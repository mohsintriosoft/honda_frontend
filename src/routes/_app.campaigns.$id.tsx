import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";

import { PageHeader } from "@/components/layout/AppShell";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/data/StatusBadge";
import { MetricTile } from "@/components/data/KpiCard";

import { Pause, Play, XCircle, RefreshCcw, Save } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { formatCurrency, formatDate, formatRelative } from "@/lib/format";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import {
  get_campaign_detail,
  patch_campaign,
  campaign_pause,
  campaign_pause_clear,
  campaign_resume,
  get_recordings,
  get_branches,
  get_segment_detail,
  patch_segment,
  server_get_data,
  server_post_data,
  server_patch_data,
} from "@/components/ServiceConnection/serviceconnection";

// Weekday encoding used by Campaign.call_days (docs §5.4 / model help
// text: "[0,1,2,3,4,5] = Mon-Sat"). 0=Monday…6=Sunday — NOT JS Date's
// 0=Sunday, so this mapping matters.
const DAYS = [
  { value: 0, label: "Mon" },
  { value: 1, label: "Tue" },
  { value: 2, label: "Wed" },
  { value: 3, label: "Thu" },
  { value: 4, label: "Fri" },
  { value: 5, label: "Sat" },
  { value: 6, label: "Sun" },
];

/* -------------------------------------------------------------------------- */
/* Types — mirrors views_admin.campaign_detail() (docs §19.6, §11.6/§11.9)    */
/* -------------------------------------------------------------------------- */

interface CampaignTotals {
  customers: number;
  completed: number;
  connected: number;
  interested: number;
  booked: number;
  callback: number;
  failed: number;
  escalated: number;
  revenue: number;
}

interface CampaignBatch {
  id: number;
  period: string | null;
  is_current: boolean;
  totals: CampaignTotals;
  conversion_rate: number;
}

interface CampaignLifetime {
  total_called: number;
  total_connected: number;
  total_booked: number;
  revenue: number;
}

interface BranchOption {
  id: number;
  name: string;
}

interface ApiCampaign {
  id: number;
  name: string;
  // NOTE: segment and agent are wired once at setup and are permanent
  // (docs §11.1/§11.6) — this page never edits them, only links out to
  // where they ARE editable (their own detail pages).
  segment: { id: number; name: string } | null;
  agent: { id: number; persona_name: string; agent_name?: string } | null;
  // 🔥 NEW — docs §11.5 "Targeting": NULL = whole dealer, set = restricted
  // to one branch's customers. Was missing from this page entirely.
  branch: BranchOption | null;
  channel: string[];
  is_active: boolean;
  status: "live" | "paused" | "draft";
  daily_call_limit: number;
  min_daily_calls: number;
  // 🔥 NEW — docs §11.5 "Operational controls". Previously only
  // daily_call_limit/call_start_time/call_end_time/call_days were
  // surfaced here even though the model (and the doc's own field
  // table) defines these alongside them.
  max_attempts: number;
  retry_gap_days: number;
  priority: number;
  // 🔥 NEW — docs §11.5 "Content": appended to the agent's system_prompt
  // for this campaign only (e.g. Missed Service's "customer aaya nahi
  // tha, politely wajah puchho"). The old `opening_line: string` field
  // that used to sit here doesn't exist on Campaign in the current
  // schema — that setting lives on Segment now (see
  // serviceconnection.js's note on the redesign) and is edited from
  // the segment's own page, which this page now links to.
  extra_prompt: string;
  call_start_time: string | null;
  call_end_time: string | null;
  call_days: number[];
  current_batch: CampaignBatch | null;
  totals: CampaignTotals;
  lifetime: CampaignLifetime;
  created_at: string | null;
}

interface RecentCall {
  id: number;
  session_id: string;
  customer: { name: string; phone_number: string } | null;
  final_intent_code: string | null;
  status: string;
  accuracy: number | null;
  duration_seconds: number | null;
  started_at: string | null;
}

// Mirrors _serialize_segment()'s fields — only the ones this page actually
// shows (calling window + description). Fetched separately from
// get_campaign_detail(), which only carries the brief {id, name}.
interface SegmentDetail {
  id: number;
  description: string | null;
  match_service_type: string | null;
  days_before: number;
  days_after: number;
}

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

// 🔥 No edit-segment/edit-agent or delete actions here either — a
// campaign's segment and agent are wired once at setup and are
// permanent (docs §11.1/§11.6). This page only lets you toggle it and
// tune the operational controls listed in §11.5.
export default function CampaignDetailPage() {
  const { id } = useParams();

  const [campaign, setCampaign] = useState<ApiCampaign | null>(null);
  const [history, setHistory] = useState<CampaignBatch[]>([]);
  const [calls, setCalls] = useState<RecentCall[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [segmentDetail, setSegmentDetail] = useState<SegmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [actionPending, setActionPending] = useState(false);

  // Editable operational controls (docs §11.5 — Targeting.branch,
  // Content.extra_prompt, and every field under "Operational controls":
  // daily_call_limit, min_daily_calls, call_start_time, call_end_time,
  // call_days, max_attempts, retry_gap_days, priority). Kept as separate
  // local state from `campaign` so typing doesn't fight with the loaded
  // data, and so we can tell the user their edits are unsaved.
  const [form, setForm] = useState({
    daily_call_limit: 0,
    min_daily_calls: 0,
    call_start_time: "10:00",
    call_end_time: "18:00",
    call_days: [] as number[],
    max_attempts: 3,
    retry_gap_days: 2,
    priority: 50,
    extra_prompt: "",
    branch_id: "" as number | "",
  });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Segment's calling window — lives on a separate resource (PATCH
  // /api/segments/{id}/) but is saved by the same "Save" button as the
  // campaign fields below (see saveSettings).
  const [segmentForm, setSegmentForm] = useState({
    days_before: 7,
    days_after: 30,
  });
  const [segmentDirty, setSegmentDirty] = useState(false);

  const load = () => {
    if (!id) return;
    setLoading(true);

    server_get_data(get_campaign_detail(id))
      .then((res) => {
        const loaded: ApiCampaign | null = res?.campaign ?? null;
        setCampaign(loaded);
        setHistory(res?.history ?? []);

        if (loaded) {
          setForm({
            daily_call_limit: loaded.daily_call_limit,
            min_daily_calls: loaded.min_daily_calls ?? 0,
            call_start_time: loaded.call_start_time ?? "10:00",
            call_end_time: loaded.call_end_time ?? "18:00",
            call_days: loaded.call_days ?? [],
            max_attempts: loaded.max_attempts ?? 3,
            retry_gap_days: loaded.retry_gap_days ?? 2,
            priority: loaded.priority ?? 50,
            extra_prompt: loaded.extra_prompt ?? "",
            branch_id: loaded.branch?.id ?? "",
          });
          setDirty(false);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));

    server_get_data(get_recordings, { campaign: id, page_size: 10 })
      .then((res) => setCalls(res?.results ?? res?.data ?? []))
      .catch(() => setCalls([]));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Branch options for the targeting select — independent of `id`, so
  // this only needs to run once regardless of which campaign is open.
  useEffect(() => {
    server_get_data(get_branches)
      .then((res) => setBranches(res?.branches ?? res?.results ?? res?.data ?? []))
      .catch(() => setBranches([]));
  }, []);

  // get_campaign_detail only carries the segment's {id, name} — the
  // calling window (days_before/days_after) lives on the segment's own
  // record, fetched separately here.
  useEffect(() => {
    const segmentId = campaign?.segment?.id;
    if (!segmentId) {
      setSegmentDetail(null);
      return;
    }
    server_get_data(get_segment_detail(segmentId))
      .then((res) => {
        const detail: SegmentDetail | null = res?.segment ?? null;
        setSegmentDetail(detail);
        if (detail) {
          setSegmentForm({
            days_before: detail.days_before,
            days_after: detail.days_after,
          });
          setSegmentDirty(false);
        }
      })
      .catch(() => setSegmentDetail(null));
  }, [campaign?.segment?.id]);

  const updateSegmentForm = (patch: Partial<typeof segmentForm>) => {
    setSegmentForm((prev) => ({ ...prev, ...patch }));
    setSegmentDirty(true);
    setSaved(false);
  };

  const updateForm = (patch: Partial<typeof form>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setDirty(true);
    setSaved(false);
  };

  const toggleDay = (value: number) => {
    updateForm({
      call_days: form.call_days.includes(value)
        ? form.call_days.filter((d) => d !== value)
        : [...form.call_days, value].sort((a, b) => a - b),
    });
  };

  const saveSettings = () => {
    if (!id) return;
    setSaving(true);
    setSaveError(null);

    const requests: Promise<unknown>[] = [
      server_patch_data(patch_campaign(id), {
        daily_call_limit: form.daily_call_limit,
        min_daily_calls: form.min_daily_calls,
        call_start_time: form.call_start_time,
        call_end_time: form.call_end_time,
        call_days: form.call_days,
        max_attempts: form.max_attempts,
        retry_gap_days: form.retry_gap_days,
        priority: form.priority,
        extra_prompt: form.extra_prompt,
        // NULL = whole dealer (docs §11.5) — the select uses "" for that.
        branch_id: form.branch_id === "" ? null : form.branch_id,
      }),
    ];

    // Calling window lives on the Segment, a separate resource — only
    // PATCH it if it's actually the thing that changed.
    if (segmentDirty && segmentDetail) {
      requests.push(
        server_patch_data(patch_segment(segmentDetail.id), {
          days_before: segmentForm.days_before,
          days_after: segmentForm.days_after,
        }).then((res) => {
          if (res?.segment) setSegmentDetail(res.segment);
          setSegmentDirty(false);
        })
      );
    }

    Promise.all(requests)
      .then(() => {
        setDirty(false);
        setSaved(true);
        load();
      })
      .catch(() => setSaveError("Couldn't save — check the values and try again."))
      .finally(() => setSaving(false));
  };

  if (notFound) {
    return <Navigate to="/campaigns" replace />;
  }

  if (loading || !campaign) {
    return (
      <>
        <PageHeader title="Campaign" breadcrumbs={[{ label: "Campaigns", to: "/campaigns" }]} />
        <div className="p-8 text-sm text-muted-foreground text-center">Loading campaign…</div>
      </>
    );
  }

  const c = campaign;

  const runAction = (action: (campaignId: string) => Promise<unknown>) => {
    if (!id) return;
    setActionPending(true);
    action(id)
      .then(() => load())
      .finally(() => setActionPending(false));
  };

  const funnel = [
    { stage: "Customers", value: c.totals.customers },
    { stage: "Completed", value: c.totals.completed },
    { stage: "Connected", value: c.totals.connected },
    { stage: "Interested", value: c.totals.interested },
    { stage: "Booked", value: c.totals.booked },
  ];

  return (
    <>
      <PageHeader
        title={c.name}
        breadcrumbs={[
          { label: "Campaigns", to: "/campaigns" },
          { label: c.name },
        ]}
        actions={
          <>
            {c.is_active ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={actionPending}
                  onClick={() => runAction((cid) => server_post_data(campaign_pause(cid)))}
                >
                  <Pause className="size-4" />
                  Pause
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  disabled={actionPending}
                  onClick={() => runAction((cid) => server_post_data(campaign_pause_clear(cid)))}
                >
                  <XCircle className="size-4" />
                  Pause &amp; clear queue
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled={actionPending}
                onClick={() => runAction((cid) => server_post_data(campaign_resume(cid)))}
              >
                <Play className="size-4" />
                Resume
              </Button>
            )}

            <Button variant="ghost" size="icon" onClick={load} disabled={actionPending}>
              <RefreshCcw className="size-4" />
            </Button>
          </>
        }
      />

      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        {/* Campaign info */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
          <StatusBadge status={c.status} />

          <span>•</span>

          <span>{c.agent?.persona_name ?? c.agent?.agent_name ?? "No agent"}</span>

          <span>•</span>

          <span className="font-mono text-xs">
            {c.segment?.name ?? "—"} • limit {c.daily_call_limit}/day
          </span>

          <span>•</span>

          <span>{c.branch ? c.branch.name : "All branches"}</span>

          {c.call_start_time && c.call_end_time && (
            <>
              <span>•</span>
              <span>
                Calling {c.call_start_time}–{c.call_end_time}
              </span>
            </>
          )}
        </div>

        {/* Metrics — this month, from the current CampaignBatch (docs §11.6) */}
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            This month
          </div>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-8">
            <MetricTile label="Total" value={c.totals.customers} />

            <MetricTile label="Completed" value={c.totals.completed} />

            <MetricTile label="Connected" value={c.totals.connected} tone="info" />

            <MetricTile label="Interested" value={c.totals.interested} tone="success" />

            <MetricTile label="Booked" value={c.totals.booked} tone="ai" />

            <MetricTile label="Callback" value={c.totals.callback} tone="warning" />

            <MetricTile label="Failed" value={c.totals.failed} tone="destructive" />

            <MetricTile label="Revenue" value={formatCurrency(c.totals.revenue)} />
          </div>
        </div>

        {/* Metrics — lifetime, straight off the Campaign model's own stat
            fields (total_called / total_connected / total_booked / revenue —
            docs §11.5 "Lifetime stats"), separate from the per-month batch
            numbers above. */}
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Lifetime
          </div>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            <MetricTile label="Called" value={c.lifetime.total_called} />

            <MetricTile label="Connected" value={c.lifetime.total_connected} tone="info" />

            <MetricTile label="Booked" value={c.lifetime.total_booked} tone="ai" />

            <MetricTile label="Revenue" value={formatCurrency(c.lifetime.revenue)} />
          </div>
        </div>

        {/* Funnel + opening line */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base font-display">Conversion funnel</CardTitle>
            </CardHeader>

            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnel} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />

                    <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />

                    <YAxis
                      type="category"
                      dataKey="stage"
                      tick={{ fontSize: 12 }}
                      stroke="var(--muted-foreground)"
                      width={90}
                    />

                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />

                    <Bar dataKey="value" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Linked configuration — a campaign is just "who" (segment) +
            "how" (agent) + operational controls (docs §11.1). Opening
            line/closing line, description and the knowledge base still
            live entirely on the Segment page (linked out below); the
            segment's calling window is edited from the "Targeting,
            schedule & limits" card below instead, since it's an
            operational control in the same spirit as call_days/timing.
            Persona/voice/system prompt live on the Agent (also linked
            out). */}
        {/* <Card>
          <CardHeader>
            <CardTitle className="text-base font-display">Linked configuration</CardTitle>
          </CardHeader>

          <CardContent className="grid gap-3 md:grid-cols-2">
            <Link
              to={c.segment ? `/segments/${c.segment.id}` : "/segments"}
              className="flex items-center justify-between rounded-md border p-3 text-sm hover:border-primary/40 transition-colors"
            >
              <span>
                <span className="text-muted-foreground">Segment</span>
                <br />
                <span className="font-medium">{c.segment?.name ?? "—"}</span>
              </span>
              <span className="text-xs text-muted-foreground">
                Opening line, closing line &amp; description →
              </span>
            </Link>

            <Link
              to={c.agent ? `/agents/${c.agent.id}` : "/agents"}
              className="flex items-center justify-between rounded-md border p-3 text-sm hover:border-primary/40 transition-colors"
            >
              <span>
                <span className="text-muted-foreground">Agent</span>
                <br />
                <span className="font-medium">
                  {c.agent?.persona_name ?? c.agent?.agent_name ?? "—"}
                </span>
              </span>
              <span className="text-xs text-muted-foreground">Persona, voice &amp; prompt →</span>
            </Link>
          </CardContent>
        </Card> */}

        {/* Editable operational controls — every field docs §11.5 lists
            under Targeting.branch, Content.extra_prompt and "Operational
            controls", not just daily_call_limit/timing/days. Also includes
            the segment's calling window (days_before/days_after) even
            though that's a different resource (PATCH /api/segments/{id}/,
            not /campaigns/{id}/) — saveSettings fires both PATCHes
            together behind the one Save button. */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base font-display">Targeting, schedule &amp; limits</CardTitle>

            <div className="flex items-center gap-2">
              {saved && !dirty && !segmentDirty && (
                <span className="text-xs text-emerald-500">Saved</span>
              )}
              {saveError && <span className="text-xs text-destructive">{saveError}</span>}

              <Button
                size="sm"
                onClick={saveSettings}
                disabled={(!dirty && !segmentDirty) || saving}
              >
                <Save className="size-4" />
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </CardHeader>

          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Branch</Label>
              <select
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
                value={form.branch_id === "" ? "" : String(form.branch_id)}
                onChange={(e) =>
                  updateForm({
                    branch_id: e.target.value === "" ? "" : Number(e.target.value),
                  })
                }
              >
                <option value="">All branches (dealer-wide)</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                Leave as "All branches" for a dealer-wide campaign, or restrict it to one branch's
                customers.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Daily call limit</Label>
                <Input
                  type="number"
                  min={0}
                  className="mt-1"
                  value={form.daily_call_limit}
                  onChange={(e) => updateForm({ daily_call_limit: Number(e.target.value) })}
                />
              </div>

            </div>
            {/* <p className="text-xs text-muted-foreground -mt-2 md:col-start-2">
              Max CallTasks created per night, and a floor so a smaller segment isn't starved. Every
              active campaign's limit is validated against the dealer's daily call budget (a
              warning, not a hard block).
            </p> */}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Call start time</Label>
                <Input
                  type="time"
                  className="mt-1"
                  value={form.call_start_time}
                  onChange={(e) => updateForm({ call_start_time: e.target.value })}
                />
              </div>

              <div>
                <Label>Call end time</Label>
                <Input
                  type="time"
                  className="mt-1"
                  value={form.call_end_time}
                  onChange={(e) => updateForm({ call_end_time: e.target.value })}
                />
              </div>
            </div>

            {/* <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Priority</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  className="mt-1"
                  value={form.priority}
                  onChange={(e) => updateForm({ priority: Number(e.target.value) })}
                />
              </div>

              <div>
                <Label>Max attempts</Label>
                <Input
                  type="number"
                  min={1}
                  className="mt-1"
                  value={form.max_attempts}
                  onChange={(e) => updateForm({ max_attempts: Number(e.target.value) })}
                />
              </div>

              <div>
                <Label>Retry gap (days)</Label>
                <Input
                  type="number"
                  min={0}
                  className="mt-1"
                  value={form.retry_gap_days}
                  onChange={(e) => updateForm({ retry_gap_days: Number(e.target.value) })}
                />
              </div>
            </div> */}

            {/* <p className="text-xs text-muted-foreground md:col-start-2 -mt-2">
              Dial order when tasks compete (0–100), how many attempts before a task is exhausted,
              and how many days between attempts.
            </p> */}

            <div className="md:col-span-2">
              <Label>Call days</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {DAYS.map((day) => {
                  const active = form.call_days.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleDay(day.value)}
                      className={`px-3 py-1.5 rounded-md text-xs border transition-colors ${active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "text-muted-foreground hover:bg-accent"
                        }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                No days selected means the campaign calls every day of the week.
              </p>
            </div>

            {segmentDetail && (
              <div className="md:col-span-2">
                <Label>Calling window</Label>
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-muted-foreground">Call starts</span>
                  <Input
                    type="number"
                    min={0}
                    className="w-20"
                    value={segmentForm.days_before}
                    onChange={(e) =>
                      updateSegmentForm({ days_before: Number(e.target.value) })
                    }
                  />
                  <span className="text-sm text-muted-foreground">
                    days before, tries until
                  </span>
                  <Input
                    type="number"
                    min={0}
                    className="w-20"
                    value={segmentForm.days_after}
                    onChange={(e) =>
                      updateSegmentForm({ days_after: Number(e.target.value) })
                    }
                  />
                  <span className="text-sm text-muted-foreground">days after the due date</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Lives on the segment ({c.segment?.name}), not the campaign — changing it
                  affects every campaign using this segment.
                </p>
              </div>
            )}

            {/* <div className="md:col-span-2">
              <Label>Prompt override</Label>
              <Textarea
                className="mt-1"
                rows={3}
                placeholder="Appended to the agent's system prompt for this campaign only, e.g. 'customer didn't show up, politely ask why.'"
                value={form.extra_prompt}
                onChange={(e) => updateForm({ extra_prompt: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Optional. Joins onto the linked agent's system prompt — leave blank to use the
                agent's prompt as-is.
              </p>
            </div> */}
          </CardContent>
        </Card>

        {/* Batch history — docs §11.6/§11.9 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-display">History</CardTitle>
          </CardHeader>

          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Customers</TableHead>
                  <TableHead>Called</TableHead>
                  <TableHead>Connected</TableHead>
                  <TableHead>Booked</TableHead>
                  <TableHead>Conv</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {history.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">
                      No batches yet — nothing has been imported for this campaign.
                    </TableCell>
                  </TableRow>
                )}

                {history.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="text-sm">
                      {b.period ? formatDate(b.period) : "—"}
                      {b.is_current && (
                        <span className="ml-2 text-[10px] uppercase text-primary">current</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">{b.totals.customers}</TableCell>
                    <TableCell className="text-sm tabular-nums">{b.totals.completed}</TableCell>
                    <TableCell className="text-sm tabular-nums">{b.totals.connected}</TableCell>
                    <TableCell className="text-sm tabular-nums">{b.totals.booked}</TableCell>
                    <TableCell className="text-sm tabular-nums">{b.conversion_rate}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Recent Calls */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base font-display">Recent calls</CardTitle>

            <Button variant="ghost" size="sm" asChild>
              <Link to="/voice">View live monitor</Link>
            </Button>
          </CardHeader>

          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Accuracy</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Started</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {calls.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">
                      No calls placed for this campaign yet.
                    </TableCell>
                  </TableRow>
                )}

                {calls.map((call) => (
                  <TableRow key={call.id}>
                    <TableCell>
                      <Link
                        to={`/voice/${call.id}`}
                        className="text-sm font-medium hover:text-primary"
                      >
                        {call.customer?.name ?? call.customer?.phone_number ?? "Unknown"}
                      </Link>
                    </TableCell>

                    <TableCell>
                      {call.final_intent_code ? (
                        <StatusBadge status={call.final_intent_code} />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    <TableCell className="text-xs text-muted-foreground">{call.status}</TableCell>

                    <TableCell>
                      {call.accuracy != null ? (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-[color:var(--ai)]"
                              style={{ width: `${Math.round(call.accuracy)}%` }}
                            />
                          </div>
                          <span className="text-xs tabular-nums">{Math.round(call.accuracy)}%</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    <TableCell className="text-xs tabular-nums">
                      {call.duration_seconds != null
                        ? `${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s`
                        : "—"}
                    </TableCell>

                    <TableCell className="text-xs text-muted-foreground">
                      {call.started_at ? formatRelative(call.started_at) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
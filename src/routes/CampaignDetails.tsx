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
  server_get_data,
  server_post_data,
  server_patch_data,
} from "@/components/ServiceConnection/serviceconnection";
import { hasPerm } from "@/lib/permissions";

// Campaign.call_days: 0=Monday…6=Sunday (NOT JS Date's 0=Sunday).
const DAYS = [
  { value: 0, label: "Mon" },
  { value: 1, label: "Tue" },
  { value: 2, label: "Wed" },
  { value: 3, label: "Thu" },
  { value: 4, label: "Fri" },
  { value: 5, label: "Sat" },
  { value: 6, label: "Sun" },
];

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
  segment: { id: number; name: string } | null;
  agent: { id: number; persona_name: string; agent_name?: string } | null;
  branch: BranchOption | null;
  channel: string[];
  is_active: boolean;
  status: "live" | "paused" | "draft";
  daily_call_limit: number;
  min_daily_calls: number;
  max_attempts: number;
  retry_gap_days: number;
  priority: number;
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

interface SegmentDetail {
  id: number;
  description: string | null;
  match_service_type: string | null;
  days_before: number;
  days_after: number;
}

function apiErrorMessage(err: any, fallback: string) {
  if (err?.response?.status === 403) return "You don't have permission to do this.";
  return err?.response?.data?.error ?? fallback;
}

export default function CampaignDetailPage() {
  const { id } = useParams();
  const canEdit = hasPerm("campaigns.edit");
  const canViewCalls = hasPerm("calls.view");

  const [campaign, setCampaign] = useState<ApiCampaign | null>(null);
  const [history, setHistory] = useState<CampaignBatch[]>([]);
  const [calls, setCalls] = useState<RecentCall[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [segmentDetail, setSegmentDetail] = useState<SegmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

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

  const [segmentForm, setSegmentForm] = useState({
    days_before: 7,
    days_after: 30,
  });
  const [segmentDirty, setSegmentDirty] = useState(false);

  const load = () => {
    if (!id) return;
    setLoading(true);
    setLoadError(null);

    server_get_data(get_campaign_detail(id))
      .then((res) => {
        const loaded: ApiCampaign | null = res?.campaign ?? null;
        if (!loaded) {
          setNotFound(true);
          return;
        }
        setCampaign(loaded);
        setHistory(res?.history ?? []);
        setForm({
          daily_call_limit: loaded.daily_call_limit ?? 0,
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
      })
      .catch((err) => {
        if (err?.response?.status === 404) setNotFound(true);
        else setLoadError(apiErrorMessage(err, "Couldn't load this campaign. Try again."));
      })
      .finally(() => setLoading(false));

    if (canViewCalls) {
      server_get_data(get_recordings, { campaign: id, page_size: 10 })
        .then((res) => setCalls(res?.results ?? []))
        .catch(() => setCalls([]));
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    server_get_data(get_branches)
      .then((res) => setBranches(res?.branches ?? []))
      .catch(() => setBranches([]));
  }, []);

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
            days_before: detail.days_before ?? 0,
            days_after: detail.days_after ?? 0,
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

  const validate = (): string | null => {
    if (!Number.isFinite(form.daily_call_limit) || form.daily_call_limit < 0) {
      return "Daily call limit can't be negative.";
    }
    if (
      !form.call_start_time ||
      !form.call_end_time ||
      form.call_end_time <= form.call_start_time
    ) {
      return "Call end time must be after call start time.";
    }
    if (
      segmentDirty &&
      (!Number.isFinite(segmentForm.days_before) ||
        segmentForm.days_before < 0 ||
        !Number.isFinite(segmentForm.days_after) ||
        segmentForm.days_after < 0)
    ) {
      return "Calling window days can't be negative.";
    }
    return null;
  };

  // One PATCH for everything -- the backend writes the segment's calling
  // window in the same transaction, under the campaign permission.
  const saveSettings = () => {
    if (!id) return;

    const validationError = validate();
    if (validationError) {
      setSaveError(validationError);
      return;
    }

    setSaving(true);
    setSaveError(null);

    const payload: Record<string, unknown> = {
      daily_call_limit: form.daily_call_limit,
      min_daily_calls: form.min_daily_calls,
      call_start_time: form.call_start_time,
      call_end_time: form.call_end_time,
      call_days: form.call_days,
      max_attempts: form.max_attempts,
      retry_gap_days: form.retry_gap_days,
      priority: form.priority,
      extra_prompt: form.extra_prompt,
      branch_id: form.branch_id === "" ? null : form.branch_id,
    };
    if (segmentDirty) {
      payload.days_before = segmentForm.days_before;
      payload.days_after = segmentForm.days_after;
    }

    server_patch_data(patch_campaign(id), payload)
      .then((res) => {
        if (res?.success === false) throw { response: { data: res } };
        if (res?.segment_window && segmentDetail) {
          setSegmentDetail({ ...segmentDetail, ...res.segment_window });
        }
        setDirty(false);
        setSegmentDirty(false);
        setSaved(true);
        load();
      })
      .catch((err) =>
        setSaveError(apiErrorMessage(err, "Couldn't save — check the values and try again.")),
      )
      .finally(() => setSaving(false));
  };

  if (notFound) {
    return <Navigate to="/campaigns" replace />;
  }

  if (loadError && !campaign) {
    return (
      <>
        <PageHeader title="Campaign" breadcrumbs={[{ label: "Campaigns", to: "/campaigns" }]} />
        <div className="p-8 text-center space-y-3">
          <p className="text-sm text-destructive">{loadError}</p>
          <Button variant="outline" size="sm" onClick={load}>
            Retry
          </Button>
        </div>
      </>
    );
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
  const totals = c.totals ?? ({} as CampaignTotals);
  const lifetime = c.lifetime ?? ({} as CampaignLifetime);

  const runAction = (action: (campaignId: string) => Promise<any>, label: string) => {
    if (!id) return;
    setActionPending(true);
    setActionError(null);
    action(id)
      .then((res) => {
        if (res?.success === false) throw { response: { data: res } };
        load();
      })
      .catch((err) => setActionError(apiErrorMessage(err, `Couldn't ${label}. Try again.`)))
      .finally(() => setActionPending(false));
  };

  const funnel = [
    { stage: "Customers", value: totals.customers ?? 0 },
    { stage: "Completed", value: totals.completed ?? 0 },
    { stage: "Connected", value: totals.connected ?? 0 },
    { stage: "Interested", value: totals.interested ?? 0 },
    { stage: "Booked", value: totals.booked ?? 0 },
  ];

  return (
    <>
      <PageHeader
        title={c.name}
        breadcrumbs={[{ label: "Campaigns", to: "/campaigns" }, { label: c.name }]}
        actions={
          <>
            {canEdit && (c.is_active ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={actionPending}
                  onClick={() => runAction((cid) => server_post_data(campaign_pause(cid)), "pause")}
                >
                  <Pause className="size-4" />
                  Pause
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  disabled={actionPending}
                  onClick={() =>
                    runAction(
                      (cid) => server_post_data(campaign_pause_clear(cid)),
                      "pause and clear the queue",
                    )
                  }
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
                onClick={() => runAction((cid) => server_post_data(campaign_resume(cid)), "resume")}
              >
                <Play className="size-4" />
                Resume
              </Button>
            ))}

            <Button variant="ghost" size="icon" onClick={load} disabled={actionPending}>
              <RefreshCcw className="size-4" />
            </Button>
          </>
        }
      />

      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        {actionError && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {actionError}
          </div>
        )}

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

        {/* This month */}
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            This month
          </div>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-8">
            <MetricTile label="Total" value={totals.customers ?? 0} />
            <MetricTile label="Completed" value={totals.completed ?? 0} />
            <MetricTile label="Connected" value={totals.connected ?? 0} tone="info" />
            <MetricTile label="Interested" value={totals.interested ?? 0} tone="success" />
            <MetricTile label="Booked" value={totals.booked ?? 0} tone="ai" />
            <MetricTile label="Callback" value={totals.callback ?? 0} tone="warning" />
            <MetricTile label="Failed" value={totals.failed ?? 0} tone="destructive" />
            <MetricTile label="Revenue" value={formatCurrency(totals.revenue ?? 0)} />
          </div>
        </div>

        {/* Lifetime */}
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Lifetime
          </div>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            <MetricTile label="Called" value={lifetime.total_called ?? 0} />
            <MetricTile label="Connected" value={lifetime.total_connected ?? 0} tone="info" />
            <MetricTile label="Booked" value={lifetime.total_booked ?? 0} tone="ai" />
            <MetricTile label="Revenue" value={formatCurrency(lifetime.revenue ?? 0)} />
          </div>
        </div>

        {/* Funnel */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base font-display">Conversion funnel</CardTitle>
            </CardHeader>

            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnel} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                      horizontal={false}
                    />
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

        {/* Targeting, schedule & limits */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base font-display">
              Targeting, schedule &amp; limits
            </CardTitle>

            <div className="flex items-center gap-2">
              {saved && !dirty && !segmentDirty && (
                <span className="text-xs text-emerald-500">Saved</span>
              )}
              {saveError && <span className="text-xs text-destructive">{saveError}</span>}

              {canEdit && (
                <Button
                  size="sm"
                  onClick={saveSettings}
                  disabled={(!dirty && !segmentDirty) || saving}
                >
                  <Save className="size-4" />
                  {saving ? "Saving…" : "Save"}
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="grid gap-4 md:grid-cols-2">
            <fieldset disabled={!canEdit} className="contents">
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
                      className={`px-3 py-1.5 rounded-md text-xs border transition-colors ${
                        active
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
                    onChange={(e) => updateSegmentForm({ days_before: Number(e.target.value) })}
                  />
                  <span className="text-sm text-muted-foreground">days before, tries until</span>
                  <Input
                    type="number"
                    min={0}
                    className="w-20"
                    value={segmentForm.days_after}
                    onChange={(e) => updateSegmentForm({ days_after: Number(e.target.value) })}
                  />
                  <span className="text-sm text-muted-foreground">days after the due date</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Lives on the segment ({c.segment?.name}), not the campaign — changing it affects
                  every campaign using this segment.
                </p>
              </div>
            )}
            </fieldset>
          </CardContent>
        </Card>

        {/* History */}
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
                    <TableCell
                      colSpan={6}
                      className="text-center text-sm text-muted-foreground py-6"
                    >
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
                    <TableCell className="text-sm tabular-nums">
                      {b.totals?.customers ?? 0}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {b.totals?.completed ?? 0}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {b.totals?.connected ?? 0}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">{b.totals?.booked ?? 0}</TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {b.conversion_rate ?? 0}%
                    </TableCell>
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
                    <TableCell
                      colSpan={6}
                      className="text-center text-sm text-muted-foreground py-6"
                    >
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

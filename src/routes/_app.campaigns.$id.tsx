import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";

import { PageHeader } from "@/components/layout/AppShell";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface ApiCampaign {
  id: number;
  name: string;
  segment: { id: number; name: string } | null;
  agent: { id: number; persona_name: string; agent_name?: string } | null;
  channel: string[];
  is_active: boolean;
  status: "live" | "paused" | "draft";
  opening_line: string;
  daily_call_limit: number;
  min_daily_calls: number;
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
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [actionPending, setActionPending] = useState(false);

  // Editable schedule/limit fields (docs §11.5). Kept as separate local
  // state from `campaign` so typing doesn't fight with the loaded data,
  // and so we can tell the user their edits are unsaved.
  const [form, setForm] = useState({
    daily_call_limit: 0,
    call_start_time: "10:00",
    call_end_time: "18:00",
    call_days: [] as number[],
  });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

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
            call_start_time: loaded.call_start_time ?? "10:00",
            call_end_time: loaded.call_end_time ?? "18:00",
            call_days: loaded.call_days ?? [],
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

    server_patch_data(patch_campaign(id), {
      daily_call_limit: form.daily_call_limit,
      call_start_time: form.call_start_time,
      call_end_time: form.call_end_time,
      call_days: form.call_days,
    })
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

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-display">Opening line</CardTitle>
            </CardHeader>

            <CardContent className="space-y-3 text-sm">
              <div className="rounded-md border bg-card p-3 whitespace-pre-wrap font-mono text-xs">
                {c.opening_line || "Falls through to the agent's default opening line."}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Editable schedule & limits (docs §11.5) */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base font-display">Schedule &amp; limits</CardTitle>

            <div className="flex items-center gap-2">
              {saved && !dirty && (
                <span className="text-xs text-emerald-500">Saved</span>
              )}
              {saveError && <span className="text-xs text-destructive">{saveError}</span>}

              <Button size="sm" onClick={saveSettings} disabled={!dirty || saving}>
                <Save className="size-4" />
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </CardHeader>

          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Daily call limit</Label>
              <Input
                type="number"
                min={0}
                className="mt-1"
                value={form.daily_call_limit}
                onChange={(e) => updateForm({ daily_call_limit: Number(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Max CallTasks created per night for this campaign. Every active campaign's limit is
                validated against the dealer's daily call budget (a warning, not a hard block).
              </p>
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
                        to={`/voice/${call.session_id}`}
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
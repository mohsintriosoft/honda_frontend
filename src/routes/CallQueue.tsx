import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ListChecks,
  Loader2,
  PhoneCall,
  PhoneForwarded,
  PhoneOff,
  RefreshCw,
  Search,
  ShieldAlert,
  Undo2,
  UserMinus,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { KpiCard } from "@/components/data/KpiCard";
import { StatusBadge } from "@/components/data/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  server_get_data,
  server_post_json,
  get_call_queue,
  post_call_queue_remove,
  post_call_queue_restore,
} from "@/components/ServiceConnection/serviceconnection";

type QueueState =
  | "queued"
  | "projected"
  | "retry"
  | "callback"
  | "in_call"
  | "called"
  | "removed";

type QueueRow = {
  key: string;
  customer_id: number;
  name: string;
  phone: string;
  city: string;
  vehicle: string;
  segment: { id: number; name: string } | null;
  campaign: { id: number; name: string; status: string } | null;
  state: QueueState;
  source: string;
  eta: string | null;
  overflow: boolean;
  priority: number;
  due_date: string | null;
  attempts: number;
  max_attempts: number;
  attempts_left: number;
  can_call_more: number | null;
  total_calls: number;
  completed: number;
  dropped: number;
  declined: number;
  unanswered: number;
  month_calls: number;
  month_cap: number | null;
  month_calls_left: number | null;
  last_called_at: string | null;
  last_outcome: string;
  callback_time: string | null;
  campaign_paused: boolean;
  can_remove: boolean;
  today: {
    calls: number;
    last_status: string | null;
    last_at: string | null;
    last_intent: string;
    talk_seconds: number;
  };
  removed: { by: string | null; at: string | null; reason: string } | null;
};

type CampaignRow = {
  id: number;
  name: string;
  status: string;
  segment: string | null;
  daily_limit: number;
  max_attempts: number;
  window: { start: string; end: string; open_now: boolean; closed_for_today: boolean };
  included: boolean;
  skip_reason: string | null;
  planned: number;
  called: number;
  remaining: number;
  removed: number;
};

type Payload = {
  success: boolean;
  generated_at: string;
  date: string;
  mode: "live" | "preview";
  full_day: boolean;
  warnings: string[];
  truncated: boolean;
  summary: {
    planned: number;
    called: number;
    in_call: number;
    remaining: number;
    removed: number;
    overflow: number;
    new: number;
    retries: number;
    callbacks: number;
    projected: number;
    estimated_finish: string | null;
    avg_call_seconds: number;
    concurrency: number;
    dialed_today: number;
    connected_today: number;
    connect_rate: number | null;
    today_outcomes: { completed: number; dropped: number; declined: number; unanswered: number };
    budget: { daily_budget: number | null; dialed: number; queued_before: number; left_for_new: number | null };
    monthly_cap: number | null;
    gap_minutes: number;
  };
  campaigns: CampaignRow[];
  segments: { name: string; planned: number; called: number; remaining: number; removed: number }[];
  rows: QueueRow[];
};

const PAGE_SIZE = 50;

const STATE_META: Record<QueueState, { label: string; cls: string }> = {
  queued: { label: "Queued", cls: "bg-[color:var(--info)]/15 text-[color:var(--info)] border-[color:var(--info)]/30" },
  projected: { label: "Would be queued", cls: "bg-muted text-muted-foreground border-border" },
  retry: { label: "Retry", cls: "bg-[color:var(--warning)]/15 text-[color:var(--warning-foreground)] border-[color:var(--warning)]/30" },
  callback: { label: "Callback", cls: "bg-primary/15 text-primary border-primary/30" },
  in_call: { label: "On call", cls: "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30" },
  called: { label: "Called", cls: "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30" },
  removed: { label: "Removed today", cls: "bg-destructive/10 text-destructive border-destructive/30" },
};

const STATE_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "remaining", label: "Still to call" },
  { value: "called", label: "Called" },
  { value: "retry", label: "Retries" },
  { value: "callback", label: "Callbacks" },
  { value: "projected", label: "Would be queued" },
  { value: "removed", label: "Removed today" },
];

const REMAINING_STATES: QueueState[] = ["queued", "projected", "retry", "callback"];

function apiError(err: any, fallback: string): string {
  return err?.response?.data?.error || err?.message || fallback;
}

function clock(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function dateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function pretty(code: string): string {
  return code ? code.replace(/_/g, " ") : "";
}

function Chip({ n, label, tone }: { n: number; label: string; tone?: "good" | "bad" | "warn" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] tabular-nums",
        n === 0 && "opacity-40",
        tone === "good" && n > 0 && "border-[color:var(--success)]/30 text-[color:var(--success)]",
        tone === "bad" && n > 0 && "border-destructive/30 text-destructive",
        tone === "warn" && n > 0 && "border-[color:var(--warning)]/40 text-[color:var(--warning-foreground)]",
      )}
      title={label}
    >
      {n} {label}
    </span>
  );
}

/**
 * Today's Calls -- who gets called today, when, and what we already know about them.
 * Super admins only (settings.HEALTH_BALANCE_STAFF_IDS); the API returns 403 for anyone else.
 *
 * Works while campaigns are paused: those customers show as "Would be queued"
 * (a read-only dry run of the scheduler -- nothing is queued or dialed from here).
 * "Remove" takes a customer off TODAY's list only; they are called again next
 * time per Settings.
 */
export default function CallQueue() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullDay, setFullDay] = useState(false);

  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [segmentFilter, setSegmentFilter] = useState("all");
  const [page, setPage] = useState(1);

  const [toRemove, setToRemove] = useState<QueueRow | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(
    async (quiet = false) => {
      quiet ? setRefreshing(true) : setLoading(true);
      setError(null);
      try {
        const res = await server_get_data(get_call_queue, fullDay ? { full_day: 1 } : {});
        if (res?.success === false) throw { response: { data: res } };
        setData(res as Payload);
        setForbidden(false);
      } catch (err: any) {
        if (err?.response?.status === 403) setForbidden(true);
        else setError(apiError(err, "Couldn't load today's calls"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fullDay],
  );

  useEffect(() => {
    load();
  }, [load]);

  // keep it fresh while the page is open (calls are happening)
  useEffect(() => {
    const t = setInterval(() => load(true), 30000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [query, stateFilter, campaignFilter, segmentFilter]);

  const rows = data?.rows ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (stateFilter === "remaining") {
        if (!REMAINING_STATES.includes(r.state)) return false;
      } else if (stateFilter !== "all" && r.state !== stateFilter) return false;
      if (campaignFilter !== "all" && String(r.campaign?.id ?? "") !== campaignFilter) return false;
      if (segmentFilter !== "all" && (r.segment?.name ?? "—") !== segmentFilter) return false;
      if (q) {
        const hay = `${r.name} ${r.phone} ${r.vehicle} ${r.segment?.name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, query, stateFilter, campaignFilter, segmentFilter]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function confirmRemove() {
    if (!toRemove) return;
    const target = toRemove;
    setBusyId(target.customer_id);
    setActionError(null);
    try {
      const res = await server_post_json(post_call_queue_remove, { customer_id: target.customer_id });
      if (res?.success === false) throw { response: { data: res } };
      setToRemove(null);
      await load(true);
    } catch (err: any) {
      setActionError(apiError(err, "Couldn't remove this customer"));
      setToRemove(null);
    } finally {
      setBusyId(null);
    }
  }

  async function restore(row: QueueRow) {
    setBusyId(row.customer_id);
    setActionError(null);
    try {
      const res = await server_post_json(post_call_queue_restore, { customer_id: row.customer_id });
      if (res?.success === false) throw { response: { data: res } };
      await load(true);
    } catch (err: any) {
      setActionError(apiError(err, "Couldn't restore this customer"));
    } finally {
      setBusyId(null);
    }
  }

  if (forbidden) {
    return (
      <>
        <PageHeader title="Today's Calls" description="Who gets called today." />
        <div className="px-4 py-10 md:px-6 lg:px-8">
          <Card>
            <CardContent className="flex items-center gap-3 py-10 text-sm text-muted-foreground">
              <ShieldAlert className="size-5" /> Only super admins can open this page.
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  const s = data?.summary;
  const segmentNames = data?.segments.map((x) => x.name) ?? [];
  const progress = s && s.planned > 0 ? Math.round((s.called / s.planned) * 100) : 0;

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            Today's Calls
            {data && (
              <Badge
                variant="outline"
                className={cn(
                  data.mode === "preview" && "border-[color:var(--warning)]/50 text-[color:var(--warning-foreground)]",
                )}
              >
                {data.mode === "preview" ? "Preview — campaigns paused" : "Live"}
              </Badge>
            )}
          </span>
        }
        description="Every customer who gets a call today, the estimated time, and their call history. Removing someone only skips them today."
        actions={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch id="full-day" checked={fullDay} onCheckedChange={setFullDay} />
              <Label htmlFor="full-day" className="text-xs">
                Full-day schedule
              </Label>
            </div>
            <Button variant="outline" size="sm" onClick={() => load(true)} disabled={loading || refreshing}>
              <RefreshCw className={cn("size-4 mr-1.5", refreshing && "animate-spin")} />
              Refresh
            </Button>
          </div>
        }
      />

      <div className="px-4 py-5 md:px-6 lg:px-8 space-y-5">
        {loading && !data && (
          <div className="flex items-center gap-2 py-16 justify-center text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Building today's list…
          </div>
        )}

        {error && (
          <Card>
            <CardContent className="flex items-center gap-2 py-4 text-sm text-destructive">
              <AlertTriangle className="size-4" /> {error}
            </CardContent>
          </Card>
        )}

        {actionError && (
          <Card>
            <CardContent className="flex items-center gap-2 py-3 text-sm text-destructive">
              <AlertTriangle className="size-4" /> {actionError}
            </CardContent>
          </Card>
        )}

        {data?.warnings.map((w, i) => (
          <div
            key={i}
            className="flex items-start gap-2 rounded-lg border border-[color:var(--warning)]/40 bg-[color:var(--warning)]/10 px-3 py-2.5 text-sm"
          >
            <AlertTriangle className="size-4 mt-0.5 shrink-0" />
            <span>{w}</span>
          </div>
        ))}

        {data && s && (
          <>
            {/* ── KPIs ───────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
              <KpiCard label="Planned today" value={s.planned} icon={<ListChecks className="size-4" />} hint={`${s.new} new`} />
              <KpiCard label="Called so far" value={s.called} icon={<CheckCircle2 className="size-4" />} hint={`${progress}% done`} />
              <KpiCard label="On call now" value={s.in_call} icon={<PhoneCall className="size-4" />} hint={`${s.concurrency} lines`} />
              <KpiCard label="Still to call" value={s.remaining} icon={<Users className="size-4" />} hint={`${s.projected} not queued yet`} />
              <KpiCard label="Retries" value={s.retries} icon={<PhoneForwarded className="size-4" />} hint={`${s.callbacks} callbacks`} />
              <KpiCard label="Removed today" value={s.removed} icon={<UserMinus className="size-4" />} hint="back next time" />
              <KpiCard
                label="Connect rate"
                value={s.connect_rate === null ? "—" : `${s.connect_rate}%`}
                icon={<PhoneOff className="size-4" />}
                hint={`${s.connected_today}/${s.dialed_today} today`}
              />
              <KpiCard
                label="Est. finish"
                value={clock(s.estimated_finish)}
                icon={<Clock className="size-4" />}
                hint={`~${s.avg_call_seconds}s / call`}
              />
            </div>

            {/* ── progress + outcomes + budget ───────────────────── */}
            <div className="grid gap-4 lg:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-display">Today's progress</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <Outcome label="Completed" n={s.today_outcomes.completed} tone="good" />
                    <Outcome label="Dropped" n={s.today_outcomes.dropped} tone="bad" />
                    <Outcome label="Declined" n={s.today_outcomes.declined} tone="bad" />
                    <Outcome label="No answer" n={s.today_outcomes.unanswered} tone="warn" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-display">Limits from Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5 text-sm">
                  <Line k="Daily call budget" v={s.budget.daily_budget ?? "No limit"} />
                  <Line k="Already dialed today" v={s.budget.dialed} />
                  <Line k="Queued before new customers" v={s.budget.queued_before} />
                  <Line k="Room left for new customers" v={s.budget.left_for_new ?? "No limit"} />
                  <Line k="Max calls / customer / month" v={s.monthly_cap ?? "No cap"} />
                  <Line k="Gap before calling again" v={s.gap_minutes ? `${s.gap_minutes} min` : "default (60 min)"} />
                  <Line k="Calls past the window" v={s.overflow} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-display">By segment</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Segment</TableHead>
                        <TableHead className="text-right">Planned</TableHead>
                        <TableHead className="text-right">Called</TableHead>
                        <TableHead className="text-right">Left</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.segments.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground text-sm">
                            Nothing planned
                          </TableCell>
                        </TableRow>
                      )}
                      {data.segments.map((g) => (
                        <TableRow key={g.name}>
                          <TableCell className="font-medium">{g.name}</TableCell>
                          <TableCell className="text-right tabular-nums">{g.planned}</TableCell>
                          <TableCell className="text-right tabular-nums">{g.called}</TableCell>
                          <TableCell className="text-right tabular-nums">{g.remaining}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            {/* ── campaigns ──────────────────────────────────────── */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-display">Campaigns</CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Calling window</TableHead>
                      <TableHead className="text-right">Daily limit</TableHead>
                      <TableHead className="text-right">Max attempts</TableHead>
                      <TableHead className="text-right">Planned</TableHead>
                      <TableHead className="text-right">Called</TableHead>
                      <TableHead className="text-right">Left</TableHead>
                      <TableHead>Note</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.campaigns.map((c) => (
                      <TableRow key={c.id} className={cn(!c.included && "opacity-60")}>
                        <TableCell className="font-medium">
                          {c.name}
                          {c.segment && <div className="text-xs text-muted-foreground">{c.segment}</div>}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={c.status} />
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {c.window.start} – {c.window.end}
                          {c.window.open_now && <span className="ml-1.5 text-[color:var(--success)] text-xs">open</span>}
                          {c.window.closed_for_today && <span className="ml-1.5 text-muted-foreground text-xs">closed</span>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{c.daily_limit}</TableCell>
                        <TableCell className="text-right tabular-nums">{c.max_attempts}</TableCell>
                        <TableCell className="text-right tabular-nums">{c.planned}</TableCell>
                        <TableCell className="text-right tabular-nums">{c.called}</TableCell>
                        <TableCell className="text-right tabular-nums">{c.remaining}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{pretty(c.skip_reason ?? "")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* ── the list ───────────────────────────────────────── */}
            <Card>
              <CardHeader className="gap-3 pb-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <CardTitle className="text-base font-display">
                    Customers <span className="text-muted-foreground font-normal">({filtered.length})</span>
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                      <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Name, phone, vehicle…"
                        className="pl-8 w-56"
                      />
                    </div>
                    <Select value={stateFilter} onValueChange={setStateFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATE_FILTERS.map((f) => (
                          <SelectItem key={f.value} value={f.value}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={campaignFilter} onValueChange={setCampaignFilter}>
                      <SelectTrigger className="w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All campaigns</SelectItem>
                        {data.campaigns.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={segmentFilter} onValueChange={setSegmentFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All segments</SelectItem>
                        {segmentNames.map((n) => (
                          <SelectItem key={n} value={n}>
                            {n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {data.truncated && (
                  <p className="text-xs text-muted-foreground">
                    Showing the first {rows.length} customers. Use the filters to narrow the list.
                  </p>
                )}
              </CardHeader>

              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Call time</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Segment</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Past calls</TableHead>
                      <TableHead>Attempts</TableHead>
                      <TableHead>This month</TableHead>
                      <TableHead>Today</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                          No customers match.
                        </TableCell>
                      </TableRow>
                    )}
                    {pageRows.map((r) => {
                      const meta = STATE_META[r.state];
                      return (
                        <TableRow key={r.key} className={cn(r.state === "removed" && "opacity-60")}>
                          <TableCell className="whitespace-nowrap align-top">
                            {r.state === "called" || r.state === "in_call" ? (
                              <div>
                                <div className="font-medium tabular-nums">{clock(r.today.last_at ?? r.eta)}</div>
                                <div className="text-xs text-muted-foreground">called</div>
                              </div>
                            ) : r.overflow ? (
                              <div>
                                <div className="font-medium">Next call day</div>
                                <div className="text-xs text-muted-foreground">after window</div>
                              </div>
                            ) : r.eta ? (
                              <div>
                                <div className="font-medium tabular-nums">~{clock(r.eta)}</div>
                                <div className="text-xs text-muted-foreground">
                                  {r.callback_time ? `asked for ${r.callback_time}` : "estimated"}
                                </div>
                              </div>
                            ) : (
                              "—"
                            )}
                          </TableCell>

                          <TableCell className="align-top">
                            <div className="font-medium">{r.name || "—"}</div>
                            <div className="text-xs text-muted-foreground tabular-nums">{r.phone}</div>
                            {r.vehicle && <div className="text-xs text-muted-foreground">{r.vehicle}</div>}
                          </TableCell>

                          <TableCell className="align-top">
                            <div>{r.segment?.name ?? "—"}</div>
                            {r.campaign && (
                              <div className="text-xs text-muted-foreground">
                                {r.campaign.name}
                                {r.campaign_paused && " · paused"}
                              </div>
                            )}
                            {r.due_date && (
                              <div className="text-xs text-muted-foreground">due {r.due_date}</div>
                            )}
                          </TableCell>

                          <TableCell className="align-top">
                            <span
                              className={cn(
                                "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
                                meta.cls,
                              )}
                            >
                              {meta.label}
                            </span>
                            {r.last_outcome && r.state !== "called" && (
                              <div className="mt-1 text-xs text-muted-foreground">last: {pretty(r.last_outcome)}</div>
                            )}
                          </TableCell>

                          <TableCell className="align-top">
                            <div className="mb-1 text-sm tabular-nums">
                              {r.total_calls} call{r.total_calls === 1 ? "" : "s"}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              <Chip n={r.completed} label="completed" tone="good" />
                              <Chip n={r.dropped} label="dropped" tone="bad" />
                              <Chip n={r.declined} label="declined" tone="bad" />
                              {r.unanswered > 0 && <Chip n={r.unanswered} label="no answer" tone="warn" />}
                            </div>
                            {r.last_called_at && (
                              <div className="mt-1 text-xs text-muted-foreground">last {dateTime(r.last_called_at)}</div>
                            )}
                          </TableCell>

                          <TableCell className="align-top whitespace-nowrap">
                            <div className="tabular-nums">
                              {r.attempts} of {r.max_attempts || "—"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {r.max_attempts ? `${r.attempts_left} attempt${r.attempts_left === 1 ? "" : "s"} left` : ""}
                            </div>
                            {r.can_call_more !== null && (
                              <div className="text-xs text-muted-foreground">can call {r.can_call_more} more</div>
                            )}
                          </TableCell>

                          <TableCell className="align-top whitespace-nowrap">
                            <div className="tabular-nums">
                              {r.month_calls}
                              {r.month_cap ? ` / ${r.month_cap}` : ""}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {r.month_calls_left !== null ? `${r.month_calls_left} left` : "no cap"}
                            </div>
                          </TableCell>

                          <TableCell className="align-top">
                            {r.today.calls > 0 ? (
                              <div>
                                <div className="text-sm">
                                  {r.today.calls}× · <span className="capitalize">{pretty(r.today.last_status ?? "")}</span>
                                </div>
                                {r.today.last_intent && (
                                  <div className="text-xs text-muted-foreground">{pretty(r.today.last_intent)}</div>
                                )}
                                {r.today.talk_seconds > 0 && (
                                  <div className="text-xs text-muted-foreground">{r.today.talk_seconds}s talk</div>
                                )}
                              </div>
                            ) : r.removed ? (
                              <div className="text-xs text-muted-foreground">
                                removed {clock(r.removed.at)}
                                {r.removed.by ? ` by ${r.removed.by}` : ""}
                                {r.removed.reason ? ` — ${r.removed.reason}` : ""}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">not called yet</span>
                            )}
                          </TableCell>

                          <TableCell className="align-top text-right">
                            {r.state === "removed" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busyId === r.customer_id}
                                onClick={() => restore(r)}
                              >
                                {busyId === r.customer_id ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <Undo2 className="size-3.5 mr-1" />
                                )}
                                Restore
                              </Button>
                            ) : r.can_remove ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busyId === r.customer_id}
                                onClick={() => setToRemove(r)}
                              >
                                {busyId === r.customer_id ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <UserMinus className="size-3.5 mr-1" />
                                )}
                                Remove today
                              </Button>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {filtered.length > PAGE_SIZE && (
                  <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
                    <span className="text-muted-foreground">
                      Page {page} of {pages}
                    </span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                        <ChevronLeft className="size-4" />
                      </Button>
                      <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                        <ChevronRight className="size-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground">
              Call times are estimates: they follow the dialer's order and the lines and calling windows set in Settings
              and each campaign. Updated {dateTime(data.generated_at)}.
            </p>
          </>
        )}
      </div>

      <AlertDialog open={!!toRemove} onOpenChange={(open) => !open && setToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from today's list?</AlertDialogTitle>
            <AlertDialogDescription>
              {toRemove?.name || toRemove?.phone} won't be called today. They stay in their campaign and will be called
              next time exactly as the Settings and campaign rules say.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep on list</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove}>Remove for today</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Outcome({ label, n, tone }: { label: string; n: number; tone: "good" | "bad" | "warn" }) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={cn(
          "text-xl font-display font-semibold tabular-nums",
          tone === "good" && "text-[color:var(--success)]",
          tone === "bad" && n > 0 && "text-destructive",
        )}
      >
        {n}
      </div>
    </div>
  );
}

function Line({ k, v }: { k: string; v: string | number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium tabular-nums">{v}</span>
    </div>
  );
}

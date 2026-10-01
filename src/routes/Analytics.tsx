import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarCheck,
  Clock,
  Download,
  IndianRupee,
  Loader2,
  PhoneCall,
  PhoneIncoming,
  RefreshCw,
  Sparkles,
  Store,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { cn } from "@/lib/utils";
import { server_get_data, get_analytics } from "@/components/ServiceConnection/serviceconnection";

/* ------------------------------------------------------------------
   Types -- mirror views_analytics.analytics
------------------------------------------------------------------ */

type Kpis = {
  calls: number;
  connected: number;
  connect_rate: number | null;
  avg_duration_s: number;
  bookings: number;
  ai_bookings: number;
  conversion: number | null;
  visits: number;
  arrivals?: number;
  cost: number;
  cost_per_call: number | null;
  cost_per_connected_call: number | null;
  cost_per_booking: number | null;
};

type Workshop = {
  arrivals: number;
  after_call: number;
  without_call: number;
  report_days: number;
  first_call_on: string | null;
  baseline_days: number;
  baseline_vehicles: number;
  baseline_per_day: number | null;
  by_day: { date: string; day: string; arrivals: number; after_call: number; without_call: number }[];
};

type AnalyticsData = {
  workshop?: Workshop;
  last_call_at?: string | null;
  date_from: string;
  date_to: string;
  days: number;
  branch_id: number | null;
  branches_available: { id: number; name: string }[];
  kpis: Kpis;
  previous: Kpis;
  trend: { date: string; day: string; calls: number; connected: number; booked: number; cost: number }[];
  by_hour: { hour: number; label: string; calls: number; connected: number; connect_rate: number | null }[];
  outcomes: { code: string | null; name: string; value: number }[];
  no_outcome: number;
  campaigns: {
    id: number;
    name: string;
    status: string;
    calls: number;
    connected: number;
    connect_rate: number | null;
    booked: number;
    conversion: number | null;
    visits: number;
    cost: number;
  }[];
  branches: { id: number; name: string; calls: number; booked: number }[];
  advisors: { name: string; booked: number; completed: number; completion_rate: number | null }[];
  cost_split: { name: string; value: number }[];
};

type RangeKey = "7" | "30" | "90" | "custom";

/* ------------------------------------------------------------------
   Helpers
------------------------------------------------------------------ */

const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const OUTCOME_COLORS = [...CHART_COLORS, "var(--muted-foreground)", "var(--border)"];

const num = (n: number | null | undefined) => (n ?? 0).toLocaleString("en-IN");
const rupees = (n: number | null | undefined, digits = 0) =>
  n == null
    ? "—"
    : `₹${n.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
const pct = (n: number | null | undefined) => (n == null ? "—" : `${n}%`);

function duration(seconds: number) {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m ? `${m}m ${s}s` : `${s}s`;
}

function fmtRange(from: string, to: string) {
  const f = new Date(`${from}T00:00:00`);
  const t = new Date(`${to}T00:00:00`);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  return `${f.toLocaleDateString(undefined, opts)} – ${t.toLocaleDateString(undefined, { ...opts, year: "numeric" })}`;
}

function apiError(err: any) {
  if (err?.response?.status === 403) return "Your role does not have permission to view reports.";
  return err?.response?.data?.error || "Couldn't load analytics. Please try again.";
}

function downloadCsv(filename: string, rows: (string | number | null)[][]) {
  const escape = (v: string | number | null) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const blob = new Blob([rows.map((r) => r.map(escape).join(",")).join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
};

/* ------------------------------------------------------------------
   Pieces
------------------------------------------------------------------ */

function Delta({ now, before, lowerIsBetter = false }: { now: number | null; before: number | null; lowerIsBetter?: boolean }) {
  if (now == null || before == null || before === 0) {
    return <span className="text-[11px] text-muted-foreground">no earlier data</span>;
  }
  const change = Math.round(((now - before) / before) * 100);
  if (change === 0) return <span className="text-[11px] text-muted-foreground">same as before</span>;
  const up = change > 0;
  const good = lowerIsBetter ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[11px] font-medium",
        good ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
      )}
    >
      <Icon className="size-3" />
      {Math.abs(change)}% vs previous
    </span>
  );
}

function Kpi({
  label,
  value,
  icon,
  sub,
  delta,
  accent,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  sub?: string;
  delta: ReactNode;
  accent?: boolean;
}) {
  return (
    <Card className={cn(accent && "border-primary/40")}>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-2">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className={cn("grid size-7 place-items-center rounded-md", accent ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary")}>
            {icon}
          </div>
        </div>
        <div className="mt-1 text-2xl font-semibold font-display tabular-nums">{value}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
        <div className="mt-1.5">{delta}</div>
      </CardContent>
    </Card>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="size-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function EmptyChart({ text = "No data in this period." }: { text?: string }) {
  return <div className="grid h-[220px] place-items-center text-sm text-muted-foreground">{text}</div>;
}

/* ------------------------------------------------------------------
   Workshop arrivals (CRE daily file) -- shown even with zero calls,
   because it is the before-Aarohi baseline.
------------------------------------------------------------------ */

const WORKSHOP_WITH_CALL = "var(--chart-2)"; // green  -- came after an Aarohi call
const WORKSHOP_NO_CALL = "var(--chart-3)"; // orange -- came without an Aarohi call

function WorkshopTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as Workshop["by_day"][number];
  const share = row.arrivals ? Math.round((row.after_call * 100) / row.arrivals) : 0;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="mb-1.5 font-medium text-foreground">{label}</div>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-full" style={{ background: WORKSHOP_WITH_CALL }} />
            After an Aarohi call
          </span>
          <span className="font-semibold tabular-nums">{row.after_call}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-full" style={{ background: WORKSHOP_NO_CALL }} />
            Without an Aarohi call
          </span>
          <span className="font-semibold tabular-nums">{row.without_call}</span>
        </div>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-6 border-t pt-1.5">
        <span className="text-muted-foreground">Total arrived</span>
        <span className="font-semibold tabular-nums">
          {row.arrivals} <span className="font-normal text-muted-foreground">· {share}% after a call</span>
        </span>
      </div>
    </div>
  );
}

function WorkshopSection({ w }: { w: Workshop }) {
  const firstCall = w.first_call_on
    ? new Date(`${w.first_call_on}T00:00:00`).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
    : null;

  const withoutCall = Math.max(0, w.arrivals - w.after_call);
  const sharePct = w.arrivals ? Math.round((w.after_call * 100) / w.arrivals) : 0;
  const hideZero = (v: number) => (v > 0 ? v : "");

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-2">
        <div>
          <CardTitle className="text-base font-display">Workshop arrivals</CardTitle>
          <p className="text-xs text-muted-foreground">
            Vehicles in the CRE daily file · {w.report_days} report day{w.report_days === 1 ? "" : "s"} in this period
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <LegendDot color={WORKSHOP_WITH_CALL} label="After an Aarohi call" />
          <LegendDot color={WORKSHOP_NO_CALL} label="Without an Aarohi call" />
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          {/* Arrived */}
          <div className="rounded-xl border p-4">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Arrived</div>
              <Store className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-1 text-2xl font-semibold font-display tabular-nums">{num(w.arrivals)}</div>
            <div className="text-xs text-muted-foreground">vehicles in the period</div>
          </div>

          {/* After a call, with share of arrivals */}
          <div className="rounded-xl border p-4">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                After an Aarohi call
              </div>
              <PhoneCall className="h-4 w-4" style={{ color: WORKSHOP_WITH_CALL }} />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-semibold font-display tabular-nums">{num(w.after_call)}</span>
              <span className="text-xs font-medium tabular-nums" style={{ color: WORKSHOP_WITH_CALL }}>
                {sharePct}%
              </span>
            </div>
            <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-muted">
              <div style={{ width: `${sharePct}%`, background: WORKSHOP_WITH_CALL }} />
              <div style={{ width: `${100 - sharePct}%`, background: WORKSHOP_NO_CALL, opacity: w.arrivals ? 1 : 0 }} />
            </div>
            <div className="mt-1.5 text-xs text-muted-foreground">
              {num(withoutCall)} came without a call
            </div>
          </div>

          {/* Baseline */}
          <div className="rounded-xl border p-4">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Baseline {firstCall ? "before calls" : "(no calls yet)"}
              </div>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-1 text-2xl font-semibold font-display tabular-nums">
              {w.baseline_per_day != null ? (
                <>
                  {w.baseline_per_day}
                  <span className="text-sm font-normal text-muted-foreground"> /day</span>
                </>
              ) : (
                "—"
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {num(w.baseline_vehicles)} vehicles over {w.baseline_days} day{w.baseline_days === 1 ? "" : "s"}
            </div>
          </div>
        </div>

        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={w.by_day} margin={{ top: 16, right: 8, left: -20, bottom: 0 }} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11 }}
                stroke="var(--muted-foreground)"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={12}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                stroke="var(--muted-foreground)"
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<WorkshopTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.5 }} />
              <Bar dataKey="after_call" name="After an Aarohi call" stackId="w" fill={WORKSHOP_WITH_CALL} maxBarSize={56}>
                <LabelList dataKey="after_call" position="center" formatter={hideZero} fill="#fff" fontSize={12} fontWeight={600} />
              </Bar>
              <Bar
                dataKey="without_call"
                name="Without an Aarohi call"
                stackId="w"
                fill={WORKSHOP_NO_CALL}
                radius={[6, 6, 0, 0]}
                maxBarSize={56}
              >
                <LabelList dataKey="without_call" position="center" formatter={hideZero} fill="#fff" fontSize={12} fontWeight={600} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            {firstCall
              ? `Aarohi's first call was on ${firstCall}. Arrivals before that date are your baseline — compare it with the days after to see what the calls add.`
              : "Aarohi hasn't made any calls yet, so every arrival here is the baseline. Once calls start, visits that follow a call are shown separately."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------
   Page
------------------------------------------------------------------ */

export default function AnalyticsPage() {
  const [range, setRange] = useState<RangeKey>("30");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [branch, setBranch] = useState<string>("all");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params: Record<string, string> = {};
    if (range === "custom") {
      if (!custom.from || !custom.to) return;
      params.date_from = custom.from;
      params.date_to = custom.to;
    } else {
      params.window_days = range;
    }
    if (branch !== "all") params.branch_id = branch;

    setLoading(true);
    setError(null);
    try {
      const res = await server_get_data(get_analytics, params);
      if (!res?.success) throw { response: { data: res } };
      setData(res);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, [range, custom.from, custom.to, branch]);

  useEffect(() => {
    load();
  }, [load]);

  const k = data?.kpis;
  const p = data?.previous;

  const bestHour = useMemo(() => {
    if (!data) return null;
    const eligible = data.by_hour.filter((h) => h.calls >= 5 && h.connect_rate != null);
    if (!eligible.length) return null;
    return eligible.reduce((a, b) => ((b.connect_rate ?? 0) > (a.connect_rate ?? 0) ? b : a));
  }, [data]);

  const outcomeTotal = data?.outcomes.reduce((n, o) => n + o.value, 0) ?? 0;
  const costTotal = data?.cost_split.reduce((n, c) => n + c.value, 0) ?? 0;
  const maxBranch = Math.max(1, ...(data?.branches ?? []).map((b) => Math.max(b.calls, b.booked)));

  const exportCampaigns = () => {
    if (!data) return;
    downloadCsv(`campaigns_${data.date_from}_${data.date_to}.csv`, [
      ["Campaign", "Status", "Calls", "Connected", "Connect %", "Booked", "Conversion %", "Showroom visits"],
      ...data.campaigns.map((c) => [
        c.name, c.status, c.calls, c.connected, c.connect_rate, c.booked, c.conversion, c.visits,
      ]),
    ]);
  };

  const showBranchPicker = (data?.branches_available.length ?? 0) > 1;

  return (
    <>
      <PageHeader
        title="Reports & Analytics"
        description={
          data
            ? `${fmtRange(data.date_from, data.date_to)} · compared with the ${data.days} days before`
            : "How Aarohi's calls turn into bookings and workshop visits."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {showBranchPicker && (
              <Select value={branch} onValueChange={setBranch}>
                <SelectTrigger className="h-9 w-40" aria-label="Branch">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All branches</SelectItem>
                  {data!.branches_available.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="inline-flex rounded-md border p-0.5">
              {(["7", "30", "90", "custom"] as RangeKey[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRange(r)}
                  className={cn(
                    "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                    range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
                  )}
                >
                  {r === "custom" ? "Custom" : `${r}d`}
                </button>
              ))}
            </div>
            <Button size="sm" variant="outline" onClick={load} disabled={loading} aria-label="Refresh">
              <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            </Button>
          </div>
        }
      />

      <div className="p-4 md:p-6 lg:p-8 space-y-4">
        {range === "custom" && (
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <div className="text-xs text-muted-foreground">From</div>
              <Input
                type="date"
                className="mt-1 w-40"
                value={custom.from}
                onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
              />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">To</div>
              <Input
                type="date"
                className="mt-1 w-40"
                value={custom.to}
                onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
              />
            </div>
            <span className="pb-2 text-xs text-muted-foreground">Up to 180 days.</span>
          </div>
        )}

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {!data && loading && (
          <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Crunching the numbers…
          </div>
        )}

        {data && k && p && (
          <>
            {/* ---------- KPIs ---------- */}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Kpi
                label="AI calls"
                value={num(k.calls)}
                icon={<PhoneCall className="size-3.5" />}
                sub={`${num(k.connected)} connected · ${pct(k.connect_rate)}`}
                delta={<Delta now={k.calls} before={p.calls} />}
              />
              <Kpi
                label="Bookings by Aarohi"
                value={num(k.ai_bookings)}
                icon={<CalendarCheck className="size-3.5" />}
                sub={`${pct(k.conversion)} of connected calls`}
                delta={<Delta now={k.ai_bookings} before={p.ai_bookings} />}
                accent
              />
              <Kpi
                label="Workshop visits after a call"
                value={num(k.visits)}
                icon={<Store className="size-3.5" />}
                sub="from the CRE daily file"
                delta={<Delta now={k.visits} before={p.visits} />}
              />
              <Kpi
                label="Workshop arrivals"
                value={num(k.arrivals ?? 0)}
                icon={<Store className="size-3.5" />}
                sub={`${num(Math.max(0, (k.arrivals ?? 0) - k.visits))} came without an Aarohi call`}
                delta={<Delta now={k.arrivals ?? 0} before={p.arrivals ?? 0} />}
              />
              {/* <Kpi
                label="Cost per booking"
                value={rupees(k.cost_per_booking, 2)}
                icon={<Wallet className="size-3.5" />}
                sub={`${rupees(k.cost, 0)} total spend`}
                delta={<Delta now={k.cost_per_booking} before={p.cost_per_booking} lowerIsBetter />}
              /> */}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Kpi
                label="Connect rate"
                value={pct(k.connect_rate)}
                icon={<PhoneIncoming className="size-3.5" />}
                delta={<Delta now={k.connect_rate} before={p.connect_rate} />}
              />
              <Kpi
                label="Avg talk time"
                value={duration(k.avg_duration_s)}
                icon={<Clock className="size-3.5" />}
                sub="connected calls only"
                delta={<Delta now={k.avg_duration_s} before={p.avg_duration_s} />}
              />
              <Kpi
                label="All bookings"
                value={num(k.bookings)}
                icon={<CalendarCheck className="size-3.5" />}
                sub={`${num(k.bookings - k.ai_bookings)} made by staff`}
                delta={<Delta now={k.bookings} before={p.bookings} />}
              />
              {/* <Kpi
                label="Total AI spend"
                value={rupees(k.cost, 0)}
                icon={<IndianRupee className="size-3.5" />}
                sub="LLM + speech + telephony"
                delta={<Delta now={k.cost} before={p.cost} lowerIsBetter />}
              /> */}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Kpi
                label="Total call cost"
                value={rupees(k.cost, 2)}
                icon={<IndianRupee className="size-3.5" />}
                // sub="LLM + speech + telephony"
                delta={<Delta now={k.cost} before={p.cost} lowerIsBetter />}
              />
              <Kpi
                label="Average cost per call"
                value={rupees(k.cost_per_call, 2)}
                icon={<Wallet className="size-3.5" />}
                sub={`${rupees(k.cost_per_connected_call, 2)} per connected call`}
                delta={<Delta now={k.cost_per_call} before={p.cost_per_call} lowerIsBetter />}
              />
            </div>

            {data.workshop && data.workshop.arrivals > 0 && <WorkshopSection w={data.workshop} />}

            {k.calls === 0 ? (
              <Card>
                <CardContent className="py-16 text-center text-sm text-muted-foreground space-y-3">
                  <p>No calls in this period{branch !== "all" ? " for this branch" : ""}.</p>
                  {data.last_call_at ? (
                    <>
                      <p>
                        The most recent call was on{" "}
                        <span className="font-medium text-foreground">
                          {new Date(`${data.last_call_at}T00:00:00`).toLocaleDateString(undefined, {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                        .
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const to = new Date(`${data.last_call_at}T00:00:00`);
                          const from = new Date(to);
                          from.setDate(from.getDate() - 29);
                          const iso = (d: Date) =>
                            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                          setCustom({ from: iso(from), to: iso(to) });
                          setRange("custom");
                        }}
                      >
                        Show the 30 days up to that call
                      </Button>
                    </>
                  ) : (
                    <p>No calls have been recorded for this dealer yet.</p>
                  )}
                </CardContent>
              </Card>
            ) : (
              <>
                {/* ---------- Trend ---------- */}
                <Card>
                  <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-base font-display">Calls → bookings, day by day</CardTitle>
                    <div className="flex gap-3">
                      <LegendDot color="var(--chart-1)" label="Calls" />
                      <LegendDot color="var(--chart-2)" label="Connected" />
                      <LegendDot color="var(--chart-3)" label="Booked" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[260px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data.trend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                          <defs>
                            {["1", "2", "3"].map((n) => (
                              <linearGradient key={n} id={`an-g${n}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={`var(--chart-${n})`} stopOpacity={0.35} />
                                <stop offset="100%" stopColor={`var(--chart-${n})`} stopOpacity={0} />
                              </linearGradient>
                            ))}
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                          <XAxis
                            dataKey="day"
                            tick={{ fontSize: 11 }}
                            stroke="var(--muted-foreground)"
                            interval="preserveStartEnd"
                            minTickGap={16}
                          />
                          <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" allowDecimals={false} />
                          <Tooltip contentStyle={tooltipStyle} />
                          <Area type="monotone" dataKey="calls" name="Calls" stroke="var(--chart-1)" fill="url(#an-g1)" strokeWidth={2} />
                          <Area type="monotone" dataKey="connected" name="Connected" stroke="var(--chart-2)" fill="url(#an-g2)" strokeWidth={2} />
                          <Area type="monotone" dataKey="booked" name="Booked" stroke="var(--chart-3)" fill="url(#an-g3)" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid gap-4 lg:grid-cols-5">
                  {/* ---------- Best time to call ---------- */}
                  <Card className="lg:col-span-3">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-display">Best time to call</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {bestHour
                          ? `Customers pick up most around ${bestHour.label} (${bestHour.connect_rate}% connect).`
                          : "Connect rate by hour of day (IST) -- needs a few more calls per hour to call a winner."}
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={data.by_hour} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                            <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" interval={0} />
                            <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" unit="%" domain={[0, 100]} />
                            <Tooltip
                              contentStyle={tooltipStyle}
                              formatter={(v: any, _n: any, item: any) => [
                                `${v ?? 0}% (${item?.payload?.connected ?? 0}/${item?.payload?.calls ?? 0})`,
                                "Connect rate",
                              ]}
                            />
                            <Bar dataKey="connect_rate" radius={[4, 4, 0, 0]}>
                              {data.by_hour.map((h) => (
                                <Cell
                                  key={h.hour}
                                  fill={bestHour && h.hour === bestHour.hour ? "var(--chart-3)" : "var(--chart-1)"}
                                  fillOpacity={h.calls ? 1 : 0.25}
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* ---------- Outcomes ---------- */}
                  <Card className="lg:col-span-2">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-display">How calls ended</CardTitle>
                      {data.no_outcome > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {num(data.no_outcome)} calls had no outcome (not answered / cut early).
                        </p>
                      )}
                    </CardHeader>
                    <CardContent>
                      {outcomeTotal === 0 ? (
                        <EmptyChart />
                      ) : (
                        <div className="flex flex-col items-center gap-3 sm:flex-row lg:flex-col xl:flex-row">
                          <div className="h-[170px] w-[170px] shrink-0">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={data.outcomes}
                                  dataKey="value"
                                  nameKey="name"
                                  innerRadius={48}
                                  outerRadius={78}
                                  paddingAngle={2}
                                  stroke="none"
                                >
                                  {data.outcomes.map((o, i) => (
                                    <Cell key={o.name} fill={OUTCOME_COLORS[i % OUTCOME_COLORS.length]} />
                                  ))}
                                </Pie>
                                <Tooltip contentStyle={tooltipStyle} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="w-full space-y-1.5">
                            {data.outcomes.map((o, i) => (
                              <div key={o.name} className="flex items-center justify-between gap-2 text-sm">
                                <span className="inline-flex min-w-0 items-center gap-2">
                                  <span
                                    className="size-2 shrink-0 rounded-full"
                                    style={{ background: OUTCOME_COLORS[i % OUTCOME_COLORS.length] }}
                                  />
                                  <span className="truncate">{o.name}</span>
                                </span>
                                <span className="shrink-0 tabular-nums text-muted-foreground">
                                  {num(o.value)} · {Math.round((o.value * 100) / outcomeTotal)}%
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* ---------- Campaigns ---------- */}
                <Card>
                  <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-base font-display">Campaign performance</CardTitle>
                    {data.campaigns.length > 0 && (
                      <Button size="sm" variant="outline" onClick={exportCampaigns}>
                        <Download className="size-4" /> CSV
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent className="p-0">
                    {data.campaigns.length === 0 ? (
                      <p className="px-6 pb-6 text-sm text-muted-foreground">No campaign calls in this period.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Campaign</TableHead>
                              <TableHead className="text-right">Calls</TableHead>
                              <TableHead className="text-right">Connect</TableHead>
                              <TableHead className="text-right">Booked</TableHead>
                              <TableHead className="text-right">Conversion</TableHead>
                              <TableHead className="text-right">Visits</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {data.campaigns.map((c) => (
                              <TableRow key={c.id}>
                                <TableCell>
                                  <Link to={`/campaigns/${c.id}`} className="font-medium hover:text-primary">
                                    {c.name}
                                  </Link>
                                  <div className="text-xs capitalize text-muted-foreground">{c.status}</div>
                                </TableCell>
                                <TableCell className="text-right tabular-nums">{num(c.calls)}</TableCell>
                                <TableCell className="text-right tabular-nums">{pct(c.connect_rate)}</TableCell>
                                <TableCell className="text-right tabular-nums font-medium">{num(c.booked)}</TableCell>
                                <TableCell className="text-right tabular-nums">{pct(c.conversion)}</TableCell>
                                <TableCell className="text-right tabular-nums">{num(c.visits)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="grid gap-4 lg:grid-cols-2">
                  {/* ---------- Branches ---------- */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-display">By branch</CardTitle>
                      <div className="flex gap-3">
                        <LegendDot color="var(--chart-1)" label="Calls" />
                        <LegendDot color="var(--chart-3)" label="Booked" />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {data.branches.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No branch data.</p>
                      ) : (
                        data.branches.map((b) => (
                          <div key={b.id}>
                            <div className="flex justify-between text-sm">
                              <span className="truncate">{b.name}</span>
                              <span className="tabular-nums text-muted-foreground">
                                {num(b.calls)} · {num(b.booked)}
                              </span>
                            </div>
                            <div className="mt-1 space-y-1">
                              <div className="h-1.5 rounded-full bg-muted">
                                <div
                                  className="h-1.5 rounded-full"
                                  style={{ width: `${(b.calls * 100) / maxBranch}%`, background: "var(--chart-1)" }}
                                />
                              </div>
                              <div className="h-1.5 rounded-full bg-muted">
                                <div
                                  className="h-1.5 rounded-full"
                                  style={{ width: `${(b.booked * 100) / maxBranch}%`, background: "var(--chart-3)" }}
                                />
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>

                  {/* ---------- Advisors ---------- */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-display">Service advisors</CardTitle>
                      <p className="text-xs text-muted-foreground">Bookings assigned in this period, and how many were serviced.</p>
                    </CardHeader>
                    <CardContent className="p-0">
                      {data.advisors.length === 0 ? (
                        <p className="px-6 pb-6 text-sm text-muted-foreground">No bookings with an advisor assigned.</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Advisor</TableHead>
                              <TableHead className="text-right">Booked</TableHead>
                              <TableHead className="text-right">Serviced</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {data.advisors.map((a) => (
                              <TableRow key={a.name}>
                                <TableCell className="font-medium">{a.name}</TableCell>
                                <TableCell className="text-right tabular-nums">{num(a.booked)}</TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {num(a.completed)}{" "}
                                  <span className="text-xs text-muted-foreground">({pct(a.completion_rate)})</span>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>

                  {/* ---------- Cost split ---------- */}
                  {/* <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-display">Where the money goes</CardTitle>
                      <p className="text-xs text-muted-foreground">{rupees(costTotal, 0)} in this period</p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {costTotal === 0 ? (
                        <p className="text-sm text-muted-foreground">No cost recorded.</p>
                      ) : (
                        data.cost_split.map((c, i) => (
                          <div key={c.name}>
                            <div className="flex justify-between text-sm">
                              <span>{c.name}</span>
                              <span className="tabular-nums text-muted-foreground">
                                {rupees(c.value, 0)} · {Math.round((c.value * 100) / costTotal)}%
                              </span>
                            </div>
                            <div className="mt-1 h-1.5 rounded-full bg-muted">
                              <div
                                className="h-1.5 rounded-full"
                                style={{ width: `${(c.value * 100) / costTotal}%`, background: CHART_COLORS[i] }}
                              />
                            </div>
                          </div>
                        ))
                      )}
                      {k.cost_per_booking != null && (
                        <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-2.5 text-xs text-muted-foreground">
                          <Sparkles className="size-3.5 shrink-0 text-primary" />
                          Each Aarohi booking cost {rupees(k.cost_per_booking, 2)} in AI and telephony.
                        </div>
                      )}
                    </CardContent>
                  </Card> */}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
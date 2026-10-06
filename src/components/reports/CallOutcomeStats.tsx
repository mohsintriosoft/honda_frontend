import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Download,
  Loader2,
  PhoneCall,
  PhoneMissed,
  PhoneOff,
  PhoneForwarded,
  RefreshCw,
  ThumbsDown,
  CalendarCheck2,
  CircleSlash,
  Radio,
} from "lucide-react";
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
import { cn } from "@/lib/utils";
import { server_get_data, get_call_stats } from "@/components/ServiceConnection/serviceconnection";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type Counts = {
  total: number;
  completed: number;
  booked: number;
  callback: number;
  declined: number;
  not_booked: number;
  dropped: number;
  no_answer: number;
  in_progress: number;
  answer_rate: number | null;
  completion_rate: number | null;
  booking_rate: number | null;
};

type StatsResponse = {
  success: boolean;
  date_from: string;
  date_to: string;
  totals: Counts;
  avg_talk_s: number;
  total_talk_s: number;
  days: (Counts & { date: string })[];
  campaigns: { id: number; name: string }[];
};

type Preset = "today" | "yesterday" | "7d" | "30d" | "month" | "day" | "range";

const PRESETS: { value: Preset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "month", label: "This month" },
  { value: "day", label: "Pick a day" },
  { value: "range", label: "Date range" },
];

/* ------------------------------------------------------------------ */
/* Date helpers (local / IST calendar days)                            */
/* ------------------------------------------------------------------ */

function iso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function presetRange(p: Preset, day: string, range: { from: string; to: string }): { from: string; to: string } | null {
  const today = new Date();
  switch (p) {
    case "today":
      return { from: iso(today), to: iso(today) };
    case "yesterday": {
      const y = addDays(today, -1);
      return { from: iso(y), to: iso(y) };
    }
    case "7d":
      return { from: iso(addDays(today, -6)), to: iso(today) };
    case "30d":
      return { from: iso(addDays(today, -29)), to: iso(today) };
    case "month":
      return { from: iso(new Date(today.getFullYear(), today.getMonth(), 1)), to: iso(today) };
    case "day":
      return day ? { from: day, to: day } : null;
    case "range":
      return range.from && range.to ? { from: range.from, to: range.to } : null;
  }
}

function prettyDate(s: string): string {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function duration(s: number): string {
  if (!s) return "0s";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${sec}s`;
  return `${sec}s`;
}

/* ------------------------------------------------------------------ */
/* Buckets                                                             */
/* ------------------------------------------------------------------ */

const BUCKETS: {
  key: keyof Counts;
  label: string;
  hint: string;
  icon: React.ReactNode;
  tone: string;
  bar: string;
}[] = [
  { key: "booked", label: "Booked", hint: "appointment confirmed", icon: <CalendarCheck2 className="size-4" />, tone: "text-emerald-600", bar: "bg-emerald-500" },
  { key: "callback", label: "Callback", hint: "asked to be called later", icon: <PhoneForwarded className="size-4" />, tone: "text-sky-600", bar: "bg-sky-500" },
  { key: "declined", label: "Not interested", hint: "said no", icon: <ThumbsDown className="size-4" />, tone: "text-amber-600", bar: "bg-amber-500" },
  { key: "not_booked", label: "Not booked", hint: "talked, no decision", icon: <CircleSlash className="size-4" />, tone: "text-violet-600", bar: "bg-violet-500" },
  { key: "dropped", label: "Dropped", hint: "picked up, line cut", icon: <PhoneOff className="size-4" />, tone: "text-rose-600", bar: "bg-rose-500" },
  { key: "no_answer", label: "No answer", hint: "never picked up", icon: <PhoneMissed className="size-4" />, tone: "text-slate-500", bar: "bg-slate-400" },
  { key: "in_progress", label: "In progress", hint: "on the line now", icon: <Radio className="size-4" />, tone: "text-primary", bar: "bg-primary" },
];

function pct(n: number, total: number): string {
  return total ? `${Math.round((n * 1000) / total) / 10}%` : "—";
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

/**
 * "Call outcomes" panel -- how many calls were made and how each one
 * ended, for any day or period, optionally for one campaign.
 * Used on the Dashboard (defaults to Today) and Reports & Analytics.
 *
 * Every call is counted in exactly one bucket (the same outcome the Call
 * Recordings page shows). "Completed" = the customer actually talked
 * (booked + callback + not interested + not booked).
 */
export function CallOutcomeStats({
  branchId,
  defaultPreset = "today",
  title = "Call outcomes",
}: {
  branchId?: string | null;
  defaultPreset?: Preset;
  title?: string;
}) {
  const [preset, setPreset] = useState<Preset>(defaultPreset);
  const [day, setDay] = useState<string>(iso(new Date()));
  const [range, setRange] = useState<{ from: string; to: string }>({
    from: iso(addDays(new Date(), -6)),
    to: iso(new Date()),
  });
  const [campaign, setCampaign] = useState<string>("all");
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const period = useMemo(() => presetRange(preset, day, range), [preset, day, range]);

  const load = useCallback(async () => {
    if (!period) return;
    const params: Record<string, string> = { date_from: period.from, date_to: period.to };
    if (campaign !== "all") params.campaign_id = campaign;
    if (branchId && branchId !== "all") params.branch_id = branchId;
    setLoading(true);
    setError(null);
    try {
      const res = await server_get_data(get_call_stats, params);
      if (!res?.success) throw new Error(res?.error || "Couldn't load call stats");
      setData(res);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || "Couldn't load call stats");
    } finally {
      setLoading(false);
    }
  }, [period, campaign, branchId]);

  useEffect(() => {
    load();
  }, [load]);

  const t = data?.totals;
  const multiDay = data ? data.date_from !== data.date_to : false;
  const periodLabel = data
    ? multiDay
      ? `${prettyDate(data.date_from)} – ${prettyDate(data.date_to)}`
      : prettyDate(data.date_from)
    : "";

  const exportCsv = () => {
    if (!data) return;
    const cols: (keyof Counts)[] = ["total", "completed", "booked", "callback", "declined", "not_booked", "dropped", "no_answer", "in_progress"];
    const head = ["date", ...cols.map((c) => (c === "declined" ? "not_interested" : c))];
    const lines = [head.join(",")];
    for (const d of data.days) lines.push([d.date, ...cols.map((c) => String(d[c] ?? 0))].join(","));
    lines.push(["TOTAL", ...cols.map((c) => String(data.totals[c] ?? 0))].join(","));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `call-outcomes_${data.date_from}_${data.date_to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Card>
      <CardHeader className="gap-3 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="font-display text-base">{title}</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {periodLabel || "…"} · every call counted once, by how it ended
            </p>
          </div>
          <div className="flex items-center gap-1">
            {multiDay && data && data.days.length > 0 && (
              <Button size="sm" variant="ghost" onClick={exportCsv} title="Download CSV">
                <Download className="size-4" />
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={load} disabled={loading} title="Refresh">
              <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPreset(p.value)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  preset === p.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {preset === "day" && (
            <div className="flex items-center gap-1.5">
              <CalendarDays className="size-4 text-muted-foreground" />
              <Input type="date" className="h-8 w-40" value={day} max={iso(new Date())} onChange={(e) => setDay(e.target.value)} />
            </div>
          )}
          {preset === "range" && (
            <div className="flex flex-wrap items-center gap-1.5">
              <Input
                type="date"
                className="h-8 w-40"
                value={range.from}
                max={range.to || iso(new Date())}
                onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
              />
              <span className="text-xs text-muted-foreground">to</span>
              <Input
                type="date"
                className="h-8 w-40"
                value={range.to}
                min={range.from}
                max={iso(new Date())}
                onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
              />
            </div>
          )}

          <Select value={campaign} onValueChange={setCampaign}>
            <SelectTrigger className="h-8 w-full sm:w-48">
              <SelectValue placeholder="All campaigns" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All campaigns</SelectItem>
              {(data?.campaigns ?? []).map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && <p className="text-sm text-destructive">{error}</p>}

        {!data && loading && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        )}

        {t && (
          <div className={cn("space-y-4 transition-opacity", loading && "opacity-60")}>
            {/* headline numbers */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Headline icon={<PhoneCall className="size-4" />} label="Calls made" value={t.total} sub={`avg talk ${duration(data!.avg_talk_s)}`} />
              <Headline
                icon={<CheckCircle2 className="size-4" />}
                label="Completed"
                value={t.completed}
                sub={`${pct(t.completed, t.total)} of calls · customer talked`}
                tone="text-emerald-600"
              />
              <Headline
                icon={<PhoneCall className="size-4" />}
                label="Picked up"
                value={t.completed + t.dropped}
                sub={t.answer_rate != null ? `${t.answer_rate}% answer rate` : "—"}
              />
              <Headline
                icon={<CalendarCheck2 className="size-4" />}
                label="Booking rate"
                value={t.booking_rate != null ? `${t.booking_rate}%` : "—"}
                sub={`${t.booked} booked of ${t.completed} completed`}
                tone="text-emerald-600"
              />
            </div>

            {/* distribution bar */}
            {t.total > 0 && (
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
                {BUCKETS.filter((b) => (t[b.key] as number) > 0).map((b) => (
                  <div
                    key={b.key}
                    className={b.bar}
                    style={{ width: `${((t[b.key] as number) * 100) / t.total}%` }}
                    title={`${b.label}: ${t[b.key]}`}
                  />
                ))}
              </div>
            )}

            {/* outcome tiles */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {BUCKETS.filter((b) => b.key !== "in_progress" || t.in_progress > 0).map((b) => (
                <div key={b.key} className="rounded-lg border p-3">
                  <div className={cn("flex items-center gap-1.5 text-xs font-medium", b.tone)}>
                    {b.icon} {b.label}
                  </div>
                  <div className="mt-1 font-display text-2xl font-semibold tabular-nums">{t[b.key] as number}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {pct(t[b.key] as number, t.total)} · {b.hint}
                  </div>
                </div>
              ))}
            </div>

            {t.total === 0 && !loading && (
              <p className="py-4 text-center text-sm text-muted-foreground">No calls in this period.</p>
            )}

            {/* per-day table */}
            {multiDay && t.total > 0 && (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Date</th>
                      <th className="px-3 py-2 text-right font-medium">Calls</th>
                      <th className="px-3 py-2 text-right font-medium">Completed</th>
                      {BUCKETS.filter((b) => b.key !== "in_progress").map((b) => (
                        <th key={b.key} className="px-3 py-2 text-right font-medium">
                          {b.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...data!.days].reverse().filter((d) => d.total > 0).map((d) => (
                      <tr key={d.date} className="border-b last:border-0 hover:bg-accent/30">
                        <td className="whitespace-nowrap px-3 py-2">
                          <button
                            type="button"
                            className="hover:text-primary hover:underline"
                            title="Show only this day"
                            onClick={() => {
                              setDay(d.date);
                              setPreset("day");
                            }}
                          >
                            {prettyDate(d.date)}
                          </button>
                        </td>
                        <td className="px-3 py-2 text-right font-medium tabular-nums">{d.total}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{d.completed}</td>
                        {BUCKETS.filter((b) => b.key !== "in_progress").map((b) => (
                          <td key={b.key} className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                            {(d[b.key] as number) || "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-muted/30 font-medium">
                      <td className="px-3 py-2">Total</td>
                      <td className="px-3 py-2 text-right tabular-nums">{t.total}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{t.completed}</td>
                      {BUCKETS.filter((b) => b.key !== "in_progress").map((b) => (
                        <td key={b.key} className="px-3 py-2 text-right tabular-nums">
                          {t[b.key] as number}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Headline({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon} {label}
      </div>
      <div className={cn("mt-1 font-display text-2xl font-semibold tabular-nums", tone)}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

export default CallOutcomeStats;

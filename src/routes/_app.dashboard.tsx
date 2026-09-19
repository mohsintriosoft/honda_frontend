import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { PageHeader } from "@/components/layout/AppShell";
import { KpiCard, MetricTile } from "@/components/data/KpiCard";
import { StatusBadge } from "@/components/data/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import {
  Users,
  PhoneCall,
  PhoneIncoming,
  CalendarCheck,
  Wrench,
  Shield,
  FileCheck,
  TrendingUp,
  Activity,
  Sparkles,
  ArrowRight,
} from "lucide-react";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

import { formatNumber, formatPercent, formatRelative } from "@/lib/format";

// NOTE: adjust this import path to wherever serviceconnection.js actually
// lives in the project — it wasn't included in the files I was given to
// edit, so I don't know its real path/alias.
import {
  get_dashboard_summary,
  get_campaigns,
  get_recordings,
  LIVE_CALL_STATUSES,
  get_appointments,
  get_segments,
  server_get_data,
} from "@/components/ServiceConnection/serviceconnection";

type DashboardKpis = {
  totalCustomers: number;
  todaysCalls: number;
  connectedCalls: number;
  appointmentsBooked: number;
  serviceDueToday: number;
  insuranceDue: number;
  amcDue: number;
  campaignSuccess: number;
  workshopConversion: number;
};

type TrendPoint = {
  day: string;
  date: string;
  calls: number;
  connected: number;
  booked: number;
};

const EMPTY_KPIS: DashboardKpis = {
  totalCustomers: 0,
  todaysCalls: 0,
  connectedCalls: 0,
  appointmentsBooked: 0,
  serviceDueToday: 0,
  insuranceDue: 0,
  amcDue: 0,
  campaignSuccess: 0,
  workshopConversion: 0,
};

function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [kpis, setKpis] = useState<DashboardKpis>(EMPTY_KPIS);
  const [callTrend, setCallTrend] = useState<TrendPoint[]>([]);
  const [liveCampaigns, setLiveCampaigns] = useState<any[]>([]);
  const [liveCalls, setLiveCalls] = useState<any[]>([]);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [segments, setSegments] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [summaryRes, campaignsRes, callsRes, appointmentsRes, segmentsRes] =
          await Promise.all([
            server_get_data(get_dashboard_summary, { trend_days: 14 }),
            server_get_data(get_campaigns),
            server_get_data(get_recordings, { status: LIVE_CALL_STATUSES, page_size: 5 }),
            server_get_data(get_appointments),
            server_get_data(get_segments),
          ]);

        if (cancelled) return;

        setKpis(summaryRes?.kpis ?? EMPTY_KPIS);
        setCallTrend(summaryRes?.call_trend ?? []);

        setLiveCampaigns(
          (campaignsRes?.campaigns ?? []).filter((c: any) => c.status === "live"),
        );

        // recordings() is paginated (DRF PageNumberPagination) -> { results: [...] }
        setLiveCalls((callsRes?.results ?? []).slice(0, 5));

        const todayIso = new Date().toISOString().slice(0, 10);
        setUpcoming(
          (appointmentsRes?.appointments ?? [])
            .filter((a: any) => a.status !== "cancelled" && a.slotDate >= todayIso)
            .sort((a: any, b: any) =>
              `${a.slotDate}T${a.slotTime}`.localeCompare(`${b.slotDate}T${b.slotTime}`),
            )
            .slice(0, 6),
        );

        setSegments(segmentsRes?.segments ?? []);
      } catch (err) {
        console.error("Dashboard load failed:", err);
        if (!cancelled) setError("Couldn't load dashboard data. Try refreshing the page.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const k = kpis;

  return (
    <>
      <PageHeader
        title="Good morning"
        description="Here's what your AI did overnight and what needs your attention today."
        actions={
          <>
            <Button variant="outline" size="sm">
              Export
            </Button>
          </>
        }
      />

      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* KPI grid */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <KpiCard
            label="Total Customers"
            value={formatNumber(k.totalCustomers)}
            icon={<Users className="size-4" />}
            hint="all branches"
          />

          <KpiCard
            label="Today's AI Calls"
            value={formatNumber(k.todaysCalls)}
            icon={<PhoneCall className="size-4" />}
            accent
          />

          <KpiCard
            label="Connected"
            value={formatNumber(k.connectedCalls)}
            icon={<PhoneIncoming className="size-4" />}
            hint={
              k.todaysCalls
                ? `${Math.round((k.connectedCalls / k.todaysCalls) * 100)}% rate`
                : undefined
            }
          />

          <KpiCard
            label="Appointments Booked"
            value={formatNumber(k.appointmentsBooked)}
            icon={<CalendarCheck className="size-4" />}
          />

          <KpiCard
            label="Service Due Today"
            value={formatNumber(k.serviceDueToday)}
            icon={<Wrench className="size-4" />}
            hint="across segments"
          />

          <KpiCard
            label="Insurance Due (30d)"
            value={formatNumber(k.insuranceDue)}
            icon={<Shield className="size-4" />}
          />

          <KpiCard
            label="AMC Due (30d)"
            value={formatNumber(k.amcDue)}
            icon={<FileCheck className="size-4" />}
          />

          <KpiCard
            label="Campaign Success"
            value={formatPercent(k.campaignSuccess, 1)}
            icon={<TrendingUp className="size-4" />}
          />

          <KpiCard
            label="Workshop Conversion"
            value={formatPercent(k.workshopConversion, 1)}
            icon={<Activity className="size-4" />}
          />
        </div>

        {/* Chart — full width now that AI Recommendations (no backend
            equivalent) has been removed from the dashboard */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-display">
                Call performance — last 14 days
              </CardTitle>

              <p className="text-xs text-muted-foreground mt-0.5">
                Calls placed, connected, and bookings generated
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <Legend color="var(--chart-1)" label="Calls" />
              <Legend color="var(--chart-2)" label="Connected" />
              <Legend color="var(--chart-3)" label="Booked" />
            </div>
          </CardHeader>

          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={callTrend}
                  margin={{
                    left: -20,
                    right: 8,
                    top: 8,
                  }}
                >
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>

                    <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                    </linearGradient>

                    <linearGradient id="g3" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />

                  <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />

                  <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />

                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />

                  <Area
                    type="monotone"
                    dataKey="calls"
                    stroke="var(--chart-1)"
                    fill="url(#g1)"
                    strokeWidth={2}
                  />

                  <Area
                    type="monotone"
                    dataKey="connected"
                    stroke="var(--chart-2)"
                    fill="url(#g2)"
                    strokeWidth={2}
                  />

                  <Area
                    type="monotone"
                    dataKey="booked"
                    stroke="var(--chart-3)"
                    fill="url(#g3)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Live campaigns + live calls */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Live campaigns */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base font-display">Today's live campaigns</CardTitle>

              <Button variant="ghost" size="sm" asChild>
                <Link to="/campaigns">
                  View all
                  <ArrowRight className="size-3" />
                </Link>
              </Button>
            </CardHeader>

            <CardContent className="space-y-2">
              {liveCampaigns.length === 0 && (
                <div className="text-sm text-muted-foreground py-4">
                  No campaigns are live right now.
                </div>
              )}

              {liveCampaigns.map((c) => (
                <Link
                  key={c.id}
                  to={`/campaigns/${c.id}`}
                  className="block rounded-lg border p-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{c.name}</div>

                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {c.agent?.persona_name ?? c.agent?.agent_name ?? "AI Agent"} •{" "}
                        {c.totals?.customers ?? 0} customers
                      </div>
                    </div>

                    <StatusBadge status={c.status} />
                  </div>

                  <div className="mt-3 grid grid-cols-4 gap-2">
                    <MetricTile label="Connected" value={c.totals?.connected ?? 0} />

                    <MetricTile label="Interested" value={c.totals?.interested ?? 0} tone="success" />

                    <MetricTile label="Booked" value={c.totals?.booked ?? 0} tone="info" />

                    <MetricTile label="Escalated" value={c.totals?.escalated ?? 0} tone="destructive" />
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-4">
            {/* Live calls */}
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-base font-display flex items-center gap-2">
                  <span className="size-2 rounded-full bg-[color:var(--success)] animate-pulse" />
                  Live calls
                </CardTitle>

                <Button variant="ghost" size="sm" asChild>
                  <Link to="/voice">
                    Monitor
                    <ArrowRight className="size-3" />
                  </Link>
                </Button>
              </CardHeader>

              <CardContent className="space-y-2">
                {liveCalls.length === 0 && (
                  <div className="text-sm text-muted-foreground py-4">No live calls right now.</div>
                )}

                {liveCalls.map((c) => {
                  const customerName = c.customer?.name || c.customer?.phone_number || "Unknown";

                  return (
                    <div key={c.id} className="flex items-center gap-3 rounded-md border p-2.5">
                      <div className="size-8 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-medium">
                        {customerName
                          .split(" ")
                          .map((p: string) => p[0])
                          .join("")
                          .slice(0, 2)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{customerName}</div>

                        <div className="text-xs text-muted-foreground truncate">
                          {c.final_intent_code || "In progress"}
                        </div>
                      </div>

                      <StatusBadge status={c.status} />
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Upcoming appointments */}
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-base font-display">Upcoming appointments</CardTitle>

                <Button variant="ghost" size="sm" asChild>
                  <Link to="/appointments">
                    View all
                    <ArrowRight className="size-3" />
                  </Link>
                </Button>
              </CardHeader>

              <CardContent className="space-y-2">
                {upcoming.length === 0 && (
                  <div className="text-sm text-muted-foreground py-4">
                    No upcoming appointments.
                  </div>
                )}

                {upcoming.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 rounded-md border p-2.5">
                    <div className="text-center min-w-[44px]">
                      <div className="text-[10px] uppercase text-muted-foreground">
                        {new Date(a.slotDate).toLocaleString("en", {
                          month: "short",
                        })}
                      </div>

                      <div className="text-lg font-semibold font-display leading-none">
                        {new Date(a.slotDate).getDate()}
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{a.customerName}</div>

                      <div className="text-xs text-muted-foreground truncate">
                        {a.type} • {a.advisor ?? "Unassigned"}
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground" suppressHydrationWarning>
                      {formatRelative(`${a.slotDate}T${a.slotTime}`)}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Segment health */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-display">Segment health</CardTitle>

            <p className="text-xs text-muted-foreground">
              Live counts and conversion across customer segments
            </p>
          </CardHeader>

          <CardContent>
            <div className="grid gap-2 grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
              {segments.length === 0 && (
                <div className="col-span-full text-sm text-muted-foreground py-4">
                  No segments configured yet.
                </div>
              )}

              {segments.map((s) => (
                <Link
                  key={s.slug}
                  to={`/segments/${s.slug}`}
                  className="rounded-lg border p-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="text-xs font-medium truncate">{s.name}</div>

                  <div className="mt-2 text-xl font-display font-semibold tabular-nums">
                    {formatNumber(s.customers)}
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{s.due_today} today</span>

                    <span className="font-medium text-[color:var(--success)]">{s.conversion}%</span>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-muted-foreground">
      <span
        className="size-2 rounded-sm"
        style={{
          background: color,
        }}
      />
      {label}
    </div>
  );
}

export default DashboardPage;
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
  dashboardKpis,
  callTrend,
  campaigns,
  calls,
  appointments,
  aiRecommendations,
  segments,
} from "@/mocks/data";

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

function DashboardPage() {
  const k = dashboardKpis;

  const liveCampaigns = campaigns.filter((c) => c.status === "live");

  const liveCalls = calls.filter((c) => c.status === "ringing").slice(0, 5);

  const upcoming = appointments.filter((a) => a.status === "upcoming").slice(0, 6);

  return (
    <>
      <PageHeader
        title="Good morning, Rajesh"
        description="Here's what your AI did overnight and what needs your attention today."
        actions={
          <>
            <Button variant="outline" size="sm">
              Export
            </Button>

            <Button size="sm" asChild>
              <Link to="/campaigns/new">
                <Sparkles className="size-4" />
                New campaign
              </Link>
            </Button>
          </>
        }
      />

      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        {/* KPI grid */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <KpiCard
            label="Total Customers"
            value={formatNumber(k.totalCustomers)}
            delta={4.2}
            icon={<Users className="size-4" />}
            hint="all branches"
          />

          <KpiCard
            label="Today's AI Calls"
            value={formatNumber(k.todaysCalls)}
            delta={12.1}
            icon={<PhoneCall className="size-4" />}
            accent
          />

          <KpiCard
            label="Connected"
            value={formatNumber(k.connectedCalls)}
            delta={3.4}
            icon={<PhoneIncoming className="size-4" />}
            hint={`${Math.round((k.connectedCalls / k.todaysCalls) * 100)}% rate`}
          />

          <KpiCard
            label="Appointments Booked"
            value={formatNumber(k.appointmentsBooked)}
            delta={8.7}
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
            delta={-2.1}
            icon={<Shield className="size-4" />}
          />

          <KpiCard
            label="AMC Due (30d)"
            value={formatNumber(k.amcDue)}
            delta={1.4}
            icon={<FileCheck className="size-4" />}
          />

          <KpiCard
            label="Campaign Success"
            value={formatPercent(k.campaignSuccess, 1)}
            delta={2.6}
            icon={<TrendingUp className="size-4" />}
          />

          <KpiCard
            label="Workshop Conversion"
            value={formatPercent(k.workshopConversion, 1)}
            delta={5.2}
            icon={<Activity className="size-4" />}
          />

          <KpiCard
            label="AI Confidence Avg"
            value="87%"
            icon={<Sparkles className="size-4 text-[color:var(--ai)]" />}
            accent
            hint="last 7 days"
          />
        </div>

        {/* Chart + AI recommendations */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
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

          {/* AI Recommendations */}
          <Card className="ai-gradient ai-border">
            <CardHeader>
              <CardTitle className="text-base font-display flex items-center gap-2">
                <Sparkles className="size-4 text-[color:var(--ai)]" />
                AI Recommendations
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-3">
              {aiRecommendations.map((r) => (
                <div key={r.id} className="rounded-lg border bg-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-medium">{r.title}</div>

                    <StatusBadge status={r.impact === "high" ? "live" : "scheduled"} />
                  </div>

                  <p className="mt-1 text-xs text-muted-foreground">{r.body}</p>

                  <Button size="sm" variant="ghost" className="mt-2 h-7 px-2 text-xs">
                    Act on this
                    <ArrowRight className="size-3" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

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
                        {c.voice} • {c.totals.customers} customers
                      </div>
                    </div>

                    <StatusBadge status={c.status} />
                  </div>

                  <div className="mt-3 grid grid-cols-4 gap-2">
                    <MetricTile label="Connected" value={c.totals.connected} />

                    <MetricTile label="Interested" value={c.totals.interested} tone="success" />

                    <MetricTile label="Booked" value={c.totals.booked} tone="info" />

                    <MetricTile label="Escalated" value={c.totals.escalated} tone="destructive" />
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

                {liveCalls.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 rounded-md border p-2.5">
                    <div className="size-8 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-medium">
                      {c.customerName
                        .split(" ")
                        .map((p: string) => p[0])
                        .join("")
                        .slice(0, 2)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{c.customerName}</div>

                      <div className="text-xs text-muted-foreground truncate">{c.intent}</div>
                    </div>

                    <StatusBadge status={c.status} />
                  </div>
                ))}
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
                {upcoming.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 rounded-md border p-2.5">
                    <div className="text-center min-w-[44px]">
                      <div className="text-[10px] uppercase text-muted-foreground">
                        {new Date(a.scheduledFor).toLocaleString("en", {
                          month: "short",
                        })}
                      </div>

                      <div className="text-lg font-semibold font-display leading-none">
                        {new Date(a.scheduledFor).getDate()}
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{a.customerName}</div>

                      <div className="text-xs text-muted-foreground truncate">
                        {a.type} • {a.advisor}
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground" suppressHydrationWarning>
                      {formatRelative(a.scheduledFor)}
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
              {segments.map((s) => (
                <Link
                  key={s.slug}
                  to={`/segments/${s.slug}`}
                  className="rounded-lg border p-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="text-xs font-medium truncate">{s.label}</div>

                  <div className="mt-2 text-xl font-display font-semibold tabular-nums">
                    {formatNumber(s.customers)}
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{s.dueToday} today</span>

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

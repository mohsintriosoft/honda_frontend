import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/AppShell";
import { campaigns, calls } from "@/mocks/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/data/StatusBadge";
import { MetricTile } from "@/components/data/KpiCard";
import { Pause, Play, MoreVertical, Sparkles } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDateTime, formatRelative } from "@/lib/format";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/_app/campaigns/$id")({
  loader: ({ params }) => {
    const campaign = campaigns.find((c) => c.id === params.id);
    if (!campaign) throw notFound();
    return { campaign };
  },
  head: ({ params }) => ({ meta: [{ title: `Campaign ${params.id} — Triosoft` }] }),
  component: CampaignDetailPage,
});

function CampaignDetailPage() {
  const { campaign: c } = Route.useLoaderData();
  const cCalls = calls.filter((x) => x.campaignId === c.id).slice(0, 10);

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
        breadcrumbs={[{ label: "Campaigns", to: "/campaigns" }, { label: c.name }]}
        actions={
          <>
            <Button variant="outline" size="sm">
              {c.status === "live" ? <><Pause className="size-4" /> Pause</> : <><Play className="size-4" /> Resume</>}
            </Button>
            <Button variant="ghost" size="icon"><MoreVertical className="size-4" /></Button>
          </>
        }
      />

      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
          <StatusBadge status={c.status} />
          <span>•</span>
          <span>{c.voice}</span>
          <span>•</span>
          <span className="font-mono text-xs">{c.template}</span>
          <span>•</span>
          <span>Scheduled {formatDateTime(c.scheduledFor)}</span>
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

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base font-display">Conversion funnel</CardTitle></CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnel} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                    <YAxis type="category" dataKey="stage" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" width={90} />
                    <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="value" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="ai-gradient ai-border">
            <CardHeader><CardTitle className="text-sm font-display flex items-center gap-1.5"><Sparkles className="size-4 text-[color:var(--ai)]" /> AI insights</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-md border bg-card p-3">
                <div className="font-medium">Best calling hour</div>
                <div className="text-xs text-muted-foreground mt-1">11:00–12:30 — connect rate is 22% higher than average.</div>
              </div>
              <div className="rounded-md border bg-card p-3">
                <div className="font-medium">Drop-off detected</div>
                <div className="text-xs text-muted-foreground mt-1">14 customers asked for price and ended call. Consider proactive pricing in script.</div>
              </div>
            </CardContent>
          </Card>
        </div>

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
                  <TableHead>Intent</TableHead>
                  <TableHead>Disposition</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Started</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cCalls.map((call) => (
                  <TableRow key={call.id}>
                    <TableCell><Link to="/voice/$callId" params={{ callId: call.id }} className="text-sm font-medium hover:text-primary">{call.customerName}</Link></TableCell>
                    <TableCell className="text-sm">{call.intent}</TableCell>
                    <TableCell><StatusBadge status={call.disposition} /></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-[color:var(--ai)]" style={{ width: `${call.confidence}%` }} />
                        </div>
                        <span className="text-xs tabular-nums">{call.confidence}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">{Math.floor(call.durationSec/60)}m {call.durationSec%60}s</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatRelative(call.startedAt)}</TableCell>
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

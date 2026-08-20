import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/AppShell";
import { campaigns } from "@/mocks/data";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/data/StatusBadge";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { Sparkles, Plus, MoreVertical, Megaphone } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_app/campaigns/")({
  head: () => ({ meta: [{ title: "Campaigns — Triosoft" }] }),
  component: CampaignsPage,
});

function CampaignsPage() {
  return (
    <>
      <PageHeader
        title="Campaigns"
        description="Multi-channel AI campaigns across voice and WhatsApp."
        actions={
          <Button size="sm" asChild>
            <Link to="/campaigns/new"><Plus className="size-4" /> New campaign</Link>
          </Button>
        }
      />

      <div className="p-4 md:p-6 lg:p-8 space-y-4">
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All ({campaigns.length})</TabsTrigger>
            <TabsTrigger value="live">Live (4)</TabsTrigger>
            <TabsTrigger value="scheduled">Scheduled (1)</TabsTrigger>
            <TabsTrigger value="completed">Completed (1)</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid gap-3">
          {campaigns.map((c) => {
            const progress = c.totals.customers
              ? Math.round((c.totals.completed / c.totals.customers) * 100)
              : 0;
            const conv = c.totals.completed
              ? Math.round((c.totals.booked / c.totals.completed) * 100)
              : 0;
            return (
              <Link key={c.id} to="/campaigns/$id" params={{ id: c.id }}>
                <Card className="hover:border-primary/40 transition-colors">
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Megaphone className="size-4 text-muted-foreground" />
                          <span className="font-display font-semibold truncate">{c.name}</span>
                          <StatusBadge status={c.status} />
                          {c.channel.map((ch) => (
                            <span key={ch} className="rounded-full bg-muted px-2 py-0.5 text-[10px] capitalize">{ch}</span>
                          ))}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {c.voice} • Segment: <span className="capitalize">{c.segment.replace("-", " ")}</span> • Created {formatDate(c.createdAt)}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={(e) => e.preventDefault()}><MoreVertical className="size-4" /></Button>
                    </div>

                    <div className="mt-4 grid grid-cols-2 md:grid-cols-6 gap-3">
                      <Stat label="Customers" value={formatNumber(c.totals.customers)} />
                      <Stat label="Completed" value={formatNumber(c.totals.completed)} />
                      <Stat label="Connected" value={formatNumber(c.totals.connected)} />
                      <Stat label="Booked" value={formatNumber(c.totals.booked)} highlight />
                      <Stat label="Escalated" value={formatNumber(c.totals.escalated)} />
                      <Stat label="Revenue" value={formatCurrency(c.totals.revenue)} />
                    </div>

                    <div className="mt-4 flex items-center gap-3">
                      <Progress value={progress} className="h-1.5 flex-1" />
                      <span className="text-xs text-muted-foreground tabular-nums w-32 text-right">
                        {progress}% complete • {conv}% conv
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-[11px] uppercase text-muted-foreground tracking-wide">{label}</div>
      <div className={`text-base font-semibold font-display tabular-nums ${highlight ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}

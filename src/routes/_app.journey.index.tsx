import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { customers, campaigns, type LifecycleStage } from "@/mocks/data";
import { formatNumber } from "@/lib/format";
import {
  PhoneCall, MessageSquare, CalendarCheck, ShoppingCart,
  Wrench, ShieldCheck, RefreshCw, UserPlus, AlertCircle,
  ArrowRight, TrendingUp, Users, Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/_app/journey/")({
  head: () => ({
    meta: [
      { title: "Journey — Triosoft" },
      { name: "description", content: "Customer lifecycle journey and campaign conversion funnel for Om Honda Bhopal." },
      { property: "og:title", content: "Journey — Triosoft" },
      { property: "og:description", content: "Customer lifecycle journey and campaign conversion funnel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JourneyPage,
});

interface JourneyStage {
  id: LifecycleStage | "reengaged" | "referral";
  label: string;
  description: string;
  icon: React.ElementType;
  color: "primary" | "success" | "warning" | "info" | "ai" | "muted";
}

const JOURNEY_STAGES: JourneyStage[] = [
  { id: "enquiry", label: "Enquiry", description: "Walk-in, call, or web lead", icon: UserPlus, color: "info" },
  { id: "qualified", label: "Qualified", description: "Intent confirmed by AI or advisor", icon: Sparkles, color: "primary" },
  { id: "purchased", label: "Vehicle Purchased", description: "Two-wheeler delivered", icon: ShoppingCart, color: "success" },
  { id: "free_service", label: "Free Service", description: "1st/2nd/3rd free service", icon: Wrench, color: "info" },
  { id: "paid_service", label: "Paid Service", description: "Out-of-warranty service", icon: Wrench, color: "warning" },
  { id: "insurance_due", label: "Insurance Due", description: "Renewal window open", icon: ShieldCheck, color: "warning" },
  { id: "amc_due", label: "AMC Due", description: "Annual maintenance contract", icon: RefreshCw, color: "ai" },
  { id: "inactive", label: "Inactive", description: "No interaction 180d+", icon: AlertCircle, color: "muted" },
  { id: "loyal", label: "Loyal / Referral", description: "Repeat buyer & advocate", icon: TrendingUp, color: "success" },
];

const colorMap = {
  primary: "bg-primary/10 text-primary border-primary/20",
  success: "bg-[color:var(--success)]/10 text-[color:var(--success)] border-[color:var(--success)]/20",
  warning: "bg-[color:var(--warning)]/10 text-[color:var(--warning)] border-[color:var(--warning)]/20",
  info: "bg-[color:var(--info)]/10 text-[color:var(--info)] border-[color:var(--info)]/20",
  ai: "bg-[color:var(--ai)]/10 text-[color:var(--ai)] border-[color:var(--ai)]/20",
  muted: "bg-muted text-muted-foreground border-border",
};

function JourneyPage() {
  const stageCounts = JOURNEY_STAGES.map((stage) => ({
    ...stage,
    count: customers.filter((c) => c.lifecycleStage === stage.id).length,
  }));

  const totalReach = campaigns.reduce((s, c) => s + c.totals.customers, 0);
  const totalConnected = campaigns.reduce((s, c) => s + c.totals.connected, 0);
  const totalInterested = campaigns.reduce((s, c) => s + c.totals.interested, 0);
  const totalBooked = campaigns.reduce((s, c) => s + c.totals.booked, 0);
  // Approximate service completions from booked appointments (not call completions).
  const totalCompleted = Math.round(totalBooked * 0.82);

  const funnel = [
    { label: "Reach", value: totalReach, icon: Users, color: "var(--chart-1)" },
    { label: "Connected", value: totalConnected, icon: PhoneCall, color: "var(--chart-2)" },
    { label: "Interested", value: totalInterested, icon: MessageSquare, color: "var(--chart-3)" },
    { label: "Booked", value: totalBooked, icon: CalendarCheck, color: "var(--chart-4)" },
    { label: "Completed", value: totalCompleted, icon: TrendingUp, color: "var(--chart-5)" },
  ];

  return (
    <>
      <PageHeader
        title="Journey"
        description="Visualize the customer lifecycle and campaign conversion funnel for Om Honda Bhopal."
        actions={
          <Button size="sm" asChild>
            <Link to="/campaigns/new">
              <Sparkles className="size-4 mr-1.5" /> Launch campaign
            </Link>
          </Button>
        }
      />

      <div className="p-4 md:p-6 lg:p-8">
        <Tabs defaultValue="lifecycle">
          <TabsList>
            <TabsTrigger value="lifecycle">Customer Lifecycle</TabsTrigger>
            <TabsTrigger value="funnel">Campaign Conversion Funnel</TabsTrigger>
          </TabsList>

          <TabsContent value="lifecycle" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-display">Lifecycle stages</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  {/* Connector line */}
                  <div className="absolute top-[2.25rem] left-0 right-0 hidden lg:block">
                    <div className="mx-12 h-0.5 bg-gradient-to-r from-primary/40 via-[color:var(--ai)]/30 to-[color:var(--success)]/40" />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                    {stageCounts.map((stage, i) => {
                      const Icon = stage.icon;
                      const isLast = i === stageCounts.length - 1;
                      const nextStage = stageCounts[i + 1];
                      const conversion = nextStage && stage.count > 0
                        ? Math.round((nextStage.count / stage.count) * 100)
                        : null;

                      return (
                        <div key={stage.id} className="relative">
                          <Card className="relative z-10 overflow-hidden border hover:border-primary/30 transition-colors">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between">
                                <div className={cn("size-10 rounded-lg border grid place-items-center", colorMap[stage.color])}>
                                  <Icon className="size-5" />
                                </div>
                                <div className="text-right">
                                  <div className="text-2xl font-display font-semibold tabular-nums">
                                    {formatNumber(stage.count)}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground uppercase tracking-wide">customers</div>
                                </div>
                              </div>
                              <div className="mt-3">
                                <div className="font-display font-semibold text-sm">{stage.label}</div>
                                <div className="text-xs text-muted-foreground">{stage.description}</div>
                              </div>
                              {conversion !== null && (
                                <div className="mt-3 flex items-center gap-1.5 text-xs">
                                  <Badge variant="secondary" className="font-medium">
                                    → {conversion}% to next
                                  </Badge>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                          {!isLast && (
                            <div className="hidden xl:flex absolute -right-3 top-1/2 -translate-y-1/2 z-20">
                              <ArrowRight className="size-4 text-muted-foreground/50" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-display">Top drop-off points</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { stage: "Free Service → Paid Service", drop: "34%", note: "Customers often skip first paid service" },
                    { stage: "Insurance Due → Renewal", drop: "28%", note: "Price shopping with external insurers" },
                    { stage: "Inactive → Re-engaged", drop: "82%", note: "Hard to win back after 180 days" },
                  ].map((d) => (
                    <div key={d.stage} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                      <div>
                        <div className="text-sm font-medium">{d.stage}</div>
                        <div className="text-xs text-muted-foreground">{d.note}</div>
                      </div>
                      <Badge variant="destructive">{d.drop}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-display">Lifecycle touchpoints</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { channel: "AI Voice Call", stages: "Enquiry, Free Service, Insurance Due, Inactive", icon: PhoneCall },
                    { channel: "WhatsApp", stages: "Booking reminders, estimates, renewal links", icon: MessageSquare },
                    { channel: "Workshop Visit", stages: "Free Service, Paid Service, AMC", icon: Wrench },
                  ].map((t) => (
                    <div key={t.channel} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                      <div className="size-9 rounded-md bg-primary/10 text-primary grid place-items-center shrink-0">
                        <t.icon className="size-4" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">{t.channel}</div>
                        <div className="text-xs text-muted-foreground">{t.stages}</div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="funnel" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-display">Campaign conversion funnel</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-w-2xl mx-auto space-y-2">
                  {funnel.map((step, i) => {
                    const Icon = step.icon;
                    const prev = funnel[i - 1];
                    const dropOff = prev && prev.value > 0
                      ? Math.round(((prev.value - step.value) / prev.value) * 100)
                      : null;
                    const widthPct = totalReach > 0 ? (step.value / totalReach) * 100 : 0;

                    return (
                      <div key={step.label} className="relative">
                        <div
                          className="flex items-center gap-4 rounded-lg border bg-card px-4 py-3 transition-all hover:border-primary/30"
                          style={{ width: `${Math.max(widthPct, 20)}%` }}
                        >
                          <div className="size-9 rounded-md grid place-items-center shrink-0" style={{ background: `${step.color}20`, color: step.color }}>
                            <Icon className="size-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium">{step.label}</div>
                            <div className="text-xl font-display font-semibold tabular-nums">
                              {formatNumber(step.value)}
                            </div>
                          </div>
                        </div>
                        {dropOff !== null && (
                          <div className="mt-1.5 mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="inline-block h-px w-4 bg-border" />
                            {dropOff}% drop-off
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-3">
              {campaigns.filter((c) => c.status === "live" || c.status === "completed").slice(0, 3).map((c) => {
                const reach = c.totals.customers;
                const bookedRate = reach > 0 ? ((c.totals.booked / reach) * 100).toFixed(1) : "0";
                const connectedRate = reach > 0 ? ((c.totals.connected / reach) * 100).toFixed(1) : "0";

                return (
                  <Card key={c.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-display">{c.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Reach</span>
                        <span className="font-medium tabular-nums">{formatNumber(reach)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Connected</span>
                        <span className="font-medium tabular-nums">{connectedRate}%</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Booked</span>
                        <span className="font-medium tabular-nums text-[color:var(--success)]">{bookedRate}%</span>
                      </div>
                      <Button variant="outline" size="sm" className="w-full" asChild>
                        <Link to="/campaigns/$id" params={{ id: c.id }}>View campaign</Link>
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

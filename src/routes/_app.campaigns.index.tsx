import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/data/StatusBadge";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { MoreVertical, Megaphone, RefreshCcw } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { get_campaigns, server_get_data } from "@/components/ServiceConnection/serviceconnection";

/* -------------------------------------------------------------------------- */
/* Types — mirrors views_admin.campaigns()/_serialize_campaign (docs §19.6)   */
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

interface ApiCampaign {
  id: number;
  name: string;
  segment: { id: number; name: string } | null;
  agent: { id: number; persona_name: string; agent_name?: string } | null;
  channel: string[];
  is_active: boolean;
  status: "live" | "paused" | "draft";
  daily_call_limit: number;
  totals: CampaignTotals;
  created_at: string | null;
}

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

// 🔥 No "New campaign" action on this page. Campaigns are 1:1 with a
// Segment and are seeded once at setup (docs §11.1/§11.3/§11.6) — same
// rule as Segments, which the docs are explicit have no "New Segment"
// action either (§8.7). The panel only lets you view and operate the
// seven campaigns that already exist.
export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<ApiCampaign[]>([]);
  const [tab, setTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCampaigns = () => {
    setLoading(true);
    setError(null);

    server_get_data(get_campaigns)
      .then((res) => setCampaigns(res?.campaigns ?? []))
      .catch(() => setError("Couldn't load campaigns. Pull to refresh or try again."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadCampaigns();
  }, []);

  const counts = useMemo(
    () => ({
      all: campaigns.length,
      live: campaigns.filter((c) => c.status === "live").length,
      paused: campaigns.filter((c) => c.status === "paused").length,
      draft: campaigns.filter((c) => c.status === "draft").length,
    }),
    [campaigns],
  );

  const visible = campaigns.filter((c) => tab === "all" || c.status === tab);

  return (
    <>
      <PageHeader
        title="Campaigns"
        description="Multi-channel AI campaigns across voice and WhatsApp."
        actions={
          <Button size="sm" variant="outline" onClick={loadCampaigns} disabled={loading}>
            <RefreshCcw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      <div className="p-4 md:p-6 lg:p-8 space-y-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="all">All ({counts.all})</TabsTrigger>

            <TabsTrigger value="live">Live ({counts.live})</TabsTrigger>

            <TabsTrigger value="paused">Paused ({counts.paused})</TabsTrigger>

            <TabsTrigger value="draft">Draft ({counts.draft})</TabsTrigger>
          </TabsList>
        </Tabs>

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading && !campaigns.length && !error && (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading campaigns…</div>
        )}

        {!loading && !error && !visible.length && (
          <div className="text-sm text-muted-foreground py-8 text-center">
            No campaigns in this view.
          </div>
        )}

        <div className="grid gap-3">
          {visible.map((c) => {
            const progress = c.totals.customers
              ? Math.round((c.totals.completed / c.totals.customers) * 100)
              : 0;

            const conv = c.totals.completed
              ? Math.round((c.totals.booked / c.totals.completed) * 100)
              : 0;

            return (
              <Link key={c.id} to={`/campaigns/${c.id}`}>
                <Card className="hover:border-primary/40 transition-colors">
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Megaphone className="size-4 text-muted-foreground" />

                          <span className="font-display font-semibold truncate">{c.name}</span>

                          <StatusBadge status={c.status} />

                          {(c.channel ?? []).map((ch) => (
                            <span
                              key={ch}
                              className="rounded-full bg-muted px-2 py-0.5 text-[10px] capitalize"
                            >
                              {ch}
                            </span>
                          ))}
                        </div>

                        <div className="mt-1 text-xs text-muted-foreground">
                          {c.agent?.persona_name ?? c.agent?.agent_name ?? "No agent"} • Segment:{" "}
                          <span className="capitalize">{c.segment?.name ?? "—"}</span>
                          {c.created_at && <> • Created {formatDate(c.created_at)}</>}
                        </div>
                      </div>

                      <Button variant="ghost" size="icon" onClick={(e) => e.preventDefault()}>
                        <MoreVertical className="size-4" />
                      </Button>
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

      <div
        className={`text-base font-semibold font-display tabular-nums ${highlight ? "text-primary" : ""
          }`}
      >
        {value}
      </div>
    </div>
  );
}
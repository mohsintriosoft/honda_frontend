import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { Link } from "react-router-dom";

import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/data/StatusBadge";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { Megaphone, RefreshCcw, Pause, Play } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  get_campaigns,
  campaign_pause,
  campaign_resume,
  server_get_data,
  server_post_data,
} from "@/components/ServiceConnection/serviceconnection";

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

interface CampaignAllocation {
  total: number;
  budget: number;
  over: number;
}

interface ApiCampaign {
  id: number;
  name: string;
  segment: { id: number; name: string } | null;
  agent: { id: number; persona_name: string; agent_name?: string } | null;
  // 🔥 NEW — docs §11.5 "Targeting": NULL = whole dealer, set = one branch.
  branch: { id: number; name: string } | null;
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
  // docs §11.4: every active campaign's daily_call_limit is validated
  // against Dealer.daily_call_budget (a warning, never a hard block).
  // views_admin.campaigns() precomputes this server-side (single source
  // of truth for the over-budget math) and returns it as `allocation`.
  const [allocation, setAllocation] = useState<CampaignAllocation | null>(null);
  const [tab, setTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Campaign ids with an in-flight pause/resume call — disables that
  // card's toggle so a double click can't fire two conflicting requests.
  const [togglingIds, setTogglingIds] = useState<Set<number>>(new Set());

  const loadCampaigns = () => {
    setLoading(true);
    setError(null);

    server_get_data(get_campaigns)
      .then((res) => {
        setCampaigns(res?.campaigns ?? []);
        setAllocation(res?.allocation ?? null);
      })
      .catch(() => setError("Couldn't load campaigns. Pull to refresh or try again."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadCampaigns();
  }, []);

  // Inline ON/OFF toggle — docs §11.9's list mockup is explicit that
  // "Toggle and limit are editable inline" right here, not only on the
  // detail page. Stops propagation so it doesn't also trigger the
  // card's Link navigation.
  const toggleCampaign = (e: MouseEvent, campaign: ApiCampaign) => {
    e.preventDefault();
    e.stopPropagation();

    if (togglingIds.has(campaign.id)) return;

    setTogglingIds((prev) => new Set(prev).add(campaign.id));

    const request = campaign.is_active
      ? server_post_data(campaign_pause(campaign.id))
      : server_post_data(campaign_resume(campaign.id));

    request
      .then(() => loadCampaigns())
      .finally(() => {
        setTogglingIds((prev) => {
          const next = new Set(prev);
          next.delete(campaign.id);
          return next;
        });
      });
  };

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
                          {" • "}
                          {c.branch ? c.branch.name : "All branches"}
                          {" • limit "}
                          {formatNumber(c.daily_call_limit)}/day
                          {c.created_at && <> • Created {formatDate(c.created_at)}</>}
                        </div>
                      </div>

                      <Button
                        variant={c.is_active ? "outline" : "default"}
                        size="sm"
                        disabled={togglingIds.has(c.id)}
                        onClick={(e) => toggleCampaign(e, c)}
                      >
                        {c.is_active ? (
                          <>
                            <Pause className="size-4" />
                            {togglingIds.has(c.id) ? "Pausing…" : "Pause"}
                          </>
                        ) : (
                          <>
                            <Play className="size-4" />
                            {togglingIds.has(c.id) ? "Resuming…" : "Resume"}
                          </>
                        )}
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

        {!loading && !error && !!campaigns.length && (
          <AllocationFooter allocation={allocation} />
        )}
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Allocation footer — docs §11.4: "Total allocation: 1,000 / 1,000 ✓" /       */
/* "⚠ 50 unused" / "✗ 50 over budget". A warning, never a hard block —        */
/* the dialer's real ceiling is Dealer.max_concurrent_calls + the calling     */
/* window, this is just guidance while setting daily_call_limit per campaign. */
/* -------------------------------------------------------------------------- */

function AllocationFooter({ allocation }: { allocation: CampaignAllocation | null }) {
  if (!allocation) return null;

  const { total, budget, over } = allocation;
  const tone = over > 0 ? "text-destructive" : total < budget ? "text-amber-500" : "text-emerald-500";
  const suffix =
    over > 0
      ? `✗ ${formatNumber(over)} over budget`
      : total < budget
        ? `⚠ ${formatNumber(budget - total)} unused`
        : "✓";

  return (
    <div className={`text-xs tabular-nums text-right pt-1 ${tone}`}>
      Total allocation: {formatNumber(total)} / {formatNumber(budget)} {suffix}
    </div>
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
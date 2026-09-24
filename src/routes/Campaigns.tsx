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
import { hasPerm } from "@/lib/permissions";

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
  branch: { id: number; name: string } | null;
  channel: string[];
  is_active: boolean;
  status: "live" | "paused" | "draft";
  daily_call_limit: number;
  totals: CampaignTotals;
  created_at: string | null;
}

function apiErrorMessage(err: any, fallback: string) {
  if (err?.response?.status === 403) return "You don't have permission to change campaigns.";
  return err?.response?.data?.error ?? fallback;
}

export default function CampaignsPage() {
  const canEdit = hasPerm("campaigns.edit");
  const [campaigns, setCampaigns] = useState<ApiCampaign[]>([]);
  const [allocation, setAllocation] = useState<CampaignAllocation | null>(null);
  const [tab, setTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [togglingIds, setTogglingIds] = useState<Set<number>>(new Set());

  const loadCampaigns = () => {
    setLoading(true);
    setError(null);

    server_get_data(get_campaigns)
      .then((res) => {
        setCampaigns(res?.campaigns ?? []);
        setAllocation(res?.allocation ?? null);
      })
      .catch((err) =>
        setError(
          err?.response?.status === 403
            ? "Your role does not have permission to view campaigns."
            : "Couldn't load campaigns. Pull to refresh or try again.",
        ),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadCampaigns();
  }, []);

  const toggleCampaign = (e: MouseEvent, campaign: ApiCampaign) => {
    e.preventDefault();
    e.stopPropagation();

    if (togglingIds.has(campaign.id)) return;

    setActionError(null);
    setTogglingIds((prev) => new Set(prev).add(campaign.id));

    const request = campaign.is_active
      ? server_post_data(campaign_pause(campaign.id))
      : server_post_data(campaign_resume(campaign.id));

    request
      .then((res) => {
        if (res?.success === false) throw { response: { data: res } };
        loadCampaigns();
      })
      .catch((err) => {
        setActionError(
          apiErrorMessage(
            err,
            `Couldn't ${campaign.is_active ? "pause" : "resume"} "${campaign.name}". Try again.`,
          ),
        );
      })
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

        {(error || actionError) && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error ?? actionError}
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
            const totals = c.totals ?? ({} as CampaignTotals);
            const progress = totals.customers
              ? Math.min(100, Math.round((totals.completed / totals.customers) * 100))
              : 0;

            const conv = totals.completed
              ? Math.round((totals.booked / totals.completed) * 100)
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
                          {formatNumber(c.daily_call_limit ?? 0)}/day
                          {c.created_at && <> • Created {formatDate(c.created_at)}</>}
                        </div>
                      </div>

                      {canEdit && (
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
                      )}
                    </div>

                    <div className="mt-4 grid grid-cols-2 md:grid-cols-6 gap-3">
                      <Stat label="Customers" value={formatNumber(totals.customers ?? 0)} />
                      <Stat label="Completed" value={formatNumber(totals.completed ?? 0)} />
                      <Stat label="Connected" value={formatNumber(totals.connected ?? 0)} />
                      <Stat label="Booked" value={formatNumber(totals.booked ?? 0)} highlight />
                      <Stat label="Escalated" value={formatNumber(totals.escalated ?? 0)} />
                      <Stat label="Revenue" value={formatCurrency(totals.revenue ?? 0)} />
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

        {!loading && !error && !!campaigns.length && <AllocationFooter allocation={allocation} />}
      </div>
    </>
  );
}

function AllocationFooter({ allocation }: { allocation: CampaignAllocation | null }) {
  if (!allocation) return null;

  const { total, budget, over } = allocation;
  const tone =
    over > 0 ? "text-destructive" : total < budget ? "text-amber-500" : "text-emerald-500";
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
        className={`text-base font-semibold font-display tabular-nums ${
          highlight ? "text-primary" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

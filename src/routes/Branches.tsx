import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/layout/AppShell";
import { server_get_data, get_branches } from "@/components/ServiceConnection/serviceconnection";
import type { Branch } from "@/mocks/branches";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatNumber } from "@/lib/format";
import { Plus, MoreVertical, Building2, MapPin, Loader2, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type BranchWithSlots = Branch & { slotsPerDay: number };

export default function BranchesPage() {
  const [branches, setBranches] = useState<BranchWithSlots[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | "active" | "inactive">("all");

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    server_get_data(get_branches, { detail: 1 })
      .then((res) => {
        if (!cancelled) setBranches(res?.branches ?? []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err?.response?.status === 403
            ? "Your role does not have permission to view branches."
            : "Couldn't load branches. Please try again.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const activeCount = branches.filter((b) => b.isActive).length;
  const inactiveCount = branches.length - activeCount;

  const visibleBranches = branches.filter((b) => {
    if (tab === "active") return b.isActive;
    if (tab === "inactive") return !b.isActive;
    return true;
  });

  return (
    <>
      <PageHeader
        title="Branches"
        description="Every showroom/workshop location, its slot config, and holidays."
      />

      <div className="p-4 md:p-6 lg:p-8 space-y-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="all">All ({branches.length})</TabsTrigger>

            <TabsTrigger value="active">Active ({activeCount})</TabsTrigger>

            <TabsTrigger value="inactive">Inactive ({inactiveCount})</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading branches…
          </div>
        )}

        {!loading && error && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <AlertCircle className="size-6 text-destructive" />
              <p className="text-sm text-muted-foreground">{error}</p>
            </CardContent>
          </Card>
        )}

        {!loading && !error && visibleBranches.length === 0 && (
          <Card>
            <CardContent className="py-16 text-center text-sm text-muted-foreground">
              No branches to show here yet.
            </CardContent>
          </Card>
        )}

        {!loading && !error && (
          <div className="grid gap-3">
            {visibleBranches.map((b) => {
              const perDay = b.slotsPerDay;

              return (
                <Link key={b.id} to={`/branches/${b.id}`}>
                  <Card className="hover:border-primary/40 transition-colors">
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Building2 className="size-4 text-muted-foreground" />

                            <span className="font-display font-semibold truncate">{b.name}</span>

                            <Badge variant={b.isActive ? "outline" : "secondary"}>
                              {b.isActive ? "Active" : "Inactive"}
                            </Badge>

                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase">
                              {b.code}
                            </span>

                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] capitalize">
                              {b.city}
                            </span>
                          </div>

                          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="size-3" />
                            <span className="truncate">{b.address}</span>
                            {b.createdAt && (
                              <span className="shrink-0">• Added {formatDate(b.createdAt)}</span>
                            )}
                          </div>
                        </div>

                        <Button variant="ghost" size="icon" onClick={(e) => e.preventDefault()}>
                          <MoreVertical className="size-4" />
                        </Button>
                      </div>

                      <div className="mt-4 grid grid-cols-2 md:grid-cols-6 gap-3">
                        <Stat label="Staff" value={formatNumber(b.stats?.staff ?? 0)} />

                        <Stat label="Slots / day" value={formatNumber(perDay ?? 0)} />

                        <Stat label="Max / slot" value={formatNumber(b.maxPerSlot ?? 0)} />

                        <Stat
                          label="Appts (month)"
                          value={formatNumber(b.stats?.appointmentsThisMonth ?? 0)}
                          highlight
                        />

                        <Stat label="Holidays" value={formatNumber(b.holidays?.length ?? 0)} />

                        <Stat
                          label="Hours"
                          value={`${b.openingTime ?? "—"}–${b.closingTime ?? "—"}`}
                        />
                      </div>

                      <div className="mt-4 flex items-center gap-3">
                        <Progress value={b.stats?.utilization ?? 0} className="h-1.5 flex-1" />

                        <span className="text-xs text-muted-foreground tabular-nums w-32 text-right">
                          {b.stats?.utilization ?? 0}% slot utilization
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
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

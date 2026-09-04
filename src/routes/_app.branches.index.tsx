import { Link } from "react-router-dom";
import { PageHeader } from "@/components/layout/AppShell";
import { branches, slotsPerDay } from "@/mocks/branches";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatNumber } from "@/lib/format";
import { Plus, MoreVertical, Building2, MapPin } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function BranchesPage() {
    const activeCount = branches.filter((b) => b.isActive).length;
    const inactiveCount = branches.length - activeCount;

    return (
        <>
            <PageHeader
                title="Branches"
                description="Every showroom/workshop location, its slot config, and holidays."
                actions={
                    <Button size="sm" asChild>
                        <Link to="/branches/new">
                            <Plus className="size-4" />
                            Add branch
                        </Link>
                    </Button>
                }
            />

            <div className="p-4 md:p-6 lg:p-8 space-y-4">
                <Tabs defaultValue="all">
                    <TabsList>
                        <TabsTrigger value="all">All ({branches.length})</TabsTrigger>

                        <TabsTrigger value="active">Active ({activeCount})</TabsTrigger>

                        <TabsTrigger value="inactive">Inactive ({inactiveCount})</TabsTrigger>
                    </TabsList>
                </Tabs>

                <div className="grid gap-3">
                    {branches.map((b) => {
                        const perDay = slotsPerDay(b);

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
                                                    <span className="shrink-0">• Added {formatDate(b.createdAt)}</span>
                                                </div>
                                            </div>

                                            <Button variant="ghost" size="icon" onClick={(e) => e.preventDefault()}>
                                                <MoreVertical className="size-4" />
                                            </Button>
                                        </div>

                                        <div className="mt-4 grid grid-cols-2 md:grid-cols-6 gap-3">
                                            <Stat label="Staff" value={formatNumber(b.stats.staff)} />

                                            <Stat label="Slots / day" value={formatNumber(perDay)} />

                                            <Stat label="Max / slot" value={formatNumber(b.maxPerSlot)} />

                                            <Stat
                                                label="Appts (month)"
                                                value={formatNumber(b.stats.appointmentsThisMonth)}
                                                highlight
                                            />

                                            <Stat label="Holidays" value={formatNumber(b.holidays.length)} />

                                            <Stat label="Hours" value={`${b.openingTime}–${b.closingTime}`} />
                                        </div>

                                        <div className="mt-4 flex items-center gap-3">
                                            <Progress value={b.stats.utilization} className="h-1.5 flex-1" />

                                            <span className="text-xs text-muted-foreground tabular-nums w-32 text-right">
                                                {b.stats.utilization}% slot utilization
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
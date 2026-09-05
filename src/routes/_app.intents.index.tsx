import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

import {
    Target,
    ThumbsUp,
    ThumbsDown,
    ArrowRight,
    ArrowUpRight,
    ArrowDownRight,
    Gauge,
    ListChecks,
    ShieldAlert,
} from "lucide-react";

import { formatNumber } from "@/lib/format";
import { get_intents, server_get_data } from "@/components/ServiceConnection/serviceconnection";

type WorthLevel = "High" | "Medium" | "Low";

const WORTH_STYLE: Record<WorthLevel, string> = {
    High: "bg-destructive/10 text-destructive border-destructive/30",
    Medium: "bg-[color:var(--warning,theme(colors.amber.500))]/10 text-amber-600 border-amber-500/30",
    Low: "bg-muted text-muted-foreground border-muted-foreground/20",
};

interface IntentRow {
    code: string;
    label: string;
    description: string;
    worth_level: WorthLevel;
    worth_reason: string;
    total_turns: number;
    positives: number;
    negatives: number;
    accuracy: number;
    avg_confidence: number;
    week_over_week_delta: number;
    top_confused_with: string | null;
    cache_updated_at: string | null;
}

export default function IntentsPage() {
    const [intents, setIntents] = useState<IntentRow[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        // 🔥 Single flat read of the Intent table — no aggregation, no
        // turn rows touched. Card detail (the actual QA table) is fetched
        // separately, only once a card is opened, on /intents/:code.
        server_get_data(get_intents)
            .then((res) => {
                if (cancelled) return;
                setIntents(res?.intents ?? []);
            })
            .catch((err) => {
                if (cancelled) return;
                console.error("Failed to load intent accuracy:", err);
                setError("Couldn't load intent accuracy data.");
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const totalTurns = intents?.reduce((sum, i) => sum + i.total_turns, 0) ?? 0;
    const totalPositives = intents?.reduce((sum, i) => sum + i.positives, 0) ?? 0;
    const overallAccuracy = totalTurns > 0 ? Math.round((totalPositives / totalTurns) * 100) : 0;
    const highWorthMismatches =
        intents
            ?.filter((i) => i.worth_level === "High")
            .reduce((sum, i) => sum + i.negatives, 0) ?? 0;

    return (
        <>
            <PageHeader
                title="Intent Accuracy"
                description="How well the fast classifier reads every call, intent by intent — with what each one is actually worth to the business."
            />

            <div className="p-4 md:p-6 lg:p-8 space-y-6">
                {/* ==================================================
              SUMMARY CARDS
          ================================================== */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                        { label: "Turns classified", value: formatNumber(totalTurns), icon: ListChecks },
                        { label: "Overall accuracy", value: `${overallAccuracy}%`, icon: Gauge },
                        { label: "Correct calls", value: formatNumber(totalPositives), icon: ThumbsUp },
                        {
                            label: "Mismatches on high-worth intents",
                            value: formatNumber(highWorthMismatches),
                            icon: ShieldAlert,
                        },
                    ].map((item) => (
                        <Card key={item.label}>
                            <CardContent className="pt-6 flex items-center gap-3">
                                <div className="size-9 rounded-lg bg-primary/10 text-primary grid place-items-center">
                                    <item.icon className="size-4" />
                                </div>
                                <div>
                                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                        {item.label}
                                    </div>
                                    <div className="text-xl font-semibold font-display tabular-nums">
                                        {intents === null ? <Skeleton className="h-6 w-12" /> : item.value}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* ==================================================
              ERROR STATE
          ================================================== */}
                {error && (
                    <Card>
                        <CardContent className="py-10 text-center text-sm text-muted-foreground">
                            {error}
                        </CardContent>
                    </Card>
                )}

                {/* ==================================================
              LOADING STATE
          ================================================== */}
                {!error && intents === null && (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <Card key={i}>
                                <CardContent className="pt-6 space-y-4">
                                    <Skeleton className="h-5 w-2/3" />
                                    <Skeleton className="h-3 w-full" />
                                    <Skeleton className="h-1.5 w-full" />
                                    <Skeleton className="h-16 w-full" />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {/* ==================================================
              EMPTY STATE
          ================================================== */}
                {!error && intents !== null && intents.length === 0 && (
                    <Card>
                        <CardContent className="py-10 text-center text-sm text-muted-foreground">
                            No intent accuracy data yet — seed the Intent catalog
                            (<code>manage.py seed_intents</code>) and run
                            (<code>manage.py refresh_intent_accuracy</code>) once calls have
                            been through post-call QA.
                        </CardContent>
                    </Card>
                )}

                {/* ==================================================
              INTENT CARDS
          ================================================== */}
                {!error && intents !== null && intents.length > 0 && (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {intents.map((intent) => (
                            <Link key={intent.code} to={`/intents/${intent.code}`} className="block">
                                <Card className="h-full hover:shadow-md hover:border-primary/40 transition-all group">
                                    <CardContent className="pt-6 space-y-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-display font-semibold">{intent.label}</span>
                                                    <Badge variant="outline" className={WORTH_STYLE[intent.worth_level]}>
                                                        {intent.worth_level} worth
                                                    </Badge>
                                                </div>
                                                <div className="text-xs text-muted-foreground mt-1">
                                                    {intent.description}
                                                </div>
                                            </div>
                                            <div className="size-9 shrink-0 rounded-lg bg-primary/10 text-primary grid place-items-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                                <Target className="size-4" />
                                            </div>
                                        </div>

                                        <p className="text-[11px] text-muted-foreground leading-snug border-l-2 pl-2.5">
                                            {intent.worth_reason}
                                        </p>

                                        <div>
                                            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                                <span>Classifier accuracy</span>
                                                <span className="flex items-center gap-1 tabular-nums">
                                                    {intent.accuracy}%
                                                    {intent.week_over_week_delta >= 0 ? (
                                                        <span className="text-[color:var(--success)] flex items-center">
                                                            <ArrowUpRight className="size-3" />
                                                            {intent.week_over_week_delta}
                                                        </span>
                                                    ) : (
                                                        <span className="text-destructive flex items-center">
                                                            <ArrowDownRight className="size-3" />
                                                            {Math.abs(intent.week_over_week_delta)}
                                                        </span>
                                                    )}
                                                </span>
                                            </div>
                                            <Progress value={intent.accuracy} className="h-1.5 mt-1" />
                                        </div>

                                        <div className="grid grid-cols-3 gap-2 text-center">
                                            <div className="rounded-md border p-2">
                                                <div className="text-[10px] uppercase text-muted-foreground flex items-center justify-center gap-1">
                                                    <ThumbsUp className="size-3" /> Correct
                                                </div>
                                                <div className="text-sm font-semibold tabular-nums">
                                                    {formatNumber(intent.positives)}
                                                </div>
                                            </div>
                                            <div className="rounded-md border p-2">
                                                <div className="text-[10px] uppercase text-muted-foreground flex items-center justify-center gap-1">
                                                    <ThumbsDown className="size-3" /> Missed
                                                </div>
                                                <div className="text-sm font-semibold tabular-nums">
                                                    {formatNumber(intent.negatives)}
                                                </div>
                                            </div>
                                            <div className="rounded-md border p-2">
                                                <div className="text-[10px] uppercase text-muted-foreground">Volume</div>
                                                <div className="text-sm font-semibold tabular-nums">
                                                    {formatNumber(intent.total_turns)}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-muted-foreground">
                                                Often confused with{" "}
                                                <span className="font-medium text-foreground">
                                                    {(intent.top_confused_with ?? "—").replace(/_/g, " ")}
                                                </span>
                                            </span>
                                            <span className="flex items-center gap-1 text-primary font-medium shrink-0">
                                                Review turns
                                                <ArrowRight className="size-3" />
                                            </span>
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}
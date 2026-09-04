import { Link } from "react-router-dom";

import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

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

import { INTENT_SUMMARIES, WORTH_STYLE } from "@/mocks/intents";
import { formatNumber } from "@/lib/format";

export default function IntentsPage() {
    const totalTurns = INTENT_SUMMARIES.reduce((sum, i) => sum + i.totalTurns, 0);
    const totalPositives = INTENT_SUMMARIES.reduce((sum, i) => sum + i.positives, 0);
    const totalNegatives = INTENT_SUMMARIES.reduce((sum, i) => sum + i.negatives, 0);
    const overallAccuracy = totalTurns > 0 ? Math.round((totalPositives / totalTurns) * 100) : 0;
    const highWorthMismatches = INTENT_SUMMARIES.filter((i) => i.worth.level === "High").reduce(
        (sum, i) => sum + i.negatives,
        0,
    );

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
                                        {item.value}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* ==================================================
              INTENT CARDS
          ================================================== */}
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {INTENT_SUMMARIES.map((intent) => (
                        <Link key={intent.code} to={`/intents/${intent.code}`} className="block">
                            <Card className="h-full hover:shadow-md hover:border-primary/40 transition-all group">
                                <CardContent className="pt-6 space-y-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-display font-semibold">{intent.label}</span>
                                                <Badge variant="outline" className={WORTH_STYLE[intent.worth.level]}>
                                                    {intent.worth.level} worth
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
                                        {intent.worth.reason}
                                    </p>

                                    <div>
                                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                            <span>Classifier accuracy</span>
                                            <span className="flex items-center gap-1 tabular-nums">
                                                {intent.accuracy}%
                                                {intent.weekOverWeekDelta >= 0 ? (
                                                    <span className="text-[color:var(--success)] flex items-center">
                                                        <ArrowUpRight className="size-3" />
                                                        {intent.weekOverWeekDelta}
                                                    </span>
                                                ) : (
                                                    <span className="text-destructive flex items-center">
                                                        <ArrowDownRight className="size-3" />
                                                        {Math.abs(intent.weekOverWeekDelta)}
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
                                                {formatNumber(intent.totalTurns)}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground">
                                            Often confused with{" "}
                                            <span className="font-medium text-foreground">
                                                {intent.topConfusedWith.replace(/_/g, " ")}
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
            </div>
        </>
    );
}
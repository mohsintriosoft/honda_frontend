import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";

import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

import { Search, Download, CheckCircle2, XCircle, PhoneCall, ChevronLeft, ChevronRight } from "lucide-react";

import { initials, formatRelative } from "@/lib/format";
import { get_intent_summary, get_intent_turns, server_get_data } from "@/components/ServiceConnection/serviceconnection";

const MATCH_STYLE = "bg-[color:var(--success)]/12 text-[color:var(--success)] border-[color:var(--success)]/30";
const MISMATCH_STYLE = "bg-destructive/10 text-destructive border-destructive/30";
const SEARCH_DEBOUNCE_MS = 350;

type ViewFilter = "all" | "match" | "mismatch";

interface IntentSummary {
    code: string;
    label: string;
    description: string;
    totalTurns: number;
    positives: number;
    negatives: number;
    accuracy: number;
    avgConfidence: number;
    topConfusedWith: string;
}

interface IntentTurnRow {
    id: number;
    callSessionId: string;
    turnNumber: number;
    customerName: string;
    branch: string;
    customerText: string;
    detectedIntent: string;
    correctIntent: string;
    confidence: number;
    fillerUsed: string;
    suggestedFiller: string;
    match: boolean;
    timestamp: string;
}

function intentLabel(code: string): string {
    return code.replace(/_/g, " ");
}

function mapSummary(row: any): IntentSummary {
    return {
        code: row.code,
        label: row.label,
        description: row.description,
        totalTurns: row.total_turns,
        positives: row.positives,
        negatives: row.negatives,
        accuracy: row.accuracy,
        avgConfidence: row.avg_confidence,
        topConfusedWith: row.top_confused_with ?? "—",
    };
}

function mapTurn(row: any): IntentTurnRow {
    return {
        id: row.id,
        callSessionId: row.call_session_id,
        turnNumber: row.turn_number,
        customerName: row.customer_name || "Unknown",
        branch: row.branch || "—",
        customerText: row.customer_text,
        detectedIntent: row.detected_intent,
        correctIntent: row.correct_intent,
        confidence: row.confidence,
        fillerUsed: row.filler_used,
        suggestedFiller: row.suggested_filler,
        match: row.match,
        timestamp: row.timestamp,
    };
}

export default function IntentDetailsPage() {
    const { code } = useParams<{ code: string }>();

    // 🔥 Card-level fetches, only for THIS intent — nothing here touches
    // the other intents' data, and neither request is made until this
    // page (i.e. the card) is actually opened.
    const [summary, setSummary] = useState<IntentSummary | null>(null);
    const [summaryError, setSummaryError] = useState<string | null>(null);
    const [notFound, setNotFound] = useState(false);

    const [turns, setTurns] = useState<IntentTurnRow[] | null>(null);
    const [turnsCount, setTurnsCount] = useState(0);
    const [turnsError, setTurnsError] = useState<string | null>(null);

    const [qInput, setQInput] = useState("");
    const [q, setQ] = useState("");
    const [view, setView] = useState<ViewFilter>("all");
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 25;

    // Summary strip — fetched once per intent code. label/description
    // come straight off the Intent row (see voice_bot.models.Intent).
    useEffect(() => {
        if (!code) return;
        let cancelled = false;
        setSummary(null);
        setSummaryError(null);
        setNotFound(false);

        server_get_data(get_intent_summary(code))
            .then((res) => {
                if (cancelled) return;
                const row = res?.intents?.[0];
                if (row) {
                    setSummary(mapSummary(row));
                } else {
                    setNotFound(true);
                }
            })
            .catch((err) => {
                if (cancelled) return;
                console.error("Failed to load intent summary:", err);
                setSummaryError("Couldn't load this intent's summary.");
            });

        return () => {
            cancelled = true;
        };
    }, [code]);

    // Debounce the search box so every keystroke doesn't hit the server.
    useEffect(() => {
        const handle = setTimeout(() => setQ(qInput), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(handle);
    }, [qInput]);

    // Turn-level table — paginated server-side, refetched on code/view/search/page.
    useEffect(() => {
        if (!code || notFound) return;
        let cancelled = false;
        setTurns(null);
        setTurnsError(null);

        server_get_data(get_intent_turns(code), {
            view,
            search: q || undefined,
            page,
            page_size: PAGE_SIZE,
        })
            .then((res) => {
                if (cancelled) return;
                setTurns((res?.results ?? []).map(mapTurn));
                setTurnsCount(res?.count ?? 0);
            })
            .catch((err) => {
                if (cancelled) return;
                console.error("Failed to load intent turns:", err);
                setTurnsError("Couldn't load turns for this intent.");
            });

        return () => {
            cancelled = true;
        };
    }, [code, view, q, page, notFound]);

    const changeView = (next: ViewFilter) => {
        setView(next);
        setPage(1);
    };

    const changeQuery = (next: string) => {
        setQInput(next);
        setPage(1);
    };

    const pageCount = Math.max(1, Math.ceil(turnsCount / PAGE_SIZE));
    const currentPage = Math.min(page, pageCount);

    if (notFound) {
        return (
            <>
                <PageHeader
                    title="Intent not found"
                    breadcrumbs={[{ label: "Intents", to: "/intents" }, { label: "Unknown" }]}
                />
                <div className="p-4 md:p-6 lg:p-8">
                    <Card>
                        <CardContent className="py-16 text-center text-sm text-muted-foreground">
                            We don't have data for this intent yet.
                            <div className="mt-4">
                                <Link to="/intents" className="text-primary font-medium">
                                    Back to Intents
                                </Link>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </>
        );
    }

    const headerLabel = summary?.label ?? intentLabel(code ?? "");

    return (
        <>
            <PageHeader
                title={`${headerLabel} — turn-level QA`}
                description={summary?.description ?? ""}
                breadcrumbs={[{ label: "Intents", to: "/intents" }, { label: headerLabel }]}
                actions={
                    <Button variant="outline" size="sm">
                        <Download className="size-4" />
                        Export
                    </Button>
                }
            />

            <div className="p-4 md:p-6 lg:p-8 space-y-4">
                {/* ==================================================
              SUMMARY STRIP
          ================================================== */}
                {summaryError ? (
                    <Card>
                        <CardContent className="py-6 text-center text-sm text-muted-foreground">
                            {summaryError}
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardContent className="pt-6">
                                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                    Accuracy
                                </div>
                                <div className="text-xl font-semibold font-display tabular-nums">
                                    {summary ? <>{summary.accuracy}%</> : <Skeleton className="h-6 w-14" />}
                                </div>
                                <div className="text-[11px] text-muted-foreground mt-0.5">
                                    {summary ? `avg confidence ${summary.avgConfidence}%` : "\u00A0"}
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6">
                                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                    Correct vs missed
                                </div>
                                <div className="text-xl font-semibold font-display tabular-nums">
                                    {summary ? (
                                        <>
                                            {summary.positives}
                                            <span className="text-muted-foreground font-normal"> / </span>
                                            {summary.negatives}
                                        </>
                                    ) : (
                                        <Skeleton className="h-6 w-16" />
                                    )}
                                </div>
                                <div className="text-[11px] text-muted-foreground mt-0.5">
                                    {summary ? `out of ${summary.totalTurns} classified turns` : "\u00A0"}
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6">
                                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                    Most confused with
                                </div>
                                <div className="text-xl font-semibold font-display capitalize">
                                    {summary ? (
                                        summary.topConfusedWith.replace(/_/g, " ")
                                    ) : (
                                        <Skeleton className="h-6 w-24" />
                                    )}
                                </div>
                                <div className="text-[11px] text-muted-foreground mt-0.5">
                                    where mismatches most often land
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Saved views */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {[
                        { key: "all" as const, label: `All turns${summary ? ` (${summary.totalTurns})` : ""}` },
                        { key: "match" as const, label: `Correct${summary ? ` (${summary.positives})` : ""}` },
                        { key: "mismatch" as const, label: `Mismatches${summary ? ` (${summary.negatives})` : ""}` },
                    ].map((v) => (
                        <button
                            key={v.key}
                            onClick={() => changeView(v.key)}
                            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${view === v.key
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-card hover:bg-accent"
                                }`}
                        >
                            {v.label}
                        </button>
                    ))}
                </div>

                <Card>
                    <CardHeader className="flex-row items-center gap-2 flex-wrap">
                        <div className="relative flex-1 min-w-64">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                            <Input
                                placeholder="Search customer, phrase, call ID…"
                                value={qInput}
                                onChange={(e) => changeQuery(e.target.value)}
                                className="pl-8"
                            />
                        </div>
                    </CardHeader>

                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Customer</TableHead>
                                        <TableHead>Turn</TableHead>
                                        <TableHead>Customer said</TableHead>
                                        <TableHead>Detected intent</TableHead>
                                        <TableHead>Correct intent</TableHead>
                                        <TableHead>Confidence</TableHead>
                                        <TableHead>Filler used</TableHead>
                                        <TableHead>Suggested filler</TableHead>
                                        <TableHead>Result</TableHead>
                                        <TableHead>When</TableHead>
                                    </TableRow>
                                </TableHeader>

                                <TableBody>
                                    {turnsError && (
                                        <TableRow>
                                            <TableCell colSpan={10} className="py-12 text-center text-sm text-muted-foreground">
                                                {turnsError}
                                            </TableCell>
                                        </TableRow>
                                    )}

                                    {!turnsError && turns === null &&
                                        Array.from({ length: 6 }).map((_, i) => (
                                            <TableRow key={`skeleton-${i}`}>
                                                <TableCell colSpan={10}>
                                                    <Skeleton className="h-8 w-full" />
                                                </TableCell>
                                            </TableRow>
                                        ))}

                                    {!turnsError && turns !== null && turns.map((t) => (
                                        <TableRow key={t.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-2.5">
                                                    <Avatar className="size-8">
                                                        <AvatarFallback className="text-xs">
                                                            {initials(t.customerName)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="min-w-0">
                                                        <div className="font-medium truncate">{t.customerName}</div>
                                                        <div className="text-xs text-muted-foreground">{t.branch}</div>
                                                    </div>
                                                </div>
                                            </TableCell>

                                            <TableCell>
                                                <Link
                                                    to={`/voice/${t.callSessionId}`}
                                                    className="flex items-center gap-1 text-xs text-primary font-medium hover:underline"
                                                >
                                                    <PhoneCall className="size-3" />
                                                    {t.callSessionId}
                                                </Link>
                                                <div className="text-[11px] text-muted-foreground mt-0.5">
                                                    turn #{t.turnNumber}
                                                </div>
                                            </TableCell>

                                            <TableCell className="max-w-64">
                                                <span className="text-sm">{t.customerText}</span>
                                            </TableCell>

                                            <TableCell>
                                                <Badge
                                                    variant="outline"
                                                    className={`capitalize ${t.match ? "" : "bg-destructive/10 text-destructive border-destructive/30"
                                                        }`}
                                                >
                                                    {intentLabel(t.detectedIntent)}
                                                </Badge>
                                            </TableCell>

                                            <TableCell>
                                                <Badge
                                                    variant="outline"
                                                    className={`capitalize ${t.match ? "bg-[color:var(--success)]/12 text-[color:var(--success)] border-[color:var(--success)]/30" : ""
                                                        }`}
                                                >
                                                    {intentLabel(t.correctIntent)}
                                                </Badge>
                                            </TableCell>

                                            <TableCell className="tabular-nums text-sm">{t.confidence}%</TableCell>

                                            <TableCell className="max-w-56">
                                                <span className="text-xs text-muted-foreground">{t.fillerUsed}</span>
                                            </TableCell>

                                            <TableCell className="max-w-56">
                                                {t.match ? (
                                                    <span className="text-xs text-muted-foreground">—</span>
                                                ) : (
                                                    <span className="text-xs">{t.suggestedFiller}</span>
                                                )}
                                            </TableCell>

                                            <TableCell>
                                                {t.match ? (
                                                    <Badge variant="outline" className={`gap-1 ${MATCH_STYLE}`}>
                                                        <CheckCircle2 className="size-3" /> Correct
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className={`gap-1 ${MISMATCH_STYLE}`}>
                                                        <XCircle className="size-3" /> Mismatch
                                                    </Badge>
                                                )}
                                            </TableCell>

                                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                                {formatRelative(t.timestamp)}
                                            </TableCell>
                                        </TableRow>
                                    ))}

                                    {!turnsError && turns !== null && turns.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={10} className="py-12 text-center text-sm text-muted-foreground">
                                                No turns match this search.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        <div className="border-t px-4 py-3 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2">
                            <span>
                                Showing {turns === null || turns.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}–
                                {(currentPage - 1) * PAGE_SIZE + (turns?.length ?? 0)} of {turnsCount} turns for{" "}
                                {headerLabel}
                            </span>

                            <div className="flex items-center gap-2">
                                <span className="hidden sm:inline">
                                    Page {currentPage} of {pageCount}
                                </span>
                                <div className="flex gap-1">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        disabled={currentPage <= 1}
                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    >
                                        <ChevronLeft className="size-4" />
                                        Previous
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        disabled={currentPage >= pageCount}
                                        onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                                    >
                                        Next
                                        <ChevronRight className="size-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
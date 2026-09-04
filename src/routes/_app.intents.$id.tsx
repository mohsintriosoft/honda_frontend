import { Link, useParams } from "react-router-dom";
import { useMemo, useState } from "react";

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

import { Search, Download, CheckCircle2, XCircle, PhoneCall, ChevronLeft, ChevronRight } from "lucide-react";

import {
    getIntentSummary,
    getIntentTurns,
    INTENT_LABEL,
    WORTH_STYLE,
    type IntentCode,
} from "@/mocks/intents";
import { initials, formatRelative } from "@/lib/format";

const MATCH_STYLE = "bg-[color:var(--success)]/12 text-[color:var(--success)] border-[color:var(--success)]/30";
const MISMATCH_STYLE = "bg-destructive/10 text-destructive border-destructive/30";
const PAGE_SIZE = 25;

function intentLabel(code: string) {
    return INTENT_LABEL[code as IntentCode] ?? code.replace(/_/g, " ");
}

export default function IntentDetailsPage() {
    const { code } = useParams<{ code: string }>();
    const intentCode = (code ?? "") as IntentCode;

    const summary = getIntentSummary(intentCode);
    const turns = useMemo(() => getIntentTurns(intentCode), [intentCode]);

    const [q, setQ] = useState("");
    const [view, setView] = useState<"all" | "match" | "mismatch">("all");
    const [page, setPage] = useState(1);

    const filtered = turns.filter((t) => {
        if (view === "match" && !t.match) return false;
        if (view === "mismatch" && t.match) return false;

        if (!q) return true;
        const needle = q.toLowerCase();
        return (
            t.customerText.toLowerCase().includes(needle) ||
            t.customerName.toLowerCase().includes(needle) ||
            t.callSessionId.toLowerCase().includes(needle)
        );
    });

    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const currentPage = Math.min(page, pageCount);
    const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    const changeView = (next: typeof view) => {
        setView(next);
        setPage(1);
    };

    const changeQuery = (next: string) => {
        setQ(next);
        setPage(1);
    };

    if (!summary) {
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

    return (
        <>
            <PageHeader
                title={`${summary.label} — turn-level QA`}
                description={summary.description}
                breadcrumbs={[{ label: "Intents", to: "/intents" }, { label: summary.label }]}
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
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                Accuracy
                            </div>
                            <div className="text-xl font-semibold font-display tabular-nums">
                                {summary.accuracy}%
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                                avg confidence {summary.avgConfidence}%
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                Correct vs missed
                            </div>
                            <div className="text-xl font-semibold font-display tabular-nums">
                                {summary.positives}
                                <span className="text-muted-foreground font-normal"> / </span>
                                {summary.negatives}
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                                out of {summary.totalTurns} classified turns
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                Most confused with
                            </div>
                            <div className="text-xl font-semibold font-display capitalize">
                                {summary.topConfusedWith.replace(/_/g, " ")}
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                                where mismatches most often land
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Saved views */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {[
                        { key: "all", label: `All turns (${turns.length})` },
                        { key: "match", label: `Correct (${turns.filter((t) => t.match).length})` },
                        { key: "mismatch", label: `Mismatches (${turns.filter((t) => !t.match).length})` },
                    ].map((v) => (
                        <button
                            key={v.key}
                            onClick={() => changeView(v.key as typeof view)}
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
                                value={q}
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
                                    {paginated.map((t) => (
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

                                    {filtered.length === 0 && (
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
                                Showing {paginated.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}–
                                {(currentPage - 1) * PAGE_SIZE + paginated.length} of {filtered.length} turns for{" "}
                                {summary.label}
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
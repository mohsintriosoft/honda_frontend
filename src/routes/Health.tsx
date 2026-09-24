import { useCallback, useEffect, useRef, useState } from "react";
import {
    AlertTriangle,
    CheckCircle2,
    HelpCircle,
    Mic,
    PhoneCall,
    RefreshCw,
    Server,
    Volume2,
    XOctagon,
    type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
    server_get_data,
    get_provider_health,
} from "@/components/ServiceConnection/serviceconnection";

/* ------------------------------------------------------------------
   Types — mirror views_health.provider_health()
------------------------------------------------------------------ */

type HealthLevel = "healthy" | "warning" | "critical" | "exhausted" | "unknown";

type HealthCardData = {
    key: string;
    label: string;
    service: string;
    provider: string;
    level: string;
    error: string | null;
};

type HealthResponse = {
    success: boolean;
    checked_at: string;
    cards: HealthCardData[];
};

const POLL_MS = 60_000;

const CARD_ICONS: Record<string, LucideIcon> = {
    server: Server,
    audio: Mic,
    voice: Volume2,
    caller: PhoneCall,
};

/* ------------------------------------------------------------------
   Level styling. Every level has its own icon + word, so state is never
   carried by colour alone.
------------------------------------------------------------------ */

type LevelStyle = {
    label: string;
    icon: LucideIcon;
    chip: string;
    marker: string;
    card: string;
    advice: (service: string) => string | null;
};

const LEVELS: { [K in HealthLevel]: LevelStyle } = {
    healthy: {
        label: "Healthy",
        icon: CheckCircle2,
        chip: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
        marker: "bg-emerald-500",
        card: "",
        advice: () => null,
    },
    warning: {
        label: "Warning",
        icon: AlertTriangle,
        chip: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
        marker: "bg-amber-500",
        card: "border-amber-500/40",
        advice: () => "Balance is getting low. Plan a top-up.",
    },
    critical: {
        label: "Critical",
        icon: AlertTriangle,
        chip: "border-orange-500/50 bg-orange-500/15 text-orange-700 dark:text-orange-400",
        marker: "bg-orange-500",
        card: "border-orange-500/60",
        advice: (s) => `Top up now. ${s} calls could start failing soon.`,
    },
    exhausted: {
        label: "Exhausted",
        icon: XOctagon,
        chip: "border-red-600 bg-red-600 text-white",
        marker: "bg-red-600",
        card: "border-red-600/70 bg-red-500/5",
        advice: (s) => `Out of balance. ${s} will fail until it's topped up.`,
    },
    unknown: {
        label: "Unavailable",
        icon: HelpCircle,
        chip: "border-border bg-muted text-muted-foreground",
        marker: "bg-muted-foreground",
        card: "border-dashed",
        advice: () => null,
    },
};

// Any level/key the backend adds later falls back safely instead of
// crashing the whole page.
function levelOf(level: string) {
    return LEVELS[level as HealthLevel] ?? LEVELS.unknown;
}

/* ------------------------------------------------------------------
   Formatting
------------------------------------------------------------------ */

function timeAgo(iso: string | undefined, now: number): string {
    if (!iso) return "never";
    const secs = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
    if (secs < 10) return "just now";
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.round(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    return `${Math.round(mins / 60)}h ago`;
}

/* ------------------------------------------------------------------
   Card
------------------------------------------------------------------ */

function HealthCard({ card }: { card: HealthCardData }) {
    const lv = levelOf(card.level);
    const Icon = CARD_ICONS[card.key] ?? Server;
    const StatusIcon = lv.icon;
    const message = card.error ?? lv.advice(card.service);

    return (
        <article
            aria-labelledby={`health-${card.key}`}
            className={cn("rounded-lg border bg-card p-5 flex flex-col gap-4 transition-colors", lv.card)}
        >
            <header className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="size-10 shrink-0 rounded-md bg-muted grid place-items-center">
                        <Icon className="size-5 text-foreground/80" aria-hidden />
                    </div>
                    <div className="min-w-0 leading-tight">
                        <h2 id={`health-${card.key}`} className="font-display font-semibold text-base">
                            {card.label}
                        </h2>
                    </div>
                </div>
                <span
                    className={cn(
                        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
                        lv.chip,
                    )}
                >
                    <StatusIcon className="size-3.5" aria-hidden />
                    {lv.label}
                </span>
            </header>

            <p className="text-xs text-muted-foreground">Status on {card.label}</p>

            {message && (
                <p
                    className={cn(
                        "text-sm border-t pt-3",
                        card.level === "exhausted" || card.level === "critical"
                            ? "font-medium text-foreground"
                            : "text-muted-foreground",
                    )}
                >
                    {message}
                </p>
            )}
        </article>
    );
}

function CardSkeleton() {
    return (
        <div className="rounded-lg border bg-card p-5 flex flex-col gap-4 animate-pulse" aria-hidden>
            <div className="flex items-center gap-3">
                <div className="size-10 rounded-md bg-muted" />
                <div className="space-y-1.5">
                    <div className="h-4 w-20 rounded bg-muted" />
                    <div className="h-3 w-10 rounded bg-muted" />
                </div>
            </div>
            <div className="h-5 w-24 rounded bg-muted" />
            <div className="h-8 rounded bg-muted" />
        </div>
    );
}

/* ------------------------------------------------------------------
   Page
------------------------------------------------------------------ */

export default function Health() {
    const [data, setData] = useState<HealthResponse | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [now, setNow] = useState(() => Date.now());
    const inFlight = useRef(false);

    const load = useCallback(async (force = false) => {
        if (inFlight.current) return;
        inFlight.current = true;
        setRefreshing(true);
        try {
            const res = (await server_get_data(
                get_provider_health,
                force ? { refresh: 1 } : {},
            )) as HealthResponse;
            if (!res?.success || !Array.isArray(res.cards)) throw new Error("Unexpected response");
            setData(res);
            setLoadError(null);
        } catch (err: any) {
            setLoadError(
                err?.response?.status === 403
                    ? "Your role does not have permission to view system health."
                    : "Couldn't reach the server to check balances.",
            );
        } finally {
            inFlight.current = false;
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        load();
        const poll = window.setInterval(() => {
            if (!document.hidden) load();
        }, POLL_MS);
        const tick = window.setInterval(() => setNow(Date.now()), 10_000);
        return () => {
            window.clearInterval(poll);
            window.clearInterval(tick);
        };
    }, [load]);

    const attention = data?.cards.filter((c) => c.level !== "healthy") ?? [];
    const allHealthy = data !== null && attention.length === 0;

    return (
        <>
            <PageHeader
                title="System health"
                description="Live status of the four services every call depends on. Rechecked every minute."
                actions={
                    <>
                        {data && (
                            <span className="hidden sm:inline text-xs text-muted-foreground">
                                Checked {timeAgo(data.checked_at, now)}
                            </span>
                        )}
                        <Button variant="outline" size="sm" onClick={() => load(true)} disabled={refreshing}>
                            <RefreshCw className={cn("size-4 mr-1.5", refreshing && "animate-spin")} aria-hidden />
                            {refreshing ? "Checking…" : "Check now"}
                        </Button>
                    </>
                }
            />

            <div className="px-4 md:px-6 lg:px-8 py-6 space-y-4">
                {loadError && (
                    <div
                        role="alert"
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm"
                    >
                        <span>
                            {loadError}
                            {data ? ` Showing the reading from ${timeAgo(data.checked_at, now)}.` : ""}
                        </span>
                        <Button variant="outline" size="sm" onClick={() => load(true)}>
                            Try again
                        </Button>
                    </div>
                )}

                {data && (
                    <p role="status" className="text-sm text-muted-foreground">
                        {allHealthy
                            ? "All four services are healthy."
                            : `${attention.length} of ${data.cards.length} services need attention: ${attention
                                .map((c) => c.label)
                                .join(", ")}.`}
                    </p>
                )}

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {data
                        ? data.cards.map((card) => <HealthCard key={card.key} card={card} />)
                        : !loadError && [0, 1, 2, 3].map((i) => <CardSkeleton key={i} />)}
                </div>
            </div>
        </>
    );
}
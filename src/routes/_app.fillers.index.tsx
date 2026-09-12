import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layers, MessageSquareText, ChevronRight, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { get_intent_fillers_summary, server_get_data } from "@/components/ServiceConnection/serviceconnection";

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

interface IntentCardData {
    code: string;
    label: string;
    description: string;
    state_count: number;
    filler_count: number;
}

// ─────────────────────────────────────────────────────────────────────────
// Card — just the two counts, nothing else. Whole card is a link to the
// detail page (/fillers/:code) where states + fillers actually live.
// ─────────────────────────────────────────────────────────────────────────

function IntentCard({ intent, onClick }: { intent: IntentCardData; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="text-left rounded-xl border bg-card p-5 transition-colors hover:bg-accent/40 hover:border-primary/30"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="font-display font-semibold text-base">{intent.label}</h3>
                    {intent.description && (
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                            {intent.description}
                        </p>
                    )}
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground mt-1" />
            </div>

            <div className="mt-4 flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Layers className="size-3.5" />
                    <span>
                        <span className="font-medium text-foreground">{intent.state_count}</span> states
                    </span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                    <MessageSquareText className="size-3.5" />
                    <span>
                        <span className="font-medium text-foreground">{intent.filler_count}</span> fillers
                    </span>
                </div>
            </div>
        </button>
    );
}

// ─────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────

export default function Fillers() {
    const navigate = useNavigate();
    const [intents, setIntents] = useState<IntentCardData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        server_get_data(get_intent_fillers_summary)
            .then((data) => {
                if (data.success) setIntents(data.intents);
            })
            .catch((err) => console.error("Failed to load intents:", err))
            .finally(() => setLoading(false));
    }, []);

    return (
        <>
            <PageHeader
                title="Fillers"
                description="Every intent the classifier can detect — open one to edit the filler lines the bot picks from while it 'thinks', state by state."
            />

            <div className="px-4 md:px-6 lg:px-8 py-6">
                {loading ? (
                    <div className="flex items-center justify-center py-20 text-muted-foreground">
                        <Loader2 className="size-5 animate-spin mr-2" /> Loading intents…
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {intents.map((intent) => (
                            <IntentCard
                                key={intent.code}
                                intent={intent}
                                onClick={() => navigate(`/fillers/${intent.code}`)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layers, MessageSquareText, ChevronRight, Loader2, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import {
  get_intent_fillers_summary,
  server_get_data,
} from "@/components/ServiceConnection/serviceconnection";

interface IntentCardData {
  id: number;
  code: string;
  label: string;
  description: string;
  state_count: number;
  filler_count: number;
}

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
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{intent.description}</p>
          )}
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground mt-1" />
      </div>

      <div className="mt-4 flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Layers className="size-3.5" />
          <span>
            <span className="font-medium text-foreground">{intent.state_count ?? 0}</span> states
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <MessageSquareText className="size-3.5" />
          <span>
            <span className="font-medium text-foreground">{intent.filler_count ?? 0}</span> fillers
          </span>
        </div>
      </div>
    </button>
  );
}

export default function Fillers() {
  const navigate = useNavigate();
  const [intents, setIntents] = useState<IntentCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    server_get_data(get_intent_fillers_summary)
      .then((data) => {
        if (cancelled) return;
        if (data?.success) setIntents(data.intents ?? []);
        else setError(data?.error ?? "Couldn't load intents.");
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Failed to load intents:", err);
        setError(
          err?.response?.status === 403
            ? "Your role does not have permission to view fillers."
            : "Couldn't load intents. Please try again.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

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
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <AlertCircle className="size-6 text-destructive" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={() => setReloadKey((k) => k + 1)}>
              Retry
            </Button>
          </div>
        ) : intents.length === 0 ? (
          <div className="py-20 text-center text-sm text-muted-foreground">
            No intents configured yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {intents.map((intent) => (
              <IntentCard
                key={intent.id}
                intent={intent}
                onClick={() => navigate(`/fillers/${intent.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
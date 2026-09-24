import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/layout/AppShell";
import {
  get_intent_fillers_detail,
  post_intent_filler,
  patch_filler,
  delete_filler,
  server_get_data,
  server_post_json,
  server_patch_data,
  server_delete_data,
} from "@/components/ServiceConnection/serviceconnection";

interface FillerRow {
  id: number;
  state: string;
  text: string;
  order: number;
  is_active: boolean;
  updated_at: string | null;
}

interface StateBlock {
  state: string;
  description: string;
  examples: string[];
  fillers: FillerRow[];
}

interface IntentDetail {
  intent: { code: string; label: string; description: string };
  state_count: number;
  filler_count: number;
  states: StateBlock[];
}

function humanizeState(state: string) {
  return state
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function apiErrorMessage(err: any, fallback: string) {
  if (err?.response?.status === 403) return "You don't have permission to edit fillers.";
  return err?.response?.data?.error ?? fallback;
}

const MAX_EXAMPLES_PREVIEW = 2;

function StateCard({
  intentCode,
  block,
  onChanged,
}: {
  intentCode: string;
  block: StateBlock;
  onChanged: (state: string, fillers: FillerRow[]) => void;
}) {
  const [fillers, setFillers] = useState<FillerRow[]>(block.fillers);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [addingText, setAddingText] = useState("");
  const [adding, setAdding] = useState(false);
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setFillers(block.fillers), [block.fillers]);

  const saveText = useCallback(
    async (filler: FillerRow, input: HTMLInputElement) => {
      const text = input.value.trim();

      // Blank is never saved -- a blank filler would make the bot say nothing.
      if (!text) {
        input.value = filler.text;
        setError("A filler line can't be empty — delete it instead.");
        return;
      }
      if (text === filler.text) {
        input.value = filler.text;
        return;
      }

      setSavingId(filler.id);
      setError(null);

      try {
        const data = await server_patch_data(patch_filler(filler.id), { text });
        if (!data?.success) throw { response: { data } };

        const next = fillers.map((f) => (f.id === filler.id ? data.filler : f));
        setFillers(next);
        onChanged(block.state, next);
        input.value = data.filler.text;
      } catch (err) {
        console.error("Failed to save filler:", err);
        input.value = filler.text; // show what's actually saved
        setError(apiErrorMessage(err, "Couldn't save that filler. Try again."));
      } finally {
        setSavingId(null);
      }
    },
    [fillers, block.state, onChanged],
  );

  const deleteFiller = useCallback(
    async (filler: FillerRow) => {
      setSavingId(filler.id);
      setError(null);

      try {
        const data = await server_delete_data(delete_filler(filler.id));
        if (!data?.success) throw { response: { data } };

        const next = fillers.filter((f) => f.id !== filler.id);
        setFillers(next);
        onChanged(block.state, next);
      } catch (err) {
        console.error("Failed to delete filler:", err);
        setError(apiErrorMessage(err, "Couldn't delete that filler. Try again."));
      } finally {
        setSavingId(null);
        setDeletingId(null);
      }
    },
    [fillers, block.state, onChanged],
  );

  const addFiller = useCallback(async () => {
    const text = addingText.trim();
    if (!text || adding) return;

    setAdding(true);
    setError(null);

    try {
      const data = await server_post_json(post_intent_filler(intentCode), {
        state: block.state,
        text,
      });
      if (!data?.success) throw { response: { data } };

      const next = [...fillers, data.filler];
      setFillers(next);
      onChanged(block.state, next);
      setAddingText("");
    } catch (err) {
      console.error("Failed to add filler:", err);
      setError(apiErrorMessage(err, "Couldn't add that filler. Try again."));
    } finally {
      setAdding(false);
    }
  }, [addingText, adding, intentCode, block.state, fillers, onChanged]);

  return (
    <div className="rounded-lg border bg-card">
      <div className="px-5 pt-4 pb-3 border-b">
        <div className="flex items-baseline justify-between gap-3">
          <h4 className="font-medium text-sm">{humanizeState(block.state)}</h4>
          <span className="text-xs text-muted-foreground">
            {fillers.length} filler{fillers.length === 1 ? "" : "s"}
          </span>
        </div>

        {block.description && (
          <p className="mt-1 text-xs text-muted-foreground">{block.description}</p>
        )}

        {block.examples?.length > 0 && (
          <p className="mt-2 text-xs italic text-muted-foreground/80 bg-muted/40 rounded px-2 py-1.5">
            {block.examples
              .slice(0, MAX_EXAMPLES_PREVIEW)
              .map((ex) => `"${ex}"`)
              .join(", ")}
            {block.examples.length > MAX_EXAMPLES_PREVIEW && (
              <>
                {" "}
                <button
                  type="button"
                  onClick={() => setExamplesOpen(true)}
                  className="not-italic font-medium text-primary hover:underline"
                >
                  View more ({block.examples.length - MAX_EXAMPLES_PREVIEW} more)
                </button>
              </>
            )}
          </p>
        )}
      </div>

      <Dialog open={examplesOpen} onOpenChange={setExamplesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{humanizeState(block.state)} — examples</DialogTitle>
            <DialogDescription>
              {block.examples?.length ?? 0} example{(block.examples?.length ?? 0) === 1 ? "" : "s"}{" "}
              for this state.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5 max-h-[60vh] overflow-auto">
            {block.examples?.map((ex, i) => (
              <p
                key={i}
                className="text-sm italic text-muted-foreground bg-muted/40 rounded px-2.5 py-1.5"
              >
                "{ex}"
              </p>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <div className="p-4 space-y-2">
        {fillers.map((filler) => (
          <div key={filler.id} className="flex items-center gap-2">
            <div className="size-1.5 rounded-full bg-muted-foreground/30 shrink-0" />

            <input
              defaultValue={filler.text}
              disabled={deletingId === filler.id || savingId === filler.id}
              onBlur={(e) => saveText(filler, e.target)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="flex-1 rounded-md border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
            />

            {deletingId === filler.id ? (
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={savingId === filler.id}
                  onClick={() => deleteFiller(filler)}
                  className="h-7 px-2 text-xs"
                >
                  {savingId === filler.id ? <Loader2 className="size-3 animate-spin" /> : "Delete"}
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  disabled={savingId === filler.id}
                  onClick={() => setDeletingId(null)}
                  className="h-7 px-2 text-xs"
                >
                  Cancel
                </Button>
              </div>
            ) : savingId === filler.id ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground shrink-0" />
            ) : (
              <button
                onClick={() => setDeletingId(filler.id)}
                className="text-muted-foreground hover:text-destructive shrink-0"
                aria-label="Delete filler"
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
        ))}

        <div className="flex items-center gap-2 pt-1">
          <Plus className="size-3.5 text-muted-foreground shrink-0" />

          <input
            value={addingText}
            onChange={(e) => setAddingText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addFiller();
            }}
            disabled={adding}
            placeholder="Add a new filler line…"
            className="flex-1 rounded-md border border-dashed bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />

          <Button
            size="sm"
            variant="secondary"
            disabled={adding || !addingText.trim()}
            onClick={addFiller}
          >
            {adding ? <Loader2 className="size-3.5 animate-spin" /> : "Add filler"}
          </Button>
        </div>

        {error && <p className="text-xs text-destructive pt-1">{error}</p>}
      </div>
    </div>
  );
}

export default function FillerDetail() {
  const { code } = useParams<{ code: string }>();
  const [detail, setDetail] = useState<IntentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setLoadError(null);

    server_get_data(get_intent_fillers_detail(code))
      .then((data) => {
        if (cancelled) return;
        if (data?.success) setDetail(data);
        else setNotFound(true);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Failed to load intent detail:", err);
        if (err?.response?.status === 404) setNotFound(true);
        else if (err?.response?.status === 403)
          setLoadError("Your role does not have permission to view fillers.");
        else setLoadError("Couldn't load this intent. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [code]);

  const handleStateChanged = useCallback((state: string, fillers: FillerRow[]) => {
    setDetail((prev) => {
      if (!prev) return prev;
      const states = prev.states.map((s) => (s.state === state ? { ...s, fillers } : s));
      return { ...prev, states, filler_count: states.reduce((n, s) => n + s.fillers.length, 0) };
    });
  }, []);

  return (
    <>
      <PageHeader
        title={detail ? detail.intent.label : "Fillers"}
        description={detail?.intent.description}
        breadcrumbs={[
          { label: "Fillers", to: "/fillers" },
          { label: detail?.intent.label || code || "" },
        ]}
        actions={
          <Link to="/fillers">
            <Button variant="outline" size="sm">
              <ArrowLeft className="size-4 mr-1.5" /> Back to fillers
            </Button>
          </Link>
        }
      />

      <div className="px-4 md:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="size-5 animate-spin mr-2" /> Loading states…
          </div>
        ) : loadError ? (
          <div className="text-center py-20 text-sm text-destructive">{loadError}</div>
        ) : notFound || !detail ? (
          <div className="text-center py-20 text-muted-foreground">
            Couldn't find that intent.{" "}
            <Link to="/fillers" className="text-primary hover:underline">
              Go back
            </Link>
          </div>
        ) : detail.states.length === 0 ? (
          <div className="text-center py-20 text-sm text-muted-foreground">
            No states are configured for this intent yet — add them in the Django admin.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {detail.states.map((block) => (
              <StateCard
                key={block.state}
                intentCode={detail.intent.code}
                block={block}
                onChanged={handleStateChanged}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

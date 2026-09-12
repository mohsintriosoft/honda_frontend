import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

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
    example: string;
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

// ─────────────────────────────────────────────────────────────────────────
// State card — mirrors the opening-line editor: a heading, a one-line
// description + conversation example, then editable filler text fields
// with an "Add filler" button. Multiple fillers per state.
// ─────────────────────────────────────────────────────────────────────────

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
    const [addingText, setAddingText] = useState("");
    const [adding, setAdding] = useState(false);

    useEffect(() => setFillers(block.fillers), [block.fillers]);

    const saveText = useCallback(
        async (filler: FillerRow, text: string) => {
            if (text === filler.text) return;
            setSavingId(filler.id);
            try {
                const data = await server_patch_data(patch_filler(filler.id), { text });
                if (data.success) {
                    const next = fillers.map((f) => (f.id === filler.id ? data.filler : f));
                    setFillers(next);
                    onChanged(block.state, next);
                }
            } catch (err) {
                console.error("Failed to save filler:", err);
            } finally {
                setSavingId(null);
            }
        },
        [fillers, block.state, onChanged],
    );

    const deleteFiller = useCallback(
        async (filler: FillerRow) => {
            setSavingId(filler.id);
            try {
                const data = await server_delete_data(delete_filler(filler.id));
                if (data.success) {
                    const next = fillers.filter((f) => f.id !== filler.id);
                    setFillers(next);
                    onChanged(block.state, next);
                }
            } catch (err) {
                console.error("Failed to delete filler:", err);
            } finally {
                setSavingId(null);
            }
        },
        [fillers, block.state, onChanged],
    );

    const addFiller = useCallback(async () => {
        const text = addingText.trim();
        if (!text) return;
        setAdding(true);
        try {
            const data = await server_post_json(post_intent_filler(intentCode), {
                state: block.state,
                text,
            });
            if (data.success) {
                const next = [...fillers, data.filler];
                setFillers(next);
                onChanged(block.state, next);
                setAddingText("");
            }
        } catch (err) {
            console.error("Failed to add filler:", err);
        } finally {
            setAdding(false);
        }
    }, [addingText, intentCode, block.state, fillers, onChanged]);

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
                {block.example && (
                    <p className="mt-2 text-xs italic text-muted-foreground/80 bg-muted/40 rounded px-2 py-1.5">
                        "{block.example}"
                    </p>
                )}
            </div>

            <div className="p-4 space-y-2">
                {fillers.map((filler) => (
                    <div key={filler.id} className="flex items-center gap-2">
                        <div className="size-1.5 rounded-full bg-muted-foreground/30 shrink-0" />
                        <input
                            defaultValue={filler.text}
                            onBlur={(e) => saveText(filler, e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                            }}
                            className="flex-1 rounded-md border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                        {savingId === filler.id ? (
                            <Loader2 className="size-4 animate-spin text-muted-foreground shrink-0" />
                        ) : (
                            <button
                                onClick={() => deleteFiller(filler)}
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
                        placeholder="Add a new filler line…"
                        className="flex-1 rounded-md border border-dashed bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <Button size="sm" variant="secondary" disabled={adding || !addingText.trim()} onClick={addFiller}>
                        {adding ? <Loader2 className="size-3.5 animate-spin" /> : "Add filler"}
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────
// Page — /fillers/:code (param named "code" to match the intent code the
// backend keys on, same convention as _app.intents.$id.tsx)
// ─────────────────────────────────────────────────────────────────────────

export default function FillerDetail() {
    const { code } = useParams<{ code: string }>();
    const [detail, setDetail] = useState<IntentDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        if (!code) return;
        setLoading(true);
        setNotFound(false);
        server_get_data(get_intent_fillers_detail(code))
            .then((data) => {
                if (data.success) setDetail(data);
                else setNotFound(true);
            })
            .catch((err) => {
                console.error("Failed to load intent detail:", err);
                setNotFound(true);
            })
            .finally(() => setLoading(false));
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
                breadcrumbs={[{ label: "Fillers", to: "/fillers" }, { label: detail?.intent.label || code || "" }]}
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
                ) : notFound || !detail ? (
                    <div className="text-center py-20 text-muted-foreground">
                        Couldn't find that intent.{" "}
                        <Link to="/fillers" className="text-primary hover:underline">
                            Go back
                        </Link>
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
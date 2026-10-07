import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, Loader2, Pencil, Plus, Search, Trash2, X, Check, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  server_get_data,
  server_post_json,
  server_patch_data,
  server_delete_data,
  get_sops,
  sop_url,
} from "@/components/ServiceConnection/serviceconnection";

type Sop = {
  id: number;
  problem: string;
  solution: string;
  created_by: string | null;
  updated_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function apiError(err: any, fallback: string): string {
  return err?.response?.data?.error || err?.message || fallback;
}

function when(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * SOP -- problem -> solution notes. Super admins only
 * (settings.HEALTH_BALANCE_STAFF_IDS); the API returns 403 for anyone else.
 *   View: search, read, edit (problem + solution), delete
 *   Add:  problem (required) + solution (optional)
 */
export default function Sops() {
  const [tab, setTab] = useState<"view" | "add">("view");
  const [items, setItems] = useState<Sop[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await server_get_data(get_sops);
      if (res?.success === false) throw { response: { data: res } };
      setItems(res?.sops ?? []);
      setForbidden(false);
    } catch (err: any) {
      if (err?.response?.status === 403) setForbidden(true);
      else setError(apiError(err, "Couldn't load SOPs"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((s) => `${s.problem}\n${s.solution}`.toLowerCase().includes(q));
  }, [items, query]);

  if (forbidden) {
    return (
      <>
        <PageHeader title="SOP" description="Problems and how to solve them." />
        <div className="px-4 py-10 md:px-6 lg:px-8">
          <Card>
            <CardContent className="flex items-center gap-3 py-10 text-sm text-muted-foreground">
              <ShieldAlert className="size-5" /> Only super admins can open the SOP page.
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="SOP" description="Problems seen on calls and how to solve them. Visible to super admins only." />

      <div className="space-y-4 px-4 py-6 md:px-6 lg:px-8">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "view" | "add")}>
          <TabsList>
            <TabsTrigger value="view">
              <ClipboardList className="mr-1.5 size-4" /> View ({items.length})
            </TabsTrigger>
            <TabsTrigger value="add">
              <Plus className="mr-1.5 size-4" /> Add
            </TabsTrigger>
          </TabsList>

          {/* ---------------- View ---------------- */}
          <TabsContent value="view" className="mt-4 space-y-3">
            <div className="relative max-w-md">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search problem or solution"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            {loading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Loading…
              </div>
            ) : visible.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-sm text-muted-foreground">
                  {items.length === 0 ? (
                    <>
                      No SOPs yet.{" "}
                      <button type="button" className="text-primary hover:underline" onClick={() => setTab("add")}>
                        Add the first one
                      </button>
                    </>
                  ) : (
                    <>Nothing matches “{query}”.</>
                  )}
                </CardContent>
              </Card>
            ) : (
              visible.map((sop) => (
                <SopCard
                  key={sop.id}
                  sop={sop}
                  onSaved={(updated) => setItems((all) => all.map((s) => (s.id === updated.id ? updated : s)))}
                  onDeleted={(id) => setItems((all) => all.filter((s) => s.id !== id))}
                />
              ))
            )}
          </TabsContent>

          {/* ---------------- Add ---------------- */}
          <TabsContent value="add" className="mt-4">
            <AddSop
              onAdded={(sop) => {
                setItems((all) => [sop, ...all]);
                setQuery("");
                setTab("view");
              }}
            />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */

function AddSop({ onAdded }: { onAdded: (sop: Sop) => void }) {
  const [problem, setProblem] = useState("");
  const [solution, setSolution] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!problem.trim()) {
      setError("Problem is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await server_post_json(get_sops, { problem, solution });
      if (!res?.success) throw { response: { data: res } };
      setProblem("");
      setSolution("");
      onAdded(res.sop);
    } catch (err) {
      setError(apiError(err, "Couldn't save"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="max-w-3xl">
      <CardContent className="space-y-4 pt-6">
        <div>
          <Label htmlFor="sop-problem">
            Problem <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="sop-problem"
            className="mt-1.5 min-h-28"
            placeholder="What went wrong? e.g. Customer hangs up when asked for the branch"
            value={problem}
            onChange={(e) => setProblem(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="sop-solution">
            Solution <span className="text-xs font-normal text-muted-foreground">(optional — can be added later)</span>
          </Label>
          <Textarea
            id="sop-solution"
            className="mt-1.5 min-h-28"
            placeholder="How to handle it"
            value={solution}
            onChange={(e) => setSolution(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Save SOP
          </Button>
          {(problem || solution) && (
            <Button
              variant="ghost"
              onClick={() => {
                setProblem("");
                setSolution("");
                setError(null);
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function SopCard({
  sop,
  onSaved,
  onDeleted,
}: {
  sop: Sop;
  onSaved: (sop: Sop) => void;
  onDeleted: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [problem, setProblem] = useState(sop.problem);
  const [solution, setSolution] = useState(sop.solution);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEdit = () => {
    setProblem(sop.problem);
    setSolution(sop.solution);
    setError(null);
    setEditing(true);
  };

  const save = async () => {
    if (!problem.trim()) {
      setError("Problem is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await server_patch_data(sop_url(sop.id), { problem, solution });
      if (!res?.success) throw { response: { data: res } };
      onSaved(res.sop);
      setEditing(false);
    } catch (err) {
      setError(apiError(err, "Couldn't save"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("Delete this SOP?")) return;
    setBusy(true);
    try {
      const res = await server_delete_data(sop_url(sop.id));
      if (res?.success === false) throw { response: { data: res } };
      onDeleted(sop.id);
    } catch (err) {
      setError(apiError(err, "Couldn't delete"));
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        {editing ? (
          <>
            <div>
              <Label className="text-xs">Problem *</Label>
              <Textarea className="mt-1 min-h-24" value={problem} onChange={(e) => setProblem(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Solution</Label>
              <Textarea
                className="mt-1 min-h-24"
                placeholder="How to handle it"
                value={solution}
                onChange={(e) => setSolution(e.target.value)}
              />
            </div>
          </>
        ) : (
          <>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Problem</div>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm font-medium">{sop.problem}</p>
            </div>
            <div className="rounded-md border-l-2 border-primary/50 bg-muted/30 px-3 py-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Solution</div>
              {sop.solution ? (
                <p className="mt-1 whitespace-pre-wrap break-words text-sm">{sop.solution}</p>
              ) : (
                <button type="button" onClick={startEdit} className="mt-1 text-sm text-primary hover:underline">
                  No solution yet — add one
                </button>
              )}
            </div>
          </>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">
            {sop.updated_by ? `Updated by ${sop.updated_by} · ` : ""}
            {when(sop.updated_at)}
          </span>
          <div className="flex gap-1">
            {editing ? (
              <>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={busy}>
                  <X className="size-4" /> Cancel
                </Button>
                <Button size="sm" onClick={save} disabled={busy}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Save
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="ghost" onClick={startEdit} disabled={busy}>
                  <Pencil className="size-4" /> Edit
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={remove} disabled={busy}>
                  <Trash2 className="size-4" /> Delete
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

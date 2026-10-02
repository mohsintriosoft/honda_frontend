import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Crosshair, EyeOff, Loader2, ShieldCheck, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  KIND_LABEL,
  describeElement,
  loadAllUiRules,
  loadMyUiRules,
  pathMatches,
  patternFor,
  setPickMode,
  setPreviewRole,
  useUiRights,
  type Candidate,
  type UiAction,
} from "@/lib/uiRights";
import {
  server_delete_data,
  server_patch_data,
  server_post_json,
  post_ui_rule,
  ui_rule_url,
} from "@/components/ServiceConnection/serviceconnection";

type Scope = "exact" | "pattern" | "all";

/**
 * "Page rights" -- super admins only (settings.HEALTH_BALANCE_STAFF_IDS, see
 * /api/ui-rules/ can_manage). Floating button on
 * every page:
 *   1. Pick element: hover highlights, click picks (button, link, tab,
 *      field, column, card or text), then choose roles + hide/disable.
 *   2. Preview as role: see the page exactly as that role will.
 *   3. List of rules on this page, each removable / switchable.
 */
export function UiRightsPicker() {
  const ui = useUiRights();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [hoverBox, setHoverBox] = useState<DOMRect | null>(null);
  const [hoverText, setHoverText] = useState("");
  const [picked, setPicked] = useState<Candidate[] | null>(null);
  const [pickedInChrome, setPickedInChrome] = useState(false);

  const pickRef = useRef(ui.pickMode);
  pickRef.current = ui.pickMode;

  // ── pick mode: highlight on hover, capture the click ──────────────
  useEffect(() => {
    if (!ui.pickMode) {
      setHoverBox(null);
      return;
    }
    const onMove = (e: MouseEvent) => {
      const el = e.target as Element | null;
      if (!el || el.closest("[data-uir-ui]")) {
        setHoverBox(null);
        return;
      }
      const c = describeElement(el)[0];
      if (!c) {
        setHoverBox(null);
        return;
      }
      setHoverBox(c.target.getBoundingClientRect());
      setHoverText(`${KIND_LABEL[c.kind]}: ${c.display}`);
    };
    const onClick = (e: MouseEvent) => {
      const el = e.target as Element | null;
      if (!el || el.closest("[data-uir-ui]")) return;
      e.preventDefault();
      e.stopPropagation();
      const candidates = describeElement(el);
      if (candidates.length) {
        // sidebar / header items live on every page -> default to "All pages"
        setPickedInChrome(!!el.closest("aside, header, [role='dialog'] nav"));
        setPicked(candidates);
        setPickMode(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPickMode(false);
    };
    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [ui.pickMode]);

  const pageRules = useMemo(
    () => ui.allRules.filter((r) => pathMatches(r.path, pathname)),
    [ui.allRules, pathname],
  );

  if (!ui.canManage) return null;

  return (
    <div data-uir-ui>
      {/* hover highlight */}
      {ui.pickMode && hoverBox && (
        <>
          <div
            className="pointer-events-none fixed z-[9998] rounded-md border-2 border-primary bg-primary/10"
            style={{ left: hoverBox.left - 2, top: hoverBox.top - 2, width: hoverBox.width + 4, height: hoverBox.height + 4 }}
          />
          <div
            className="pointer-events-none fixed z-[9999] max-w-xs truncate rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground"
            style={{ left: hoverBox.left, top: Math.max(4, hoverBox.top - 24) }}
          >
            {hoverText}
          </div>
        </>
      )}

      {ui.pickMode && (
        <div className="fixed left-1/2 top-3 z-[9999] -translate-x-1/2 rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground shadow-lg">
          Click any button, field, tab, column or card · Esc to cancel
        </div>
      )}

      {/* floating launcher */}
      {!open && (
        <Button
          size="sm"
          className="fixed bottom-4 right-4 z-40 rounded-full shadow-lg"
          onClick={() => {
            setOpen(true);
            loadAllUiRules();
          }}
        >
          <ShieldCheck className="size-4" />
          Page rights
          {ui.previewRole && <Badge variant="secondary" className="ml-1">as {ui.previewRole}</Badge>}
        </Button>
      )}

      {/* panel */}
      {open && (
        <div className="fixed bottom-4 right-4 z-40 w-[min(92vw,360px)] rounded-xl border bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="size-4 text-primary" /> Page rights
            </div>
            <Button size="icon" variant="ghost" className="size-7" onClick={() => setOpen(false)} aria-label="Close">
              <X className="size-4" />
            </Button>
          </div>

          <div className="space-y-3 p-4">
            <Button className="w-full" variant={ui.pickMode ? "secondary" : "default"} onClick={() => setPickMode(!ui.pickMode)}>
              <Crosshair className="size-4" />
              {ui.pickMode ? "Picking… (Esc to stop)" : "Pick an element on this page"}
            </Button>

            <div>
              <Label className="text-xs text-muted-foreground">Preview this page as</Label>
              <Select value={ui.previewRole ?? "__me"} onValueChange={(v) => setPreviewRole(v === "__me" ? null : v)}>
                <SelectTrigger className="mt-1 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent data-uir-ui>
                  <SelectItem value="__me">Myself (no restrictions)</SelectItem>
                  {ui.roles.map((r) => (
                    <SelectItem key={r.code} value={r.code}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">
                Rules on this page ({pageRules.length})
              </div>
              <div className="max-h-56 space-y-1.5 overflow-y-auto">
                {pageRules.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nothing restricted here yet.</p>
                )}
                {pageRules.map((r) => (
                  <RuleRow key={r.id} ruleId={r.id} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {picked && (
        <RuleDialog
          candidates={picked}
          pathname={pathname}
          chrome={pickedInChrome}
          onClose={() => setPicked(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function RuleRow({ ruleId }: { ruleId: number }) {
  const ui = useUiRights();
  const r = ui.allRules.find((x) => x.id === ruleId);
  const [busy, setBusy] = useState(false);
  if (!r) return null;

  const toggleActive = async () => {
    setBusy(true);
    try {
      await server_patch_data(ui_rule_url(r.id), { is_active: !r.is_active });
      await Promise.all([loadAllUiRules(), loadMyUiRules()]);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await server_delete_data(ui_rule_url(r.id));
      await Promise.all([loadAllUiRules(), loadMyUiRules()]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("rounded-md border p-2 text-xs", !r.is_active && "opacity-50")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-medium">
            {r.action === "hide" ? "Hide" : "Disable"} {KIND_LABEL[r.kind].toLowerCase()} “{r.display_label}”
          </div>
          <div className="mt-0.5 flex flex-wrap gap-1">
            {r.roles.map((code) => (
              <Badge key={code} variant="outline" className="px-1.5 py-0 text-[10px]">
                {ui.roles.find((x) => x.code === code)?.name ?? code}
              </Badge>
            ))}
            {r.path === "*" && <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">all pages</Badge>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button size="icon" variant="ghost" className="size-6" onClick={toggleActive} disabled={busy} title={r.is_active ? "Switch off" : "Switch on"}>
            <EyeOff className="size-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="size-6 text-destructive" onClick={remove} disabled={busy} title="Delete">
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function RuleDialog({
  candidates,
  pathname,
  chrome,
  onClose,
}: {
  candidates: Candidate[];
  pathname: string;
  chrome: boolean;
  onClose: () => void;
}) {
  const ui = useUiRights();
  const [index, setIndex] = useState(0);
  const [label, setLabel] = useState(candidates[0].display);
  const [scope, setScope] = useState<Scope>(chrome ? "all" : patternFor(pathname) !== pathname ? "pattern" : "exact");
  const [action, setAction] = useState<UiAction>("hide");
  const [roles, setRoles] = useState<string[]>(ui.previewRole ? [ui.previewRole] : []);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chosen = candidates[index];
  const path = scope === "all" ? "*" : scope === "pattern" ? patternFor(pathname) : pathname;

  const save = async () => {
    if (!roles.length) {
      setError("Choose at least one role.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await server_post_json(post_ui_rule, {
        path,
        kind: chosen.kind,
        label,
        display_label: label,
        action,
        roles,
        note,
      });
      if (!res?.success) throw new Error(res?.error || "Could not save");
      await Promise.all([loadAllUiRules(), loadMyUiRules()]);
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" data-uir-ui>
        <DialogHeader>
          <DialogTitle>Restrict this element</DialogTitle>
          <DialogDescription>
            Applies to the selected roles only. The account owner always sees everything.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs">What to restrict</Label>
            <div className="mt-1.5 space-y-1.5">
              {candidates.map((c, i) => (
                <button
                  key={`${c.kind}-${c.label}`}
                  type="button"
                  onClick={() => {
                    setIndex(i);
                    setLabel(c.display);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm",
                    i === index ? "border-primary bg-primary/5" : "hover:bg-accent",
                  )}
                >
                  <span className="truncate">“{c.display}”</span>
                  <Badge variant="secondary" className="shrink-0">{KIND_LABEL[c.kind]}</Badge>
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs">Matches elements whose text is</Label>
            <Input className="mt-1" value={label} onChange={(e) => setLabel(e.target.value)} />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Numbers are ignored, so “Live (5)” also matches “Live (12)”.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Where</Label>
              <Select value={scope} onValueChange={(v) => setScope(v as Scope)}>
                <SelectTrigger className="mt-1 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="exact">This page only</SelectItem>
                  {patternFor(pathname) !== pathname && <SelectItem value="pattern">Every page like this</SelectItem>}
                  <SelectItem value="all">All pages</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1 truncate text-[11px] text-muted-foreground">{path}</p>
            </div>
            <div>
              <Label className="text-xs">Action</Label>
              <Select value={action} onValueChange={(v) => setAction(v as UiAction)}>
                <SelectTrigger className="mt-1 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hide">Hide</SelectItem>
                  <SelectItem value="disable">Show but disable</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">For these roles</Label>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {ui.roles.map((r) => (
                <label key={r.code} className="flex items-center gap-2 rounded-md border px-2.5 py-2 text-sm">
                  <Checkbox
                    checked={roles.includes(r.code)}
                    onCheckedChange={(v) =>
                      setRoles((prev) => (v ? [...prev, r.code] : prev.filter((c) => c !== r.code)))
                    }
                  />
                  <span className="truncate">{r.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs">Note (optional)</Label>
            <Input className="mt-1" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why this is restricted" />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save rule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
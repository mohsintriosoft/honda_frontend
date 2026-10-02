import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  KIND_LABEL,
  loadAllUiRules,
  loadMyUiRules,
  useUiRights,
  type UiAction,
  type UiKind,
  type UiRule,
} from "@/lib/uiRights";
import { NAV_ITEMS, SECONDARY_NAV_ITEMS } from "@/components/layout/navItems";
import {
  server_delete_data,
  server_patch_data,
  server_post_json,
  post_ui_rule,
  ui_rule_url,
} from "@/components/ServiceConnection/serviceconnection";

const PAGES: { path: string; label: string }[] = [
  { path: "*", label: "All pages (sidebar, header…)" },
  ...[...NAV_ITEMS, ...SECONDARY_NAV_ITEMS].map((n: any) => ({ path: n.to, label: n.label })),
];

function pageName(path: string) {
  if (path === "*") return "All pages";
  const exact = PAGES.find((p) => p.path === path);
  if (exact) return exact.label;
  const base = PAGES.find((p) => p.path !== "*" && p.path !== "/" && path.startsWith(p.path + "/"));
  return base ? `${base.label} › detail` : path;
}

/**
 * Users & Roles → "UI rights" tab. Every screen restriction in one list:
 * switch on/off, change action, add/remove roles, delete, or add one by
 * hand. Picking elements visually happens on the page itself with the
 * "Page rights" button (bottom-right on every page).
 */
export function UiRightsTab() {
  const ui = useUiRights();
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAllUiRules().finally(() => setLoading(false));
    // rules added from the "Page rights" picker (or another admin) show up
    // without a manual reload
    const onFocus = () => loadAllUiRules();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const refresh = () => Promise.all([loadAllUiRules(), loadMyUiRules()]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ui.allRules.filter(
      (r) =>
        (roleFilter === "all" || r.roles.includes(roleFilter)) &&
        (!q || `${r.display_label} ${r.path} ${pageName(r.path)} ${r.note ?? ""}`.toLowerCase().includes(q)),
    );
  }, [ui.allRules, query, roleFilter]);

  const patch = async (r: UiRule, body: Partial<UiRule>) => {
    setBusyId(r.id);
    setError(null);
    try {
      const res = await server_patch_data(ui_rule_url(r.id), body);
      if (!res?.success) throw new Error(res?.error || "Could not save");
      await refresh();
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || "Could not save");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (r: UiRule) => {
    if (!window.confirm(`Delete the rule for “${r.display_label}”?`)) return;
    setBusyId(r.id);
    try {
      await server_delete_data(ui_rule_url(r.id));
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const toggleRole = (r: UiRule, code: string) => {
    const next = r.roles.includes(code) ? r.roles.filter((c) => c !== code) : [...r.roles, code];
    if (!next.length) {
      setError("A rule needs at least one role — delete it instead.");
      return;
    }
    patch(r, { roles: next });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-2 pt-5 text-sm text-muted-foreground">
          <p>
            Hide or disable <b className="text-foreground">any</b> button, field, tab, table column or card for
            chosen roles. Open any page and use <b className="text-foreground">Page rights</b> (bottom-right) →
            <b className="text-foreground"> Pick an element</b>, or add a rule by hand below.
          </p>
          {ui.dealerId != null && (
            <p className="text-xs">
              These rules belong to <b className="text-foreground">dealer #{ui.dealerId}</b> and only apply to users of
              that same dealer. A user from another dealer is not affected.
            </p>
          )}
          <p className="text-xs">
            Only super admins see this tab and the Page rights button, and they are never restricted
            themselves — neither is the account owner. This controls what people <i>see</i>; what they can actually
            do is still decided by the role's rights in the “Roles & rights” tab.
          </p>
        </CardContent>
      </Card>

      <AddRuleForm onSaved={refresh} />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search element or page" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {ui.roles.map((r) => (
              <SelectItem key={r.code} value={r.code}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{rows.length} rule(s)</span>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          ) : rows.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">No UI rules yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Page</TableHead>
                  <TableHead>Element</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>On</TableHead>
                  <TableHead className="text-right"> </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} className={r.is_active ? "" : "opacity-60"}>
                    <TableCell>
                      <div className="font-medium">{pageName(r.path)}</div>
                      <div className="font-mono text-[11px] text-muted-foreground">{r.path}</div>
                      {r.path !== "*" && (
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => patch(r, { path: "*" })}
                          className="mt-0.5 text-[11px] text-primary hover:underline"
                          title="Sidebar / header items must apply on every page"
                        >
                          Apply on all pages
                        </button>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">“{r.display_label}”</div>
                      <div className="text-xs text-muted-foreground">
                        {KIND_LABEL[r.kind]}
                        {r.note ? ` · ${r.note}` : ""}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select value={r.action} onValueChange={(v) => patch(r, { action: v as UiAction })} disabled={busyId === r.id}>
                        <SelectTrigger className="h-8 w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hide">Hide</SelectItem>
                          <SelectItem value="disable">Disable</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex max-w-[320px] flex-wrap gap-1">
                        {ui.roles.map((role) => {
                          const on = r.roles.includes(role.code);
                          return (
                            <button
                              key={role.code}
                              type="button"
                              disabled={busyId === r.id}
                              onClick={() => toggleRole(r, role.code)}
                              className={
                                on
                                  ? "rounded-full border border-primary bg-primary/10 px-2 py-0.5 text-[11px] text-primary"
                                  : "rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent"
                              }
                            >
                              {role.name}
                            </button>
                          );
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Switch checked={r.is_active} disabled={busyId === r.id} onCheckedChange={(v) => patch(r, { is_active: v })} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {r.path !== "*" && !r.path.includes(":") && (
                          <Button size="icon" variant="ghost" className="size-8" asChild title="Open page">
                            <Link to={r.path}>
                              <ExternalLink className="size-4" />
                            </Link>
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-destructive"
                          onClick={() => remove(r)}
                          disabled={busyId === r.id}
                          title="Delete"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function AddRuleForm({ onSaved }: { onSaved: () => Promise<unknown> }) {
  const ui = useUiRights();
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState("*");
  const [customPath, setCustomPath] = useState("");
  const [kind, setKind] = useState<UiKind>("button");
  const [label, setLabel] = useState("");
  const [action, setAction] = useState<UiAction>("hide");
  const [roles, setRoles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    if (!label.trim()) return setError("Enter the element's text (e.g. Pause, Upload call list).");
    if (!roles.length) return setError("Choose at least one role.");
    setSaving(true);
    try {
      const res = await server_post_json(post_ui_rule, {
        path: path === "__custom" ? customPath : path,
        kind,
        label,
        display_label: label,
        action,
        roles,
      });
      if (!res?.success) throw new Error(res?.error || "Could not save");
      setLabel("");
      setRoles([]);
      setOpen(false);
      await onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || "Could not save");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Add rule by hand
      </Button>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label className="text-xs">Page</Label>
            <Select value={path} onValueChange={setPath}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGES.map((p) => (
                  <SelectItem key={p.path} value={p.path}>
                    {p.label}
                  </SelectItem>
                ))}
                <SelectItem value="__custom">Other route…</SelectItem>
              </SelectContent>
            </Select>
            {path === "__custom" && (
              <Input className="mt-2" placeholder="/campaigns/:id" value={customPath} onChange={(e) => setCustomPath(e.target.value)} />
            )}
          </div>
          <div>
            <Label className="text-xs">Element type</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as UiKind)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(KIND_LABEL) as UiKind[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {KIND_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Its visible text / field label</Label>
            <Input className="mt-1" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Pause" />
          </div>
          <div>
            <Label className="text-xs">Action</Label>
            <Select value={action} onValueChange={(v) => setAction(v as UiAction)}>
              <SelectTrigger className="mt-1">
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
          <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {ui.roles.map((r) => (
              <label key={r.code} className="flex items-center gap-2 rounded-md border px-2.5 py-2 text-sm">
                <Checkbox
                  checked={roles.includes(r.code)}
                  onCheckedChange={(v) => setRoles((prev) => (v ? [...prev, r.code] : prev.filter((c) => c !== r.code)))}
                />
                <span className="truncate">{r.name}</span>
              </label>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-2">
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />} Save rule
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default UiRightsTab;
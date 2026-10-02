import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Columns3,
  Crown,
  Loader2,
  Lock,
  PencilLine,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { RoleUiRights } from "@/components/uirights/RoleUiRights";
import {
  server_delete_data,
  server_patch_data,
  server_post_json,
  post_role,
  role_url,
} from "@/components/ServiceConnection/serviceconnection";

export type RoleRow = {
  id: number;
  code: string;
  name: string;
  description: string;
  permissions: string[];
  is_system: boolean;
  is_owner: boolean;
  user_count: number;
  assignable: boolean;
};

export type PermissionDef = { code: string; label: string; group: string };

type Draft = { name: string; description: string; permissions: string[] };

const NEW_ID = -1;

function apiError(err: any, fallback: string) {
  return err?.response?.data?.error || err?.message || fallback;
}

/**
 * Users & Roles -> "Roles & rights".
 * Left: every role with how many rights / users it has. Right: the selected
 * role's rights as switches, grouped, searchable, with "all in group"
 * toggles and a save bar that shows exactly what changed. A "Compare" view
 * shows every role side by side.
 */
// "Manage roles & rights" no longer decides anything -- only super admins
// (settings.HEALTH_BALANCE_STAFF_IDS) manage roles -- so it isn't offered.
// A role that already has it keeps it untouched on save.
const RETIRED_RIGHTS = new Set(["roles.manage"]);

export function RolesRightsPanel({
  roles,
  catalog: fullCatalog,
  myPerms,
  canManage,
  loading,
  onChanged,
}: {
  roles: RoleRow[];
  catalog: PermissionDef[];
  myPerms: string[];
  canManage: boolean;
  loading: boolean;
  onChanged: () => Promise<unknown>;
}) {
  const [view, setView] = useState<"edit" | "compare">("edit");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>({ name: "", description: "", permissions: [] });
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const catalog = useMemo(() => fullCatalog.filter((p) => !RETIRED_RIGHTS.has(p.code)), [fullCatalog]);
  const allCodes = useMemo(() => catalog.map((p) => p.code), [catalog]);
  const groups = useMemo(() => {
    const out: [string, PermissionDef[]][] = [];
    for (const p of catalog) {
      const g = out.find(([name]) => name === p.group);
      if (g) g[1].push(p);
      else out.push([p.group, [p]]);
    }
    return out;
  }, [catalog]);

  const selected = selectedId === NEW_ID ? null : roles.find((r) => r.id === selectedId) ?? null;
  const isNew = selectedId === NEW_ID;
  const isOwner = !!selected?.is_owner;
  const readOnly = !canManage;

  // pick the first non-owner role once roles arrive
  useEffect(() => {
    if (selectedId !== null || !roles.length) return;
    const first = roles.find((r) => !r.is_owner) ?? roles[0];
    select(first.id, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roles]);

  // keep the draft in sync after a reload (e.g. user counts changed)
  useEffect(() => {
    if (selected && !dirty) resetDraft(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roles]);

  function resetDraft(role: RoleRow | null) {
    setDraft(
      role
        ? { name: role.name, description: role.description || "", permissions: [...role.permissions] }
        : { name: "", description: "", permissions: [] },
    );
  }

  const base: Draft = selected
    ? { name: selected.name, description: selected.description || "", permissions: selected.permissions }
    : { name: "", description: "", permissions: [] };

  const added = draft.permissions.filter((c) => !base.permissions.includes(c));
  const removed = base.permissions.filter((c) => !draft.permissions.includes(c));
  const dirty =
    isNew ||
    draft.name.trim() !== base.name ||
    draft.description.trim() !== (base.description || "") ||
    added.length > 0 ||
    removed.length > 0;

  function select(id: number, force = false) {
    if (!force && dirty && id !== selectedId && !window.confirm("Discard unsaved changes?")) return;
    setSelectedId(id);
    setError(null);
    setNotice(null);
    resetDraft(id === NEW_ID ? null : roles.find((r) => r.id === id) ?? null);
  }

  // Only super admins manage roles, and they may grant every right.
  const grantable = (_code: string) => canManage;
  const has = (code: string) => isOwner || draft.permissions.includes(code);

  function toggle(code: string, on: boolean) {
    if (readOnly || isOwner || !grantable(code)) return;
    setDraft((d) => ({
      ...d,
      permissions: on ? Array.from(new Set([...d.permissions, code])) : d.permissions.filter((c) => c !== code),
    }));
  }

  function setMany(codes: string[], on: boolean) {
    if (readOnly || isOwner) return;
    const allowed = codes.filter(grantable);
    setDraft((d) => ({
      ...d,
      permissions: on
        ? Array.from(new Set([...d.permissions, ...allowed]))
        : d.permissions.filter((c) => !allowed.includes(c)),
    }));
  }

  async function save() {
    setError(null);
    setNotice(null);
    if (!draft.name.trim()) {
      setError("Role name is required.");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = { name: draft.name.trim(), description: draft.description.trim() };
      if (!isOwner) body.permissions = draft.permissions;
      const res = isNew
        ? await server_post_json(post_role, body)
        : await server_patch_data(role_url(selected!.id), body);
      if (res?.success === false || res?.error) throw { response: { data: res } };
      const savedId: number | undefined = res?.role?.id;
      await onChanged();
      if (savedId) {
        setSelectedId(savedId);
      }
      setNotice(isNew ? "Role created." : "Changes saved.");
    } catch (err: any) {
      setError(apiError(err, "Couldn't save this role."));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!selected) return;
    if (!window.confirm(`Delete the role "${selected.name}"? This can't be undone.`)) return;
    setSaving(true);
    try {
      const res = await server_delete_data(role_url(selected.id));
      if (res?.success === false) throw { response: { data: res } };
      setSelectedId(null);
      await onChanged();
    } catch (err: any) {
      setError(apiError(err, "Couldn't delete this role."));
    } finally {
      setSaving(false);
    }
  }

  const q = query.trim().toLowerCase();
  const visibleGroups = groups
    .map(([g, perms]) => [g, perms.filter((p) => !q || `${p.label} ${p.code} ${g}`.toLowerCase().includes(q))] as const)
    .filter(([, perms]) => perms.length > 0);

  const granted = isOwner ? allCodes.length : draft.permissions.filter((c) => allCodes.includes(c)).length;
  const labelOf = (code: string) => catalog.find((p) => p.code === code)?.label ?? code;

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading roles…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Each role is a set of rights. Users get the rights of the role they're assigned.
        </p>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border p-0.5">
            <button
              type="button"
              onClick={() => setView("edit")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium",
                view === "edit" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
              )}
            >
              <PencilLine className="size-3.5" /> Edit
            </button>
            <button
              type="button"
              onClick={() => setView("compare")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium",
                view === "compare" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
              )}
            >
              <Columns3 className="size-3.5" /> Compare
            </button>
          </div>
          {canManage && (
            <Button
              size="sm"
              onClick={() => {
                setView("edit");
                select(NEW_ID);
              }}
            >
              <Plus className="size-4" /> New role
            </Button>
          )}
        </div>
      </div>

      {view === "compare" ? (
        <CompareView
          roles={roles}
          groups={groups}
          onOpen={(id) => {
            setView("edit");
            select(id);
          }}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          {/* ── role list ── */}
          <Card className="self-start">
            <CardContent className="p-2">
              {isNew && (
                <div className="mb-1 flex items-center gap-2 rounded-md border border-dashed border-primary bg-primary/5 px-3 py-2.5 text-sm font-medium text-primary">
                  <Plus className="size-4" /> {draft.name.trim() || "New role"}
                </div>
              )}
              <div className="space-y-1">
                {roles.map((r) => {
                  const count = r.is_owner ? allCodes.length : r.permissions.filter((c) => allCodes.includes(c)).length;
                  const pct = allCodes.length ? Math.round((count / allCodes.length) * 100) : 0;
                  const active = r.id === selectedId;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => select(r.id)}
                      className={cn(
                        "w-full rounded-md px-3 py-2.5 text-left transition-colors",
                        active ? "bg-primary/10 ring-1 ring-primary/40" : "hover:bg-accent",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {r.is_owner ? (
                          <Crown className="size-4 shrink-0 text-amber-500" />
                        ) : (
                          <ShieldCheck className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                        )}
                        <span className="truncate text-sm font-medium">{r.name}</span>
                        {r.is_system && !r.is_owner && (
                          <Badge variant="secondary" className="ml-auto px-1.5 py-0 text-[10px]">
                            System
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1.5 h-1 rounded-full bg-muted">
                        <div className="h-1 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                        <span>{r.is_owner ? "All rights" : `${count} of ${allCodes.length} rights`}</span>
                        <span className="inline-flex items-center gap-1">
                          <Users className="size-3" /> {r.user_count}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* ── editor ── */}
          {selectedId === null ? (
            <Card>
              <CardContent className="py-16 text-center text-sm text-muted-foreground">Select a role.</CardContent>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <CardContent className="space-y-5 pt-5">
                {/* identity */}
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label className="text-xs">Role name</Label>
                    <Input
                      className="mt-1"
                      value={draft.name}
                      placeholder="e.g. Service Head"
                      disabled={readOnly}
                      onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Description</Label>
                    <Input
                      className="mt-1"
                      value={draft.description}
                      placeholder="What this role is for"
                      disabled={readOnly}
                      onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                    />
                  </div>
                </div>

                {selected && (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-3.5" /> {selected.user_count} user{selected.user_count === 1 ? "" : "s"}
                    </span>
                    {selected.is_system && <Badge variant="secondary">System role</Badge>}
                    <span className="font-mono">{selected.code}</span>
                  </div>
                )}

                {isOwner && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                    <Crown className="mt-0.5 size-4 shrink-0 text-amber-500" />
                    <span>The Owner role always has every right. Only its name and description can be changed.</span>
                  </div>
                )}

                {/* rights toolbar */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[200px] flex-1">
                    <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                    <Input className="pl-8" placeholder="Search rights" value={query} onChange={(e) => setQuery(e.target.value)} />
                  </div>
                  <Badge variant="outline" className="h-8 px-3 text-xs">
                    {granted} of {allCodes.length} rights
                  </Badge>
                  {!isOwner && !readOnly && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setMany(allCodes, true)}>
                        <Check className="size-4" /> All
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setMany(allCodes, false)}>
                        None
                      </Button>
                    </>
                  )}
                </div>

                {/* rights grid */}
                <div className="grid gap-3 md:grid-cols-2">
                  {visibleGroups.map(([group, perms]) => {
                    const on = perms.filter((p) => has(p.code)).length;
                    const all = on === perms.length;
                    return (
                      <div key={group} className="rounded-lg border">
                        <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide">{group}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {on} of {perms.length} on
                            </div>
                          </div>
                          {!isOwner && !readOnly && (
                            <button
                              type="button"
                              onClick={() => setMany(perms.map((p) => p.code), !all)}
                              className="rounded px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"
                            >
                              {all ? "Turn all off" : "Turn all on"}
                            </button>
                          )}
                        </div>
                        <div className="divide-y">
                          {perms.map((p) => {
                            const checked = has(p.code);
                            const locked = isOwner || readOnly || !grantable(p.code);
                            const changed = added.includes(p.code) || removed.includes(p.code);
                            return (
                              <label
                                key={p.code}
                                className={cn(
                                  "flex items-center justify-between gap-3 px-3 py-2.5",
                                  locked ? "cursor-default" : "cursor-pointer hover:bg-accent/40",
                                  changed && "bg-primary/5",
                                )}
                              >
                                <span className="min-w-0">
                                  <span className="block text-sm">{p.label}</span>
                                  <span className="block font-mono text-[10px] text-muted-foreground">{p.code}</span>
                                </span>
                                <span className="flex shrink-0 items-center gap-2">
                                  {locked && !isOwner && <Lock className="size-3.5 text-muted-foreground" />}
                                  <Switch checked={checked} disabled={locked} onCheckedChange={(v) => toggle(p.code, v)} />
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {visibleGroups.length === 0 && (
                    <p className="text-sm text-muted-foreground md:col-span-2">No right matches “{query}”.</p>
                  )}
                </div>

                {selected && <RoleUiRights roleCode={selected.code} roleName={selected.name} />}

                {error && <p className="text-sm text-destructive">{error}</p>}
                {notice && !dirty && <p className="text-sm text-emerald-600">{notice}</p>}
              </CardContent>

              {/* save bar */}
              {!readOnly && (
                <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t bg-card/95 px-6 py-3 backdrop-blur">
                  <div className="min-w-0 text-xs text-muted-foreground">
                    {isNew ? (
                      "New role — not saved yet"
                    ) : dirty ? (
                      <span className="flex flex-wrap gap-1">
                        Unsaved:
                        {added.map((c) => (
                          <Badge key={c} className="bg-emerald-600/15 px-1.5 py-0 text-[10px] text-emerald-700 hover:bg-emerald-600/15 dark:text-emerald-400">
                            + {labelOf(c)}
                          </Badge>
                        ))}
                        {removed.map((c) => (
                          <Badge key={c} className="bg-rose-600/15 px-1.5 py-0 text-[10px] text-rose-700 hover:bg-rose-600/15 dark:text-rose-400">
                            − {labelOf(c)}
                          </Badge>
                        ))}
                        {!added.length && !removed.length && <span>name / description</span>}
                      </span>
                    ) : (
                      "All changes saved"
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {selected && !selected.is_system && !selected.is_owner && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        disabled={saving || selected.user_count > 0}
                        title={selected.user_count > 0 ? "Move its users to another role first" : "Delete role"}
                        onClick={remove}
                      >
                        <Trash2 className="size-4" /> Delete
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={saving || !dirty}
                      onClick={() => {
                        if (isNew) {
                          const first = roles.find((r) => !r.is_owner) ?? roles[0];
                          if (first) select(first.id, true);
                          else setSelectedId(null);
                        } else resetDraft(selected);
                      }}
                    >
                      <RotateCcw className="size-4" /> {isNew ? "Cancel" : "Discard"}
                    </Button>
                    <Button size="sm" disabled={saving || !dirty} onClick={save}>
                      {saving && <Loader2 className="size-4 animate-spin" />}
                      {isNew ? "Create role" : "Save changes"}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function CompareView({
  roles,
  groups,
  onOpen,
}: {
  roles: RoleRow[];
  groups: [string, PermissionDef[]][];
  onOpen: (id: number) => void;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="sticky left-0 z-10 bg-muted/40 px-4 py-2.5 text-left font-medium">Right</th>
                {roles.map((r) => (
                  <th key={r.id} className="px-3 py-2.5 text-center font-medium">
                    <button type="button" onClick={() => onOpen(r.id)} className="hover:text-primary" title="Edit this role">
                      {r.name}
                    </button>
                    <div className="text-[10px] font-normal text-muted-foreground">{r.user_count} users</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map(([group, perms]) => (
                <GroupRows key={group} group={group} perms={perms} roles={roles} />
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function GroupRows({ group, perms, roles }: { group: string; perms: PermissionDef[]; roles: RoleRow[] }) {
  return (
    <>
      <tr className="border-b bg-muted/20">
        <td colSpan={roles.length + 1} className="sticky left-0 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {group}
        </td>
      </tr>
      {perms.map((p) => (
        <tr key={p.code} className="border-b last:border-0 hover:bg-accent/30">
          <td className="sticky left-0 z-10 bg-card px-4 py-2">{p.label}</td>
          {roles.map((r) => {
            const on = r.is_owner || r.permissions.includes(p.code);
            return (
              <td key={r.id} className="px-3 py-2 text-center">
                {on ? (
                  <Check className="mx-auto size-4 text-emerald-600" aria-label="yes" />
                ) : (
                  <span className="text-muted-foreground/40" aria-label="no">—</span>
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

export default RolesRightsPanel;
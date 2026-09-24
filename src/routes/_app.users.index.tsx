import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { Loader2, Plus, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import {
  server_get_data,
  server_post_json,
  server_patch_data,
  server_delete_data,
  get_branches,
  get_users,
  post_user,
  patch_user,
  get_roles,
  post_role,
  role_url,
} from "@/components/ServiceConnection/serviceconnection";

type StaffRow = {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: string;
  role_name: string;
  branch_id: number | null;
  branch_name: string | null;
  is_active: boolean;
  can_view_all_branches: boolean;
  must_change_password: boolean;
};

type Role = {
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

type PermissionDef = { code: string; label: string; group: string };

type Branch = { id: number; name: string };

const ALL_BRANCHES_VALUE = "__all__";

function apiErrorMessage(err: any, fallback: string) {
  if (err?.response?.status === 403) {
    return err?.response?.data?.error && err.response.data.error !== "Not permitted"
      ? err.response.data.error
      : "You don't have permission to do this.";
  }
  return err?.response?.data?.error || err?.message || fallback;
}

function branchDisplay(u: StaffRow): string {
  if (u.can_view_all_branches || !u.branch_id) return "All";
  return u.branch_name ?? "All";
}

const emptyInviteForm = {
  name: "",
  email: "",
  phone: "",
  role: "",
  branch_id: "",
  password: "",
};

const emptyRoleForm = { name: "", description: "", permissions: [] as string[] };

export default function UsersPage() {
  const [users, setUsers] = useState<StaffRow[] | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [catalog, setCatalog] = useState<PermissionDef[]>([]);
  const [myPerms, setMyPerms] = useState<string[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState(emptyInviteForm);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSaving, setInviteSaving] = useState(false);

  const [editTarget, setEditTarget] = useState<StaffRow | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleForm, setRoleForm] = useState(emptyRoleForm);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [roleSaving, setRoleSaving] = useState(false);

  const canManageUsers = myPerms.includes("users.manage");
  const canManageRoles = myPerms.includes("roles.manage");

  const assignableRoles = useMemo(() => roles.filter((r) => r.assignable), [roles]);
  const roleName = (code: string) => roles.find((r) => r.code === code)?.name ?? code;

  const catalogGroups = useMemo(() => {
    const groups: Record<string, PermissionDef[]> = {};
    for (const p of catalog) (groups[p.group] ??= []).push(p);
    return Object.entries(groups);
  }, [catalog]);

  async function loadAll() {
    setLoading(true);
    setError(null);

    const [usersRes, rolesRes, branchesRes] = await Promise.allSettled([
      server_get_data(get_users),
      server_get_data(get_roles),
      server_get_data(get_branches),
    ]);

    if (usersRes.status === "fulfilled") {
      setUsers(usersRes.value?.results ?? []);
    } else {
      console.error("Failed to load users:", usersRes.reason);
      setUsers(null);
      setError(apiErrorMessage(usersRes.reason, "Failed to load users."));
    }

    if (rolesRes.status === "fulfilled") {
      setRoles(rolesRes.value?.roles ?? []);
      setCatalog(rolesRes.value?.catalog ?? []);
      setMyPerms(rolesRes.value?.my_permissions ?? []);
    }

    if (branchesRes.status === "fulfilled") {
      setBranches(branchesRes.value?.branches ?? []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  /* ---------------- Users ---------------- */

  function openInvite() {
    const defaultRole =
      assignableRoles.find((r) => r.code === "advisor")?.code ??
      assignableRoles.find((r) => !r.is_owner)?.code ??
      "";
    setInviteForm({ ...emptyInviteForm, role: defaultRole });
    setInviteError(null);
    setInviteOpen(true);
  }

  async function handleInviteSubmit() {
    setInviteError(null);

    if (!inviteForm.name.trim() || !inviteForm.email.trim() || !inviteForm.password) {
      setInviteError("Name, email and password are required.");
      return;
    }
    if (!inviteForm.role) {
      setInviteError("Pick a role.");
      return;
    }
    if (inviteForm.password.length < 8) {
      setInviteError("Password must be at least 8 characters.");
      return;
    }

    setInviteSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: inviteForm.name.trim(),
        email: inviteForm.email.trim(),
        phone: inviteForm.phone.trim(),
        role: inviteForm.role,
        password: inviteForm.password,
      };
      if (inviteForm.branch_id) body.branch_id = Number(inviteForm.branch_id);

      const created = await server_post_json(post_user, body);
      if (created?.error) throw { response: { data: created } };

      setInviteOpen(false);
      await loadAll();
    } catch (err: any) {
      setInviteError(apiErrorMessage(err, "Couldn't create this user. Please try again."));
    } finally {
      setInviteSaving(false);
    }
  }

  async function handleToggleActive(u: StaffRow) {
    try {
      const result = await server_patch_data(patch_user(u.id), { is_active: !u.is_active });
      if (result?.error) throw { response: { data: result } };
      await loadAll();
    } catch (err: any) {
      setError(apiErrorMessage(err, "Couldn't update this user."));
    }
  }

  async function handleEditSave() {
    if (!editTarget) return;
    setEditError(null);
    setEditSaving(true);
    try {
      const result = await server_patch_data(patch_user(editTarget.id), {
        name: editTarget.name,
        phone: editTarget.phone,
        role: editTarget.role,
        branch_id: editTarget.branch_id,
        is_active: editTarget.is_active,
      });
      if (result?.error) throw { response: { data: result } };
      setEditTarget(null);
      await loadAll();
    } catch (err: any) {
      setEditError(apiErrorMessage(err, "Couldn't save changes. Please try again."));
    } finally {
      setEditSaving(false);
    }
  }

  /* ---------------- Roles ---------------- */

  function openNewRole() {
    setEditingRole(null);
    setRoleForm(emptyRoleForm);
    setRoleError(null);
    setRoleDialogOpen(true);
  }

  function openEditRole(role: Role) {
    setEditingRole(role);
    setRoleForm({
      name: role.name,
      description: role.description,
      permissions: [...role.permissions],
    });
    setRoleError(null);
    setRoleDialogOpen(true);
  }

  function togglePermission(code: string) {
    setRoleForm((f) => ({
      ...f,
      permissions: f.permissions.includes(code)
        ? f.permissions.filter((p) => p !== code)
        : [...f.permissions, code],
    }));
  }

  async function handleRoleSave() {
    setRoleError(null);
    if (!roleForm.name.trim()) {
      setRoleError("Role name is required.");
      return;
    }
    setRoleSaving(true);
    try {
      const body = {
        name: roleForm.name.trim(),
        description: roleForm.description.trim(),
        permissions: roleForm.permissions,
      };
      const res = editingRole
        ? await server_patch_data(role_url(editingRole.id), body)
        : await server_post_json(post_role, body);
      if (res?.success === false || res?.error) throw { response: { data: res } };
      setRoleDialogOpen(false);
      await loadAll();
    } catch (err: any) {
      setRoleError(apiErrorMessage(err, "Couldn't save this role."));
    } finally {
      setRoleSaving(false);
    }
  }

  async function handleRoleDelete(role: Role) {
    if (!window.confirm(`Delete the role "${role.name}"?`)) return;
    try {
      const res = await server_delete_data(role_url(role.id));
      if (res?.success === false) throw { response: { data: res } };
      await loadAll();
    } catch (err: any) {
      setError(apiErrorMessage(err, "Couldn't delete this role."));
    }
  }

  const ownerRoleForm = editingRole?.is_owner ?? false;

  return (
    <>
      <PageHeader
        title="Users & Roles"
        description="Manage team access with role-based rights per branch."
      />

      <div className="p-4 md:p-6 lg:p-8">
        {error && (
          <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="roles">Roles & rights</TabsTrigger>
          </TabsList>

          {/* ---------------- USERS TAB ---------------- */}
          <TabsContent value="users" className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {canManageUsers ? "" : "You have read-only access to users."}
              </p>
              {canManageUsers && (
                <Button size="sm" onClick={openInvite} disabled={assignableRoles.length === 0}>
                  <UserPlus className="size-4" />
                  Add user
                </Button>
              )}
            </div>

            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="p-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading users…
                  </div>
                ) : users === null ? (
                  <div className="p-8 text-sm text-muted-foreground text-center">
                    Users can't be shown.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Branch</TableHead>
                        <TableHead>Status</TableHead>
                        {canManageUsers && <TableHead />}
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {users.map((u) => {
                        const editable =
                          canManageUsers &&
                          (roles.find((r) => r.code === u.role)?.assignable ?? false);
                        return (
                          <TableRow key={u.id}>
                            <TableCell>
                              <div className="flex items-center gap-2.5">
                                <Avatar className="size-8">
                                  <AvatarFallback className="text-xs">
                                    {initials(u.name)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-medium text-sm">{u.name}</div>
                                  <div className="text-xs text-muted-foreground">{u.email}</div>
                                </div>
                              </div>
                            </TableCell>

                            <TableCell className="text-sm">
                              {u.role_name || roleName(u.role)}
                            </TableCell>

                            <TableCell className="text-sm">{branchDisplay(u)}</TableCell>

                            <TableCell>
                              <span
                                className={`text-[10px] rounded-full px-2 py-0.5 ${
                                  u.is_active
                                    ? "bg-[color:var(--success)]/15 text-[color:var(--success)]"
                                    : "bg-[color:var(--warning)]/15 text-[color:var(--warning-foreground)]"
                                }`}
                              >
                                {u.is_active ? "Active" : "Deactivated"}
                              </span>
                            </TableCell>

                            {canManageUsers && (
                              <TableCell className="text-right">
                                {editable && (
                                  <div className="flex justify-end gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setEditError(null);
                                        setEditTarget(u);
                                      }}
                                    >
                                      Manage
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleToggleActive(u)}
                                    >
                                      {u.is_active ? "Deactivate" : "Reactivate"}
                                    </Button>
                                  </div>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}

                      {users.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={canManageUsers ? 5 : 4}
                            className="text-center text-sm text-muted-foreground py-8"
                          >
                            No users yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ---------------- ROLES TAB ---------------- */}
          <TabsContent value="roles" className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Each role is a set of rights. Users get the rights of the role they're assigned.
              </p>
              {canManageRoles && (
                <Button size="sm" onClick={openNewRole}>
                  <Plus className="size-4" />
                  New role
                </Button>
              )}
            </div>

            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="p-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading roles…
                  </div>
                ) : roles.length === 0 ? (
                  <div className="p-8 text-sm text-muted-foreground text-center">
                    Roles can't be shown.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Role</TableHead>
                        <TableHead>Rights</TableHead>
                        <TableHead>Users</TableHead>
                        {canManageRoles && <TableHead />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {roles.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <ShieldCheck className="size-4 text-muted-foreground" />
                              <span className="font-medium text-sm">{r.name}</span>
                              {r.is_system && (
                                <Badge variant="secondary" className="text-[10px]">
                                  System
                                </Badge>
                              )}
                            </div>
                            {r.description && (
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {r.description}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {r.is_owner
                              ? "All rights"
                              : `${r.permissions.length} of ${catalog.length}`}
                          </TableCell>
                          <TableCell className="text-sm">{r.user_count}</TableCell>
                          {canManageRoles && (
                            <TableCell className="text-right">
                              {r.assignable && (
                                <div className="flex justify-end gap-1">
                                  <Button size="sm" variant="ghost" onClick={() => openEditRole(r)}>
                                    Edit
                                  </Button>
                                  {!r.is_system && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-destructive"
                                      disabled={r.user_count > 0}
                                      title={
                                        r.user_count > 0
                                          ? "Move its users to another role first"
                                          : "Delete role"
                                      }
                                      onClick={() => handleRoleDelete(r)}
                                    >
                                      <Trash2 className="size-4" />
                                    </Button>
                                  )}
                                </div>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ---------------- Add user dialog ---------------- */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add user</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Set a password and tell them personally — there's no invite email or link.
            </p>

            <div>
              <Label>Name</Label>
              <Input
                className="mt-1"
                value={inviteForm.name}
                onChange={(e) => setInviteForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div>
              <Label>Email</Label>
              <Input
                type="email"
                className="mt-1"
                value={inviteForm.email}
                onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>

            <div>
              <Label>Phone</Label>
              <Input
                className="mt-1"
                value={inviteForm.phone}
                onChange={(e) => setInviteForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>

            <div>
              <Label>Role</Label>
              <Select
                value={inviteForm.role}
                onValueChange={(v) => setInviteForm((f) => ({ ...f, role: v }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {assignableRoles.map((r) => (
                    <SelectItem key={r.code} value={r.code}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Branch</Label>
              <Select
                value={inviteForm.branch_id || ALL_BRANCHES_VALUE}
                onValueChange={(v) =>
                  setInviteForm((f) => ({ ...f, branch_id: v === ALL_BRANCHES_VALUE ? "" : v }))
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_BRANCHES_VALUE}>
                    Whole dealership (all branches)
                  </SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Password</Label>
              <Input
                type="password"
                className="mt-1"
                placeholder="At least 8 characters"
                value={inviteForm.password}
                onChange={(e) => setInviteForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>

            {inviteError && <p className="text-sm text-destructive">{inviteError}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)} disabled={inviteSaving}>
              Cancel
            </Button>
            <Button onClick={handleInviteSubmit} disabled={inviteSaving}>
              {inviteSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating…
                </>
              ) : (
                "Create user"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------- Manage user dialog ---------------- */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        {editTarget && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Manage {editTarget.name}</DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div>
                <Label>Name</Label>
                <Input
                  className="mt-1"
                  value={editTarget.name}
                  onChange={(e) => setEditTarget((t) => (t ? { ...t, name: e.target.value } : t))}
                />
              </div>

              <div>
                <Label>Phone</Label>
                <Input
                  className="mt-1"
                  value={editTarget.phone}
                  onChange={(e) => setEditTarget((t) => (t ? { ...t, phone: e.target.value } : t))}
                />
              </div>

              <div>
                <Label>Role</Label>
                <Select
                  value={editTarget.role}
                  onValueChange={(v) => setEditTarget((t) => (t ? { ...t, role: v } : t))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {assignableRoles.map((r) => (
                      <SelectItem key={r.code} value={r.code}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Branch</Label>
                <Select
                  value={editTarget.branch_id ? String(editTarget.branch_id) : ALL_BRANCHES_VALUE}
                  onValueChange={(v) =>
                    setEditTarget((t) =>
                      t ? { ...t, branch_id: v === ALL_BRANCHES_VALUE ? null : Number(v) } : t,
                    )
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_BRANCHES_VALUE}>
                      Whole dealership (all branches)
                    </SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={String(b.id)}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between border rounded-md p-3">
                <div>
                  <div className="text-sm font-medium">Active</div>
                  <div className="text-xs text-muted-foreground">
                    Deactivated users can't sign in, but call records referencing them are kept.
                  </div>
                </div>
                <Switch
                  checked={editTarget.is_active}
                  onCheckedChange={(checked) =>
                    setEditTarget((t) => (t ? { ...t, is_active: checked } : t))
                  }
                />
              </div>

              {editError && <p className="text-sm text-destructive">{editError}</p>}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditTarget(null)} disabled={editSaving}>
                Cancel
              </Button>
              <Button onClick={handleEditSave} disabled={editSaving}>
                {editSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* ---------------- Role dialog ---------------- */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRole ? `Edit role — ${editingRole.name}` : "New role"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label>Role name</Label>
              <Input
                className="mt-1"
                value={roleForm.name}
                placeholder="e.g. Service Head"
                onChange={(e) => setRoleForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div>
              <Label>Description</Label>
              <Input
                className="mt-1"
                value={roleForm.description}
                onChange={(e) => setRoleForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div className="space-y-3">
              <Label>Rights</Label>
              {ownerRoleForm && (
                <p className="text-xs text-muted-foreground">
                  The Owner role always has every right.
                </p>
              )}
              {catalogGroups.map(([group, perms]) => (
                <div key={group} className="rounded-md border p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    {group}
                  </div>
                  <div className="space-y-2">
                    {perms.map((p) => {
                      const checked = ownerRoleForm || roleForm.permissions.includes(p.code);
                      const grantable = myPerms.includes(p.code);
                      return (
                        <label
                          key={p.code}
                          className={`flex items-center gap-2 text-sm ${!grantable || ownerRoleForm ? "opacity-60" : "cursor-pointer"}`}
                          title={!grantable ? "You can't grant a right you don't have" : undefined}
                        >
                          <input
                            type="checkbox"
                            className="size-4 accent-[color:var(--primary)]"
                            checked={checked}
                            disabled={ownerRoleForm || !grantable}
                            onChange={() => togglePermission(p.code)}
                          />
                          {p.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {roleError && <p className="text-sm text-destructive">{roleError}</p>}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRoleDialogOpen(false)}
              disabled={roleSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleRoleSave} disabled={roleSaving}>
              {roleSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save role"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

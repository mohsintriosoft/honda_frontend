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
  getStaffUser,
  setAuthSession,
} from "@/components/ServiceConnection/serviceconnection";
import { hasPerm, isSuperAdmin } from "@/lib/permissions";
import { useUiRights } from "@/lib/uiRights";
import { UiRightsTab } from "@/components/uirights/UiRightsTab";
import { RolesRightsPanel } from "@/components/roles/RolesRightsPanel";

// Keeps the stored login user's rights in step with the server, so the
// sidebar/route guards update right after someone edits their own role.
function syncStoredPermissions(perms: string[]) {
  const user = getStaffUser();
  const token = localStorage.getItem("access_token");
  if (!user || !token) return;
  const current = Array.isArray(user.permissions) ? [...user.permissions].sort() : [];
  const next = [...perms].sort();
  if (current.join(",") === next.join(",")) return;
  setAuthSession(token, { ...user, permissions: perms });
}

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

export default function UsersPage() {
  // A roles-only admin can open this page but can't list users.
  const canViewUsers = hasPerm("users.view", "users.manage");
  // Roles & rights + UI rights: super admins only (settings.HEALTH_BALANCE_STAFF_IDS).
  // useUiRights() re-renders once /api/ui-rules/ confirms the flag.
  const uiRightsState = useUiRights();
  const superAdmin = isSuperAdmin() || uiRightsState.canManage;

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


  const canManageUsers = myPerms.includes("users.manage");
  // The logged-in user's own row offers neither Manage nor Deactivate.
  const currentUserId = getStaffUser()?.id;
  const canManageRoles = superAdmin;

  const assignableRoles = useMemo(() => roles.filter((r) => r.assignable), [roles]);
  const roleName = (code: string) => roles.find((r) => r.code === code)?.name ?? code;


  async function loadAll() {
    setLoading(true);
    setError(null);

    const [usersRes, rolesRes, branchesRes] = await Promise.allSettled([
      canViewUsers ? server_get_data(get_users) : Promise.resolve({ results: [] }),
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
      const perms: string[] = rolesRes.value?.my_permissions ?? [];
      setMyPerms(perms);
      syncStoredPermissions(perms);
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

        <Tabs defaultValue={canViewUsers ? "users" : superAdmin ? "roles" : "users"}>
          <TabsList>
            {canViewUsers && <TabsTrigger value="users">Users</TabsTrigger>}
            {superAdmin && <TabsTrigger value="roles">Roles & rights</TabsTrigger>}
            {superAdmin && <TabsTrigger value="ui">UI rights</TabsTrigger>}
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
                                className={`text-[10px] rounded-full px-2 py-0.5 ${u.is_active
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
                                    {u.id !== currentUserId && (
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
                                    )}
                                    {u.id !== currentUserId && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleToggleActive(u)}
                                      >
                                        {u.is_active ? "Deactivate" : "Reactivate"}
                                      </Button>
                                    )}
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
          {superAdmin && (
            <TabsContent value="roles" className="mt-4">
              <RolesRightsPanel
                roles={roles}
                catalog={catalog}
                myPerms={myPerms}
                canManage={canManageRoles}
                loading={loading}
                onChanged={loadAll}
              />
            </TabsContent>
          )}

          {superAdmin && (
            <TabsContent value="ui" className="mt-4">
              <UiRightsTab />
            </TabsContent>
          )}
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

    </>
  );
}
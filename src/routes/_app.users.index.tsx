import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { Loader2, UserPlus } from "lucide-react";
import {
  server_get_data,
  server_post_json,
  server_patch_data,
  APL_LINK,
} from "@/components/ServiceConnection/serviceconnection";
import { handleError } from "@/components/CommonJquery/CommonJquery";
import { useAuth } from "@/context/AuthContext";

// Not exported from serviceconnection.js yet -- added alongside /me/ in
// the auth/permissions plan (§2/§8). Built locally the same way
// get_branch_detail etc. are, rather than editing that file for two URLs
// only this page uses so far.
const get_users = APL_LINK + "api/users/";
const post_user = APL_LINK + "api/users/";
const patch_user = (id: number) => `${APL_LINK}api/users/${id}/`;

const ROLE_CHOICES = [
  { value: "owner", label: "Owner" },
  { value: "dealer_admin", label: "Dealer Admin" },
  { value: "branch_manager", label: "Branch Manager" },
  { value: "advisor", label: "Service Advisor" },
  { value: "telecaller", label: "Telecaller" },
] as const;

const ROLE_LABEL: Record<string, string> = Object.fromEntries(
  ROLE_CHOICES.map((r) => [r.value, r.label]),
);

// Matches _serialize_staff_row() in views_admin.py.
type StaffRow = {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: string;
  branch_id: number | null;
  branch_name: string | null;
  is_active: boolean;
  can_edit_knowledge: boolean;
  can_edit_agent: boolean;
  can_edit_campaign: boolean;
  can_view_all_branches: boolean;
  must_change_password: boolean;
};

// Radix/shadcn's Select can't hold an empty-string item value, and once
// a value is set there's nothing in the list to click back to "unset" --
// the placeholder only shows for an empty value, it's not a selectable
// option. So "whole dealership" needs its own real, non-empty sentinel
// value in the list, translated to/from branch_id="" (invite form) or
// null (edit target) at the read/write boundary below.
const ALL_BRANCHES_VALUE = "__all__";

type Branch = { id: number; name: string };

// "All" means dealer-wide ACCESS, not just "no home branch set" -- per
// PDF §4.6, can_view_all_branches is what actually drives row-scoping
// (see scoped() in permissions.py: `if can_view_all_branches or
// branch_id is None`). Owner/dealer_admin default to that flag True at
// creation time, but can still have a specific branch_id on their row
// (e.g. the branch they physically sit at) -- that's a home-branch label,
// not a restriction, so it shouldn't read as one here.
function branchDisplay(u: StaffRow): string {
  if (u.can_view_all_branches) return "All";
  return u.branch_name ?? "All";
}

const emptyInviteForm = {
  name: "",
  email: "",
  phone: "",
  role: "advisor" as string,
  branch_id: "" as string, // "" = whole dealer (branch=null)
  password: "",
};

export default function UsersPage() {
  const { role: myRole, loading: authLoading } = useAuth();
  // Only owner/dealer_admin get edit controls; branch_manager is a
  // read-only list per the PDF §4.5 matrix -- the backend already
  // enforces this (PATCH 403s for branch_manager), this just keeps the
  // UI from offering buttons that would fail.
  const canEdit = myRole === "owner" || myRole === "dealer_admin";

  const [users, setUsers] = useState<StaffRow[] | null>(null);
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

  async function loadUsers() {
    setLoading(true);
    setError(null);
    try {
      const data = await server_get_data(get_users);
      setUsers(data?.results ?? []);
    } catch (err) {
      console.error("Failed to load users:", err);
      handleError("network");
      setError("Failed to load users.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
    // Branches feed the invite/edit branch picker. Reuses the same
    // endpoint the Settings/Calendar pages already call.
    server_get_data(APL_LINK + "api/branches/")
      .then((data) => setBranches(data?.results ?? data?.branches ?? []))
      .catch((err) => console.error("Failed to load branches:", err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleInviteSubmit() {
    setInviteError(null);

    if (!inviteForm.name.trim() || !inviteForm.email.trim() || !inviteForm.password) {
      setInviteError("Name, email and password are required.");
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
      if (created?.error) throw new Error(created.error);

      setInviteOpen(false);
      setInviteForm(emptyInviteForm);
      await loadUsers();
    } catch (err: any) {
      const serverMessage = err?.response?.data?.error || err?.message;
      setInviteError(serverMessage || "Couldn't create this user. Please try again.");
    } finally {
      setInviteSaving(false);
    }
  }

  async function handleToggleActive(u: StaffRow) {
    // Optimistic-ish: just refetch after, keeps this simple and matches
    // how the rest of this page already works (no local row mutation
    // elsewhere either).
    try {
      const result = await server_patch_data(patch_user(u.id), {
        is_active: !u.is_active,
      });
      if (result?.error) throw new Error(result.error);
      await loadUsers();
    } catch (err: any) {
      console.error("Failed to update user status:", err);
      handleError("network");
    }
  }

  return (
    <>
      <PageHeader
        title="Users & Roles"
        description="Manage team access with role-based permissions per branch."
        actions={
          canEdit ? (
            <Button size="sm" onClick={() => setInviteOpen(true)}>
              <UserPlus className="size-4" />
              Invite user
            </Button>
          ) : undefined
        }
      />

      <div className="p-4 md:p-6 lg:p-8">
        {!canEdit && !authLoading && (
          <p className="mb-3 text-xs text-muted-foreground">
            You have read-only access to this page.
          </p>
        )}

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading users…
              </div>
            ) : error ? (
              <div className="p-8 text-sm text-destructive text-center">{error}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Status</TableHead>
                    {canEdit && <TableHead />}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {(users ?? []).map((u) => (
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
                        {ROLE_LABEL[u.role] ?? u.role}
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

                      {canEdit && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => setEditTarget(u)}>
                              Manage
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleToggleActive(u)}>
                              {u.is_active ? "Deactivate" : "Reactivate"}
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}

                  {(users ?? []).length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={canEdit ? 5 : 4}
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
      </div>

      {/* Invite user dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite user</DialogTitle>
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
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_CHOICES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
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
                  setInviteForm((f) => ({
                    ...f,
                    branch_id: v === ALL_BRANCHES_VALUE ? "" : v,
                  }))
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

      {/* Manage / edit dialog */}
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
                    {ROLE_CHOICES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
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
                      t
                        ? { ...t, branch_id: v === ALL_BRANCHES_VALUE ? null : Number(v) }
                        : t,
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
              <Button
                onClick={async () => {
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
                    if (result?.error) throw new Error(result.error);
                    setEditTarget(null);
                    await loadUsers();
                  } catch (err: any) {
                    const serverMessage = err?.response?.data?.error || err?.message;
                    setEditError(serverMessage || "Couldn't save changes. Please try again.");
                  } finally {
                    setEditSaving(false);
                  }
                }}
                disabled={editSaving}
              >
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
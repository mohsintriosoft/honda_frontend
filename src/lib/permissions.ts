// Single source of truth for UI-side rights. Codes mirror the backend
// PERMISSION_CATALOG (voice_bot/permissions.py) -- the backend is still the
// real gate (403); this only hides what the user can't use.
import { getStaffUser } from "@/components/ServiceConnection/serviceconnection";
import { getUiRightsState } from "@/lib/uiRights";

export type PermCode =
  | "dashboard.view"
  | "customers.view"
  | "calls.view"
  | "calls.place"
  | "callbacks.manage"
  | "appointments.manage"
  | "branches.manage"
  | "campaigns.edit"
  | "imports.manage"
  | "agents.edit"
  | "knowledge.edit"
  | "intents.view"
  | "settings.manage"
  | "health.view"
  | "users.view"
  | "users.manage"
  | "roles.manage";

/** Caller's rights from the stored login user, or null for an old session without them. */
export function getPermissions(): Set<string> | null {
  const user = getStaffUser();
  if (!user || !Array.isArray(user.permissions)) return null;
  return new Set<string>(user.permissions);
}

/**
 * Super admin = the staff ids in the backend's settings.HEALTH_BALANCE_STAFF_IDS.
 * Only they see and manage "Roles & rights" and "UI rights" (and the
 * "Page rights" picker). Read from the login user (is_super_admin) or, for a
 * session that logged in before this flag existed, from /api/ui-rules/.
 */
export function isSuperAdmin(): boolean {
  const user = getStaffUser();
  return user?.is_super_admin === true || getUiRightsState().canManage;
}

/**
 * STRICT super admin: only staff ids in settings.HEALTH_BALANCE_STAFF_IDS
 * (not the owner role). Used by the SOP page. From the login user, or from
 * /api/ui-rules/ for a session that logged in before the flag existed.
 */
export function isStrictSuperAdmin(): boolean {
  const user = getStaffUser();
  return user?.is_super_admin === true || getUiRightsState().isSuperAdmin === true;
}

/** True if the user has ANY of the given rights (same rule as backend @require_perm). */
export function hasPerm(...codes: PermCode[]): boolean {
  const perms = getPermissions();
  if (!perms) return false;
  return codes.some((c) => perms.has(c));
}

// Route prefix -> rights needed (ANY). null = any logged-in user.
// Longest matching prefix wins, so /agents/recordings overrides /agents.
const ROUTE_PERMS: Record<string, PermCode[] | null> = {
  "/dashboard": ["dashboard.view"],
  "/customers": ["customers.view"],
  "/segments": ["agents.edit", "campaigns.edit", "imports.manage", "dashboard.view"],
  "/campaigns": ["campaigns.edit", "dashboard.view"],
  "/agents": ["agents.edit"],
  "/agents/recordings": ["calls.view"],
  "/intents": ["intents.view"],
  "/fillers": ["agents.edit", "intents.view"],
  "/knowledge": ["knowledge.edit", "agents.edit"],
  "/voice": ["calls.view", "calls.place"],
  "/whatsapp": null,
  "/appointments": ["appointments.manage", "dashboard.view"],
  "/visits": ["dashboard.view", "imports.manage"],
  "/callbacks": ["callbacks.manage"],
  "/branches": ["branches.manage", "appointments.manage"],
  "/imports": ["imports.manage"],
  "/analytics": ["dashboard.view"],
  "/health": ["health.view"],
  "/integrations": ["settings.manage"],
  "/users": ["users.view", "users.manage"], // + super admins (see canAccessPath)
  "/settings": null,
  "/sops": null, // super admins only -- see canAccessPath
  "/call-queue": null, // super admins only -- see canAccessPath
};

function matchRoute(path: string): string | undefined {
  return Object.keys(ROUTE_PERMS)
    .filter((p) => path === p || path.startsWith(p + "/"))
    .sort((a, b) => b.length - a.length)[0];
}

/** Can the current user open this path? Unknown paths pass (404 handles them). */
export function canAccessPath(path: string): boolean {
  const key = matchRoute(path);
  if (key === undefined) return true;
  const needed = ROUTE_PERMS[key];
  if (key === "/users" && isSuperAdmin()) return true; // Roles & rights / UI rights
  if (key === "/sops") return isStrictSuperAdmin(); // SOP: HEALTH_BALANCE_STAFF_IDS only
  if (key === "/call-queue") return isStrictSuperAdmin(); // Today's Calls: HEALTH_BALANCE_STAFF_IDS only
  return needed === null || hasPerm(...needed);
}

// Order to pick a landing page when /dashboard isn't allowed.
const LANDING_ORDER = [
  "/dashboard",
  "/voice",
  "/callbacks",
  "/appointments",
  "/customers",
  "/campaigns",
  "/agents",
  "/imports",
  "/settings",
];

export function landingPath(): string {
  return LANDING_ORDER.find(canAccessPath) || "/settings";
}

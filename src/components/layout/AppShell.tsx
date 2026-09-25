import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Search,
  Bell,
  Building2,
  Sun,
  Moon,
  ChevronDown,
  Command,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { canAccessPath } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { CommandPalette } from "./CommandPalette";
import { NAV_ITEMS, SECONDARY_NAV_ITEMS, badgeLabel } from "./navItems";
import {
  server_get_data,
  server_post_json,
  get_nav_badges,
  logout_user_email,
  clearAuthSession,
  getStaffUser,
} from "@/components/ServiceConnection/serviceconnection";

const nav = NAV_ITEMS;
const secondary = SECONDARY_NAV_ITEMS;
const BADGE_POLL_MS = 60_000;

type Workspace = {
  name: string;
  code: string;
  city: string;
  branch_count: number;
  branches: { id: number; name: string; city: string; is_main_branch: boolean }[];
  my_branch: { id: number; name: string } | null;
};

function workspaceInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "—";
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0]).toUpperCase();
}

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [dark, setDark] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [badges, setBadges] = useState<Record<string, number>>({});
  const [workspace, setWorkspace] = useState<Workspace | null>(null);

  // Live counts for the sidebar: on load, on every page change (so a
  // pause/resume or a processed import shows up right away), and once a
  // minute while the tab is visible. A failed fetch keeps the last counts.
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      if (document.hidden) return;
      server_get_data(get_nav_badges)
        .then((res) => {
          if (cancelled) return;
          if (res?.badges) setBadges(res.badges);
          if (res?.workspace) setWorkspace(res.workspace);
        })
        .catch(() => {});
    };
    load();
    const timer = window.setInterval(load, BADGE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [pathname]);

  const canOpenBranches = canAccessPath("/branches");
  const workspaceSubtitle = workspace
    ? [
        workspace.city,
        workspace.my_branch
          ? `${workspace.my_branch.name} branch`
          : `${workspace.branch_count} ${workspace.branch_count === 1 ? "branch" : "branches"}`,
      ]
        .filter(Boolean)
        .join(" • ")
    : "";

  const badgeText = (to: string) => badgeLabel(badges, to);

  // Only the pages this user's role can open.
  const visibleNav = nav.filter((item) => canAccessPath(item.to));
  const visibleSecondary = secondary.filter((item) => canAccessPath(item.to));

  // Falls back to the placeholder identity below until the login page is
  // wired up to actually populate "staff_user" via setAuthSession().
  const staffUser = getStaffUser();
  const displayName = staffUser?.name || "Rajesh Saini";
  const initials = displayName
    .split(" ")
    .map((part: string) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      // Best-effort — logout_user_email doesn't exist on the backend yet.
      // The local session clear below is what actually logs the user out
      // of this client, so a failed/404 request here is not fatal.
      await server_post_json(logout_user_email).catch(() => { });
    } finally {
      clearAuthSession();
      setSigningOut(false);
      navigate("/login", { replace: true });
    }
  };

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const isActive = (to: string) => {
    const allPaths = [...nav, ...secondary].map((i) => i.to);
    const match = allPaths
      .filter((p) => pathname === p || pathname.startsWith(p + "/"))
      .sort((a, b) => b.length - a.length)[0];
    return to === match;
  };

  // const isActive = (to: string) => pathname === to || (to !== "/" && pathname.startsWith(to));

  return (
    <div className="min-h-screen flex w-full bg-background text-foreground">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
        <div className="h-14 flex items-center gap-2 px-4 border-b">
          <div className="size-8 rounded-md bg-gradient-to-br from-primary to-[color:var(--ai)] grid place-items-center text-primary-foreground font-display font-bold">
            T
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold font-display">Triosoft</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              AI Lifecycle OS
            </div>
          </div>
        </div>

        {/* Workspace (dealer) -- from GET /api/nav-badges/ */}
        <div className="p-3 border-b">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="w-full flex items-center gap-2 rounded-md border bg-card px-2.5 py-2 text-left hover:bg-accent transition-colors"
                disabled={!workspace}
              >
                <div className="size-7 rounded bg-foreground/90 text-background grid place-items-center text-xs font-bold">
                  {workspace ? workspaceInitials(workspace.name) : ""}
                </div>
                <div className="flex-1 min-w-0">
                  {workspace ? (
                    <>
                      <div className="text-sm font-medium truncate">{workspace.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {workspaceSubtitle}
                      </div>
                    </>
                  ) : (
                    <div className="space-y-1.5" aria-label="Loading workspace">
                      <div className="h-3 w-24 rounded bg-muted animate-pulse" />
                      <div className="h-2.5 w-16 rounded bg-muted animate-pulse" />
                    </div>
                  )}
                </div>
                <ChevronDown className="size-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            {workspace && (
              <DropdownMenuContent className="w-60" align="start">
                <DropdownMenuLabel className="flex items-center justify-between gap-2">
                  <span className="truncate">{workspace.name}</span>
                  {workspace.code && (
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {workspace.code}
                    </span>
                  )}
                </DropdownMenuLabel>
                {workspace.my_branch && (
                  <div className="px-2 pb-1.5 text-xs text-muted-foreground">
                    You work at {workspace.my_branch.name}
                  </div>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-normal">
                  Branches
                </DropdownMenuLabel>
                {workspace.branches.length === 0 ? (
                  <DropdownMenuItem disabled>No active branches</DropdownMenuItem>
                ) : (
                  workspace.branches.map((b) => (
                    <DropdownMenuItem
                      key={b.id}
                      disabled={!canOpenBranches}
                      onClick={() => navigate(`/branches/${b.id}`)}
                    >
                      <Building2 className="mr-2 size-4" />
                      <span className="flex-1 truncate">{b.name}</span>
                      {b.is_main_branch && (
                        <span className="ml-2 text-[10px] text-muted-foreground">Main</span>
                      )}
                    </DropdownMenuItem>
                  ))
                )}
                {canOpenBranches && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate("/branches")}>
                      Manage branches
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            )}
          </DropdownMenu>
        </div>

        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {visibleNav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                isActive(item.to)
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <item.icon className="size-4" />
              <span className="flex-1">{item.label}</span>
              {badgeText(item.to) && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-medium">
                  {badgeText(item.to)}
                </Badge>
              )}
            </Link>
          ))}

          {visibleSecondary.length > 0 && (
            <div className="pt-4 pb-1 px-2.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              Workspace
            </div>
          )}
          {visibleSecondary.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                isActive(item.to)
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60",
              )}
            >
              <item.icon className="size-4" />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-14 flex items-center gap-3 border-b px-4 md:px-6 bg-background/80 backdrop-blur sticky top-0 z-30">
          <button
            onClick={() => setPaletteOpen(true)}
            className="flex-1 max-w-md flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <Search className="size-4" />
            <span className="flex-1 text-left">Search customers, campaigns, calls…</span>
            <kbd className="hidden sm:inline-flex items-center gap-1 rounded border bg-background px-1.5 py-0.5 text-[10px] font-mono">
              <Command className="size-3" />K
            </kbd>
          </button>

          {/* ml-auto pushes theme / bell / profile to the far right */}
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDark((d) => !d)}
              aria-label="Toggle theme"
            >
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="size-4" />
                  <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-destructive" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="flex flex-col items-start gap-0.5">
                  <div className="text-sm font-medium">9 escalations need review</div>
                  <div className="text-xs text-muted-foreground">Win-back campaign • 5m ago</div>
                </DropdownMenuItem>
                <DropdownMenuItem className="flex flex-col items-start gap-0.5">
                  <div className="text-sm font-medium">Free Service Nudge crossed 80 bookings</div>
                  <div className="text-xs text-muted-foreground">21m ago</div>
                </DropdownMenuItem>
                <DropdownMenuItem className="flex flex-col items-start gap-0.5">
                  <div className="text-sm font-medium">WhatsApp template approved</div>
                  <div className="text-xs text-muted-foreground">amc_renewal_v1 • 1h ago</div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="ml-1 flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-accent">
                  <Avatar className="size-7">
                    <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                      {initials || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden lg:block text-left leading-tight">
                    <div className="text-xs font-medium">{displayName}</div>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => navigate("/settings")}>Profile</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} disabled={signingOut}>
                  {signingOut ? "Signing out…" : "Sign out"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 min-w-0">{children}</main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} badges={badges} />
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: { label: string; to?: string }[];
}) {
  return (
    <div className="px-4 md:px-6 lg:px-8 pt-6 pb-4 border-b bg-background">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
          {breadcrumbs.map((b, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {b.to ? (
                <Link to={b.to} className="hover:text-foreground">
                  {b.label}
                </Link>
              ) : (
                <span>{b.label}</span>
              )}
              {i < breadcrumbs.length - 1 && <span>/</span>}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-display font-semibold tracking-tight">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground max-w-2xl">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
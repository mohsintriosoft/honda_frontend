import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Layers,
  Megaphone,
  PhoneCall,
  MessageSquare,
  CalendarDays,
  BarChart3,
  Route,
  Bot,
  AudioLines,
  ClipboardCheck,
  Target,
  BookOpen,
  Plug,
  Shield,
  Settings,
  Search,
  Bell,
  Sparkles,
  Building2,
  Sun,
  Moon,
  ChevronDown,
  Command,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
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

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/customers", label: "Customer 360", icon: Users },
  { to: "/segments", label: "Segments", icon: Layers },
  { to: "/campaigns", label: "Campaigns", icon: Megaphone, badge: "4 live" },
  { to: "/journey", label: "Journey", icon: Route },
  { to: "/agents", label: "AI Agents", icon: Bot },
  { to: "/agents/recordings", label: "Call Recordings", icon: AudioLines },
  { to: "/agents/recordings/review", label: "Review Queue", icon: ClipboardCheck, badge: "16" },
  { to: "/intents", label: "Intents", icon: Target },   // NEW
  { to: "/knowledge", label: "Knowledge Base", icon: BookOpen },   // NEW
  { to: "/voice", label: "AI Voice Calls", icon: PhoneCall },
  { to: "/whatsapp", label: "WhatsApp", icon: MessageSquare, badge: "12" },
  { to: "/appointments", label: "Appointments", icon: CalendarDays },
  { to: "/branches", label: "Branches", icon: Building2 },   // NEW
  { to: "/analytics", label: "Reports & Analytics", icon: BarChart3 },
] as const;

const secondary = [
  { to: "/integrations", label: "Integrations", icon: Plug },
  { to: "/users", label: "Users", icon: Shield },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [dark, setDark] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

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

  const isActive = (to: string) => pathname === to || (to !== "/" && pathname.startsWith(to));

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

        {/* Workspace switcher */}
        <div className="p-3 border-b">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-2 rounded-md border bg-card px-2.5 py-2 text-left hover:bg-accent transition-colors">
                <div className="size-7 rounded bg-foreground/90 text-background grid place-items-center text-xs font-bold">
                  OH
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">Om Honda</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    Bhopal • 3 branches
                  </div>
                </div>
                <ChevronDown className="size-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="start">
              <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
              <DropdownMenuItem>
                <Building2 className="mr-2 size-4" /> Om Honda — Bhopal
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <Building2 className="mr-2 size-4 opacity-60" /> Demo Dealer (preview)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>+ Add workspace</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {nav.map((item) => (
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
              {"badge" in item && item.badge ? (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-medium">
                  {item.badge}
                </Badge>
              ) : null}
            </Link>
          ))}

          <div className="pt-4 pb-1 px-2.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            Workspace
          </div>
          {secondary.map((item) => (
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

        <div className="p-3 border-t">
          <div className="rounded-lg ai-gradient ai-border border p-3">
            <div className="flex items-center gap-2 text-xs font-medium">
              <Sparkles className="size-3.5 text-[color:var(--ai)]" />
              AI Assistant
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
              Ask anything about your customers, campaigns, or workshop.
            </p>
          </div>
        </div>
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

          <div className="flex items-center gap-1">
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
                      RS
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden lg:block text-left leading-tight">
                    <div className="text-xs font-medium">Rajesh Saini</div>
                    <div className="text-[10px] text-muted-foreground">Service Manager</div>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Switch role (demo)</DropdownMenuLabel>
                <DropdownMenuItem>Super Admin</DropdownMenuItem>
                <DropdownMenuItem>Dealer Principal</DropdownMenuItem>
                <DropdownMenuItem>Service Manager ✓</DropdownMenuItem>
                <DropdownMenuItem>Service Advisor</DropdownMenuItem>
                <DropdownMenuItem>Call Center</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Profile</DropdownMenuItem>
                <DropdownMenuItem>Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 min-w-0">{children}</main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
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
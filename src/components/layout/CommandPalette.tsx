import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  CornerDownLeft,
  Loader2,
  Megaphone,
  PhoneCall,
  PhoneForwarded,
  Store,
  UploadCloud,
  UserPlus,
  UserRound,
  Users,
} from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { canAccessPath, hasPerm, type PermCode } from "@/lib/permissions";
import { server_get_data, get_global_search } from "@/components/ServiceConnection/serviceconnection";
import { NAV_ITEMS, SECONDARY_NAV_ITEMS, badgeLabel } from "./navItems";

/* ------------------------------------------------------------------
   Types -- mirror views_settings.global_search
------------------------------------------------------------------ */

type SearchResult = {
  customers: { id: number; name: string; phone: string; vehicle: string }[];
  campaigns: { id: number; name: string; status: string; segment: string }[];
  calls: { id: number; customer: string; started_at: string | null; status: string; outcome: string; campaign: string }[];
  branches: { id: number; name: string; city: string }[];
};

const EMPTY: SearchResult = { customers: [], campaigns: [], calls: [], branches: [] };
const MIN_QUERY = 2;
const DEBOUNCE_MS = 250;

type QuickAction = {
  id: string;
  label: string;
  hint: string;
  to: string;
  icon: typeof UploadCloud;
  perms: PermCode[];
};

// Only actions that land on a real, working screen.
const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "call",
    label: "Add / call a customer",
    hint: "Place an Aarohi call now",
    to: "/voice",
    icon: PhoneCall,
    perms: ["calls.place"],
  },
  {
    id: "callbacks",
    label: "Handle pending callbacks",
    hint: "Customers waiting for a call back",
    to: "/callbacks",
    icon: PhoneForwarded,
    perms: ["callbacks.manage"],
  },
  {
    id: "cre",
    label: "Upload CRE daily file",
    hint: "Showroom-visit reconciliation",
    to: "/visits?tab=imports",
    icon: Store,
    perms: ["imports.manage"],
  },
  {
    id: "crm",
    label: "Upload CRM call list",
    hint: "Monthly service / insurance / AMC list",
    to: "/imports",
    icon: UploadCloud,
    perms: ["imports.manage"],
  },
  {
    id: "user",
    label: "Add a team member",
    hint: "Users & roles",
    to: "/users",
    icon: UserPlus,
    perms: ["users.manage"],
  },
];

/* ------------------------------------------------------------------
   Small pieces
------------------------------------------------------------------ */

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0]).toUpperCase();
}

function fmtWhen(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function Row({
  icon,
  title,
  subtitle,
  right,
}: {
  icon: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex w-full items-center gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-md border bg-muted/50 text-muted-foreground group-data-[selected=true]:border-primary/30 group-data-[selected=true]:text-primary group-aria-selected:border-primary/30 group-aria-selected:text-primary">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{title}</div>
        {subtitle && <div className="truncate text-xs text-muted-foreground">{subtitle}</div>}
      </div>
      {right}
      <ArrowRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 group-data-[selected=true]:opacity-100 group-aria-selected:opacity-100" />
    </div>
  );
}

function Pill({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "live" }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
        tone === "live"
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          : "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

const itemClass = "group rounded-md px-2 py-2 cursor-pointer";

/* ------------------------------------------------------------------
   Palette
------------------------------------------------------------------ */

export function CommandPalette({
  open,
  onOpenChange,
  badges = {},
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  badges?: Record<string, number>;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult>(EMPTY);
  const [searching, setSearching] = useState(false);
  const latest = useRef("");

  // Fresh start every time it closes.
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults(EMPTY);
      setSearching(false);
    }
  }, [open]);

  // Debounced server search; stale responses are dropped.
  useEffect(() => {
    const q = query.trim();
    latest.current = q;
    if (q.length < MIN_QUERY) {
      setResults(EMPTY);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = window.setTimeout(() => {
      server_get_data(get_global_search, { q })
        .then((res) => {
          if (latest.current !== q) return;
          setResults({
            customers: res?.customers ?? [],
            campaigns: res?.campaigns ?? [],
            calls: res?.calls ?? [],
            branches: res?.branches ?? [],
          });
        })
        .catch(() => {
          if (latest.current === q) setResults(EMPTY);
        })
        .finally(() => {
          if (latest.current === q) setSearching(false);
        });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  const go = (to: string) => {
    onOpenChange(false);
    navigate(to);
  };

  // cmdk filters items by their `value` against the typed text. Server
  // results already match the query, so their value carries the query to
  // make sure cmdk never hides them.
  const q = query.trim();
  const resultValue = (kind: string, id: number, text: string) => `${q} ${kind} ${id} ${text}`;

  const pages = [...NAV_ITEMS, ...SECONDARY_NAV_ITEMS].filter((p) => canAccessPath(p.to));
  const actions = QUICK_ACTIONS.filter((a) => hasPerm(...a.perms) && canAccessPath(a.to.split("?")[0]));
  const hasResults =
    results.customers.length + results.campaigns.length + results.calls.length + results.branches.length > 0;
  const searchable = hasPerm("customers.view", "campaigns.edit", "dashboard.view", "calls.view");

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder={
          searchable ? "Search customers, phone, frame #, campaigns, calls… or jump to a page" : "Jump to a page…"
        }
      />

      <CommandList className="max-h-[420px]">
        <CommandEmpty>
          {searching ? (
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Searching…
            </span>
          ) : q.length >= MIN_QUERY ? (
            <span className="text-muted-foreground">Nothing found for “{q}”.</span>
          ) : (
            <span className="text-muted-foreground">No matching pages.</span>
          )}
        </CommandEmpty>

        {/* ---------- live search results ---------- */}
        {q.length >= MIN_QUERY && searching && hasResults && (
          <div className="flex items-center gap-2 px-3 pt-2 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> Updating…
          </div>
        )}

        {results.customers.length > 0 && (
          <CommandGroup heading="Customers">
            {results.customers.map((c) => (
              <CommandItem
                key={`cu-${c.id}`}
                value={resultValue("customer", c.id, `${c.name} ${c.phone}`)}
                onSelect={() => go(`/customers/${c.id}`)}
                className={itemClass}
              >
                <Row
                  icon={<span className="text-[11px] font-semibold">{initials(c.name)}</span>}
                  title={c.name}
                  subtitle={[c.phone, c.vehicle].filter(Boolean).join(" · ")}
                />
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results.campaigns.length > 0 && (
          <CommandGroup heading="Campaigns">
            {results.campaigns.map((c) => (
              <CommandItem
                key={`ca-${c.id}`}
                value={resultValue("campaign", c.id, c.name)}
                onSelect={() => go(`/campaigns/${c.id}`)}
                className={itemClass}
              >
                <Row
                  icon={<Megaphone className="size-4" />}
                  title={c.name}
                  subtitle={c.segment ? `Segment: ${c.segment}` : undefined}
                  right={<Pill tone={c.status === "live" ? "live" : "muted"}>{c.status}</Pill>}
                />
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results.calls.length > 0 && (
          <CommandGroup heading="Calls">
            {results.calls.map((c) => (
              <CommandItem
                key={`call-${c.id}`}
                value={resultValue("call", c.id, c.customer)}
                onSelect={() => go(`/voice/${c.id}`)}
                className={itemClass}
              >
                <Row
                  icon={<PhoneCall className="size-4" />}
                  title={c.customer}
                  subtitle={[fmtWhen(c.started_at), c.campaign].filter(Boolean).join(" · ")}
                  right={<Pill>{(c.outcome || c.status).replace(/_/g, " ")}</Pill>}
                />
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results.branches.length > 0 && (
          <CommandGroup heading="Branches">
            {results.branches.map((b) => (
              <CommandItem
                key={`br-${b.id}`}
                value={resultValue("branch", b.id, b.name)}
                onSelect={() => go(`/branches/${b.id}`)}
                className={itemClass}
              >
                <Row icon={<Building2 className="size-4" />} title={b.name} subtitle={b.city || undefined} />
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {hasResults && <CommandSeparator />}

        {/* ---------- quick actions ---------- */}
        {actions.length > 0 && (
          <CommandGroup heading="Quick actions">
            {actions.map((a) => {
              const badge = badgeLabel(badges, a.to.split("?")[0]);
              return (
                <CommandItem
                  key={a.id}
                  value={`${a.label} ${a.hint}`}
                  onSelect={() => go(a.to)}
                  className={itemClass}
                >
                  <Row
                    icon={<a.icon className="size-4" />}
                    title={a.label}
                    subtitle={a.hint}
                    right={badge ? <Pill>{badge}</Pill> : undefined}
                  />
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {actions.length > 0 && pages.length > 0 && <CommandSeparator />}

        {/* ---------- pages ---------- */}
        {pages.length > 0 && (
          <CommandGroup heading="Go to">
            {pages.map((p) => {
              const badge = badgeLabel(badges, p.to);
              return (
                <CommandItem
                  key={p.to}
                  value={`${p.label} ${p.keywords ?? ""} ${p.to}`}
                  onSelect={() => go(p.to)}
                  className={itemClass}
                >
                  <Row
                    icon={<p.icon className="size-4" />}
                    title={p.label}
                    right={
                      badge ? <Pill tone={badge.endsWith("live") ? "live" : "muted"}>{badge}</Pill> : undefined
                    }
                  />
                </CommandItem>
              );
            })}
            <CommandItem value="my profile password account" onSelect={() => go("/settings")} className={itemClass}>
              <Row icon={<UserRound className="size-4" />} title="My profile & password" />
            </CommandItem>
          </CommandGroup>
        )}
      </CommandList>

      {/* ---------- footer hints ---------- */}
      <div className="flex items-center justify-between gap-3 border-t px-3 py-2 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1 font-mono">↑</kbd>
            <kbd className="rounded border bg-muted px-1 font-mono">↓</kbd>
            move
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1 font-mono">
              <CornerDownLeft className="inline size-3" />
            </kbd>
            open
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1 font-mono">esc</kbd>
            close
          </span>
        </div>
        {searchable && (
          <span className="hidden sm:inline-flex items-center gap-1">
            <Users className="size-3" /> Type 2+ letters to search records
          </span>
        )}
      </div>
    </CommandDialog>
  );
}

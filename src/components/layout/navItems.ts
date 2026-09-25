// Single list of app pages -- used by the sidebar (AppShell) and the Ctrl+K
// palette (CommandPalette), so a page added here shows up in both.
// Visibility per role comes from canAccessPath() in lib/permissions.ts.
import {
  LayoutDashboard,
  Users,
  Layers,
  Megaphone,
  PhoneCall,
  PhoneForwarded,
  MessageSquare,
  MessageSquareText,
  CalendarDays,
  BarChart3,
  Bot,
  AudioLines,
  Target,
  BookOpen,
  Plug,
  Shield,
  Settings,
  Building2,
  UploadCloud,
  HeartPulse,
  Store,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  /** extra words the Ctrl+K palette matches on */
  keywords?: string;
};

export const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, keywords: "home overview" },
  { to: "/customers", label: "Customer 360", icon: Users, keywords: "customers vehicles" },
  { to: "/segments", label: "Segments", icon: Layers },
  { to: "/campaigns", label: "Campaigns", icon: Megaphone },
  { to: "/agents", label: "AI Agents", icon: Bot, keywords: "prompt persona voice" },
  { to: "/agents/recordings", label: "Call Recordings", icon: AudioLines, keywords: "audio transcript" },
  { to: "/intents", label: "Intents", icon: Target, keywords: "accuracy classifier" },
  { to: "/fillers", label: "Fillers", icon: MessageSquareText },
  { to: "/knowledge", label: "Knowledge Base", icon: BookOpen, keywords: "kb documents rag" },
  { to: "/voice", label: "AI Voice Calls", icon: PhoneCall, keywords: "live calls dial" },
  { to: "/whatsapp", label: "WhatsApp", icon: MessageSquare },
  { to: "/appointments", label: "Appointments", icon: CalendarDays, keywords: "bookings slots calendar" },
  { to: "/visits", label: "Showroom Visits", icon: Store, keywords: "cre visit reconciliation" },
  { to: "/callbacks", label: "Callbacks", icon: PhoneForwarded },
  { to: "/branches", label: "Branches", icon: Building2, keywords: "timing holidays" },
  { to: "/imports", label: "Data Import", icon: UploadCloud, keywords: "csv upload crm" },
  { to: "/analytics", label: "Reports & Analytics", icon: BarChart3, keywords: "reports" },
  { to: "/health", label: "System Health", icon: HeartPulse, keywords: "balance status" },
];

export const SECONDARY_NAV_ITEMS: NavItem[] = [
  { to: "/integrations", label: "Integrations", icon: Plug },
  { to: "/users", label: "Users", icon: Shield, keywords: "roles rights staff" },
  { to: "/settings", label: "Settings", icon: Settings, keywords: "profile password company" },
];

// Sidebar/palette badge text per route -- counts come from GET /api/nav-badges/.
// Routes not listed here show a plain number.
export const BADGE_SUFFIX: Record<string, string> = {
  "/campaigns": " live",
  "/voice": " live",
  "/imports": " ready",
  "/visits": " ready",
};

export function badgeLabel(badges: Record<string, number>, to: string): string | null {
  const n = badges[to];
  return n ? `${n}${BADGE_SUFFIX[to] ?? ""}` : null;
}

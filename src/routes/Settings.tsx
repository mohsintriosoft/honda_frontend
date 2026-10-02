import { useEffect, useMemo, useState, type JSX } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import {
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  Gauge,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Phone,
  PhoneCall,
  ShieldCheck,
  User,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  server_get_data,
  server_post_json,
  server_patch_data,
  get_branches,
  get_tts_voices,
  get_workspace_settings,
  patch_workspace_settings,
  patch_profile,
  post_change_password,
  patch_settings_voice,
  getStaffUser,
  setAuthSession,
} from "@/components/ServiceConnection/serviceconnection";
import { canAccessPath, hasPerm } from "@/lib/permissions";

/* ------------------------------------------------------------------
   Types -- mirror views_settings.py
------------------------------------------------------------------ */

type Choice = { value: string; label: string };

type Workspace = {
  company: {
    name: string;
    code: string;
    city: string;
    phone: string;
    email: string;
    main_branch_id: number | null;
  };
  limits: {
    max_concurrent_calls: number;
    daily_call_budget: number;
    min_days_between_calls: number;
    max_calls_per_customer_month: number;
    call_scheduler_hour: number;
    call_scheduler_minute: number;
  };
  ai: {
    llm_provider: string;
    stt_provider: string;
    tts_provider: string;
    rag_enabled: boolean;
    rag_distance_threshold: number;
  };
  choices: { llm_provider: Choice[]; stt_provider: Choice[]; tts_provider: Choice[] };
  branches: { id: number; name: string }[];
  updated_at: string | null;
};

type Voice = {
  id: number;
  voice_name: string;
  gender: string;
  provider_name: string;
  is_active: boolean;
};

function apiErrorMessage(err: any, fallback: string) {
  if (err?.response?.status === 403) return "You don't have permission to do this.";
  return err?.response?.data?.error || fallback;
}

const pad2 = (n: number) => String(n ?? 0).padStart(2, "0");

/* ------------------------------------------------------------------
   Shared building blocks
------------------------------------------------------------------ */

function Section({
  icon: Icon,
  title,
  description,
  children,
  footer,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center gap-3 space-y-0 border-b bg-muted/30 py-4">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <CardTitle className="font-display text-base">{title}</CardTitle>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
      </CardHeader>
      <CardContent className="p-5 md:p-6">{children}</CardContent>
      {footer}
    </Card>
  );
}

function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="text-xs font-medium">{label}</Label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Text input with a leading icon. */
function IconInput({
  icon: Icon,
  className = "",
  ...props
}: { icon: LucideIcon } & React.ComponentProps<typeof Input>) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input className={`pl-9 ${className}`} {...props} />
    </div>
  );
}

/** Number input with a unit shown inside the field. */
function NumberField({
  value,
  onChange,
  suffix,
}: {
  value: number;
  onChange: (n: number) => void;
  suffix: string;
}) {
  return (
    <div className="relative">
      <Input
        type="number"
        min={0}
        className="pr-20 tabular-nums"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
        {suffix}
      </span>
    </div>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </div>
  );
}

/** Footer bar for a form card: live status on the left, actions on the right. */
function SaveRow({
  onSave,
  onDiscard,
  saving,
  dirty,
  saved,
  error,
  label = "Save changes",
}: {
  onSave: () => void;
  onDiscard?: () => void;
  saving: boolean;
  dirty: boolean;
  saved: boolean;
  error: string | null;
  label?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/30 px-5 py-3 md:px-6">
      <div className="text-xs">
        {error ? (
          <span className="text-destructive">{error}</span>
        ) : dirty ? (
          <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
            <span className="size-1.5 rounded-full bg-current" /> Unsaved changes
          </span>
        ) : saved ? (
          <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-3.5" /> All changes saved
          </span>
        ) : (
          <span className="text-muted-foreground">No changes</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {onDiscard && dirty && !saving && (
          <Button variant="ghost" size="sm" onClick={onDiscard}>
            Discard
          </Button>
        )}
        <Button size="sm" onClick={onSave} disabled={!dirty || saving}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          {saving ? "Saving…" : label}
        </Button>
      </div>
    </div>
  );
}

/** Tracks a form copy of a server object + a PATCH that replaces it. */
function useSectionForm<T extends object>(initial: T) {
  const [form, setForm] = useState<T>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setForm(initial), [initial]);

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const set = <K extends keyof T>(key: K, value: T[K]) => {
    setSaved(false);
    setForm((f) => ({ ...f, [key]: value }));
  };
  const reset = () => {
    setForm(initial);
    setSaved(false);
    setError(null);
  };

  async function save(run: (form: T) => Promise<void>) {
    setSaving(true);
    setError(null);
    try {
      await run(form);
      setSaved(true);
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't save. Try again."));
    } finally {
      setSaving(false);
    }
  }

  return { form, set, reset, dirty, saving, saved, error, save };
}

/* ------------------------------------------------------------------
   Profile (everyone)
------------------------------------------------------------------ */

const STRENGTH_LABELS = ["Too short", "Weak", "Fair", "Good", "Strong"];
const STRENGTH_COLORS = [
  "bg-destructive",
  "bg-destructive",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-emerald-500",
];

function passwordStrength(pw: string): number {
  if (pw.length < 8) return 0;
  let score = 1;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}

// Order + styling for permission actions so the scary ones stand out.
const ACTION_RANK: Record<string, number> = { view: 0, place: 1, edit: 2, manage: 3 };
const ACTION_TONE: Record<string, string> = {
  view: "border-border bg-muted/50 text-muted-foreground",
  place: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  edit: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  manage: "border-primary/25 bg-primary/10 text-primary",
};
const actionTone = (a: string) => ACTION_TONE[a] ?? ACTION_TONE.view;
const actionRank = (a: string) => ACTION_RANK[a] ?? 99;

function ProfileTab() {
  const [user, setUser] = useState<any>(() => getStaffUser());
  const initial = useMemo(() => ({ name: user?.name ?? "", phone: user?.phone ?? "" }), [user]);
  const profile = useSectionForm(initial);

  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [showPw, setShowPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const saveProfile = () =>
    profile.save(async (form) => {
      const res = await server_patch_data(patch_profile, form);
      if (!res?.success) throw { response: { data: res } };
      const token = localStorage.getItem("access_token");
      if (token) setAuthSession(token, res.user);
      setUser(res.user);
    });

  async function changePassword() {
    setPwMsg(null);
    if (pw.next.length < 8) {
      setPwMsg({ ok: false, text: "New password must be at least 8 characters." });
      return;
    }
    if (pw.next !== pw.confirm) {
      setPwMsg({ ok: false, text: "New passwords don't match." });
      return;
    }
    setPwSaving(true);
    try {
      const res = await server_post_json(post_change_password, {
        current_password: pw.current,
        new_password: pw.next,
      });
      if (!res?.success) throw { response: { data: res } };
      setPw({ current: "", next: "", confirm: "" });
      setPwMsg({ ok: true, text: "Password changed." });
    } catch (err) {
      setPwMsg({ ok: false, text: apiErrorMessage(err, "Couldn't change the password.") });
    } finally {
      setPwSaving(false);
    }
  }

  const perms: string[] = user?.permissions ?? [];

  // "campaigns.edit" -> group "campaigns", action "edit"
  const permGroups = useMemo(() => {
    const groups = new Map<string, { action: string; full: string }[]>();
    perms.forEach((p) => {
      const [head, ...rest] = p.split(".");
      const key = rest.length ? head : "general";
      const action = rest.length ? rest.join(".") : p;
      groups.set(key, [...(groups.get(key) ?? []), { action, full: p }]);
    });
    return Array.from(groups.entries())
      .map(([g, items]) => [g, [...items].sort((a, b) => actionRank(a.action) - actionRank(b.action))] as const)
      .sort((a, b) => a[0].localeCompare(b[0]));
  }, [perms]);

  const strength = passwordStrength(pw.next);
  const mismatch = !!pw.confirm && pw.next !== pw.confirm;
  const matches = !!pw.confirm && pw.next === pw.confirm;
  const displayName = profile.form.name || user?.name || "Your name";

  return (
    <div className="space-y-4">
      {/* Identity header */}
      <Card className="overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-primary/25 via-primary/10 to-transparent" />
        <CardContent className="flex flex-wrap items-end gap-4 pb-5">
          <Avatar className="-mt-12 size-20 ring-4 ring-background">
            <AvatarFallback className="bg-primary/10 text-xl font-semibold text-primary">
              {initials(profile.form.name || user?.email || "") || "?"}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-[10rem] flex-1">
            <div className="truncate font-display text-lg font-semibold">{displayName}</div>
            <div className="truncate text-sm text-muted-foreground">{user?.email ?? "—"}</div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="capitalize tracking-wide">
              {user?.role_name || user?.role || "—"}
            </Badge>
            <Badge variant="outline">{user?.branch_id ? "Single branch" : "All branches"}</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Personal details */}
        <Section
          icon={User}
          title="Personal details"
          description="How you appear to your team."
          footer={
            <SaveRow
              onSave={saveProfile}
              onDiscard={profile.reset}
              saving={profile.saving}
              dirty={profile.dirty}
              saved={profile.saved}
              error={profile.error}
            />
          }
        >
          <div className="space-y-4">
            <Field label="Full name">
              <IconInput
                icon={UserRound}
                value={profile.form.name}
                onChange={(e) => profile.set("name", e.target.value)}
              />
            </Field>
            <Field label="Phone">
              <IconInput
                icon={Phone}
                value={profile.form.phone}
                onChange={(e) => profile.set("phone", e.target.value)}
              />
            </Field>
            <Field label="Email" hint="Your sign-in email can't be changed here.">
              <IconInput icon={Mail} value={user?.email ?? ""} disabled />
            </Field>
          </div>
        </Section>

        {/* Password */}
        <Section
          icon={KeyRound}
          title="Password"
          description="Use at least 8 characters. A longer mix is stronger."
          footer={
            <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/30 px-5 py-3 md:px-6">
              <div className="text-xs">
                {pwMsg ? (
                  <span className={pwMsg.ok ? "text-emerald-600" : "text-destructive"}>
                    {pwMsg.text}
                  </span>
                ) : (
                  <span className="text-muted-foreground">You'll stay signed in on this device.</span>
                )}
              </div>
              <Button
                size="sm"
                onClick={changePassword}
                disabled={pwSaving || !pw.current || !pw.next || !pw.confirm}
              >
                {pwSaving && <Loader2 className="size-4 animate-spin" />}
                {pwSaving ? "Changing…" : "Update password"}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <Field label="Current password">
              <Input
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
                value={pw.current}
                onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))}
              />
            </Field>

            <Field label="New password">
              <Input
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={pw.next}
                onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
              />
              {pw.next && (
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex flex-1 gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${i <= Math.max(strength, 1) ? STRENGTH_COLORS[strength] : "bg-muted"
                          }`}
                      />
                    ))}
                  </div>
                  <span className="w-16 text-right text-[11px] text-muted-foreground">
                    {STRENGTH_LABELS[strength]}
                  </span>
                </div>
              )}
            </Field>

            <Field label="Confirm new password">
              <Input
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                aria-invalid={mismatch}
                className={mismatch ? "border-destructive focus-visible:ring-destructive" : ""}
                value={pw.confirm}
                onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
              />
              {mismatch && <p className="mt-1.5 text-xs text-destructive">Passwords don't match yet.</p>}
              {matches && (
                <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-emerald-600">
                  <CheckCircle2 className="size-3.5" /> Passwords match
                </p>
              )}
            </Field>

            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              {showPw ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              {showPw ? "Hide passwords" : "Show passwords"}
            </button>
          </div>
        </Section>
      </div>

      {/* Access rights */}
      <Section
        icon={ShieldCheck}
        title="Your access"
        description={
          perms.length
            ? `${permGroups.length} areas · ${perms.length} permissions granted by your role.`
            : "What your role allows you to see and change."
        }
      >
        {perms.length === 0 ? (
          <span className="text-sm text-muted-foreground">No rights assigned to your role.</span>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
              {Object.keys(ACTION_TONE).map((a) => (
                <span key={a} className="inline-flex items-center gap-1.5">
                  <span className={`size-2 rounded-full border ${actionTone(a)}`} />
                  <span className="capitalize">{a}</span>
                </span>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {permGroups.map(([group, items]) => (
                <div
                  key={group}
                  className="flex flex-col gap-2.5 rounded-lg border bg-muted/20 p-3.5 transition-colors hover:bg-muted/40"
                >
                  <div className="truncate text-sm font-medium capitalize">
                    {group.replace(/_/g, " ")}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {items.map((it) => (
                      <span
                        key={it.full}
                        title={it.full}
                        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${actionTone(it.action)}`}
                      >
                        {it.action}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}

/* ------------------------------------------------------------------
   Company (settings.manage)
------------------------------------------------------------------ */

function CompanyTab({ ws, onSaved }: { ws: Workspace; onSaved: (w: Workspace) => void }) {
  const s = useSectionForm(ws.company);
  const NONE = "__none__";

  return (
    <Section
      icon={Building2}
      title="Company"
      description="Business details used across your workspace."
      footer={
        <SaveRow
          onSave={() =>
            s.save(async (form) => {
              const { code, ...company } = form;
              const res = await server_patch_data(patch_workspace_settings, { company });
              if (!res?.success) throw { response: { data: res } };
              onSaved(res);
            })
          }
          onDiscard={s.reset}
          saving={s.saving}
          dirty={s.dirty}
          saved={s.saved}
          error={s.error}
        />
      }
    >
      <div className="space-y-6">
        <div>
          <SubHeading>Identity</SubHeading>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Company name">
              <Input value={s.form.name} onChange={(e) => s.set("name", e.target.value)} />
            </Field>
            <Field label="Code" hint="Used in knowledge-base names, so it can't be changed here.">
              <IconInput icon={Lock} className="font-mono" value={s.form.code} disabled />
            </Field>
          </div>
        </div>

        <div className="border-t pt-6">
          <SubHeading>Contact</SubHeading>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="City">
              <Input value={s.form.city} onChange={(e) => s.set("city", e.target.value)} />
            </Field>
            <Field label="Phone">
              <IconInput
                icon={Phone}
                value={s.form.phone}
                onChange={(e) => s.set("phone", e.target.value)}
              />
            </Field>
            <Field label="Email" className="md:col-span-2">
              <IconInput
                icon={Mail}
                type="email"
                value={s.form.email}
                onChange={(e) => s.set("email", e.target.value)}
              />
            </Field>
          </div>
        </div>

        <div className="border-t pt-6">
          <SubHeading>Branches</SubHeading>
          <Field label="Main branch" className="md:max-w-sm">
            <Select
              value={s.form.main_branch_id != null ? String(s.form.main_branch_id) : NONE}
              onValueChange={(v) => s.set("main_branch_id", v === NONE ? null : Number(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a branch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No main branch</SelectItem>
                {ws.branches.map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------
   Calling limits + scheduler (settings.manage)
------------------------------------------------------------------ */

const LIMIT_GROUPS: {
  title: string;
  fields: {
    key: keyof LimitsForm;
    label: string;
    help: string;
    suffix: string;
  }[];
}[] = [
    {
      title: "Capacity & budget",
      fields: [
        {
          key: "max_concurrent_calls",
          label: "Max calls at the same time",
          help: "Your SIP trunk capacity. The dialer never places more than this at once.",
          suffix: "calls",
        },
        {
          key: "daily_call_budget",
          label: "Daily call budget",
          help: "Total calls per day across every campaign.",
          suffix: "calls / day",
        },
      ],
    },
    {
      title: "Customer contact rules",
      fields: [
        {
          key: "min_days_between_calls",
          label: "Days between calls to one customer",
          help: "A customer isn't called again by any campaign within this many days.",
          suffix: "days",
        },
        {
          key: "max_calls_per_customer_month",
          label: "Max calls per customer per month",
          help: "Applies however many vehicles or campaigns the customer has.",
          suffix: "calls / mo",
        },
      ],
    },
  ];

type LimitsForm = Omit<Workspace["limits"], "call_scheduler_hour" | "call_scheduler_minute">;
type SchedulerForm = Pick<Workspace["limits"], "call_scheduler_hour" | "call_scheduler_minute">;

function CallingTab({ ws, onSaved }: { ws: Workspace; onSaved: (w: Workspace) => void }) {
  // Each card tracks and saves only its own fields. `initial` must be a stable
  // reference (useMemo), otherwise useSectionForm would reset on every render.
  const limitsInitial = useMemo<LimitsForm>(
    () => ({
      max_concurrent_calls: ws.limits.max_concurrent_calls,
      daily_call_budget: ws.limits.daily_call_budget,
      min_days_between_calls: ws.limits.min_days_between_calls,
      max_calls_per_customer_month: ws.limits.max_calls_per_customer_month,
    }),
    [
      ws.limits.max_concurrent_calls,
      ws.limits.daily_call_budget,
      ws.limits.min_days_between_calls,
      ws.limits.max_calls_per_customer_month,
    ],
  );
  const schedulerInitial = useMemo<SchedulerForm>(
    () => ({
      call_scheduler_hour: ws.limits.call_scheduler_hour,
      call_scheduler_minute: ws.limits.call_scheduler_minute,
    }),
    [ws.limits.call_scheduler_hour, ws.limits.call_scheduler_minute],
  );

  const limits = useSectionForm(limitsInitial);
  const scheduler = useSectionForm(schedulerInitial);
  const time = `${pad2(scheduler.form.call_scheduler_hour)}:${pad2(scheduler.form.call_scheduler_minute)}`;

  // Merge onto the last-saved limits so the other card's unsaved edits are never sent.
  const patchLimits = async (part: Partial<Workspace["limits"]>) => {
    const res = await server_patch_data(patch_workspace_settings, {
      limits: { ...ws.limits, ...part },
    });
    if (!res?.success) throw { response: { data: res } };
    onSaved(res);
  };

  return (
    <div className="space-y-6">
      <Section
        icon={PhoneCall}
        title="Calling Settings"
        description="Guard rails for the dialer and the daily call queue."
        footer={
          <SaveRow
            onSave={() => limits.save((form) => patchLimits(form))}
            onDiscard={limits.reset}
            saving={limits.saving}
            dirty={limits.dirty}
            saved={limits.saved}
            error={limits.error}
          />
        }
      >
        <div className="space-y-6">
          {LIMIT_GROUPS.map((group, i) => (
            <div key={group.title} className={i > 0 ? "border-t pt-6" : ""}>
              <SubHeading>{group.title}</SubHeading>
              <div className="grid gap-4 md:grid-cols-2">
                {group.fields.map((f) => (
                  <Field key={f.key} label={f.label} hint={f.help}>
                    <NumberField
                      value={limits.form[f.key]}
                      onChange={(n) => limits.set(f.key, n)}
                      suffix={f.suffix}
                    />
                  </Field>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section
        icon={CalendarClock}
        title="Scheduler"
        description="When the daily call queue gets built."
        footer={
          <SaveRow
            onSave={() => scheduler.save((form) => patchLimits(form))}
            onDiscard={scheduler.reset}
            saving={scheduler.saving}
            dirty={scheduler.dirty}
            saved={scheduler.saved}
            error={scheduler.error}
          />
        }
      >
        <Field
          label="Daily call-list build time"
          hint="When the scheduler builds the day's call queue from imported lists."
          className="md:max-w-xs"
        >
          <IconInput
            icon={CalendarClock}
            type="time"
            value={time}
            onChange={(e) => {
              const [hh, mm] = e.target.value.split(":").map(Number);
              scheduler.set("call_scheduler_hour", hh || 0);
              scheduler.set("call_scheduler_minute", mm || 0);
            }}
          />
        </Field>
      </Section>
    </div>
  );
}

/* ------------------------------------------------------------------
   AI providers (settings.manage)
------------------------------------------------------------------ */

// function AiTab({ ws, onSaved }: { ws: Workspace; onSaved: (w: Workspace) => void }) {
//   const s = useSectionForm(ws.ai);

//   const providerSelect = (key: "llm_provider" | "stt_provider" | "tts_provider", label: string) => (
//     <div>
//       <Label>{label}</Label>
//       <Select value={s.form[key]} onValueChange={(v) => s.set(key, v)}>
//         <SelectTrigger className="mt-1">
//           <SelectValue placeholder="Select a provider" />
//         </SelectTrigger>
//         <SelectContent>
//           {ws.choices[key].map((c) => (
//             <SelectItem key={c.value} value={c.value}>
//               {c.label}
//             </SelectItem>
//           ))}
//         </SelectContent>
//       </Select>
//     </div>
//   );

//   return (
//     <Card>
//       <CardHeader>
//         <CardTitle className="font-display">AI providers</CardTitle>
//       </CardHeader>
//       <CardContent className="space-y-4 max-w-lg">
//         <p className="text-sm text-muted-foreground">
//           Applies to new calls within about 30 seconds. Calls already running keep their provider.
//         </p>
//         {providerSelect("llm_provider", "Conversation (LLM)")}
//         {providerSelect("stt_provider", "Speech-to-text (STT)")}
//         {providerSelect("tts_provider", "Text-to-speech (TTS)")}
//         <div className="flex items-center justify-between rounded-md border p-3">
//           <div>
//             <div className="text-sm font-medium">Use knowledge base</div>
//             <div className="text-xs text-muted-foreground">
//               Let the agent answer from your uploaded documents.
//             </div>
//           </div>
//           <Switch checked={s.form.rag_enabled} onCheckedChange={(v) => s.set("rag_enabled", v)} />
//         </div>
//         <div>
//           <Label>Knowledge match threshold</Label>
//           <Input
//             className="mt-1 w-32"
//             type="number"
//             step="0.05"
//             min={0.05}
//             max={2}
//             value={s.form.rag_distance_threshold}
//             disabled={!s.form.rag_enabled}
//             onChange={(e) => s.set("rag_distance_threshold", Number(e.target.value))}
//           />
//           <p className="text-xs text-muted-foreground mt-1">
//             Lower is stricter. Documents further than this aren't used in answers.
//           </p>
//         </div>
//         <SaveRow
//           onSave={() =>
//             s.save(async (form) => {
//               const res = await server_patch_data(patch_workspace_settings, { ai: form });
//               if (!res?.success) throw { response: { data: res } };
//               onSaved(res);
//             })
//           }
//           saving={s.saving}
//           dirty={s.dirty}
//           saved={s.saved}
//           error={s.error}
//         />
//       </CardContent>
//     </Card>
//   );
// }

/* ------------------------------------------------------------------
   Voices (agents.edit / settings.manage)
------------------------------------------------------------------ */

// function VoicesTab() {
//   const canToggle = hasPerm("settings.manage");
//   const [voices, setVoices] = useState<Voice[] | null>(null);
//   const [error, setError] = useState<string | null>(null);
//   const [busyId, setBusyId] = useState<number | null>(null);
//   const [form, setForm] = useState({ voice_name: "", gender: "female", provider_name: "Murf" });
//   const [adding, setAdding] = useState(false);

//   async function load() {
//     try {
//       const res = await server_get_data(get_tts_voices);
//       setVoices(res?.voices ?? []);
//       setError(null);
//     } catch (err) {
//       setError(apiErrorMessage(err, "Couldn't load voices."));
//     }
//   }

//   useEffect(() => {
//     load();
//   }, []);

//   async function toggle(v: Voice) {
//     setBusyId(v.id);
//     setError(null);
//     try {
//       const res = await server_patch_data(patch_settings_voice(v.id), { is_active: !v.is_active });
//       if (!res?.success) throw { response: { data: res } };
//       setVoices((list) => (list ?? []).map((x) => (x.id === v.id ? res.voice : x)));
//     } catch (err) {
//       setError(apiErrorMessage(err, "Couldn't update this voice."));
//     } finally {
//       setBusyId(null);
//     }
//   }

//   async function add() {
//     if (!form.voice_name.trim()) return;
//     setAdding(true);
//     setError(null);
//     try {
//       const res = await server_post_json(get_tts_voices, {
//         voice_name: form.voice_name.trim(),
//         gender: form.gender,
//         provider_name: form.provider_name.trim() || "Murf",
//       });
//       if (!res?.success) throw { response: { data: res } };
//       setForm((f) => ({ ...f, voice_name: "" }));
//       await load();
//     } catch (err) {
//       setError(apiErrorMessage(err, "Couldn't add this voice."));
//     } finally {
//       setAdding(false);
//     }
//   }

//   return (
//     <Card>
//       <CardHeader>
//         <CardTitle className="font-display">AI voices</CardTitle>
//       </CardHeader>
//       <CardContent className="space-y-4">
//         <p className="text-sm text-muted-foreground">
//           Voices your agents can speak with. Assign one per agent from AI Agents.
//         </p>

//         {error && <p className="text-sm text-destructive">{error}</p>}

//         {voices === null && !error ? (
//           <div className="flex items-center gap-2 text-sm text-muted-foreground">
//             <Loader2 className="size-4 animate-spin" /> Loading voices…
//           </div>
//         ) : (
//           <div className="divide-y rounded-md border">
//             {(voices ?? []).length === 0 && (
//               <div className="p-3 text-sm text-muted-foreground">No voices yet. Add one below.</div>
//             )}
//             {(voices ?? []).map((v) => (
//               <div key={v.id} className="flex items-center justify-between gap-3 p-3">
//                 <div className="min-w-0">
//                   <div className="text-sm font-medium">{v.voice_name}</div>
//                   <div className="text-xs text-muted-foreground capitalize">
//                     {v.gender} • {v.provider_name}
//                   </div>
//                 </div>
//                 {canToggle ? (
//                   <div className="flex items-center gap-2">
//                     <span className="text-xs text-muted-foreground">
//                       {v.is_active ? "Active" : "Off"}
//                     </span>
//                     <Switch
//                       checked={v.is_active}
//                       disabled={busyId === v.id}
//                       onCheckedChange={() => toggle(v)}
//                       aria-label={`Turn ${v.voice_name} ${v.is_active ? "off" : "on"}`}
//                     />
//                   </div>
//                 ) : (
//                   <Badge variant={v.is_active ? "outline" : "secondary"}>
//                     {v.is_active ? "Active" : "Off"}
//                   </Badge>
//                 )}
//               </div>
//             ))}
//           </div>
//         )}

//         <div className="rounded-md border p-3 space-y-3 max-w-lg">
//           <div className="text-sm font-medium">Add a voice</div>
//           <div className="grid sm:grid-cols-3 gap-2">
//             <Input
//               placeholder="Voice name, e.g. Sunaina"
//               value={form.voice_name}
//               onChange={(e) => setForm((f) => ({ ...f, voice_name: e.target.value }))}
//               className="sm:col-span-3"
//             />
//             <Select
//               value={form.gender}
//               onValueChange={(v) => setForm((f) => ({ ...f, gender: v }))}
//             >
//               <SelectTrigger>
//                 <SelectValue />
//               </SelectTrigger>
//               <SelectContent>
//                 <SelectItem value="female">Female</SelectItem>
//                 <SelectItem value="male">Male</SelectItem>
//                 <SelectItem value="neutral">Neutral</SelectItem>
//               </SelectContent>
//             </Select>
//             <Input
//               placeholder="Provider"
//               value={form.provider_name}
//               onChange={(e) => setForm((f) => ({ ...f, provider_name: e.target.value }))}
//               className="sm:col-span-2"
//             />
//           </div>
//           <Button size="sm" onClick={add} disabled={adding || !form.voice_name.trim()}>
//             {adding && <Loader2 className="size-4 animate-spin" />}
//             Add voice
//           </Button>
//         </div>
//       </CardContent>
//     </Card>
//   );
// }

/* ------------------------------------------------------------------
   Branches (shortcut into the Branches pages)
------------------------------------------------------------------ */

// function BranchesTab() {
//   const [branches, setBranches] = useState<any[] | null>(null);
//   const [error, setError] = useState<string | null>(null);

//   useEffect(() => {
//     server_get_data(get_branches)
//       .then((res) => setBranches(res?.branches ?? []))
//       .catch((err) => setError(apiErrorMessage(err, "Couldn't load branches.")));
//   }, []);

//   return (
//     <Card>
//       <CardHeader>
//         <CardTitle className="font-display">Branches</CardTitle>
//       </CardHeader>
//       <CardContent className="space-y-2">
//         <p className="text-sm text-muted-foreground">
//           Timings, weekly offs, holidays and slot capacity are set per branch.
//         </p>
//         {error && <p className="text-sm text-destructive">{error}</p>}
//         {branches === null && !error && (
//           <div className="flex items-center gap-2 text-sm text-muted-foreground">
//             <Loader2 className="size-4 animate-spin" /> Loading branches…
//           </div>
//         )}
//         {(branches ?? []).map((b) => (
//           <Link
//             key={b.id}
//             to={`/branches/${b.id}`}
//             className="flex items-center justify-between border rounded-md p-3 hover:bg-accent transition-colors"
//           >
//             <span className="text-sm font-medium">{b.name}</span>
//             <ChevronRight className="size-4 text-muted-foreground" />
//           </Link>
//         ))}
//         {branches?.length === 0 && (
//           <p className="text-sm text-muted-foreground">No branches yet.</p>
//         )}
//       </CardContent>
//     </Card>
//   );
// }

/* ------------------------------------------------------------------
   Page
------------------------------------------------------------------ */

function SettingsSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 border-b bg-muted/30 p-4">
        <div className="size-9 animate-pulse rounded-lg bg-muted" />
        <div className="space-y-2">
          <div className="h-3 w-32 animate-pulse rounded bg-muted" />
          <div className="h-2.5 w-48 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <CardContent className="grid gap-4 p-6 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-2.5 w-24 animate-pulse rounded bg-muted" />
            <div className="h-9 animate-pulse rounded-md bg-muted" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const canManage = hasPerm("settings.manage");
  const canVoices = hasPerm("agents.edit", "settings.manage");
  const canBranches = canAccessPath("/branches");

  const [ws, setWs] = useState<Workspace | null>(null);
  const [wsError, setWsError] = useState<string | null>(null);

  useEffect(() => {
    if (!canManage) return;
    server_get_data(get_workspace_settings)
      .then((res) => {
        if (!res?.success) throw { response: { data: res } };
        setWs(res);
      })
      .catch((err) => setWsError(apiErrorMessage(err, "Couldn't load workspace settings.")));
  }, [canManage]);

  const tabs: { value: string; label: string; hint: string; icon: LucideIcon; show: boolean }[] = [
    { value: "profile", label: "Profile", hint: "You & your password", icon: User, show: true },
    { value: "company", label: "Company", hint: "Business details", icon: Building2, show: canManage },
    { value: "calling", label: "Calling", hint: "Dialer & scheduler", icon: Gauge, show: canManage },
    // { value: "ai", label: "AI providers", show: canManage },
    // { value: "voices", label: "Voices", show: canVoices },
    // { value: "branches", label: "Branches", show: canBranches },
  ].filter((t) => t.show);

  const workspaceBody = (render: (w: Workspace) => JSX.Element) =>
    wsError ? (
      <Card>
        <CardContent className="pt-6 text-sm text-destructive">{wsError}</CardContent>
      </Card>
    ) : !ws ? (
      <SettingsSkeleton />
    ) : (
      render(ws)
    );

  return (
    <>
      <PageHeader
        title="Settings"
        description={
          canManage
            ? "Your profile, company details, calling settings, AI providers and voices."
            : "Your profile and password."
        }
      />

      <div className="p-4 md:p-6 lg:p-8">
        <Tabs defaultValue="profile" orientation="vertical">
          <div className="grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)]">
            <TabsList className="flex h-auto items-stretch gap-1 self-start overflow-x-auto bg-transparent p-0 lg:sticky lg:top-24 lg:flex-col lg:overflow-visible">
              {tabs.map((t) => (
                <TabsTrigger
                  key={t.value}
                  value={t.value}
                  className="group h-auto shrink-0 justify-start gap-3 whitespace-nowrap rounded-lg border border-transparent px-3 py-2.5 text-left data-[state=active]:border-primary/20 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none"
                >
                  <t.icon className="size-4 shrink-0" />
                  <span className="flex flex-col items-start">
                    <span className="text-sm font-medium leading-tight">{t.label}</span>
                    <span className="hidden text-[11px] font-normal leading-tight text-muted-foreground lg:block">
                      {t.hint}
                    </span>
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="max-w-4xl">
              <TabsContent value="profile" className="mt-0">
                <ProfileTab />
              </TabsContent>

              {canManage && (
                <>
                  <TabsContent value="company" className="mt-0">
                    {workspaceBody((w) => (
                      <CompanyTab ws={w} onSaved={setWs} />
                    ))}
                  </TabsContent>
                  <TabsContent value="calling" className="mt-0">
                    {workspaceBody((w) => (
                      <CallingTab ws={w} onSaved={setWs} />
                    ))}
                  </TabsContent>
                  {/* <TabsContent value="ai">
                    {workspaceBody((w) => (
                      <AiTab ws={w} onSaved={setWs} />
                    ))}
                  </TabsContent> */}
                </>
              )}

              {/* {canVoices && (
                <TabsContent value="voices">
                  <VoicesTab />
                </TabsContent>
              )}

              {canBranches && (
                <TabsContent value="branches">
                  <BranchesTab />
                </TabsContent>
              )} */}
            </div>
          </div>
        </Tabs>
      </div>
    </>
  );
}
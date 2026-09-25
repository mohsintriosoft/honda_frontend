import { useEffect, useMemo, useState } from "react";
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
import { CheckCircle2, ChevronRight, Loader2 } from "lucide-react";
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
   Shared save row
------------------------------------------------------------------ */

function SaveRow({
  onSave,
  saving,
  dirty,
  saved,
  error,
  label = "Save",
}: {
  onSave: () => void;
  saving: boolean;
  dirty: boolean;
  saved: boolean;
  error: string | null;
  label?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 pt-1">
      <Button onClick={onSave} disabled={!dirty || saving}>
        {saving && <Loader2 className="size-4 animate-spin" />}
        {saving ? "Saving…" : label}
      </Button>
      {saved && !dirty && (
        <span className="inline-flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-4" /> Saved
        </span>
      )}
      {error && <span className="text-sm text-destructive">{error}</span>}
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

  return { form, set, dirty, saving, saved, error, save };
}

/* ------------------------------------------------------------------
   Profile (everyone)
------------------------------------------------------------------ */

function ProfileTab() {
  const [user, setUser] = useState<any>(() => getStaffUser());
  const initial = useMemo(() => ({ name: user?.name ?? "", phone: user?.phone ?? "" }), [user]);
  const profile = useSectionForm(initial);

  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
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

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Your profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 max-w-lg">
          <div>
            <Label>Name</Label>
            <Input
              className="mt-1"
              value={profile.form.name}
              onChange={(e) => profile.set("name", e.target.value)}
            />
          </div>
          <div>
            <Label>Phone</Label>
            <Input
              className="mt-1"
              value={profile.form.phone}
              onChange={(e) => profile.set("phone", e.target.value)}
            />
          </div>
          <div>
            <Label>Email</Label>
            <Input className="mt-1" value={user?.email ?? ""} disabled />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Role</span>
            <Badge variant="secondary">{user?.role_name || user?.role || "—"}</Badge>
            <span className="text-muted-foreground">
              • {user?.branch_id ? "Single branch" : "All branches"}
            </span>
          </div>
          <SaveRow
            onSave={saveProfile}
            saving={profile.saving}
            dirty={profile.dirty}
            saved={profile.saved}
            error={profile.error}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display">Change password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 max-w-lg">
          <div>
            <Label>Current password</Label>
            <Input
              className="mt-1"
              type="password"
              autoComplete="current-password"
              value={pw.current}
              onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))}
            />
          </div>
          <div>
            <Label>New password</Label>
            <Input
              className="mt-1"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={pw.next}
              onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
            />
          </div>
          <div>
            <Label>Confirm new password</Label>
            <Input
              className="mt-1"
              type="password"
              autoComplete="new-password"
              value={pw.confirm}
              onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button
              onClick={changePassword}
              disabled={pwSaving || !pw.current || !pw.next || !pw.confirm}
            >
              {pwSaving && <Loader2 className="size-4 animate-spin" />}
              {pwSaving ? "Changing…" : "Change password"}
            </Button>
            {pwMsg && (
              <span className={pwMsg.ok ? "text-sm text-emerald-600" : "text-sm text-destructive"}>
                {pwMsg.text}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display">Your rights</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-1.5">
          {perms.length === 0 ? (
            <span className="text-sm text-muted-foreground">No rights assigned to your role.</span>
          ) : (
            perms.map((p) => (
              <Badge key={p} variant="outline" className="font-mono text-[11px]">
                {p}
              </Badge>
            ))
          )}
        </CardContent>
      </Card>
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
    <Card>
      <CardHeader>
        <CardTitle className="font-display">Company</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 max-w-lg">
        <div>
          <Label>Company name</Label>
          <Input
            className="mt-1"
            value={s.form.name}
            onChange={(e) => s.set("name", e.target.value)}
          />
        </div>
        <div>
          <Label>Code</Label>
          <Input className="mt-1 font-mono" value={s.form.code} disabled />
          <p className="text-xs text-muted-foreground mt-1">
            Used in knowledge-base names, so it can't be changed here.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>City</Label>
            <Input
              className="mt-1"
              value={s.form.city}
              onChange={(e) => s.set("city", e.target.value)}
            />
          </div>
          <div>
            <Label>Phone</Label>
            <Input
              className="mt-1"
              value={s.form.phone}
              onChange={(e) => s.set("phone", e.target.value)}
            />
          </div>
        </div>
        <div>
          <Label>Email</Label>
          <Input
            className="mt-1"
            type="email"
            value={s.form.email}
            onChange={(e) => s.set("email", e.target.value)}
          />
        </div>
        <div>
          <Label>Main branch</Label>
          <Select
            value={s.form.main_branch_id != null ? String(s.form.main_branch_id) : NONE}
            onValueChange={(v) => s.set("main_branch_id", v === NONE ? null : Number(v))}
          >
            <SelectTrigger className="mt-1">
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
        </div>
        <SaveRow
          onSave={() =>
            s.save(async (form) => {
              const { code, ...company } = form;
              const res = await server_patch_data(patch_workspace_settings, { company });
              if (!res?.success) throw { response: { data: res } };
              onSaved(res);
            })
          }
          saving={s.saving}
          dirty={s.dirty}
          saved={s.saved}
          error={s.error}
        />
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------
   Calling limits + scheduler (settings.manage)
------------------------------------------------------------------ */

const LIMIT_FIELDS: { key: keyof Workspace["limits"]; label: string; help: string }[] = [
  {
    key: "max_concurrent_calls",
    label: "Max calls at the same time",
    help: "Your SIP trunk capacity. The dialer never places more than this at once.",
  },
  {
    key: "daily_call_budget",
    label: "Daily call budget",
    help: "Total calls per day across every campaign.",
  },
  {
    key: "min_days_between_calls",
    label: "Days between calls to one customer",
    help: "A customer isn't called again by any campaign within this many days.",
  },
  {
    key: "max_calls_per_customer_month",
    label: "Max calls per customer per month",
    help: "Applies however many vehicles or campaigns the customer has.",
  },
];

function CallingTab({ ws, onSaved }: { ws: Workspace; onSaved: (w: Workspace) => void }) {
  const s = useSectionForm(ws.limits);
  const time = `${pad2(s.form.call_scheduler_hour)}:${pad2(s.form.call_scheduler_minute)}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display">Calling limits</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 max-w-lg">
        {LIMIT_FIELDS.map((f) => (
          <div key={f.key}>
            <Label>{f.label}</Label>
            <Input
              className="mt-1 w-40"
              type="number"
              min={0}
              value={s.form[f.key]}
              onChange={(e) => s.set(f.key, Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground mt-1">{f.help}</p>
          </div>
        ))}
        <div>
          <Label>Daily call-list build time</Label>
          <Input
            className="mt-1 w-32"
            type="time"
            value={time}
            onChange={(e) => {
              const [hh, mm] = e.target.value.split(":").map(Number);
              s.set("call_scheduler_hour", hh || 0);
              s.set("call_scheduler_minute", mm || 0);
            }}
          />
          <p className="text-xs text-muted-foreground mt-1">
            When the scheduler builds the day's call queue from imported lists.
          </p>
        </div>
        <SaveRow
          onSave={() =>
            s.save(async (form) => {
              const res = await server_patch_data(patch_workspace_settings, { limits: form });
              if (!res?.success) throw { response: { data: res } };
              onSaved(res);
            })
          }
          saving={s.saving}
          dirty={s.dirty}
          saved={s.saved}
          error={s.error}
        />
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------
   AI providers (settings.manage)
------------------------------------------------------------------ */

function AiTab({ ws, onSaved }: { ws: Workspace; onSaved: (w: Workspace) => void }) {
  const s = useSectionForm(ws.ai);

  const providerSelect = (key: "llm_provider" | "stt_provider" | "tts_provider", label: string) => (
    <div>
      <Label>{label}</Label>
      <Select value={s.form[key]} onValueChange={(v) => s.set(key, v)}>
        <SelectTrigger className="mt-1">
          <SelectValue placeholder="Select a provider" />
        </SelectTrigger>
        <SelectContent>
          {ws.choices[key].map((c) => (
            <SelectItem key={c.value} value={c.value}>
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display">AI providers</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 max-w-lg">
        <p className="text-sm text-muted-foreground">
          Applies to new calls within about 30 seconds. Calls already running keep their provider.
        </p>
        {providerSelect("llm_provider", "Conversation (LLM)")}
        {providerSelect("stt_provider", "Speech-to-text (STT)")}
        {providerSelect("tts_provider", "Text-to-speech (TTS)")}
        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <div className="text-sm font-medium">Use knowledge base</div>
            <div className="text-xs text-muted-foreground">
              Let the agent answer from your uploaded documents.
            </div>
          </div>
          <Switch checked={s.form.rag_enabled} onCheckedChange={(v) => s.set("rag_enabled", v)} />
        </div>
        <div>
          <Label>Knowledge match threshold</Label>
          <Input
            className="mt-1 w-32"
            type="number"
            step="0.05"
            min={0.05}
            max={2}
            value={s.form.rag_distance_threshold}
            disabled={!s.form.rag_enabled}
            onChange={(e) => s.set("rag_distance_threshold", Number(e.target.value))}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Lower is stricter. Documents further than this aren't used in answers.
          </p>
        </div>
        <SaveRow
          onSave={() =>
            s.save(async (form) => {
              const res = await server_patch_data(patch_workspace_settings, { ai: form });
              if (!res?.success) throw { response: { data: res } };
              onSaved(res);
            })
          }
          saving={s.saving}
          dirty={s.dirty}
          saved={s.saved}
          error={s.error}
        />
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------
   Voices (agents.edit / settings.manage)
------------------------------------------------------------------ */

function VoicesTab() {
  const canToggle = hasPerm("settings.manage");
  const [voices, setVoices] = useState<Voice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [form, setForm] = useState({ voice_name: "", gender: "female", provider_name: "Murf" });
  const [adding, setAdding] = useState(false);

  async function load() {
    try {
      const res = await server_get_data(get_tts_voices);
      setVoices(res?.voices ?? []);
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't load voices."));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggle(v: Voice) {
    setBusyId(v.id);
    setError(null);
    try {
      const res = await server_patch_data(patch_settings_voice(v.id), { is_active: !v.is_active });
      if (!res?.success) throw { response: { data: res } };
      setVoices((list) => (list ?? []).map((x) => (x.id === v.id ? res.voice : x)));
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't update this voice."));
    } finally {
      setBusyId(null);
    }
  }

  async function add() {
    if (!form.voice_name.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await server_post_json(get_tts_voices, {
        voice_name: form.voice_name.trim(),
        gender: form.gender,
        provider_name: form.provider_name.trim() || "Murf",
      });
      if (!res?.success) throw { response: { data: res } };
      setForm((f) => ({ ...f, voice_name: "" }));
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't add this voice."));
    } finally {
      setAdding(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display">AI voices</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Voices your agents can speak with. Assign one per agent from AI Agents.
        </p>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {voices === null && !error ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading voices…
          </div>
        ) : (
          <div className="divide-y rounded-md border">
            {(voices ?? []).length === 0 && (
              <div className="p-3 text-sm text-muted-foreground">No voices yet. Add one below.</div>
            )}
            {(voices ?? []).map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{v.voice_name}</div>
                  <div className="text-xs text-muted-foreground capitalize">
                    {v.gender} • {v.provider_name}
                  </div>
                </div>
                {canToggle ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {v.is_active ? "Active" : "Off"}
                    </span>
                    <Switch
                      checked={v.is_active}
                      disabled={busyId === v.id}
                      onCheckedChange={() => toggle(v)}
                      aria-label={`Turn ${v.voice_name} ${v.is_active ? "off" : "on"}`}
                    />
                  </div>
                ) : (
                  <Badge variant={v.is_active ? "outline" : "secondary"}>
                    {v.is_active ? "Active" : "Off"}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="rounded-md border p-3 space-y-3 max-w-lg">
          <div className="text-sm font-medium">Add a voice</div>
          <div className="grid sm:grid-cols-3 gap-2">
            <Input
              placeholder="Voice name, e.g. Sunaina"
              value={form.voice_name}
              onChange={(e) => setForm((f) => ({ ...f, voice_name: e.target.value }))}
              className="sm:col-span-3"
            />
            <Select
              value={form.gender}
              onValueChange={(v) => setForm((f) => ({ ...f, gender: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="neutral">Neutral</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Provider"
              value={form.provider_name}
              onChange={(e) => setForm((f) => ({ ...f, provider_name: e.target.value }))}
              className="sm:col-span-2"
            />
          </div>
          <Button size="sm" onClick={add} disabled={adding || !form.voice_name.trim()}>
            {adding && <Loader2 className="size-4 animate-spin" />}
            Add voice
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------
   Branches (shortcut into the Branches pages)
------------------------------------------------------------------ */

function BranchesTab() {
  const [branches, setBranches] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    server_get_data(get_branches)
      .then((res) => setBranches(res?.branches ?? []))
      .catch((err) => setError(apiErrorMessage(err, "Couldn't load branches.")));
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display">Branches</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Timings, weekly offs, holidays and slot capacity are set per branch.
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {branches === null && !error && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading branches…
          </div>
        )}
        {(branches ?? []).map((b) => (
          <Link
            key={b.id}
            to={`/branches/${b.id}`}
            className="flex items-center justify-between border rounded-md p-3 hover:bg-accent transition-colors"
          >
            <span className="text-sm font-medium">{b.name}</span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
        ))}
        {branches?.length === 0 && (
          <p className="text-sm text-muted-foreground">No branches yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------
   Page
------------------------------------------------------------------ */

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

  const tabs = [
    { value: "profile", label: "Profile", show: true },
    { value: "company", label: "Company", show: canManage },
    { value: "calling", label: "Calling limits", show: canManage },
    { value: "ai", label: "AI providers", show: canManage },
    { value: "voices", label: "Voices", show: canVoices },
    { value: "branches", label: "Branches", show: canBranches },
  ].filter((t) => t.show);

  const workspaceBody = (render: (w: Workspace) => JSX.Element) =>
    wsError ? (
      <Card>
        <CardContent className="pt-6 text-sm text-destructive">{wsError}</CardContent>
      </Card>
    ) : !ws ? (
      <Card>
        <CardContent className="pt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading settings…
        </CardContent>
      </Card>
    ) : (
      render(ws)
    );

  return (
    <>
      <PageHeader
        title="Settings"
        description={
          canManage
            ? "Your profile, company details, calling limits, AI providers and voices."
            : "Your profile and password."
        }
      />

      <div className="p-4 md:p-6 lg:p-8">
        <Tabs defaultValue="profile" orientation="vertical">
          <div className="grid lg:grid-cols-[200px_1fr] gap-6">
            <TabsList className="flex-col h-auto items-stretch bg-transparent p-0 gap-1">
              {tabs.map((t) => (
                <TabsTrigger
                  key={t.value}
                  value={t.value}
                  className="justify-start data-[state=active]:bg-accent"
                >
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <div>
              <TabsContent value="profile">
                <ProfileTab />
              </TabsContent>

              {canManage && (
                <>
                  <TabsContent value="company">
                    {workspaceBody((w) => (
                      <CompanyTab ws={w} onSaved={setWs} />
                    ))}
                  </TabsContent>
                  <TabsContent value="calling">
                    {workspaceBody((w) => (
                      <CallingTab ws={w} onSaved={setWs} />
                    ))}
                  </TabsContent>
                  <TabsContent value="ai">
                    {workspaceBody((w) => (
                      <AiTab ws={w} onSaved={setWs} />
                    ))}
                  </TabsContent>
                </>
              )}

              {canVoices && (
                <TabsContent value="voices">
                  <VoicesTab />
                </TabsContent>
              )}

              {canBranches && (
                <TabsContent value="branches">
                  <BranchesTab />
                </TabsContent>
              )}
            </div>
          </div>
        </Tabs>
      </div>
    </>
  );
}

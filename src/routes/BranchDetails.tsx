import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";

import { PageHeader } from "@/components/layout/AppShell";
import { Branch, BranchHoliday, DEFAULT_NEW_BRANCH, WEEKDAY_LABELS } from "@/mocks/branches";
import {
  server_get_data,
  server_patch_data,
  get_branch_detail,
  patch_branch,
} from "@/components/ServiceConnection/serviceconnection";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import { ArrowLeft, Save, Plus, Trash2, AlertCircle, Building2, Loader2 } from "lucide-react";

type DraftBranch = Omit<Branch, "id" | "createdAt" | "updatedAt" | "stats"> &
  Partial<Pick<Branch, "id" | "createdAt" | "updatedAt" | "stats">>;

// Client-side guard -- mirrors the backend checks so bad values never hit
// the server (a negative slot length would hang the slot-grid loop).
function validateBranch(b: DraftBranch): string | null {
  if (!b.name?.trim()) return "Name is required.";
  if (
    !Number.isFinite(b.slotDurationMinutes) ||
    b.slotDurationMinutes < 5 ||
    b.slotDurationMinutes > 240
  ) {
    return "Slot duration must be between 5 and 240 minutes.";
  }
  if (!Number.isFinite(b.maxPerSlot) || b.maxPerSlot < 1) {
    return "Max customers per slot must be at least 1.";
  }
  const schedule = b.weeklySchedule ?? [];
  if (!schedule.some((d) => d.isOpen)) {
    return "At least one day of the week must be open.";
  }
  for (const d of schedule) {
    if (!d.isOpen) continue;
    if (!d.openingTime || !d.closingTime || d.closingTime <= d.openingTime) {
      return "Closing time must be after opening time.";
    }
  }
  const holidays = b.holidays ?? [];
  if (holidays.some((h) => !h.date)) {
    return "Every holiday needs a date — fill it in or remove the empty row.";
  }
  const dates = holidays.map((h) => h.date);
  if (new Set(dates).size !== dates.length) {
    return "The same holiday date is listed twice.";
  }
  return null;
}

function saveErrorMessage(err: any): string {
  if (err?.response?.status === 403) return "You don't have permission to edit branches.";
  const msg = err?.response?.data?.error;
  return msg ? String(msg) : "Couldn't save this branch. Please try again.";
}

export default function BranchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;

  const [existing, setExisting] = useState<Branch | undefined>(undefined);
  const [loading, setLoading] = useState(!isNew);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (isNew || !id) return;

    let cancelled = false;
    setLoading(true);
    setNotFound(false);

    server_get_data(get_branch_detail(id))
      .then((res) => {
        if (cancelled) return;
        if (res?.branch) setExisting(res.branch);
        else setNotFound(true);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, isNew]);

  if (!isNew && loading) {
    return (
      <div className="p-4 md:p-6 lg:p-8">
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading branch…
        </div>
      </div>
    );
  }

  if (!isNew && (notFound || !existing)) {
    return (
      <div className="p-4 md:p-6 lg:p-8">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 rounded-full bg-destructive/10 p-3">
              <AlertCircle className="size-6 text-destructive" />
            </div>

            <h2 className="text-lg font-semibold">Branch not found</h2>

            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Unable to load this branch. Please check the branch and try again.
            </p>

            <Button asChild variant="outline" size="sm" className="mt-5">
              <Link to="/branches">
                <ArrowLeft className="size-4" />
                Back to Branches
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <BranchDetailContent
      key={existing?.id ?? "new"}
      draft={existing ?? (DEFAULT_NEW_BRANCH as DraftBranch)}
      isNew={isNew}
    />
  );
}

function BranchDetailContent({ draft, isNew }: { draft: DraftBranch; isNew: boolean }) {
  const [branch, setBranch] = useState<DraftBranch>(draft);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const set = <K extends keyof DraftBranch>(key: K, value: DraftBranch[K]) =>
    setBranch((b) => ({ ...b, [key]: value }));

  // Per-weekday schedule helpers -- mirrors the backend's BranchDayTiming
  const getDaySchedule = (day: number) =>
    (branch.weeklySchedule ?? []).find((d) => d.weekday === day) ?? {
      weekday: day,
      isOpen: false,
      openingTime: "09:00",
      closingTime: "18:00",
    };

  const setDaySchedule = (day: number, patch: Partial<{ isOpen: boolean; openingTime: string; closingTime: string }>) => {
    const current = branch.weeklySchedule ?? [];
    const existing = getDaySchedule(day);
    const updated = { ...existing, ...patch };
    const withoutDay = current.filter((d) => d.weekday !== day);
    set("weeklySchedule", [...withoutDay, updated].sort((a, b) => a.weekday - b.weekday));
  };

  const toggleDayOpen = (day: number) => {
    const current = getDaySchedule(day);
    setDaySchedule(day, {
      isOpen: !current.isOpen,
      openingTime: current.openingTime || "09:00",
      closingTime: current.closingTime || "18:00",
    });
  };

  const addHoliday = () => {
    const newHoliday: BranchHoliday = { id: Date.now(), date: "", reason: "" };
    set("holidays", [...(branch.holidays ?? []), newHoliday]);
  };

  const updateHoliday = (holidayId: number, patch: Partial<BranchHoliday>) => {
    set(
      "holidays",
      (branch.holidays ?? []).map((h) => (h.id === holidayId ? { ...h, ...patch } : h)),
    );
  };

  const removeHoliday = (holidayId: number) => {
    set(
      "holidays",
      (branch.holidays ?? []).filter((h) => h.id !== holidayId),
    );
  };

  const handleSave = async () => {
    if (isNew) {
      setSaveError(
        "Creating branches isn't wired up yet — the backend only exposes GET/PATCH on existing branches.",
      );
      return;
    }

    const validationError = validateBranch(branch);
    if (validationError) {
      setSaveError(validationError);
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      const res = await server_patch_data(patch_branch(branch.id as number), branch);
      if (res?.success === false) throw { response: { data: res } };
      if (res?.branch) setBranch(res.branch);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2500);
    } catch (err) {
      setSaveError(saveErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title={isNew ? "Add branch" : branch.name}
        description={
          isNew ? "Set up a new showroom/workshop location." : `${branch.code} • ${branch.city}`
        }
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/branches">
              <ArrowLeft className="size-4" />
              Back
            </Link>
          </Button>
        }
      />

      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline">
            <Building2 className="size-3 mr-1" />
            {isNew ? "Draft" : branch.isActive ? "Active" : "Inactive"}
          </Badge>

          {!isNew && <Badge variant="outline">{branch.code}</Badge>}

          {!isNew && <Badge variant="outline">{branch.city}</Badge>}
        </div>

        <Tabs defaultValue="details">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="timing">Timing</TabsTrigger>
            <TabsTrigger value="holidays">Holidays</TabsTrigger>
          </TabsList>

          {/* DETAILS */}
          <TabsContent value="details" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Branch details</CardTitle>
              </CardHeader>

              <CardContent className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g. Kolar Road"
                      value={branch.name}
                      onChange={(e) => set("name", e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="code">Code</Label>
                    <Input
                      id="code"
                      placeholder="e.g. KOLAR"
                      value={branch.code}
                      onChange={(e) => set("code", e.target.value.toUpperCase())}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      placeholder="e.g. Bhopal"
                      value={branch.city}
                      onChange={(e) => set("city", e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="address">Address</Label>
                    <Textarea
                      id="address"
                      rows={3}
                      placeholder="Full postal address"
                      value={branch.address}
                      onChange={(e) => set("address", e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Branch phone</Label>
                    <Input
                      id="phone"
                      placeholder="Landline / front desk"
                      value={branch.phone}
                      onChange={(e) => set("phone", e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="advisorPhone">Advisor phone</Label>
                    <Input
                      id="advisorPhone"
                      placeholder="Escalation calls transfer here"
                      value={branch.advisorPhone}
                      onChange={(e) => set("advisorPhone", e.target.value)}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
                    <div>
                      <div className="text-sm font-medium">Active</div>
                      <div className="text-xs text-muted-foreground">
                        Inactive branches stop taking new slot bookings.
                      </div>
                    </div>

                    <Switch
                      checked={branch.isActive}
                      onCheckedChange={(checked) => set("isActive", checked)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TIMING */}
          <TabsContent value="timing" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Weekly schedule</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Each day can have its own opening/closing time — flip a day off to skip bookings
                  for it entirely.
                </p>
              </CardHeader>

              <CardContent className="p-0">
                <div className="divide-y">
                  {WEEKDAY_LABELS.map((label, day) => {
                    const daySchedule = getDaySchedule(day);
                    const off = !daySchedule.isOpen;

                    return (
                      <div
                        key={label}
                        className="flex flex-wrap items-center gap-3 px-4 py-3 sm:gap-4"
                      >
                        <span className="w-10 shrink-0 text-sm font-medium text-primary">
                          {label}
                        </span>

                        {off ? (
                          <span className="w-32 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                            off
                          </span>
                        ) : (
                          <Input
                            type="time"
                            className="w-32"
                            value={daySchedule.openingTime ?? "09:00"}
                            onChange={(e) => setDaySchedule(day, { openingTime: e.target.value })}
                          />
                        )}

                        <span className="text-sm text-muted-foreground">to</span>

                        {off ? (
                          <span className="w-32 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                            off
                          </span>
                        ) : (
                          <Input
                            type="time"
                            className="w-32"
                            value={daySchedule.closingTime ?? "18:00"}
                            onChange={(e) => setDaySchedule(day, { closingTime: e.target.value })}
                          />
                        )}

                        <div className="flex-1" />

                        <Switch
                          checked={!off}
                          onCheckedChange={() => toggleDayOpen(day)}
                          aria-label={`${label} ${off ? "closed" : "open"}`}
                        />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Slot configuration</CardTitle>
              </CardHeader>

              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="slotDuration">Slot duration (minutes)</Label>
                  <Input
                    id="slotDuration"
                    type="number"
                    min={15}
                    step={15}
                    value={branch.slotDurationMinutes}
                    onChange={(e) => set("slotDurationMinutes", Number(e.target.value))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="maxPerSlot">Max customers per slot</Label>
                  <Input
                    id="maxPerSlot"
                    type="number"
                    min={1}
                    value={branch.maxPerSlot}
                    onChange={(e) => set("maxPerSlot", Number(e.target.value))}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* HOLIDAYS */}
          <TabsContent value="holidays" className="mt-4">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Holidays</CardTitle>

                <Button variant="outline" size="sm" onClick={addHoliday}>
                  <Plus className="size-4" />
                  Add holiday
                </Button>
              </CardHeader>

              <CardContent className="space-y-3">
                {(branch.holidays ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No one-off holidays configured for this branch yet.
                  </p>
                )}

                {(branch.holidays ?? []).map((h) => (
                  <div
                    key={h.id}
                    className="flex flex-wrap items-center gap-3 rounded-md border px-3 py-2.5"
                  >
                    <Input
                      type="date"
                      className="w-40"
                      value={h.date}
                      onChange={(e) => updateHoliday(h.id, { date: e.target.value })}
                    />

                    <Input
                      className="flex-1 min-w-40"
                      placeholder="Reason, e.g. Diwali"
                      value={h.reason}
                      onChange={(e) => updateHoliday(h.id, { reason: e.target.value })}
                    />

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeHoliday(h.id)}
                      aria-label="Remove holiday"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex items-center gap-3">
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {isNew ? "Create branch" : "Save changes"}
          </Button>

          {savedNotice && <span className="text-xs text-muted-foreground">Saved.</span>}

          {saveError && <span className="text-xs text-destructive">{saveError}</span>}
        </div>
      </div>
    </>
  );
}
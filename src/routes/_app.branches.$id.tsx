import { Link, useParams } from "react-router-dom";
import { useState } from "react";

import { PageHeader } from "@/components/layout/AppShell";
import { Branch, BranchHoliday, DEFAULT_NEW_BRANCH, WEEKDAY_LABELS, getBranch } from "@/mocks/branches";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import { ArrowLeft, Save, Plus, Trash2, AlertCircle, Building2 } from "lucide-react";

/* -------------------------------------------------------------------------- */
/* This screen is UI scaffolding only.                                        */
/*                                                                            */
/* It mirrors the Branch / BranchHoliday models from voice_bot/models.py so   */
/* the fields line up 1:1 once it's wired to the API — but for now every      */
/* edit only touches local state. Nothing here calls the backend yet.         */
/* -------------------------------------------------------------------------- */

type DraftBranch = Omit<Branch, "id" | "createdAt" | "updatedAt" | "stats"> &
    Partial<Pick<Branch, "id" | "createdAt" | "updatedAt" | "stats">>;

export default function BranchDetailPage() {
    const { id } = useParams<{ id: string }>();
    const isNew = !id;

    const existing = isNew ? undefined : getBranch(id);

    if (!isNew && !existing) {
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

    return <BranchDetailContent draft={existing ?? (DEFAULT_NEW_BRANCH as DraftBranch)} isNew={isNew} />;
}

function BranchDetailContent({ draft, isNew }: { draft: DraftBranch; isNew: boolean }) {
    const [branch, setBranch] = useState<DraftBranch>(draft);
    const [savedNotice, setSavedNotice] = useState(false);

    const set = <K extends keyof DraftBranch>(key: K, value: DraftBranch[K]) =>
        setBranch((b) => ({ ...b, [key]: value }));

    const toggleWeeklyOff = (day: number) => {
        const current = branch.weeklyOff ?? [];
        set(
            "weeklyOff",
            current.includes(day) ? current.filter((d) => d !== day) : [...current, day],
        );
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
        set("holidays", (branch.holidays ?? []).filter((h) => h.id !== holidayId));
    };

    const handleSave = () => {
        // Not connected to the backend yet — this just simulates a save so the
        // UI can be reviewed end-to-end. Swap for server_post_json / server_patch_data
        // against /branches/ once that endpoint accepts the full payload.
        setSavedNotice(true);
        setTimeout(() => setSavedNotice(false), 2500);
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
                {/* ---------------------------------------------------------------- */}
                {/* Meta                                                             */}
                {/* ---------------------------------------------------------------- */}

                <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="outline">
                        <Building2 className="size-3 mr-1" />
                        {isNew ? "Draft" : branch.isActive ? "Active" : "Inactive"}
                    </Badge>

                    {!isNew && <Badge variant="outline">{branch.code}</Badge>}

                    {!isNew && <Badge variant="outline">{branch.city}</Badge>}

                    <span className="text-muted-foreground">
                        Not yet connected to the backend — changes are local only.
                    </span>
                </div>

                {/* ---------------------------------------------------------------- */}
                {/* Tabs                                                             */}
                {/* ---------------------------------------------------------------- */}

                <Tabs defaultValue="details">
                    <TabsList className="flex-wrap h-auto">
                        <TabsTrigger value="details">Details</TabsTrigger>

                        <TabsTrigger value="timing">Timing</TabsTrigger>

                        <TabsTrigger value="holidays">Holidays</TabsTrigger>
                    </TabsList>

                    {/* ============================================================ */}
                    {/* DETAILS                                                       */}
                    {/* ============================================================ */}

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

                    {/* ============================================================ */}
                    {/* TIMING                                                        */}
                    {/* ============================================================ */}

                    <TabsContent value="timing" className="mt-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Slot configuration</CardTitle>
                            </CardHeader>

                            <CardContent className="grid gap-6 lg:grid-cols-2">
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="openingTime">Opening time</Label>
                                            <Input
                                                id="openingTime"
                                                type="time"
                                                value={branch.openingTime}
                                                onChange={(e) => set("openingTime", e.target.value)}
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label htmlFor="closingTime">Closing time</Label>
                                            <Input
                                                id="closingTime"
                                                type="time"
                                                value={branch.closingTime}
                                                onChange={(e) => set("closingTime", e.target.value)}
                                            />
                                        </div>
                                    </div>

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
                                </div>

                                <div className="space-y-1.5">
                                    <Label>Weekly off</Label>
                                    <p className="text-xs text-muted-foreground mb-2">
                                        Days this branch doesn't take bookings.
                                    </p>

                                    <div className="flex flex-wrap gap-2">
                                        {WEEKDAY_LABELS.map((label, day) => {
                                            const off = (branch.weeklyOff ?? []).includes(day);

                                            return (
                                                <button
                                                    key={label}
                                                    type="button"
                                                    onClick={() => toggleWeeklyOff(day)}
                                                    className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${off
                                                            ? "bg-destructive/10 border-destructive/40 text-destructive"
                                                            : "bg-muted/40 hover:bg-muted"
                                                        }`}
                                                >
                                                    {label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ============================================================ */}
                    {/* HOLIDAYS                                                      */}
                    {/* ============================================================ */}

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
                    <Button size="sm" onClick={handleSave}>
                        <Save className="size-4" />
                        {isNew ? "Create branch" : "Save changes"}
                    </Button>

                    {savedNotice && (
                        <span className="text-xs text-muted-foreground">
                            Saved locally — not yet sent to the backend.
                        </span>
                    )}
                </div>
            </div>
        </>
    );
}
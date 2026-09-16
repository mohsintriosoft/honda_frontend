import { useEffect, useMemo, useState, Fragment } from "react";
import { PageHeader } from "@/components/layout/AppShell";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/data/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import {
  Plus,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Ban,
  X,
  Loader2,
  Globe,
} from "lucide-react";
import { MetricTile } from "@/components/data/KpiCard";
import {
  get_branches,
  get_branch_calendar,
  get_appointments,
  get_slot_blocks,
  post_manual_slot,
  post_slot_block,
  delete_slot_block,
  server_get_data,
  server_post_json,
  server_delete_data,
} from "@/components/ServiceConnection/serviceconnection.js";

/* =========================================================
   TYPES — shape matches views_admin.py's serializers
========================================================= */

type RangeKey = "day" | "week" | "15day" | "month";
// A specific branch id, or "all" for the global cross-branch view.
type BranchSelection = number | "all";

const RANGE_DAYS: Record<RangeKey, number> = { day: 1, week: 7, "15day": 15, month: 30 };
const RANGE_LABEL: Record<RangeKey, string> = { day: "Today", week: "Week", "15day": "15 Days", month: "Month" };
const GLOBAL_VALUE = "all";

interface BranchOption {
  id: number;
  name: string;
  // Only present when branches are fetched with detail=1 — used to build
  // a combined opening/closing axis for the global (all-branches) view.
  openingTime?: string;
  closingTime?: string;
  slotDurationMinutes?: number;
}

interface AppointmentRow {
  id: number;
  branchId: number;
  branchName: string | null;
  customerName: string;
  phoneNumber: string | null;
  vehicle: string | null;
  type: string;
  advisor: string | null;
  bay: string;
  slotDate: string;
  slotTime: string;
  source: string;
  status: string;
  isManualHold: boolean;
  notes: string;
  createdAt: string | null;
}

interface CalendarSlot {
  time: string;
  status: "open" | "full" | "blocked";
  booked: number;
  capacity: number;
  blockReason: string | null;
  appointments: AppointmentRow[];
}

interface CalendarDay {
  date: string;
  weekday: string;
  isWeeklyOff: boolean;
  isHoliday: boolean;
  slots: CalendarSlot[];
}

interface CalendarBranchInfo {
  id: number;
  name: string;
  openingTime: string;
  closingTime: string;
  slotDurationMinutes: number;
  maxPerSlot: number;
}

interface SlotBlock {
  id: number;
  branchId: number;
  date: string;
  startTime: string;
  endTime: string;
  reason: string;
  createdBy: string | null;
  createdAt: string | null;
}

/* =========================================================
   DATE / TIME HELPERS — plain local-date arithmetic, no library
========================================================= */

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addMinutesToTime(hhmm: string, minutes: number) {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(((total % 1440) + 1440) % 1440 / 60);
  const mm = ((total % 60) + 60) % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function timeToMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(total: number) {
  const hh = Math.floor(((total % 1440) + 1440) % 1440 / 60);
  const mm = ((total % 60) + 60) % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function displayDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

function displayTime(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

// A slot's capacity can be 5, 10, 20… far more than a grid cell can
// show without turning into a wall of text. Show a couple inline and
// push the rest behind a "…" popup (click anywhere on the cell).
const MAX_CHIPS_PER_CELL = 2;

// StatusBadge was built against the mock statuses (upcoming/completed/
// missed/cancelled/rescheduled) — the DB's "confirmed" means the same
// thing as "upcoming" here, everything else already lines up.
function toBadgeStatus(status: string) {
  return status === "confirmed" ? "upcoming" : status;
}

// Appointment chip styling for the calendar grid — colored by status so
// the board reads at a glance, same idea as any real calendar app.
function apptStatusClasses(a: AppointmentRow) {
  if (a.isManualHold) return "border-dashed border-muted-foreground/50 text-muted-foreground bg-muted/40";
  switch (a.status) {
    case "missed":
    case "cancelled":
      return "bg-destructive/10 border-destructive/30 text-destructive";
    case "completed":
      return "bg-emerald-500/10 border-emerald-600/30 text-emerald-800";
    case "rescheduled":
      return "bg-amber-500/10 border-amber-600/30 text-amber-800";
    default:
      return "bg-blue-500/10 border-blue-600/30 text-blue-900";
  }
}

function apptChipClass(a: AppointmentRow, textClass = "text-[11px]", paddingClass = "px-1.5 py-1") {
  return `rounded ${paddingClass} ${textClass} leading-tight border w-full text-left truncate ${apptStatusClasses(a)}`;
}

// Manual holds have no real customer attached — "Manual Slot - <Branch>"
// reads better in the grid/list than a bare dash. includeBranch=false
// when the branch is already shown in its own column alongside this.
function apptDisplayName(a: AppointmentRow, includeBranch = true) {
  if (a.isManualHold) {
    return includeBranch && a.branchName ? `Manual Slot - ${a.branchName}` : "Manual Slot";
  }
  return a.customerName;
}

// Every distinct slot time worth showing as a grid row: every slot the
// branch grid defines (so empty/open times show up too, not just
// booked ones), plus — belt and braces — any appointment time that
// happens to fall outside that set (global mode has no slot grid at
// all, so this is the only source of rows there).
// Fallback business-hours axis (9 AM – 7 PM, hourly) used only when
// there's no single branch's hours to go by (global, cross-branch view).
const DEFAULT_TIME_ROWS = Array.from({ length: 11 }, (_, i) => `${String(9 + i).padStart(2, "0")}:00`);

// Combined opening/closing window across every branch, in minutes since
// midnight — used to build the global (all-branches) time axis: starts
// at whichever branch opens earliest, ends just before whichever branch
// closes latest (so "closes at 6" means the last row shown is 5, not 6).
interface HoursRange {
  openMin: number;
  closeMin: number;
  step: number;
}

function buildTimeRows(
  days: CalendarDay[],
  appointments: AppointmentRow[],
  branchInfo: CalendarBranchInfo | null,
  isGlobal: boolean,
  globalHoursRange: HoursRange | null,
): string[] {
  const set = new Set<string>();

  if (!isGlobal && branchInfo?.openingTime && branchInfo?.closingTime) {
    // Left-hand axis follows the branch's own opening/closing time,
    // stepped by its slot duration, so the grid never shows hours the
    // branch isn't even open for.
    const openMin = timeToMinutes(branchInfo.openingTime);
    const closeMin = timeToMinutes(branchInfo.closingTime);
    const step = branchInfo.slotDurationMinutes && branchInfo.slotDurationMinutes > 0
      ? branchInfo.slotDurationMinutes
      : 60;
    for (let t = openMin; t < closeMin; t += step) {
      set.add(minutesToTime(t));
    }
  } else if (isGlobal && globalHoursRange) {
    // Global axis spans every branch's hours: earliest opening to latest
    // closing, so no branch's slots are ever cut off from the grid.
    for (let t = globalHoursRange.openMin; t < globalHoursRange.closeMin; t += globalHoursRange.step) {
      set.add(minutesToTime(t));
    }
  } else {
    DEFAULT_TIME_ROWS.forEach((t) => set.add(t));
  }

  days.forEach((d) => d.slots.forEach((s) => set.add(s.time)));
  const dateSet = new Set(days.map((d) => d.date));
  appointments.forEach((a) => {
    if (dateSet.has(a.slotDate)) set.add(a.slotTime);
  });
  return Array.from(set).sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
}

/* =========================================================
   PAGE
========================================================= */

export default function AppointmentsPage() {
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [branchId, setBranchId] = useState<BranchSelection | null>(null);
  const isGlobal = branchId === GLOBAL_VALUE;

  const [rangeKey, setRangeKey] = useState<RangeKey>("day");
  const [start, setStart] = useState(todayIso());

  const [branchInfo, setBranchInfo] = useState<CalendarBranchInfo | null>(null);
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayIso());

  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  // Blocks for every visible day, keyed by date — branch mode only
  // (a block belongs to one branch, so this is empty in global mode).
  const [blocksByDate, setBlocksByDate] = useState<Record<string, SlotBlock[]>>({});

  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [manualSlotOpen, setManualSlotOpen] = useState(false);
  const [manualSlotBranchId, setManualSlotBranchId] = useState<number | null>(null);
  const [manualSlotDate, setManualSlotDate] = useState(todayIso());
  const [manualSlotTime, setManualSlotTime] = useState("");
  const [manualSlotSaving, setManualSlotSaving] = useState(false);

  const [blockOpen, setBlockOpen] = useState(false);
  const [blockBranchId, setBlockBranchId] = useState<number | null>(null);
  const [blockDate, setBlockDate] = useState(todayIso());
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [blockSaving, setBlockSaving] = useState(false);

  // A slot can hold more customers than comfortably fit in one grid
  // cell (capacity 5, 10, 20…) — the cell itself only teases a few,
  // this dialog shows the full list on click.
  const [slotDetail, setSlotDetail] = useState<{ date: string; time: string; appts: AppointmentRow[] } | null>(null);

  const end = useMemo(() => addDays(start, RANGE_DAYS[rangeKey] - 1), [start, rangeKey]);

  /* ---------- load branches once ---------- */
  useEffect(() => {
    server_get_data(get_branches, { dealer_id: 1, detail: 1 })
      .then((res) => {
        const list: BranchOption[] = res?.branches ?? [];
        setBranches(list);
        if (list.length > 0) setBranchId((cur) => cur ?? list[0].id);
      })
      .catch(() => setError("Couldn't load branches."));
  }, []);

  async function loadBlocksForDays(bId: number, daysList: CalendarDay[]) {
    const entries = await Promise.all(
      daysList.map(async (d) => {
        try {
          const res = await server_get_data(get_slot_blocks(bId, d.date));
          return [d.date, res?.blocks ?? []] as const;
        } catch {
          return [d.date, []] as const;
        }
      }),
    );
    const map: Record<string, SlotBlock[]> = {};
    entries.forEach(([date, blocks]) => {
      map[date] = blocks;
    });
    return map;
  }

  /* ---------- load calendar + appointment list for the window ---------- */
  useEffect(() => {
    if (branchId === null) return;
    let cancelled = false;
    setLoadingCalendar(true);
    setError(null);

    if (isGlobal) {
      // Global view: no single branch's hours/capacity apply, so there's
      // no slot grid — just the raw appointments across every branch,
      // laid over a plain date skeleton for the window.
      server_get_data(get_appointments, { start, end })
        .then((res) => {
          if (cancelled) return;
          const list: AppointmentRow[] = res?.appointments ?? [];
          setAppointments(list);
          setBranchInfo(null);
          setBlocksByDate({});
          const skeleton: CalendarDay[] = [];
          let cur = start;
          while (cur <= end) {
            skeleton.push({
              date: cur,
              weekday: new Date(`${cur}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" }),
              isWeeklyOff: false,
              isHoliday: false,
              slots: [],
            });
            cur = addDays(cur, 1);
          }
          setDays(skeleton);
          const dates = skeleton.map((d) => d.date);
          if (!dates.includes(selectedDate)) {
            setSelectedDate(dates.includes(todayIso()) ? todayIso() : dates[0] ?? start);
          }
        })
        .catch(() => {
          if (!cancelled) setError("Couldn't load appointments. Try again.");
        })
        .finally(() => {
          if (!cancelled) setLoadingCalendar(false);
        });
    } else {
      Promise.all([
        server_get_data(get_branch_calendar(branchId, start, rangeKey)),
        server_get_data(get_appointments, { branch_id: branchId, start, end }),
      ])
        .then(async ([calRes, listRes]) => {
          if (cancelled) return;
          const newDays: CalendarDay[] = calRes?.days ?? [];
          setBranchInfo(calRes?.branch ?? null);
          setDays(newDays);
          setAppointments(listRes?.appointments ?? []);
          const dates = newDays.map((d) => d.date);
          if (!dates.includes(selectedDate)) {
            setSelectedDate(dates.includes(todayIso()) ? todayIso() : dates[0] ?? start);
          }
          const blocks = await loadBlocksForDays(branchId, newDays);
          if (!cancelled) setBlocksByDate(blocks);
        })
        .catch(() => {
          if (!cancelled) setError("Couldn't load the calendar. Try again.");
        })
        .finally(() => {
          if (!cancelled) setLoadingCalendar(false);
        });
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, start, rangeKey, isGlobal]);

  // Combined hours window across every branch (earliest open → latest
  // close), used only for the global time axis. Branches without hours
  // data (list fetched without detail=1, or a branch missing hours) are
  // skipped rather than collapsing the whole range to 00:00–00:00.
  const globalHoursRange = useMemo<HoursRange | null>(() => {
    const withHours = branches.filter(
      (b): b is BranchOption & { openingTime: string; closingTime: string } =>
        !!b.openingTime && !!b.closingTime,
    );
    if (withHours.length === 0) return null;
    const openMin = Math.min(...withHours.map((b) => timeToMinutes(b.openingTime)));
    const closeMin = Math.max(...withHours.map((b) => timeToMinutes(b.closingTime)));
    if (closeMin <= openMin) return null;
    const step = Math.min(...withHours.map((b) => (b.slotDurationMinutes && b.slotDurationMinutes > 0 ? b.slotDurationMinutes : 60)));
    return { openMin, closeMin, step };
  }, [branches]);

  const timeRows = useMemo(
    () => buildTimeRows(days, appointments, branchInfo, isGlobal, globalHoursRange),
    [days, appointments, branchInfo, isGlobal, globalHoursRange],
  );
  const upcoming = appointments.filter((a) => a.status === "confirmed").length;
  const completed = appointments.filter((a) => a.status === "completed").length;
  const missed = appointments.filter((a) => a.status === "missed").length;
  const cancelled = appointments.filter((a) => a.status === "cancelled").length;

  function refreshCalendar() {
    if (branchId === null) return;
    if (isGlobal) {
      server_get_data(get_appointments, { start, end }).then((res) =>
        setAppointments(res?.appointments ?? []),
      );
      return;
    }
    server_get_data(get_branch_calendar(branchId, start, rangeKey)).then(async (res) => {
      setBranchInfo(res?.branch ?? null);
      const newDays: CalendarDay[] = res?.days ?? [];
      setDays(newDays);
      setBlocksByDate(await loadBlocksForDays(branchId, newDays));
    });
    server_get_data(get_appointments, { branch_id: branchId, start, end }).then((res) =>
      setAppointments(res?.appointments ?? []),
    );
  }

  function openManualSlot(prefillDate?: string, prefillTime?: string, prefillBranchId?: number) {
    setManualSlotBranchId(
      prefillBranchId ?? (typeof branchId === "number" ? branchId : branches[0]?.id ?? null),
    );
    setManualSlotDate(prefillDate ?? selectedDate ?? todayIso());
    setManualSlotTime(prefillTime ?? "");
    setManualSlotOpen(true);
  }

  async function submitManualSlot() {
    if (!manualSlotBranchId || !manualSlotDate || !manualSlotTime) return;
    setManualSlotSaving(true);
    setError(null);
    try {
      const res = await server_post_json(post_manual_slot(manualSlotBranchId), {
        date: manualSlotDate,
        time: manualSlotTime,
      });
      if (!res?.success) {
        setError(res?.error === "slot_taken" ? "That slot is already full." : `Couldn't create the slot (${res?.error ?? "unknown error"}).`);
        return;
      }
      setManualSlotOpen(false);
      refreshCalendar();
    } catch {
      setError("Couldn't create the manual slot. Try again.");
    } finally {
      setManualSlotSaving(false);
    }
  }

  function openBlock(prefillDate?: string, prefillStart?: string, prefillEnd?: string, prefillBranchId?: number) {
    setBlockBranchId(
      prefillBranchId ?? (typeof branchId === "number" ? branchId : branches[0]?.id ?? null),
    );
    setBlockDate(prefillDate ?? selectedDate ?? todayIso());
    setBlockStart(prefillStart ?? "");
    setBlockEnd(prefillEnd ?? "");
    setBlockReason("");
    setBlockOpen(true);
  }

  async function submitBlock() {
    if (!blockBranchId || !blockDate || !blockStart || !blockEnd) return;
    setBlockSaving(true);
    setError(null);
    try {
      const res = await server_post_json(post_slot_block(blockBranchId), {
        date: blockDate,
        startTime: blockStart,
        endTime: blockEnd,
        reason: blockReason,
      });
      if (!res?.success) {
        setError(`Couldn't block that range (${res?.error ?? "unknown error"}).`);
        return;
      }
      setBlockOpen(false);
      refreshCalendar();
    } catch {
      setError("Couldn't block that range. Try again.");
    } finally {
      setBlockSaving(false);
    }
  }

  async function removeBlock(id: number) {
    try {
      await server_delete_data(delete_slot_block(id));
      refreshCalendar();
    } catch {
      setError("Couldn't remove that block. Try again.");
    }
  }

  const slotStep = branchInfo ? branchInfo.slotDurationMinutes * 60 : 1800;

  // As more days get crammed into the grid (15-day / month views), shrink
  // rows, columns, padding and chip text so the whole window fits with a lot
  // less scrolling than the day/week layout needs.
  const density: "normal" | "compact" | "ultra" =
    rangeKey === "month" ? "ultra" : rangeKey === "15day" ? "compact" : "normal";
  const cellMinHeightClass =
    density === "ultra" ? "min-h-[30px]" : density === "compact" ? "min-h-[42px]" : "min-h-[56px]";
  const cellPaddingClass = density === "ultra" ? "p-0.5" : "p-1";
  const colMinWidthPx = density === "ultra" ? 56 : density === "compact" ? 92 : 130;
  const timeColWidthPx = density === "ultra" ? 44 : 64;
  const chipTextClass = density === "ultra" ? "text-[9px]" : density === "compact" ? "text-[10px]" : "text-[11px]";
  const chipPaddingClass = density === "ultra" ? "px-1 py-0.5" : density === "compact" ? "px-1 py-0.5" : "px-1.5 py-1";
  const maxChipsPerCell = density === "normal" ? MAX_CHIPS_PER_CELL : 1;
  const headerPaddingClass = density === "ultra" ? "py-1" : density === "compact" ? "py-1.5" : "py-2";
  const headerDateClass = density === "ultra" ? "text-[11px] font-semibold" : "text-sm font-semibold";
  const headerWeekdayClass = density === "ultra" ? "text-[9px]" : "text-[11px]";
  const timeLabelClass = density === "ultra" ? "text-[9px]" : "text-[11px]";

  /* ---------- one cell of the week/15-day time-grid ---------- */
  function renderGridCell(day: CalendarDay, time: string) {
    const closedDay = !isGlobal && (day.isHoliday || day.isWeeklyOff);
    if (closedDay) {
      return <div key={time} className={`border-b border-r bg-muted/20 ${cellMinHeightClass}`} />;
    }

    const slot = !isGlobal ? day.slots.find((s) => s.time === time) : undefined;
    if (!isGlobal && !slot) {
      return <div key={time} className={`border-b border-r bg-muted/10 ${cellMinHeightClass}`} />;
    }

    const cellAppts: AppointmentRow[] = isGlobal
      ? appointments.filter((a) => a.slotDate === day.date && a.slotTime === time)
      : slot?.appointments ?? [];
    const status = slot?.status;
    const block = !isGlobal
      ? (blocksByDate[day.date] ?? []).find((b) => b.startTime <= time && time < b.endTime)
      : null;

    const bgClass =
      status === "blocked"
        ? "bg-amber-500/5"
        : status === "full"
          ? "bg-destructive/5"
          : "hover:bg-muted/40";

    const hasAppts = cellAppts.length > 0;

    return (
      <div
        key={time}
        role={hasAppts ? "button" : undefined}
        tabIndex={hasAppts ? 0 : undefined}
        onClick={hasAppts ? () => setSlotDetail({ date: day.date, time, appts: cellAppts }) : undefined}
        onKeyDown={
          hasAppts
            ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setSlotDetail({ date: day.date, time, appts: cellAppts });
              }
            }
            : undefined
        }
        aria-label={hasAppts ? `Show all ${cellAppts.length} appointments` : undefined}
        className={`group relative border-b border-r ${cellPaddingClass} ${cellMinHeightClass} ${bgClass} ${hasAppts ? "cursor-pointer" : ""}`}
      >
        {block && (
          <div className={`flex items-center justify-between gap-1 ${chipTextClass} text-amber-700 bg-amber-500/10 rounded px-1 py-0.5 ${density === "normal" ? "mb-1" : "mb-0.5"}`}>
            <span className="truncate">{block.reason || "Blocked"}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeBlock(block.id);
              }}
              aria-label="Remove block"
              className="shrink-0 hover:text-amber-900"
            >
              <X className="size-2.5" />
            </button>
          </div>
        )}

        <div className={density === "normal" ? "space-y-1" : "space-y-0.5"}>
          {cellAppts.slice(0, maxChipsPerCell).map((a) => (
            <div
              key={a.id}
              className={apptChipClass(a, chipTextClass, chipPaddingClass)}
              title={[
                apptDisplayName(a),
                a.isManualHold ? null : a.type,
                a.bay ? `Bay ${a.bay}` : null,
                isGlobal && !a.isManualHold ? a.branchName : null,
                a.notes || null,
              ].filter(Boolean).join(" · ")}
            >
              <span className="font-medium">{apptDisplayName(a)}</span>
              {density === "normal" && !a.isManualHold && <span className="opacity-70"> · {a.type}</span>}
              {density === "normal" && a.bay && <span className="opacity-60"> · Bay {a.bay}</span>}
              {density === "normal" && isGlobal && !a.isManualHold && a.branchName && <span className="opacity-60"> · {a.branchName}</span>}
            </div>
          ))}
          {cellAppts.length > maxChipsPerCell && (
            <div className={`w-full rounded ${chipPaddingClass} ${chipTextClass} leading-tight text-left text-muted-foreground bg-muted/50 truncate`}>
              +{cellAppts.length - maxChipsPerCell} more…
            </div>
          )}
        </div>

        {!isGlobal && status === "open" && (
          <div className="absolute inset-0 hidden group-hover:flex items-center justify-center gap-1 bg-background/90">
            <Button
              size="icon"
              variant="ghost"
              className={density === "normal" ? "size-6" : "size-5"}
              onClick={(e) => {
                e.stopPropagation();
                openManualSlot(day.date, time);
              }}
              aria-label="Add manual slot"
            >
              <Plus className={density === "normal" ? "size-3.5" : "size-3"} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className={density === "normal" ? "size-6" : "size-5"}
              onClick={(e) => {
                e.stopPropagation();
                openBlock(day.date, time, addMinutesToTime(time, branchInfo?.slotDurationMinutes ?? 60));
              }}
              aria-label="Block this time"
            >
              <Ban className={density === "normal" ? "size-3.5" : "size-3"} />
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Appointments"
        description="Workshop bookings — auto-created by AI calls and WhatsApp confirmations."
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => openBlock()} disabled={branchId === null}>
              <Ban className="size-4" />
              Block time
            </Button>
            <Button size="sm" onClick={() => openManualSlot()} disabled={branchId === null}>
              <Plus className="size-4" />
              Manual slot
            </Button>
          </div>
        }
      />

      <div className="p-4 md:p-6 lg:p-8 space-y-4">
        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Branch + range controls */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {rangeKey !== "day" && (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setStart((s) => addDays(s, -RANGE_DAYS[rangeKey]))}
                  aria-label="Previous"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setStart(todayIso())}>
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setStart((s) => addDays(s, RANGE_DAYS[rangeKey]))}
                  aria-label="Next"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </>
            )}
            <span className="text-sm text-muted-foreground ml-1">
              {rangeKey === "day" ? displayDate(start) : `${displayDate(start)} – ${displayDate(end)}`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Tabs value={rangeKey} onValueChange={(v) => setRangeKey(v as RangeKey)}>
              <TabsList>
                {(Object.keys(RANGE_DAYS) as RangeKey[]).map((key) => (
                  <TabsTrigger key={key} value={key}>
                    {RANGE_LABEL[key]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <Select
              value={branchId !== null ? String(branchId) : undefined}
              onValueChange={(v) => setBranchId(v === GLOBAL_VALUE ? GLOBAL_VALUE : Number(v))}
            >
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={GLOBAL_VALUE}>
                  <span className="flex items-center gap-1.5">
                    <Globe className="size-3.5" />
                    All branches (Global)
                  </span>
                </SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid gap-3 md:grid-cols-4">
          <MetricTile label="Upcoming" value={upcoming} tone="info" />
          <MetricTile label="Completed" value={completed} tone="success" />
          <MetricTile label="Missed" value={missed} tone="destructive" />
          <MetricTile label="Cancelled" value={cancelled} />
        </div>

        <Tabs defaultValue="calendar">
          <TabsList>
            <TabsTrigger value="calendar" className="gap-2">
              <CalendarDays className="size-4" />
              Calendar
            </TabsTrigger>
            <TabsTrigger value="list">List</TabsTrigger>
          </TabsList>

          {/* Calendar */}
          <TabsContent value="calendar" className="mt-4 space-y-4">
            <Card>
              <CardContent className="p-4">
                {loadingCalendar && days.length === 0 ? (
                  <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Loading calendar…
                  </div>
                ) : (
                  /* ---- Time-grid calendar — shared by day / week / 15-day / month ----
                     Rows = time-of-day (from the branch's own opening/closing
                     hours), columns = each day in the window — the same
                     layout any calendar app uses, so appointments, open
                     slots, blocked ranges, holidays, and weekly-offs are all
                     visible at once without clicking into a day. Always
                     renders (timeRows falls back to a default hourly axis
                     when there's no single branch's hours to go by) so the
                     calendar shape shows up even on a completely empty
                     window. */
                  <div className="max-h-[70vh] overflow-auto border rounded-md">
                    <div
                      className="grid"
                      style={{ gridTemplateColumns: `${timeColWidthPx}px repeat(${days.length}, minmax(${colMinWidthPx}px, 1fr))` }}
                    >
                      {/* corner */}
                      <div className="sticky top-0 left-0 z-30 bg-background border-b border-r" />
                      {days.map((day) => {
                        const isToday = day.date === todayIso();
                        const closed = !isGlobal && (day.isHoliday || day.isWeeklyOff);
                        const isSelected = isGlobal && day.date === selectedDate;
                        return (
                          <button
                            key={day.date}
                            type="button"
                            onClick={() => setSelectedDate(day.date)}
                            className={`sticky top-0 z-20 bg-background border-b border-r text-center ${headerPaddingClass} ${isToday ? "bg-primary/5" : ""
                              } ${closed ? "bg-muted/30" : ""} ${isSelected ? "ring-2 ring-inset ring-primary" : ""}`}
                          >
                            <div className={`${headerWeekdayClass} text-muted-foreground`}>{day.weekday}</div>
                            <div className={`${headerDateClass} ${isToday ? "text-primary" : ""}`}>
                              {displayDate(day.date)}
                            </div>
                            {closed && density === "normal" && (
                              <div className="text-[10px] font-medium text-amber-700">
                                {day.isHoliday ? "Holiday" : "Off"}
                              </div>
                            )}
                          </button>
                        );
                      })}

                      {timeRows.map((time) => (
                        <Fragment key={time}>
                          <div className={`sticky left-0 z-10 bg-background border-b border-r ${timeLabelClass} text-muted-foreground text-right pr-2 ${headerPaddingClass}`}>
                            {displayTime(time)}
                          </div>
                          {days.map((day) => renderGridCell(day, time))}
                        </Fragment>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Selected day detail — global mode only. The grid above has
               no single branch's slot data to lay out in global mode, so
               this is the only place a day's cross-branch appointments are
               listed as a flat list. Branch mode shows everything it needs
               directly in the time-grid above. */}
            {isGlobal && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold">
                      {selectedDate ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      }) : "—"}
                    </h3>
                  </div>

                  {appointments.filter((a) => a.slotDate === selectedDate).length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">
                      No appointments this day.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {appointments
                        .filter((a) => a.slotDate === selectedDate)
                        .sort((a, b) => timeToMinutes(a.slotTime) - timeToMinutes(b.slotTime))
                        .map((a) => (
                          <div
                            key={a.id}
                            className="flex items-center gap-3 rounded-md border px-3 py-2"
                          >
                            <span className="text-sm font-medium w-20 shrink-0">
                              {displayTime(a.slotTime)}
                            </span>
                            <span className="text-xs text-muted-foreground w-28 shrink-0 truncate">
                              {a.branchName ?? "—"}
                            </span>
                            <span className="flex-1 text-sm truncate">
                              {apptDisplayName(a, false)}
                              {!a.isManualHold ? ` · ${a.type}` : ""}
                              {a.bay ? ` • Bay ${a.bay}` : ""}
                            </span>
                            <StatusBadge status={toBadgeStatus(a.status) as any} />
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* List — already global-aware: it just renders whatever the
             branch selector loaded above, branch-specific or all-branch. */}
          <TabsContent value="list" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      {isGlobal && <TableHead>Branch</TableHead>}
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Advisor</TableHead>
                      <TableHead>Bay</TableHead>
                      <TableHead>When</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {appointments.map((appointment) => (
                      <TableRow key={appointment.id}>
                        <TableCell className="font-medium text-sm">
                          {apptDisplayName(appointment, false)}
                        </TableCell>
                        {isGlobal && (
                          <TableCell className="text-xs">{appointment.branchName ?? "—"}</TableCell>
                        )}
                        <TableCell className="text-xs">{appointment.vehicle ?? "—"}</TableCell>
                        <TableCell className="text-sm">{appointment.isManualHold ? "—" : appointment.type}</TableCell>
                        <TableCell className="text-sm">{appointment.advisor ?? "—"}</TableCell>
                        <TableCell className="text-xs">{appointment.bay || "—"}</TableCell>
                        <TableCell className="text-xs">
                          {formatDateTime(`${appointment.slotDate}T${appointment.slotTime}:00`)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {appointment.isManualHold ? "Manual" : appointment.source}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={toBadgeStatus(appointment.status) as any} />
                        </TableCell>
                      </TableRow>
                    ))}
                    {appointments.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={isGlobal ? 9 : 8} className="text-center text-sm text-muted-foreground py-8">
                          No appointments in this window.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Manual slot dialog */}
      <Dialog open={manualSlotOpen} onOpenChange={setManualSlotOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manual slot</DialogTitle>
            <DialogDescription>
              Holds a seat on the calendar — no customer details needed now, attach one later.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {isGlobal && (
              <div className="space-y-1.5">
                <Label htmlFor="manual-slot-branch">Branch</Label>
                <Select
                  value={manualSlotBranchId ? String(manualSlotBranchId) : undefined}
                  onValueChange={(v) => setManualSlotBranchId(Number(v))}
                >
                  <SelectTrigger id="manual-slot-branch">
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={String(b.id)}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="manual-slot-date">Date</Label>
                <Input
                  id="manual-slot-date"
                  type="date"
                  value={manualSlotDate}
                  onChange={(e) => setManualSlotDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="manual-slot-time">Time</Label>
                <Input
                  id="manual-slot-time"
                  type="time"
                  step={slotStep}
                  value={manualSlotTime}
                  onChange={(e) => setManualSlotTime(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setManualSlotOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submitManualSlot}
              disabled={manualSlotSaving || !manualSlotTime || !manualSlotBranchId}
            >
              {manualSlotSaving ? "Creating…" : "Create slot"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Block time dialog */}
      <Dialog open={blockOpen} onOpenChange={setBlockOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block a time range</DialogTitle>
            <DialogDescription>
              Nobody can book inside this window — existing bookings aren't affected.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {isGlobal && (
              <div className="space-y-1.5">
                <Label htmlFor="block-branch">Branch</Label>
                <Select
                  value={blockBranchId ? String(blockBranchId) : undefined}
                  onValueChange={(v) => setBlockBranchId(Number(v))}
                >
                  <SelectTrigger id="block-branch">
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={String(b.id)}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="block-date">Date</Label>
              <Input
                id="block-date"
                type="date"
                value={blockDate}
                onChange={(e) => setBlockDate(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="block-start">From</Label>
                <Input
                  id="block-start"
                  type="time"
                  step={slotStep}
                  value={blockStart}
                  onChange={(e) => setBlockStart(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="block-end">To</Label>
                <Input
                  id="block-end"
                  type="time"
                  step={slotStep}
                  value={blockEnd}
                  onChange={(e) => setBlockEnd(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="block-reason">Reason (optional)</Label>
              <Input
                id="block-reason"
                placeholder="Staff meeting, maintenance…"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitBlock} disabled={blockSaving || !blockStart || !blockEnd || !blockBranchId}>
              {blockSaving ? "Blocking…" : "Block range"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Slot detail — full customer list for one date+time cell, since
         a slot's booked count can run well past what a grid cell can
         show inline. */}
      <Dialog open={!!slotDetail} onOpenChange={(open) => !open && setSlotDetail(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {slotDetail ? `${displayDate(slotDetail.date)} · ${displayTime(slotDetail.time)}` : "Slot"}
            </DialogTitle>
            <DialogDescription>
              {slotDetail
                ? `${slotDetail.appts.length} customer${slotDetail.appts.length === 1 ? "" : "s"} in this slot.`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5 max-h-[60vh] overflow-auto">
            {slotDetail?.appts.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-md border px-3 py-2">
                <span className="flex-1 text-sm truncate">
                  {apptDisplayName(a, false)}
                  {!a.isManualHold ? ` · ${a.type}` : ""}
                  {a.bay ? ` • Bay ${a.bay}` : ""}
                  {isGlobal && a.branchName ? ` · ${a.branchName}` : ""}
                </span>
                <StatusBadge status={toBadgeStatus(a.status) as any} />
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSlotDetail(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
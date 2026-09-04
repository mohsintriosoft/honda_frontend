/**
 * mocks/branches.ts
 *
 * Demo data for the Branches feature. Shaped to mirror the backend
 * `Branch` / `BranchHoliday` models (see voice_bot/models.py) so this is a
 * straight swap-in once the real API is wired up:
 *
 *   Branch:        name, code, address, city, phone, advisor_phone,
 *                  opening_time, closing_time, slot_duration_minutes,
 *                  max_per_slot, weekly_off (0=Mon…6=Sun), is_active
 *   BranchHoliday:  holiday_date, reason
 *
 * NOT connected to the API yet — this file is the only source of truth
 * for the UI until GET /branches/ etc. return the full record instead of
 * just {id, name}.
 */

export interface BranchHoliday {
    id: number;
    date: string; // ISO yyyy-mm-dd — BranchHoliday.holiday_date
    reason: string; // BranchHoliday.reason
}

export interface Branch {
    id: number;
    dealerId: number;
    name: string; // Branch.name
    code: string; // Branch.code
    city: string; // Branch.city
    address: string; // Branch.address
    phone: string; // Branch.phone
    advisorPhone: string; // Branch.advisor_phone
    openingTime: string; // Branch.opening_time, "HH:MM"
    closingTime: string; // Branch.closing_time, "HH:MM"
    slotDurationMinutes: number; // Branch.slot_duration_minutes
    maxPerSlot: number; // Branch.max_per_slot
    weeklyOff: number[]; // Branch.weekly_off, 0=Mon…6=Sun
    isActive: boolean; // Branch.is_active
    createdAt: string;
    updatedAt: string;
    holidays: BranchHoliday[];
    // Demo-only figures for the list card — not real backend fields yet.
    stats: {
        staff: number;
        appointmentsThisMonth: number;
        utilization: number; // 0-100
    };
}

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function slotsPerDay(b: Pick<Branch, "openingTime" | "closingTime" | "slotDurationMinutes">) {
    const [oh, om] = b.openingTime.split(":").map(Number);
    const [ch, cm] = b.closingTime.split(":").map(Number);
    const minutes = ch * 60 + cm - (oh * 60 + om);
    if (minutes <= 0 || !b.slotDurationMinutes) return 0;
    return Math.floor(minutes / b.slotDurationMinutes);
}

export const branches: Branch[] = [
    {
        id: 1,
        dealerId: 1,
        name: "Awadhpuri",
        code: "AWDH",
        city: "Bhopal",
        address: "Plot 12, Awadhpuri Main Road, Bhopal, MP 462022",
        phone: "0755-4012345",
        advisorPhone: "9876500001",
        openingTime: "09:00",
        closingTime: "18:00",
        slotDurationMinutes: 60,
        maxPerSlot: 10,
        weeklyOff: [6], // Sunday
        isActive: true,
        createdAt: "2024-01-08T00:00:00Z",
        updatedAt: "2026-08-20T00:00:00Z",
        holidays: [
            { id: 1, date: "2026-10-20", reason: "Diwali" },
            { id: 2, date: "2026-11-08", reason: "Bhai Dooj" },
        ],
        stats: { staff: 14, appointmentsThisMonth: 342, utilization: 78 },
    },
    {
        id: 2,
        dealerId: 1,
        name: "Kolar",
        code: "KOLAR",
        city: "Bhopal",
        address: "Kolar Road, Near Danish Kunj, Bhopal, MP 462042",
        phone: "0755-4012346",
        advisorPhone: "9876500002",
        openingTime: "09:00",
        closingTime: "19:00",
        slotDurationMinutes: 60,
        maxPerSlot: 10,
        weeklyOff: [6],
        isActive: true,
        createdAt: "2024-03-15T00:00:00Z",
        updatedAt: "2026-08-18T00:00:00Z",
        holidays: [{ id: 3, date: "2026-10-20", reason: "Diwali" }],
        stats: { staff: 11, appointmentsThisMonth: 298, utilization: 65 },
    },
    {
        id: 3,
        dealerId: 1,
        name: "Ayodhya Bypass",
        code: "AYOB",
        city: "Bhopal",
        address: "Ayodhya Bypass Road, Bhopal, MP 462041",
        phone: "0755-4012347",
        advisorPhone: "9876500003",
        openingTime: "09:30",
        closingTime: "18:30",
        slotDurationMinutes: 30,
        maxPerSlot: 6,
        weeklyOff: [6],
        isActive: true,
        createdAt: "2024-06-01T00:00:00Z",
        updatedAt: "2026-07-30T00:00:00Z",
        holidays: [],
        stats: { staff: 8, appointmentsThisMonth: 176, utilization: 54 },
    },
    {
        id: 4,
        dealerId: 1,
        name: "Ashok Garden",
        code: "ASHG",
        city: "Bhopal",
        address: "Ashok Garden Main Market, Bhopal, MP 462023",
        phone: "0755-4012348",
        advisorPhone: "9876500004",
        openingTime: "09:00",
        closingTime: "18:00",
        slotDurationMinutes: 60,
        maxPerSlot: 8,
        weeklyOff: [6],
        isActive: false,
        createdAt: "2024-09-10T00:00:00Z",
        updatedAt: "2026-05-02T00:00:00Z",
        holidays: [{ id: 4, date: "2026-10-20", reason: "Diwali" }],
        stats: { staff: 5, appointmentsThisMonth: 0, utilization: 0 },
    },
];

export function getBranch(id: string | number | undefined): Branch | undefined {
    if (id === undefined) return undefined;
    return branches.find((b) => String(b.id) === String(id));
}

export const DEFAULT_NEW_BRANCH: Omit<Branch, "id" | "createdAt" | "updatedAt" | "stats"> = {
    dealerId: 1,
    name: "",
    code: "",
    city: "",
    address: "",
    phone: "",
    advisorPhone: "",
    openingTime: "09:00",
    closingTime: "18:00",
    slotDurationMinutes: 60,
    maxPerSlot: 10,
    weeklyOff: [6],
    isActive: true,
    holidays: [],
};
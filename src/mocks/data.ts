// Deterministic mock data for Triosoft AI Automotive Lifecycle Platform.
// Phase 1: in-memory only. Replace with server functions later without touching components.

export type LifecycleStage =
  | "enquiry"
  | "qualified"
  | "purchased"
  | "free_service"
  | "paid_service"
  | "insurance_due"
  | "amc_due"
  | "inactive"
  | "loyal";

export type SegmentSlug =
  | "inactive"
  | "missed-service"
  | "insurance-due"
  | "free-service"
  | "paid-service"
  | "amc-due"
  | "new-enquiries";

export type CampaignStatus = "draft" | "scheduled" | "live" | "paused" | "completed";
export type CallStatus = "ringing" | "connected" | "completed" | "failed" | "voicemail";
export type Disposition =
  | "interested"
  | "booked"
  | "callback"
  | "not_interested"
  | "wrong_number"
  | "escalated"
  | "no_answer";

export type AppointmentStatus =
  | "upcoming"
  | "completed"
  | "missed"
  | "cancelled"
  | "rescheduled";

export interface Vehicle {
  model: string;
  variant: string;
  regNo: string;
  purchasedOn: string;
  lastServiceOn: string | null;
  kms: number;
  fuel: "Petrol";
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  branch: string;
  lifecycleStage: LifecycleStage;
  segments: SegmentSlug[];
  vehicle: Vehicle;
  insurance: { provider: string; dueOn: string; status: "active" | "due" | "expired" };
  amc: { plan: string; dueOn: string; status: "active" | "due" | "expired" };
  lastInteractionAt: string;
  totalSpend: number;
  satisfaction: number; // 0-100
}

export interface Campaign {
  id: string;
  name: string;
  segment: SegmentSlug;
  status: CampaignStatus;
  channel: ("voice" | "whatsapp")[];
  voice: string;
  template: string;
  createdAt: string;
  scheduledFor: string;
  totals: {
    customers: number;
    completed: number;
    connected: number;
    interested: number;
    booked: number;
    callback: number;
    failed: number;
    escalated: number;
    revenue: number;
  };
}

export interface Call {
  id: string;
  campaignId: string;
  customerId: string;
  customerName: string;
  startedAt: string;
  durationSec: number;
  status: CallStatus;
  disposition: Disposition;
  intent: string;
  confidence: number;
  summary: string;
  recordingUrl: string;
}

export interface Appointment {
  id: string;
  customerId: string;
  customerName: string;
  vehicle: string;
  type: "Free Service" | "Paid Service" | "Insurance" | "AMC" | "Inspection";
  status: AppointmentStatus;
  advisor: string;
  bay: string;
  scheduledFor: string;
  source: "AI Call" | "WhatsApp" | "Walk-in";
}

export interface WAThread {
  id: string;
  customerId: string;
  customerName: string;
  lastMessage: string;
  lastAt: string;
  unread: number;
  status: "open" | "assigned" | "escalated" | "closed";
  channel: "campaign" | "inbound";
}

const BRANCHES = ["MP Nagar", "Kolar Road", "Ayodhya Bypass"];
const MODELS: [string, string][] = [
  ["Honda Activa 6G", "DLX"],
  ["Honda Activa 125", "Smart"],
  ["Honda Shine 125", "Drum"],
  ["Honda SP 125", "Disc BS6"],
  ["Honda Unicorn", "Standard"],
  ["Honda Dio", "DLX"],
  ["Honda Hornet 2.0", "STD"],
  ["Honda CB350", "DLX Pro"],
  ["Honda X-Blade", "DLX"],
  ["Honda Livo", "Disc"],
];
const NAMES = [
  "Rohit Sharma", "Priya Nair", "Aman Verma", "Sneha Iyer", "Vikram Singh",
  "Anjali Mehta", "Karan Kapoor", "Pooja Reddy", "Rahul Gupta", "Neha Joshi",
  "Arjun Malhotra", "Ishita Bose", "Sandeep Yadav", "Ritika Saxena", "Manish Tiwari",
  "Divya Pillai", "Suresh Patil", "Kavya Rao", "Nikhil Jain", "Meera Krishnan",
];

const rand = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
};
const r = rand(42);
const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)]!;
const daysFromNow = (d: number) =>
  new Date(Date.now() + d * 24 * 3600 * 1000).toISOString();

export const customers: Customer[] = NAMES.flatMap((name, i) => {
  const make = (suffix: number): Customer => {
    const [model, variant] = pick(MODELS);
    const insuranceDays = Math.floor(r() * 200) - 30;
    const amcDays = Math.floor(r() * 240) - 30;
    const lifecycleStages: LifecycleStage[] = [
      "enquiry", "qualified", "purchased", "free_service",
      "paid_service", "insurance_due", "amc_due", "inactive", "loyal",
    ];
    const segs: SegmentSlug[] = [];
    if (insuranceDays < 30 && insuranceDays > -30) segs.push("insurance-due");
    if (amcDays < 30 && amcDays > -30) segs.push("amc-due");
    if (r() > 0.7) segs.push("missed-service");
    if (r() > 0.85) segs.push("inactive");
    if (r() > 0.6) segs.push("free-service");
    if (r() > 0.7) segs.push("paid-service");
    if (r() > 0.92) segs.push("new-enquiries");
    return {
      id: `cust_${i}_${suffix}`,
      name,
      phone: `+91 9${Math.floor(100000000 + r() * 900000000)}`,
      email: `${name.toLowerCase().replace(/\s/g, ".")}@example.com`,
      city: "Bhopal",
      branch: pick(BRANCHES),
      lifecycleStage: pick(lifecycleStages),
      segments: segs.length ? segs : ["free-service"],
      vehicle: {
        model,
        variant,
        regNo: `MP04 ${String.fromCharCode(65 + Math.floor(r() * 26))}${String.fromCharCode(65 + Math.floor(r() * 26))} ${1000 + Math.floor(r() * 8999)}`,
        purchasedOn: daysFromNow(-Math.floor(r() * 1200)),
        lastServiceOn: r() > 0.1 ? daysFromNow(-Math.floor(r() * 200)) : null,
        kms: Math.floor(r() * 35000) + 1500,
        fuel: "Petrol",
      },
      insurance: {
        provider: pick(["ICICI Lombard", "Bajaj Allianz", "HDFC Ergo", "TATA AIG"]),
        dueOn: daysFromNow(insuranceDays),
        status: insuranceDays < 0 ? "expired" : insuranceDays < 30 ? "due" : "active",
      },
      amc: {
        plan: pick(["Gold", "Silver", "Platinum"]),
        dueOn: daysFromNow(amcDays),
        status: amcDays < 0 ? "expired" : amcDays < 30 ? "due" : "active",
      },
      lastInteractionAt: daysFromNow(-Math.floor(r() * 120)),
      totalSpend: Math.floor(r() * 350000) + 20000,
      satisfaction: Math.floor(r() * 30) + 70,
    };
  };
  return Array.from({ length: 6 }, (_, k) => make(k));
});

export const segments: {
  slug: SegmentSlug;
  label: string;
  description: string;
  customers: number;
  dueToday: number;
  activeCampaign: string | null;
  conversion: number;
}[] = [
  { slug: "inactive", label: "Inactive / Lost", description: "No interaction in 180+ days", customers: 2480, dueToday: 125, activeCampaign: "Win-back Nov", conversion: 18 },
  { slug: "missed-service", label: "Missed Service", description: "Skipped scheduled service", customers: 850, dueToday: 42, activeCampaign: "Missed Service Reach-out", conversion: 29 },
  { slug: "insurance-due", label: "Insurance Renewal", description: "Insurance expiring in 30 days", customers: 320, dueToday: 19, activeCampaign: "Renewal Drive", conversion: 22 },
  { slug: "free-service", label: "Free Service Due", description: "Eligible for free service", customers: 1120, dueToday: 58, activeCampaign: "Free Service Nudge", conversion: 61 },
  { slug: "paid-service", label: "Paid Service Due", description: "Service interval reached", customers: 760, dueToday: 30, activeCampaign: "Service Recall", conversion: 39 },
  { slug: "amc-due", label: "AMC Renewal", description: "AMC expiring in 30 days", customers: 205, dueToday: 14, activeCampaign: null, conversion: 44 },
  { slug: "new-enquiries", label: "New Enquiries", description: "Recent showroom enquiries", customers: 85, dueToday: 18, activeCampaign: "Enquiry Follow-up", conversion: 67 },
];

export const campaigns: Campaign[] = [
  {
    id: "cmp_001", name: "Free Service Nudge — Nov", segment: "free-service",
    status: "live", channel: ["voice", "whatsapp"],
    voice: "Aarohi (Hindi, Warm)", template: "free_service_reminder_v3",
    createdAt: daysFromNow(-3), scheduledFor: daysFromNow(0),
    totals: { customers: 412, completed: 318, connected: 264, interested: 142, booked: 88, callback: 26, failed: 28, escalated: 9, revenue: 462000 },
  },
  {
    id: "cmp_002", name: "Insurance Renewal Drive", segment: "insurance-due",
    status: "live", channel: ["voice", "whatsapp"],
    voice: "Kabir (English, Professional)", template: "insurance_renewal_v2",
    createdAt: daysFromNow(-5), scheduledFor: daysFromNow(-1),
    totals: { customers: 280, completed: 240, connected: 198, interested: 84, booked: 52, callback: 20, failed: 16, escalated: 6, revenue: 1240000 },
  },
  {
    id: "cmp_003", name: "AMC Renewal — Q4", segment: "amc-due",
    status: "scheduled", channel: ["voice"],
    voice: "Aarohi (Hindi, Warm)", template: "amc_renewal_v1",
    createdAt: daysFromNow(-1), scheduledFor: daysFromNow(2),
    totals: { customers: 184, completed: 0, connected: 0, interested: 0, booked: 0, callback: 0, failed: 0, escalated: 0, revenue: 0 },
  },
  {
    id: "cmp_004", name: "Win-back Inactive 180d+", segment: "inactive",
    status: "live", channel: ["voice", "whatsapp"],
    voice: "Zara (Hinglish, Friendly)", template: "winback_offer_v2",
    createdAt: daysFromNow(-7), scheduledFor: daysFromNow(-2),
    totals: { customers: 1280, completed: 940, connected: 612, interested: 188, booked: 102, callback: 64, failed: 102, escalated: 22, revenue: 318000 },
  },
  {
    id: "cmp_005", name: "Missed Service Reach-out", segment: "missed-service",
    status: "completed", channel: ["voice", "whatsapp"],
    voice: "Aarohi (Hindi, Warm)", template: "missed_service_v1",
    createdAt: daysFromNow(-14), scheduledFor: daysFromNow(-10),
    totals: { customers: 420, completed: 420, connected: 312, interested: 168, booked: 122, callback: 28, failed: 22, escalated: 14, revenue: 684000 },
  },
  {
    id: "cmp_006", name: "Enquiry Follow-up (24h)", segment: "new-enquiries",
    status: "live", channel: ["voice", "whatsapp"],
    voice: "Kabir (English, Professional)", template: "enquiry_followup_v1",
    createdAt: daysFromNow(-2), scheduledFor: daysFromNow(0),
    totals: { customers: 64, completed: 58, connected: 46, interested: 38, booked: 26, callback: 6, failed: 4, escalated: 2, revenue: 0 },
  },
];

const DISPOSITIONS: Disposition[] = ["interested", "booked", "callback", "not_interested", "wrong_number", "escalated", "no_answer"];
const INTENTS = ["Book Service", "Renew Insurance", "Reschedule", "Price Enquiry", "Not Interested", "Talk to Advisor", "Wrong Number"];

export const calls: Call[] = Array.from({ length: 36 }, (_, i) => {
  const c = customers[i % customers.length]!;
  const cmp = campaigns[i % campaigns.length]!;
  const status: CallStatus = i % 9 === 0 ? "ringing" : i % 7 === 0 ? "failed" : "completed";
  return {
    id: `call_${i}`,
    campaignId: cmp.id,
    customerId: c.id,
    customerName: c.name,
    startedAt: daysFromNow(-Math.floor(i / 6) - r()),
    durationSec: Math.floor(r() * 220) + 30,
    status,
    disposition: pick(DISPOSITIONS),
    intent: pick(INTENTS),
    confidence: Math.floor(r() * 25) + 72,
    summary:
      "Customer acknowledged service due. Mentioned preference for weekend slot. Asked about brake pad pricing — AI shared estimate. Open to booking; callback requested in 2 days.",
    recordingUrl: "#",
  };
});

export const appointments: Appointment[] = Array.from({ length: 24 }, (_, i) => {
  const c = customers[i % customers.length]!;
  const statuses: AppointmentStatus[] = ["upcoming", "upcoming", "upcoming", "completed", "missed", "rescheduled", "cancelled"];
  const types: Appointment["type"][] = ["Free Service", "Paid Service", "Insurance", "AMC", "Inspection"];
  return {
    id: `apt_${i}`,
    customerId: c.id,
    customerName: c.name,
    vehicle: `${c.vehicle.model} • ${c.vehicle.regNo}`,
    type: pick(types),
    status: pick(statuses),
    advisor: pick(["Anil Khanna", "Ravi Deshmukh", "Sunita Rao", "Mohit Bansal"]),
    bay: `Bay ${Math.floor(r() * 6) + 1}`,
    scheduledFor: daysFromNow(Math.floor(r() * 10) - 2),
    source: pick(["AI Call", "WhatsApp", "Walk-in"]),
  };
});

export const waThreads: WAThread[] = customers.slice(0, 18).map((c, i) => ({
  id: `wa_${i}`,
  customerId: c.id,
  customerName: c.name,
  lastMessage: pick([
    "Yes, please book for Saturday morning.",
    "What's the cost estimate?",
    "I'll renew insurance next week.",
    "Can you call back in the evening?",
    "Already serviced elsewhere, thanks.",
    "Sure, send me the link.",
  ]),
  lastAt: daysFromNow(-r() * 3),
  unread: i % 4 === 0 ? Math.floor(r() * 4) + 1 : 0,
  status: pick(["open", "assigned", "escalated", "closed"]),
  channel: i % 3 === 0 ? "inbound" : "campaign",
}));

// Dashboard widgets
export const dashboardKpis = {
  totalCustomers: customers.length * 420, // scale up to look real
  todaysCalls: 1284,
  connectedCalls: 962,
  appointmentsBooked: 184,
  serviceDueToday: 246,
  insuranceDue: 319,
  amcDue: 205,
  campaignSuccess: 38.4,
  workshopConversion: 64.2,
};

export const callTrend = Array.from({ length: 14 }, (_, i) => ({
  day: `D${i + 1}`,
  calls: 800 + Math.floor(Math.sin(i / 2) * 200) + Math.floor(Math.random() * 80),
  connected: 600 + Math.floor(Math.sin(i / 2) * 150) + Math.floor(Math.random() * 50),
  booked: 80 + Math.floor(Math.sin(i / 2) * 30) + Math.floor(Math.random() * 20),
}));

export const aiRecommendations = [
  { id: "rec1", title: "Launch AMC Renewal campaign now", body: "205 customers have AMC expiring in 30 days. Predicted conversion 44%. Estimated revenue ₹6.4L.", impact: "high" },
  { id: "rec2", title: "Re-engage 412 inactive Activa owners", body: "Activa owners inactive 180d+ historically respond best to Hindi voice + WhatsApp combo on Saturdays.", impact: "high" },
  { id: "rec3", title: "Reduce missed appointments", body: "Add T-3h WhatsApp reminder — historical missed rate drops from 18% to 9%.", impact: "med" },
];

export const recentNotifications = [
  { id: 1, title: "9 escalations from 'Win-back' need review", at: "5m ago", kind: "escalation" },
  { id: 2, title: "Campaign 'Free Service Nudge' crossed 80 bookings", at: "21m ago", kind: "milestone" },
  { id: 3, title: "WhatsApp template 'amc_renewal_v1' approved", at: "1h ago", kind: "system" },
];

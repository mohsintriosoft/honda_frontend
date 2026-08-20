// AI agent training + conversation configuration mock layer.
// Each "agent" is a calling workflow (Sales, Service, Insurance, AMC, Win-back)
// that can be fine-tuned from the admin dashboard.

export type AgentWorkflow =
  | "sales"
  | "service"
  | "insurance"
  | "amc"
  | "winback"
  | "feedback";

export type AgentStatus = "live" | "training" | "draft" | "paused";

export interface FlowStep {
  id: string;
  label: string;
  goal: string;
  /** what the AI says at this step (template with {{vars}}) */
  say: string;
  /** expected customer outcomes routing to next steps */
  branches: { on: string; next: string }[];
}

export interface Objection {
  id: string;
  trigger: string;
  response: string;
  /** how often customers raise this, % of calls */
  frequency: number;
  enabled: boolean;
}

export interface KnowledgeItem {
  id: string;
  title: string;
  type: "pricing" | "policy" | "offer" | "faq" | "script";
  updatedAt: string;
  chunks: number;
  status: "indexed" | "indexing" | "stale";
}

export interface IntentSample {
  id: string;
  intent: string;
  utterances: string[];
  accuracy: number;
}

export interface AgentConfig {
  id: string;
  workflow: AgentWorkflow;
  name: string;
  /** AI persona name spoken on the call */
  persona: string;
  gender: "female" | "male";
  voice: "coral" | "shimmer" | "sage" | "alloy" | "ash" | "verse" | "echo";
  status: AgentStatus;
  description: string;
  language: "Bhopali Hindi" | "Hindi" | "Hinglish" | "English";
  tone: number; // 0 formal -> 100 friendly
  pace: number; // 0 slow -> 100 fast
  persistence: number; // how hard it pushes for the booking
  maxTurns: number;
  interruptible: boolean;
  callWindow: string;
  retryPolicy: string;
  openingLine: string;
  systemPrompt: string;
  goal: string;
  /** training + quality metrics */
  metrics: {
    calls: number;
    connectRate: number;
    intentAccuracy: number;
    bookingRate: number;
    avgDurationSec: number;
    escalations: number;
    csat: number;
  };
  version: string;
  lastTrained: string;
  flow: FlowStep[];
  objections: Objection[];
  knowledge: KnowledgeItem[];
  intents: IntentSample[];
  guardrails: { id: string; label: string; detail: string; enabled: boolean }[];
  escalation: { id: string; when: string; action: string; enabled: boolean }[];
}

const baseGuardrails = (extra: AgentConfig["guardrails"] = []): AgentConfig["guardrails"] => [
  { id: "g1", label: "No price commitments beyond approved list", detail: "Agent may quote only from the indexed pricing sheet; anything else routes to advisor.", enabled: true },
  { id: "g2", label: "Never claim insurance/warranty approval", detail: "Agent can share process and estimate only, never confirm claim outcomes.", enabled: true },
  { id: "g3", label: "Respect DND & opt-out", detail: "Stop and mark opted-out the moment customer says 'call mat karo'.", enabled: true },
  { id: "g4", label: "No personal data read-back", detail: "Agent never reads out full phone, address or payment details on call.", enabled: true },
  { id: "g5", label: "Two-wheeler context only", detail: "Never reference cars or four-wheeler services.", enabled: true },
  ...extra,
];

const baseEscalation = (extra: AgentConfig["escalation"] = []): AgentConfig["escalation"] => [
  { id: "e1", when: "Customer asks for a human twice", action: "Warm transfer to branch advisor", enabled: true },
  { id: "e2", when: "Angry / complaint sentiment detected", action: "Transfer to CRM manager + log ticket", enabled: true },
  { id: "e3", when: "Intent confidence below 60%", action: "Fallback script, then callback by human", enabled: true },
  ...extra,
];

export const agents: AgentConfig[] = [
  {
    id: "agent_sales",
    workflow: "sales",
    name: "Sales Enquiry Agent",
    persona: "Aarohi",
    gender: "female",
    voice: "coral",
    status: "live",
    description: "Qualifies new enquiries for Activa, Shine and Hornet, and books showroom test rides.",
    language: "Bhopali Hindi",
    tone: 72,
    pace: 50,
    persistence: 65,
    maxTurns: 14,
    interruptible: true,
    callWindow: "10:00 – 19:00 IST",
    retryPolicy: "3 attempts / 48h, 4h gap",
    openingLine:
      "Namaste {{customer_first_name}} ji, Om Honda Bhopal se Aarohi baat kar rai hoon. Aapne {{model}} ke baare mein poocha tha, do minute baat kar lein?",
    goal: "Qualify budget, model preference and finance need, then book a showroom visit or test ride.",
    systemPrompt:
      "You are Aarohi, a warm 25-year-old female sales consultant at Om Honda Bhopal, a Honda TWO-WHEELER dealership. Speak natural conversational Hindi with a soft Bhopali tongue. Qualify the customer on model, budget, finance need and timeline. Offer a free home test ride within Bhopal. Never discuss cars. Never promise discounts beyond the approved offer sheet.",
    metrics: { calls: 1840, connectRate: 71, intentAccuracy: 93, bookingRate: 28, avgDurationSec: 132, escalations: 46, csat: 4.4 },
    version: "v4.2",
    lastTrained: "2026-08-09",
    flow: [
      { id: "s1", label: "Greeting & consent", goal: "Confirm identity, get 2 minutes", say: "Namaste {{customer_first_name}} ji, Om Honda Bhopal se Aarohi. Do minute baat ho sakti hai?", branches: [{ on: "Yes", next: "Discovery" }, { on: "Busy", next: "Callback" }] },
      { id: "s2", label: "Discovery", goal: "Model, usage, budget", say: "Aap daily kitna chalate ho aur budget kya soch rahe ho ji?", branches: [{ on: "Shared", next: "Pitch" }, { on: "Unsure", next: "Recommend" }] },
      { id: "s3", label: "Pitch & offer", goal: "Match model + live offer", say: "{{model}} pe abhi exchange bonus aur free insurance chal raha hai ji.", branches: [{ on: "Interested", next: "Test ride" }, { on: "Objection", next: "Objection handling" }] },
      { id: "s4", label: "Test ride booking", goal: "Lock slot + address", say: "Ghar pe hi test ride bhijwa dun? Kal shaam 5 baje theek rahega?", branches: [{ on: "Booked", next: "Confirm" }, { on: "Later", next: "Callback" }] },
      { id: "s5", label: "Confirm & close", goal: "WhatsApp confirmation", say: "WhatsApp pe detail bhej rai hoon ji, dhanyawaad.", branches: [{ on: "End", next: "—" }] },
    ],
    objections: [
      { id: "o1", trigger: "Price zyada hai", response: "Ji abhi exchange bonus aur ₹3,000 ka accessory voucher chal raha hai, EMI sirf ₹2,4xx se shuru.", frequency: 34, enabled: true },
      { id: "o2", trigger: "Doosre dealer se compare kar raha hoon", response: "Bilkul kijiye ji, hum on-road price match karte hain aur 3 free services extra dete hain.", frequency: 21, enabled: true },
      { id: "o3", trigger: "Abhi nahi, baad mein", response: "Koi baat nahi ji, offer {{offer_end_date}} tak hai — main us se pehle ek reminder bhej dun?", frequency: 27, enabled: true },
      { id: "o4", trigger: "EV lena hai", response: "Ji Activa e bhi aa gaya hai, main uski detail bhej deti hoon.", frequency: 9, enabled: false },
    ],
    knowledge: [
      { id: "k1", title: "Aug 2026 price list — two-wheelers", type: "pricing", updatedAt: "2026-08-01", chunks: 42, status: "indexed" },
      { id: "k2", title: "Exchange bonus & finance schemes", type: "offer", updatedAt: "2026-08-05", chunks: 18, status: "indexed" },
      { id: "k3", title: "Model comparison FAQ", type: "faq", updatedAt: "2026-07-22", chunks: 31, status: "stale" },
    ],
    intents: [
      { id: "i1", intent: "book_test_ride", utterances: ["test ride karwa do", "gaadi dekhni hai", "kal aa jaunga showroom"], accuracy: 96 },
      { id: "i2", intent: "ask_price", utterances: ["on road kitna padega", "daam kya hai", "EMI kitni banegi"], accuracy: 94 },
      { id: "i3", intent: "not_interested", utterances: ["nahi chahiye", "abhi nahi lena", "call mat karo"], accuracy: 91 },
    ],
    guardrails: baseGuardrails([
      { id: "g6", label: "Finance quotes are indicative", detail: "Always say EMI is subject to bank approval.", enabled: true },
    ]),
    escalation: baseEscalation([
      { id: "e4", when: "Customer ready to book today", action: "Live transfer to sales executive", enabled: true },
    ]),
  },
  {
    id: "agent_service",
    workflow: "service",
    name: "Service Reminder Agent",
    persona: "Aarohi",
    gender: "female",
    voice: "coral",
    status: "live",
    description: "Free & paid service reminders, slot booking and free pick-up/drop across Bhopal branches.",
    language: "Bhopali Hindi",
    tone: 80,
    pace: 48,
    persistence: 55,
    maxTurns: 12,
    interruptible: true,
    callWindow: "09:30 – 19:00 IST",
    retryPolicy: "2 attempts / 72h",
    openingLine:
      "Namaste {{customer_first_name}} ji, Om Honda Bhopal se Aarohi. Aapki {{model}} ki {{service_type}} service due hai, slot book kar dun?",
    goal: "Book a workshop slot with pick-up preference and confirm on WhatsApp.",
    systemPrompt:
      "You are Aarohi, a polite service-desk agent at Om Honda Bhopal (two-wheelers only). Remind the customer about the due service, explain what is covered, offer free pick-up and drop inside Bhopal, and book a slot at the nearest branch (MP Nagar, Kolar Road, Ayodhya Bypass). Keep it under 90 seconds.",
    metrics: { calls: 4210, connectRate: 78, intentAccuracy: 96, bookingRate: 41, avgDurationSec: 78, escalations: 22, csat: 4.6 },
    version: "v6.0",
    lastTrained: "2026-08-11",
    flow: [
      { id: "sv1", label: "Greeting", goal: "Identify customer", say: "Namaste ji, Om Honda Bhopal se Aarohi baat kar rai hoon.", branches: [{ on: "Confirmed", next: "Reminder" }, { on: "Wrong person", next: "Close" }] },
      { id: "sv2", label: "Service reminder", goal: "State due service + benefit", say: "Aapki {{model}} ki {{service_type}} service due hai ji.", branches: [{ on: "Interested", next: "Slot" }, { on: "Objection", next: "Objection handling" }] },
      { id: "sv3", label: "Slot & branch", goal: "Date, time, branch", say: "Shanivaar subah 10 baje ka slot khali hai, MP Nagar chalega?", branches: [{ on: "Booked", next: "Pick-up" }, { on: "Later", next: "Callback" }] },
      { id: "sv4", label: "Pick-up offer", goal: "Attach free pick-up", say: "Free pick-up aur drop bhi de denge, aapko aana bhi nai padega.", branches: [{ on: "Yes", next: "Confirm" }, { on: "No", next: "Confirm" }] },
      { id: "sv5", label: "Confirm", goal: "WhatsApp + OTP", say: "WhatsApp pe confirmation bhej rai hoon ji.", branches: [{ on: "End", next: "—" }] },
    ],
    objections: [
      { id: "o1", trigger: "Time nahi hai", response: "Isiliye to free pick-up de rahe hain ji, aapko workshop aana hi nahi padega.", frequency: 38, enabled: true },
      { id: "o2", trigger: "Local mechanic se karwa lunga", response: "Genuine parts aur warranty bani rahti hai ji, aur labour pe 15% off bhi chal raha hai.", frequency: 24, enabled: true },
      { id: "o3", trigger: "Abhi gaadi theek chal rai hai", response: "Bhopal ki dhool mein air filter aur chain 3 mahine mein hi baith jate hain ji, ek free check-up kar dete hain.", frequency: 19, enabled: true },
    ],
    knowledge: [
      { id: "k1", title: "Service schedule & labour rate card", type: "pricing", updatedAt: "2026-08-03", chunks: 56, status: "indexed" },
      { id: "k2", title: "Monsoon 20-point check-up offer", type: "offer", updatedAt: "2026-07-28", chunks: 12, status: "indexed" },
      { id: "k3", title: "Branch timings & pick-up zones", type: "policy", updatedAt: "2026-06-30", chunks: 9, status: "indexed" },
    ],
    intents: [
      { id: "i1", intent: "book_service_slot", utterances: ["shanivaar ko kar do", "kal le jao gaadi", "slot book kar do"], accuracy: 97 },
      { id: "i2", intent: "request_pickup", utterances: ["ghar se le jaoge", "pick up mil jayega", "main aa nahi paunga"], accuracy: 95 },
      { id: "i3", intent: "complaint", utterances: ["pichli baar theek nahi hua", "awaaz aa rai hai abhi bhi"], accuracy: 89 },
    ],
    guardrails: baseGuardrails(),
    escalation: baseEscalation([
      { id: "e4", when: "Repeat repair complaint", action: "Create service ticket + manager callback", enabled: true },
    ]),
  },
  {
    id: "agent_insurance",
    workflow: "insurance",
    name: "Insurance Renewal Agent",
    persona: "Aarohi",
    gender: "female",
    voice: "coral",
    status: "live",
    description: "Renewal reminders 30/15/7 days before expiry with multi-insurer quotes and payment links.",
    language: "Bhopali Hindi",
    tone: 65,
    pace: 52,
    persistence: 70,
    maxTurns: 12,
    interruptible: true,
    callWindow: "10:00 – 18:30 IST",
    retryPolicy: "4 attempts / expiry window",
    openingLine:
      "Namaskar {{customer_first_name}} ji, Om Honda Bhopal se Aarohi. Aapki {{model}} ki insurance {{days_to_expiry}} din mein expire ho rai hai.",
    goal: "Share quote, send renewal link on WhatsApp, and collect payment before expiry.",
    systemPrompt:
      "You are Aarohi handling two-wheeler insurance renewals for Om Honda Bhopal. Quote only from the indexed insurer rate sheet (ICICI Lombard, HDFC Ergo, Bajaj Allianz). Mention no-claim bonus when applicable. Never confirm claim approvals. Always offer to send the renewal link on WhatsApp.",
    metrics: { calls: 2360, connectRate: 69, intentAccuracy: 92, bookingRate: 33, avgDurationSec: 96, escalations: 51, csat: 4.2 },
    version: "v3.5",
    lastTrained: "2026-08-06",
    flow: [
      { id: "in1", label: "Greeting", goal: "Confirm owner", say: "Namaskar ji, Om Honda Bhopal se Aarohi.", branches: [{ on: "Confirmed", next: "Expiry alert" }] },
      { id: "in2", label: "Expiry alert", goal: "Create urgency", say: "Insurance {{days_to_expiry}} din mein khatam ho rai hai ji.", branches: [{ on: "Interested", next: "Quote" }, { on: "Already renewed", next: "Update record" }] },
      { id: "in3", label: "Quote", goal: "Share best premium + NCB", say: "ICICI Lombard ka quote ₹{{premium}} saalana, NCB bhi mil raha hai.", branches: [{ on: "Accepts", next: "Payment link" }, { on: "Wants comparison", next: "Send options" }] },
      { id: "in4", label: "Payment link", goal: "Send WhatsApp link", say: "Link WhatsApp pe bhej rai hoon, 2 minute mein ho jayega ji.", branches: [{ on: "Paid", next: "Close" }, { on: "Later", next: "Callback" }] },
    ],
    objections: [
      { id: "o1", trigger: "Online sasta mil raha hai", response: "Ji hamare through cashless claim hamare hi workshop pe milta hai, aur paperwork hum karte hain.", frequency: 41, enabled: true },
      { id: "o2", trigger: "Pichli baar sasta tha", response: "NCB aur IDV ke hisaab se thoda farak aata hai ji, main teen insurer ke quote bhej deti hoon.", frequency: 26, enabled: true },
      { id: "o3", trigger: "Sirf third party karwana hai", response: "Bilkul ji, third-party ka quote bhi bhej deti hoon — sirf ₹{{tp_premium}}.", frequency: 18, enabled: true },
    ],
    knowledge: [
      { id: "k1", title: "Insurer rate sheet — 2W (Aug 2026)", type: "pricing", updatedAt: "2026-08-02", chunks: 64, status: "indexed" },
      { id: "k2", title: "NCB & IDV explainer", type: "faq", updatedAt: "2026-05-19", chunks: 14, status: "indexed" },
      { id: "k3", title: "Claim process policy", type: "policy", updatedAt: "2026-07-11", chunks: 22, status: "indexing" },
    ],
    intents: [
      { id: "i1", intent: "renew_now", utterances: ["link bhej do", "abhi kara do", "payment kaise karun"], accuracy: 95 },
      { id: "i2", intent: "already_renewed", utterances: ["ho gaya renew", "doosre se karwa liya"], accuracy: 93 },
      { id: "i3", intent: "ask_quote", utterances: ["kitna padega", "quote bhejo", "compare karke batao"], accuracy: 92 },
    ],
    guardrails: baseGuardrails(),
    escalation: baseEscalation([
      { id: "e4", when: "Customer asks about an open claim", action: "Transfer to insurance desk", enabled: true },
    ]),
  },
  {
    id: "agent_amc",
    workflow: "amc",
    name: "AMC Upsell Agent",
    persona: "Rohan",
    gender: "male",
    voice: "ash",
    status: "training",
    description: "Annual maintenance contract renewals and Gold → Platinum upgrades.",
    language: "Bhopali Hindi",
    tone: 60,
    pace: 55,
    persistence: 75,
    maxTurns: 13,
    interruptible: true,
    callWindow: "10:30 – 19:00 IST",
    retryPolicy: "3 attempts / 7 days",
    openingLine:
      "Namaste {{customer_first_name}} bhaiya, Om Honda Bhopal se Rohan bol raha hoon. Aapka {{amc_plan}} AMC plan {{days_to_expiry}} din mein khatam ho raha hai.",
    goal: "Renew AMC or upgrade the plan, and schedule a branch visit if needed.",
    systemPrompt:
      "You are Rohan, a confident 28-year-old male retention agent at Om Honda Bhopal (two-wheelers only). Explain AMC value in rupee terms, compare Gold vs Platinum honestly, and close the renewal or book a branch visit. Speak natural Bhopali Hindi.",
    metrics: { calls: 980, connectRate: 66, intentAccuracy: 88, bookingRate: 24, avgDurationSec: 118, escalations: 37, csat: 4.1 },
    version: "v2.1-beta",
    lastTrained: "2026-08-12",
    flow: [
      { id: "a1", label: "Greeting", goal: "Rapport", say: "Namaste bhaiya, Rohan bol raha hoon Om Honda se.", branches: [{ on: "Confirmed", next: "Expiry" }] },
      { id: "a2", label: "Plan expiry", goal: "State value used", say: "Is saal aapne AMC se ₹{{savings}} bachaye hain ji.", branches: [{ on: "Interested", next: "Upgrade pitch" }] },
      { id: "a3", label: "Upgrade pitch", goal: "Gold vs Platinum", say: "Platinum mein 2 extra service, chain lube aur 24x7 roadside assistance milta hai.", branches: [{ on: "Accepts", next: "Close" }, { on: "Objection", next: "Objection handling" }] },
      { id: "a4", label: "Close / branch visit", goal: "Payment or visit", say: "Shanivaar 11 baje Ayodhya Bypass branch aa jaiyega, main bol deta hoon.", branches: [{ on: "End", next: "—" }] },
    ],
    objections: [
      { id: "o1", trigger: "AMC ka fayda nahi hua", response: "Bhaiya is saal aapki 3 services aur 2 parts AMC mein cover hue, kul ₹{{savings}} bache.", frequency: 31, enabled: true },
      { id: "o2", trigger: "Platinum mehnga hai", response: "Sirf ₹700 saalana zyada, ek roadside call mein hi wasool ho jata hai ji.", frequency: 29, enabled: true },
      { id: "o3", trigger: "Soch ke batata hoon", response: "Bilkul ji, main brochure bhej deta hoon aur parso ek reminder laga deta hoon.", frequency: 33, enabled: true },
    ],
    knowledge: [
      { id: "k1", title: "AMC plan matrix — Silver/Gold/Platinum", type: "pricing", updatedAt: "2026-07-15", chunks: 27, status: "indexed" },
      { id: "k2", title: "Roadside assistance coverage", type: "policy", updatedAt: "2026-06-02", chunks: 11, status: "indexed" },
      { id: "k3", title: "AMC renewal call script v2", type: "script", updatedAt: "2026-08-12", chunks: 8, status: "indexing" },
    ],
    intents: [
      { id: "i1", intent: "renew_amc", utterances: ["kara do renew", "wahi wala rakh do"], accuracy: 90 },
      { id: "i2", intent: "upgrade_plan", utterances: ["platinum kar do", "upgrade karna hai"], accuracy: 86 },
      { id: "i3", intent: "visit_branch", utterances: ["khud aa jaunga", "branch aake dekh lunga"], accuracy: 88 },
    ],
    guardrails: baseGuardrails(),
    escalation: baseEscalation(),
  },
  {
    id: "agent_winback",
    workflow: "winback",
    name: "Win-back Agent",
    persona: "Aarohi",
    gender: "female",
    voice: "coral",
    status: "live",
    description: "Re-engages customers inactive for 6+ months with seasonal offers and free check-ups.",
    language: "Bhopali Hindi",
    tone: 85,
    pace: 46,
    persistence: 45,
    maxTurns: 10,
    interruptible: true,
    callWindow: "11:00 – 18:00 IST",
    retryPolicy: "2 attempts / 30 days",
    openingLine:
      "Namaste {{customer_first_name}} ji, bahut din ho gaye aap apni {{model}} leke workshop nai aaye, sab kushal mangal?",
    goal: "Revive lapsed customers with a free check-up and a discounted service slot.",
    systemPrompt:
      "You are Aarohi reconnecting with lapsed two-wheeler customers of Om Honda Bhopal. Be warm, never guilt-trip. Lead with the free 20-point check-up and seasonal labour discount, then book a slot or send a brochure on WhatsApp.",
    metrics: { calls: 1520, connectRate: 58, intentAccuracy: 90, bookingRate: 17, avgDurationSec: 88, escalations: 19, csat: 4.3 },
    version: "v1.8",
    lastTrained: "2026-07-30",
    flow: [
      { id: "w1", label: "Warm greeting", goal: "Re-establish relationship", say: "Bahut din ho gaye ji, sab theek?", branches: [{ on: "Positive", next: "Offer" }] },
      { id: "w2", label: "Seasonal offer", goal: "Free check-up + 15% off", say: "Monsoon special chal raha hai — free 20-point check-up.", branches: [{ on: "Interested", next: "Slot" }, { on: "Objection", next: "Objection handling" }] },
      { id: "w3", label: "Slot / brochure", goal: "Book or nurture", say: "Shukravaar ya Shanivaar, jo aapko theek lage ji.", branches: [{ on: "End", next: "—" }] },
    ],
    objections: [
      { id: "o1", trigger: "Gaadi bech di", response: "Achha ji, main record update kar deti hoon. Nayi gaadi lene ka plan ho to bata dijiyega.", frequency: 22, enabled: true },
      { id: "o2", trigger: "Doosri jagah service karwa rahe hain", response: "Koi baat nahi ji, ek baar free check-up karwa lijiye, compare kar lena.", frequency: 30, enabled: true },
    ],
    knowledge: [
      { id: "k1", title: "Monsoon win-back offer sheet", type: "offer", updatedAt: "2026-07-20", chunks: 10, status: "indexed" },
      { id: "k2", title: "Lapsed-customer FAQ", type: "faq", updatedAt: "2026-05-05", chunks: 15, status: "stale" },
    ],
    intents: [
      { id: "i1", intent: "reactivate", utterances: ["theek hai bula lo", "aa jaunga is hafte"], accuracy: 92 },
      { id: "i2", intent: "vehicle_sold", utterances: ["gaadi bech di", "ab wo scooty nahi hai"], accuracy: 94 },
    ],
    guardrails: baseGuardrails(),
    escalation: baseEscalation(),
  },
  {
    id: "agent_feedback",
    workflow: "feedback",
    name: "Post-Service Feedback Agent",
    persona: "Rohan",
    gender: "male",
    voice: "ash",
    status: "draft",
    description: "CSAT capture 24h after service delivery with complaint routing.",
    language: "Hinglish",
    tone: 70,
    pace: 50,
    persistence: 30,
    maxTurns: 8,
    interruptible: true,
    callWindow: "11:00 – 19:00 IST",
    retryPolicy: "1 attempt",
    openingLine:
      "Namaste {{customer_first_name}} ji, Om Honda Bhopal se Rohan. Kal aapki {{model}} service hui thi, ek minute feedback le lun?",
    goal: "Capture a 1–5 rating, log the reason, and route complaints to the service manager.",
    systemPrompt:
      "You are Rohan collecting post-service feedback for Om Honda Bhopal two-wheeler customers. Ask for a 1–5 rating, one reason, and whether the issue is resolved. If rating <= 3, apologise and promise a manager callback within 24 hours.",
    metrics: { calls: 0, connectRate: 0, intentAccuracy: 0, bookingRate: 0, avgDurationSec: 0, escalations: 0, csat: 0 },
    version: "v0.3",
    lastTrained: "—",
    flow: [
      { id: "f1", label: "Greeting", goal: "Ask permission", say: "Ek minute feedback le lun ji?", branches: [{ on: "Yes", next: "Rating" }] },
      { id: "f2", label: "Rating", goal: "1–5 score", say: "1 se 5 mein aap kitne number denge?", branches: [{ on: "4-5", next: "Thanks" }, { on: "1-3", next: "Recovery" }] },
      { id: "f3", label: "Recovery", goal: "Log + escalate", say: "Maafi chahta hoon ji, manager 24 ghante mein call karenge.", branches: [{ on: "End", next: "—" }] },
    ],
    objections: [],
    knowledge: [
      { id: "k1", title: "CSAT question bank", type: "script", updatedAt: "2026-08-10", chunks: 6, status: "indexed" },
    ],
    intents: [
      { id: "i1", intent: "give_rating", utterances: ["paanch de raha hoon", "theek tha", "kharab experience tha"], accuracy: 0 },
    ],
    guardrails: baseGuardrails(),
    escalation: baseEscalation(),
  },
];

export const WORKFLOW_LABEL: Record<AgentWorkflow, string> = {
  sales: "Sales",
  service: "Service",
  insurance: "Insurance",
  amc: "AMC",
  winback: "Win-back",
  feedback: "Feedback",
};

export function getAgent(id: string): AgentConfig | undefined {
  return agents.find((a) => a.id === id);
}

/** Sample utterances the trainer can replay in the test console. */
export const TEST_UTTERANCES: Record<AgentWorkflow, string[]> = {
  sales: ["On road kitna padega Activa ka?", "Test ride ghar pe ho sakti hai?", "Abhi nahi lena, baad mein"],
  service: ["Shanivaar ko slot mil jayega?", "Ghar se pick up kar loge?", "Local mechanic se karwa lunga"],
  insurance: ["Online sasta mil raha hai", "Third party ka kitna hai?", "Link bhej do"],
  amc: ["Platinum mein kya extra hai?", "AMC ka fayda kya hua?", "Soch ke batata hoon"],
  winback: ["Gaadi bech di bhai", "Achha free check-up hai kya?", "Brochure bhej do"],
  feedback: ["Service theek thi", "Awaaz abhi bhi aa rai hai", "Bahut badhiya kaam kiya"],
};

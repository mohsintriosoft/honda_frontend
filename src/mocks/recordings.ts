// Call-recording ingestion + mining mock layer.
// Real pipeline later: audio -> storage -> speech-to-text -> mining -> review queue.

import type { AgentWorkflow } from "./agents";

export type RecordingStatus = "queued" | "transcribing" | "mined" | "reviewed" | "failed";
export type CallOutcome = "booked" | "callback" | "not_interested" | "no_answer" | "complaint";
export type IngestSource = "upload" | "manifest" | "dialer";

export type TranscriptTurn = {
  speaker: "agent" | "customer";
  text: string;
  at: string;
  filler?: string;   // 🔥 NEW
};

/** How the workflow/module of a recording was determined. */
export type ModuleSource = "metadata" | "crm" | "ai" | "manual" | "unknown";

export interface ModuleScore {
  module: AgentWorkflow;
  score: number;
}

export interface Recording {
  id: string;
  file: string;
  customer: string;
  phone: string;
  module: AgentWorkflow;
  /** which signal decided the module */
  moduleSource: ModuleSource;
  /** 0-100; 100 for explicit metadata, 0 when unclassified */
  moduleConfidence: number;
  /** runner-up modules from the classifier */
  moduleAlternatives: ModuleScore[];
  /** keywords / intents that drove the classification */
  moduleSignals: string[];
  /** e.g. dialer campaign name or CSV row — shown as the evidence */
  moduleEvidence: string;
  agentName: string;
  date: string;
  durationSec: number;
  language: "Bhopali Hindi" | "Hindi" | "Hinglish";
  outcome: CallOutcome;
  quality: number; // 0-100 audio + conversation quality
  status: RecordingStatus;
  source: IngestSource;
  sentiment: number[]; // -100..100 sampled along the call
  transcript: TranscriptTurn[];
  detectedIntents: string[];
  objectionsRaised: string[];
}


export type SuggestionKind = "intent" | "objection" | "faq" | "opening" | "escalation";

export interface MinedSuggestion {
  id: string;
  kind: SuggestionKind;
  /** trigger / question / utterance */
  a: string;
  /** rebuttal / answer / action — empty for plain intent utterances */
  b: string;
  intent?: string;
  confidence: number;
  occurrences: number;
  sourceRecordingId: string;
  sourceSnippet: string;
  targetAgentId: string;
  module: AgentWorkflow;
  status: "pending" | "approved" | "rejected";
}

export interface IngestJob {
  id: string;
  source: IngestSource;
  label: string;
  files: number;
  hours: number;
  startedAt: string;
  progress: number;
  status: "running" | "done" | "failed";
}

export interface TrainingRun {
  id: string;
  agentId: string;
  fromCalls: number;
  items: number;
  fromVersion: string;
  toVersion: string;
  ranAt: string;
  accuracyBefore: number;
  accuracyAfter: number;
  newIntents: number;
  objectionCoverage: number;
}

export const OUTCOME_LABEL: Record<CallOutcome, string> = {
  booked: "Booked",
  callback: "Callback",
  not_interested: "Not interested",
  no_answer: "No answer",
  complaint: "Complaint",
};

export const KIND_LABEL: Record<SuggestionKind, string> = {
  intent: "Intent utterance",
  objection: "Objection + rebuttal",
  faq: "Q&A pair",
  opening: "Opening line",
  escalation: "Escalation trigger",
};

export const MODULE_AGENT: Record<AgentWorkflow, string> = {
  sales: "agent_sales",
  service: "agent_service",
  insurance: "agent_insurance",
  amc: "agent_amc",
  winback: "agent_winback",
  feedback: "agent_feedback",
};

const NAMES = [
  "Rohit Sharma", "Priya Nair", "Sneha Iyer", "Vikram Singh", "Anjali Verma",
  "Manish Tiwari", "Deepak Yadav", "Kavita Rathore", "Imran Khan", "Pooja Mishra",
  "Sanjay Patel", "Ritu Chouhan", "Arif Sheikh", "Neha Dubey", "Ajay Malviya",
  "Shweta Jain", "Rakesh Rawat", "Meena Solanki", "Harsh Gupta", "Bhavna Soni",
];

const MODULES: AgentWorkflow[] = ["sales", "service", "insurance", "amc", "winback", "feedback"];
const OUTCOMES: CallOutcome[] = ["booked", "callback", "not_interested", "no_answer", "complaint"];
const AGENTS_ON_CALL = ["Aarohi (AI)", "Rohan (AI)", "Seema (human)", "Vijay (human)"];

const TRANSCRIPTS: Record<AgentWorkflow, TranscriptTurn[]> = {
  service: [
    { t: "00:00", speaker: "agent", text: "Namaste ji, main Aarohi bol rai hoon Om Honda Bhopal se. Aapki Activa 6G ki service due ho gayi hai." },
    { t: "00:07", speaker: "customer", text: "Haan bola tha, par abhi time nahi mil raha." },
    { t: "00:12", speaker: "agent", text: "Koi baat nahi ji, hum free pickup and drop kar dete hain, aapko aana bhi nahi padega." },
    { t: "00:20", speaker: "customer", text: "Achha, kitna kharcha aayega?" },
    { t: "00:24", speaker: "agent", text: "Paid service ₹649 se shuru hai, engine oil aur chain lube alag. Kal subah ka slot rakh doon?" },
    { t: "00:33", speaker: "customer", text: "Theek hai, kal 10 baje pickup karwa lena." },
  ],
  sales: [
    { t: "00:00", speaker: "agent", text: "Namaste ji, Om Honda Bhopal se Rohan. Aapne Shine 125 ke liye enquiry ki thi." },
    { t: "00:06", speaker: "customer", text: "Haan, par Activa bhi dekh raha hoon." },
    { t: "00:10", speaker: "agent", text: "Dono ka test ride ek hi visit mein ho jayega ji. Shine mileage mein aage hai, Activa daily city use ke liye aasan." },
    { t: "00:20", speaker: "customer", text: "Down payment kitna lagega?" },
    { t: "00:24", speaker: "agent", text: "₹11,999 se shuru, finance 9 minute mein approve ho jata hai. Shanivar ko showroom aa jaiye?" },
  ],
  insurance: [
    { t: "00:00", speaker: "agent", text: "Namaste ji, aapki two-wheeler insurance is mahine expire ho rai hai." },
    { t: "00:06", speaker: "customer", text: "Online sasta mil raha hai." },
    { t: "00:10", speaker: "agent", text: "Sahi hai ji, par hamare through cashless claim seedha workshop mein ho jata hai, koi paperwork nahi." },
    { t: "00:19", speaker: "customer", text: "Premium kitna hoga Activa ka?" },
    { t: "00:23", speaker: "agent", text: "Third party ke saath zero-dep ₹2,340 padta hai. WhatsApp par quote bhej doon?" },
  ],
  amc: [
    { t: "00:00", speaker: "agent", text: "Namaste ji, aapki Dio ke liye AMC plan renew karana hai." },
    { t: "00:06", speaker: "customer", text: "AMC ka fayda kya hai bhai?" },
    { t: "00:10", speaker: "agent", text: "Teen saal ki labour free, genuine parts par discount aur priority slot milta hai." },
    { t: "00:18", speaker: "customer", text: "Kitne ka hai?" },
    { t: "00:21", speaker: "agent", text: "₹2,999 mein 3 saal. EMI par bhi le sakte hain ji." },
  ],
  winback: [
    { t: "00:00", speaker: "agent", text: "Namaste ji, aap kaafi time se service ke liye nahi aaye, sab theek hai na?" },
    { t: "00:07", speaker: "customer", text: "Pichli baar bahut wait karna pada tha." },
    { t: "00:12", speaker: "agent", text: "Maafi chahti hoon ji. Ab express bay hai, 90 minute mein gaadi ready. Aapke liye ₹300 ka win-back voucher bhi hai." },
    { t: "00:22", speaker: "customer", text: "Theek hai, agle hafte dekh lenge." },
  ],
  feedback: [
    { t: "00:00", speaker: "agent", text: "Namaste ji, kal aapki Activa ki service hui thi, kaisa experience raha?" },
    { t: "00:07", speaker: "customer", text: "Kaam theek tha, par brake abhi bhi thoda dheela lag raha." },
    { t: "00:14", speaker: "agent", text: "Sorry ji, main free re-check schedule kar deti hoon, koi charge nahi lagega." },
    { t: "00:21", speaker: "customer", text: "Haan kar do, kal shaam." },
  ],
};

const INTENTS: Record<AgentWorkflow, string[]> = {
  service: ["book_service", "price_enquiry", "pickup_drop"],
  sales: ["test_ride", "finance_enquiry", "model_compare"],
  insurance: ["renew_policy", "premium_enquiry", "claim_process"],
  amc: ["amc_benefits", "amc_price", "renew_amc"],
  winback: ["past_complaint", "reschedule", "offer_interest"],
  feedback: ["csat_response", "rework_request", "complaint"],
};

const OBJECTIONS: Record<AgentWorkflow, string[]> = {
  service: ["Abhi time nahi hai", "Bahar sasta ho jata hai"],
  sales: ["Budget zyada hai", "Abhi soch raha hoon"],
  insurance: ["Online sasta mil raha hai", "Abhi expire nahi hui"],
  amc: ["Fayda samajh nahi aaya", "Mehnga lag raha hai"],
  winback: ["Pichli baar wait karna pada", "Ab dusri workshop jaata hoon"],
  feedback: ["Kaam adhoora laga", "Call mat kijiye"],
};

// Deterministic pseudo-random so SSR and client agree.
const rand = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};
const pick = <T,>(arr: T[], seed: number) => arr[Math.floor(rand(seed) * arr.length)]!;

// ---------------------------------------------------------------------------
// Module classification
// Priority: explicit metadata > CRM/disposition > AI transcript > unclassified.
// Replace classifyTranscript() with a server function later; same return shape.
// ---------------------------------------------------------------------------

export const MODULE_SOURCE_LABEL: Record<ModuleSource, string> = {
  metadata: "Metadata",
  crm: "CRM match",
  ai: "AI transcript",
  manual: "Human verified",
  unknown: "Unclassified",
};

export const MODULE_SOURCE_HELP: Record<ModuleSource, string> = {
  metadata: "Read from the dialer campaign, CSV column or filename tag — treated as certain.",
  crm: "Matched against the customer's vehicle, service history and call disposition.",
  ai: "Predicted by the keyword + intent classifier running on the Hindi transcript.",
  manual: "Set by a reviewer; also used as a labelled example for the classifier.",
  unknown: "No signal matched — a human must pick the module before this call can train an agent.",
};

/** Dialer campaign / queue → module. Configured once on the Dialer sync tab. */
export const CAMPAIGN_MODULE_MAP: { campaign: string; module: AgentWorkflow; calls: number }[] = [
  { campaign: "Service Reminder — July", module: "service", calls: 612 },
  { campaign: "Showroom Enquiry Followup", module: "sales", calls: 331 },
  { campaign: "Policy Expiry 30d", module: "insurance", calls: 208 },
  { campaign: "AMC Renewal Drive", module: "amc", calls: 154 },
  { campaign: "Lapsed Customer Winback", module: "winback", calls: 164 },
  { campaign: "Post-Service CSAT", module: "feedback", calls: 121 },
];

/** Keyword lexicon per module — matched against the Hindi/Hinglish transcript. */
export const MODULE_LEXICON: Record<AgentWorkflow, string[]> = {
  service: ["service", "servicing", "pickup", "drop", "engine oil", "chain", "slot", "labour"],
  sales: ["test ride", "down payment", "emi", "finance", "shine", "activa", "exchange", "showroom"],
  insurance: ["insurance", "policy", "premium", "zero dep", "expire", "claim", "cashless", "ncb"],
  amc: ["amc", "plan", "renew", "labour free", "priority slot", "3 saal", "teen saal"],
  winback: ["wait", "nahi aaye", "nahi aaya", "voucher", "dusri workshop", "pichli baar", "express bay"],
  feedback: ["experience", "kaisa raha", "complaint", "re-check", "rework", "csat", "brake dheela"],
};

export interface ClassificationResult {
  module: AgentWorkflow;
  confidence: number;
  alternatives: ModuleScore[];
  signals: string[];
}

/** Deterministic mock classifier over a transcript. */
export function classifyTranscript(turns: TranscriptTurn[]): ClassificationResult | null {
  const text = turns.map((t) => t.text).join(" ").toLowerCase();
  const hits = MODULES.map((m) => {
    const signals = MODULE_LEXICON[m].filter((k) => text.includes(k));
    return { module: m, score: signals.length, signals };
  }).sort((a, b) => b.score - a.score);

  const top = hits[0]!;
  if (top.score === 0) return null;
  const spread = top.score - (hits[1]?.score ?? 0);
  const confidence = Math.min(96, 48 + top.score * 9 + spread * 6);
  return {
    module: top.module,
    confidence,
    alternatives: hits.slice(1, 3).filter((h) => h.score > 0).map((h) => ({
      module: h.module,
      score: Math.min(90, 30 + h.score * 9),
    })),
    signals: top.signals.slice(0, 5),
  };
}

/** Threshold below which a call is routed to the "Needs classification" tab. */
export const CONFIDENCE_THRESHOLD = 70;

export const needsClassification = (r: Recording) =>
  r.moduleSource === "unknown" || (r.moduleSource === "ai" && r.moduleConfidence < CONFIDENCE_THRESHOLD);

export const recordings: Recording[] = Array.from({ length: 42 }, (_, i) => {
  const module = MODULES[i % MODULES.length]!;
  const outcome = pick(OUTCOMES, i + 3);
  const status: RecordingStatus =
    i < 4 ? "transcribing" : i < 10 ? "queued" : i < 30 ? "mined" : "reviewed";
  const day = String(2 + (i % 26)).padStart(2, "0");
  const source: IngestSource = i % 7 === 0 ? "manifest" : i % 3 === 0 ? "dialer" : "upload";
  const transcript = TRANSCRIPTS[module];

  // ~10% unclassified, ~25% AI-classified (some below threshold), rest explicit metadata/CRM.
  const bucket = i % 10;
  const ai = classifyTranscript(transcript);
  let moduleSource: ModuleSource = "metadata";
  let moduleConfidence = 100;
  let moduleAlternatives: ModuleScore[] = [];
  let moduleSignals: string[] = [];
  let moduleEvidence =
    source === "dialer"
      ? `Dialer campaign: ${CAMPAIGN_MODULE_MAP.find((c) => c.module === module)?.campaign ?? "—"}`
      : source === "manifest"
        ? `CSV column "module" = ${module}`
        : `Filename tag OMH_${module.toUpperCase()}_…`;

  if (bucket === 7 || bucket === 8) {
    moduleSource = "unknown";
    moduleConfidence = 0;
    moduleEvidence = "No campaign tag, no CSV column, filename has no module code";
  } else if (bucket === 1 || bucket === 4 || bucket === 9) {
    moduleSource = "ai";
    moduleConfidence = ai ? (bucket === 9 ? Math.min(68, ai.confidence - 12) : ai.confidence) : 55;
    moduleAlternatives = ai?.alternatives ?? [];
    moduleSignals = ai?.signals ?? [];
    moduleEvidence = "Predicted from transcript keywords + detected intents";
  } else if (bucket === 3) {
    moduleSource = "crm";
    moduleConfidence = 88;
    moduleEvidence = "Matched to an open service ticket for this customer's vehicle";
  }

  return {
    id: `rec_${1000 + i}`,
    file: `OMH_${moduleSource === "unknown" ? "NA" : module.toUpperCase()}_${1000 + i}.mp3`,
    customer: pick(NAMES, i + 11),
    phone: `+91 9${String(400000000 + Math.floor(rand(i + 7) * 99999999)).slice(0, 9)}`,
    module,
    moduleSource,
    moduleConfidence,
    moduleAlternatives,
    moduleSignals,
    moduleEvidence,
    agentName: pick(AGENTS_ON_CALL, i + 5),
    date: `2026-07-${day}`,
    durationSec: 95 + Math.floor(rand(i + 1) * 260),
    language: i % 5 === 0 ? "Hinglish" : "Bhopali Hindi",
    outcome,
    quality: 62 + Math.floor(rand(i + 13) * 37),
    status,
    source,
    sentiment: Array.from({ length: 8 }, (_, k) => Math.round((rand(i * 8 + k) * 140) - 40)),
    transcript,
    detectedIntents: INTENTS[module].slice(0, 2 + (i % 2)),
    objectionsRaised: OBJECTIONS[module].slice(0, 1 + (i % 2)),
  };
});


export const LIBRARY_TOTAL = 1284; // total recordings synced from the dialer archive

export const ingestJobs: IngestJob[] = [
  { id: "job_1", source: "dialer", label: "Dialer sync — Service, last 30 days", files: 612, hours: 41.5, startedAt: "Today 09:12", progress: 100, status: "done" },
  { id: "job_2", source: "manifest", label: "insurance_q2_manifest.csv", files: 208, hours: 12.9, startedAt: "Today 11:40", progress: 100, status: "done" },
  { id: "job_3", source: "upload", label: "winback_july_batch.zip", files: 164, hours: 9.2, startedAt: "Today 14:05", progress: 68, status: "running" },
];

const SUGGESTION_SEED: Omit<MinedSuggestion, "id" | "status" | "sourceRecordingId" | "targetAgentId">[] = [
  { kind: "objection", module: "service", a: "Bahar sasta ho jata hai", b: "Bahar sasta lag sakta hai ji, par genuine parts, trained mechanic aur warranty sirf authorised service par milti hai — aur abhi labour par 10% off chal raha hai.", confidence: 94, occurrences: 187, sourceSnippet: "Customer: bahar wale 400 mein kar dete hain…" },
  { kind: "faq", module: "service", a: "Pickup and drop free hai kya?", b: "Ji haan, Bhopal city limits mein free pickup and drop hai, ek din pehle booking karni hoti hai.", confidence: 91, occurrences: 143, sourceSnippet: "Customer: gaadi lene aa jaoge kya?" },
  { kind: "intent", module: "service", a: "scooty ki servicing karani hai", b: "", intent: "book_service", confidence: 96, occurrences: 402, sourceSnippet: "Customer: meri scooty ki servicing karani hai" },
  { kind: "intent", module: "sales", a: "test ride kab mil sakti hai", b: "", intent: "test_ride", confidence: 93, occurrences: 121, sourceSnippet: "Customer: test ride kab karwa doge?" },
  { kind: "objection", module: "sales", a: "Budget thoda zyada ja raha hai", b: "Samajh sakta hoon ji — ₹11,999 down payment aur ₹2,850 EMI par ho jata hai, aur exchange bonus alag se milta hai.", confidence: 88, occurrences: 96, sourceSnippet: "Customer: itna budget nahi hai abhi" },
  { kind: "objection", module: "insurance", a: "Online sasta mil raha hai", b: "Rate lagbhag same rehta hai ji, par hamare through claim cashless seedha workshop mein ho jata hai — aapko paperwork nahi karna padta.", confidence: 90, occurrences: 158, sourceSnippet: "Customer: policybazaar par kam dikha raha" },
  { kind: "faq", module: "insurance", a: "Zero dep ka premium kitna hai Activa ka?", b: "Activa 6G ka zero-dep third party ke saath ₹2,340 aata hai, NCB ke hisaab se kam bhi ho sakta hai.", confidence: 86, occurrences: 74, sourceSnippet: "Customer: zero dep ka rate batao" },
  { kind: "opening", module: "winback", a: "Win-back opening line", b: "Namaste ji, aap kaafi samay se service ke liye nahi aaye — koi dikkat hui thi kya? Main sirf ek minute lungi.", confidence: 82, occurrences: 61, sourceSnippet: "Best-performing opener across 61 booked win-back calls" },
  { kind: "objection", module: "winback", a: "Pichli baar bahut wait karna pada", b: "Bilkul galat hua ji, maafi chahti hoon. Ab express bay hai — 90 minute mein gaadi ready, aur aapke liye ₹300 ka voucher bhi hai.", confidence: 89, occurrences: 88, sourceSnippet: "Customer: 4 ghante lag gaye the pichli baar" },
  { kind: "escalation", module: "feedback", a: "Customer repeats the same complaint twice", b: "Transfer to service manager and open a rework ticket immediately.", confidence: 79, occurrences: 44, sourceSnippet: "Customer: bola tha na brake theek nahi hua" },
  { kind: "faq", module: "amc", a: "AMC lene ka fayda kya hai?", b: "3 saal labour free, genuine parts par discount aur priority slot — ₹2,999 mein, EMI bhi ho jati hai.", confidence: 92, occurrences: 133, sourceSnippet: "Customer: AMC ka fayda kya milega?" },
  { kind: "intent", module: "amc", a: "amc renew karwana hai", b: "", intent: "renew_amc", confidence: 95, occurrences: 118, sourceSnippet: "Customer: amc renew kar do meri" },
  { kind: "intent", module: "insurance", a: "policy expire ho rai hai renew karo", b: "", intent: "renew_policy", confidence: 94, occurrences: 205, sourceSnippet: "Customer: insurance khatam ho rai hai" },
  { kind: "faq", module: "sales", a: "Finance approve hone mein kitna time lagta hai?", b: "Documents complete ho to 9 minute mein approval mil jata hai ji, aadhaar aur PAN chahiye.", confidence: 84, occurrences: 67, sourceSnippet: "Customer: loan kitne din mein hota hai?" },
  { kind: "escalation", module: "service", a: "Customer mentions accident or safety issue", b: "Stop the booking script and transfer to the branch service manager.", confidence: 87, occurrences: 29, sourceSnippet: "Customer: gaadi gir gayi thi, brake fail ho gaya tha" },
  { kind: "opening", module: "service", a: "Service reminder opening line", b: "Namaste ji, main Aarohi Om Honda Bhopal se — aapki Activa ki service due hai, do minute baat kar sakti hoon?", confidence: 90, occurrences: 214, sourceSnippet: "Highest connect-to-booking opener in July" },
];

export const minedSuggestions: MinedSuggestion[] = SUGGESTION_SEED.map((s, i) => ({
  ...s,
  id: `sug_${100 + i}`,
  status: "pending",
  sourceRecordingId: recordings[(i * 3) % recordings.length]!.id,
  targetAgentId: MODULE_AGENT[s.module],
}));

export const trainingRuns: TrainingRun[] = [
  { id: "run_3", agentId: "agent_service", fromCalls: 612, items: 84, fromVersion: "v1.3", toVersion: "v1.4", ranAt: "2026-07-28 18:40", accuracyBefore: 88, accuracyAfter: 93, newIntents: 6, objectionCoverage: 87 },
  { id: "run_2", agentId: "agent_insurance", fromCalls: 208, items: 41, fromVersion: "v1.0", toVersion: "v1.1", ranAt: "2026-07-19 12:10", accuracyBefore: 79, accuracyAfter: 85, newIntents: 4, objectionCoverage: 72 },
  { id: "run_1", agentId: "agent_sales", fromCalls: 331, items: 57, fromVersion: "v2.0", toVersion: "v2.1", ranAt: "2026-07-08 10:02", accuracyBefore: 84, accuracyAfter: 90, newIntents: 5, objectionCoverage: 80 },
];

export const TRAIN_STEPS = ["Transcribe", "Mine", "Dedupe", "Index", "Evaluate"] as const;

export const formatDuration = (s: number) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export const totalHours = (list: Recording[]) =>
  Math.round((list.reduce((s, r) => s + r.durationSec, 0) / 3600) * 10) / 10;

export function getRecording(id: string) {
  return recordings.find((r) => r.id === id);
}

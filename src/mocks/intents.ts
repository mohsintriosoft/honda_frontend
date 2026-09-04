// mocks/intents.ts
//
// Mock data for the Intents dashboard.
//
// Modeled directly on the backend so swapping in the real API later is a
// straight data-shape match, not a rewrite:
//   - IntentCode          → CorrectIntent.INTENT_CLASS_CHOICES / ConversationTurn.intent
//   - IntentTurnRecord     → CorrectIntent row joined with its ConversationTurn
//       - detectedIntent   → CorrectIntent.intent      ("filler_service ne turn pe jo diya")
//       - correctIntent    → CorrectIntent.suggested_intent (LLM hindsight QA)
//       - fillerUsed       → CorrectIntent.filler / ConversationTurn.filler_text
//       - suggestedFiller  → CorrectIntent.suggested_filler
//       - match            → mirrors CorrectIntentAdmin.mismatch (intent != suggested_intent)
//
// All numbers below are seeded-random placeholders — see AgentsPage's
// mulberry32 pattern in _app.agents.index.tsx. Nothing here calls the API.

export type IntentCode =
    | "booking"
    | "call_end"
    | "callback"
    | "complaint"
    | "generic"
    | "greeting"
    | "off_topic"
    | "query_general"
    | "upset";

export const INTENT_CODES: IntentCode[] = [
    "booking",
    "callback",
    "upset",
    "complaint",
    "query_general",
    "call_end",
    "greeting",
    "off_topic",
    "generic",
];

export const INTENT_LABEL: Record<IntentCode, string> = {
    booking: "Booking",
    call_end: "Call End",
    callback: "Callback",
    complaint: "Complaint",
    generic: "Generic",
    greeting: "Greeting",
    off_topic: "Off Topic",
    query_general: "Query General",
    upset: "Upset",
};

export const INTENT_DESCRIPTION: Record<IntentCode, string> = {
    booking: "Customer wants to book, reschedule or confirm a service slot.",
    call_end: "Customer signals the conversation is done — nothing further to discuss.",
    callback: "Customer wants the bot or an advisor to call back at a better time.",
    complaint: "Customer is reporting a problem with the vehicle, service or billing.",
    generic: "Small talk, filler acknowledgements, or chatter that doesn't fit elsewhere.",
    greeting: "The opening exchange at the very start of a call.",
    off_topic: "Conversation drifts away from the calling workflow entirely.",
    query_general: "A factual question — pricing, address, timing, service coverage.",
    upset: "Customer sounds frustrated, angry, or is starting to escalate.",
};

export type WorthLevel = "High" | "Medium" | "Low";

export const INTENT_WORTH: Record<IntentCode, { level: WorthLevel; reason: string }> = {
    booking: {
        level: "High",
        reason: "Directly drives appointment revenue — the funnel's money intent.",
    },
    callback: {
        level: "High",
        reason: "A missed or mishandled callback usually means a lost customer, not a second chance.",
    },
    upset: {
        level: "High",
        reason: "Escalation risk — a misread here damages trust faster than any other intent.",
    },
    complaint: {
        level: "Medium",
        reason: "Feeds the service-quality and retention signal, but rarely time-critical in the moment.",
    },
    query_general: {
        level: "Medium",
        reason: "Keeps the customer engaged; a bad answer here stalls the funnel rather than ending it.",
    },
    call_end: {
        level: "Low",
        reason: "Mostly housekeeping — low downstream impact if it's occasionally misclassified.",
    },
    greeting: {
        level: "Low",
        reason: "Opening pleasantries; close to zero business impact on its own.",
    },
    off_topic: {
        level: "Low",
        reason: "Noise the bot should steer away from, not a signal worth optimising for.",
    },
    generic: {
        level: "Low",
        reason: "Large catch-all bucket — high volume, but little signal per individual turn.",
    },
};

export const WORTH_STYLE: Record<WorthLevel, string> = {
    High: "bg-[color:var(--destructive)]/10 text-[color:var(--destructive)] border-[color:var(--destructive)]/30",
    Medium: "bg-[color:var(--ai)]/12 text-[color:var(--ai)] border-[color:var(--ai)]/30",
    Low: "bg-secondary text-muted-foreground",
};

// ======================================================
// SEEDED RANDOM (mock fields until the QA endpoints are wired up)
// ======================================================

function strSeed(str: string): number {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return h;
}

function mulberry32(seed: number) {
    return function () {
        seed |= 0;
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function randInt(rng: () => number, min: number, max: number) {
    return Math.floor(rng() * (max - min + 1)) + min;
}

function randPick<T>(rng: () => number, arr: T[]): T {
    return arr[Math.floor(rng() * arr.length)];
}

// ======================================================
// SAMPLE CONVERSATION CONTENT (per intent)
// ======================================================

const CUSTOMER_NAMES = [
    "Ravi Sharma", "Priya Malviya", "Ajay Tiwari", "Sunita Rathore", "Vikram Chouhan",
    "Neha Joshi", "Manish Verma", "Kavita Soni", "Deepak Jain", "Anjali Yadav",
    "Rahul Gupta", "Pooja Mishra", "Sanjay Dubey", "Meena Agrawal", "Amit Kushwaha",
];

const BRANCHES = ["Awadhpuri", "Kolar Road", "Ayodhya Bypass"];

type SamplePair = { customer: string; filler: string; altFiller?: string };

const SAMPLES: Record<IntentCode, SamplePair[]> = {
    booking: [
        { customer: "Haan, kal shaam ka slot mil jayega kya?", filler: "Bilkul, main abhi slot check karti hoon…" },
        { customer: "Mujhe apni Activa ka service book karna hai is weekend.", filler: "Theek hai, weekend ke slots dekhti hoon…" },
        { customer: "Sunday ko chhutti hai kya branch me? Monday shift kar dijiye.", filler: "Ek second, Monday ka slot dekh rahi hoon…", altFiller: "Sunday ki availability confirm karke batati hoon…" },
        { customer: "Time badalna hai booking ka, 11 baje kar dijiye.", filler: "Reschedule kar rahi hoon, ek minute…" },
        { customer: "Ha book kar do, 3rd free service hai mera.", filler: "Confirm kar rahi hoon aapki 3rd free service…" },
    ],
    callback: [
        { customer: "Abhi meeting me hoon, thodi der baad call kariyega.", filler: "Bilkul, hum thodi der baad call karte hain…" },
        { customer: "Shaam 6 baje call karna, abhi busy hoon.", filler: "Theek hai, shaam 6 baje call karenge…" },
        { customer: "Kal subah call kar lena, abhi network sahi nahi hai.", filler: "Samajh gayi, kal subah try karte hain…", altFiller: "Koi baat nahi, kal subah dobara call karenge…" },
        { customer: "Mera dost gaadi use kar raha hai, wapas aane par call karna.", filler: "Theek hai, thodi der baad call karte hain…" },
    ],
    upset: [
        { customer: "Teesri baar call kar rahe ho, ek baar me sahi jawab do na!", filler: "Bahut maafi chahti hoon aapki taqleef ke liye…" },
        { customer: "Service center walon ne meri gaadi kharab kar di hai, bahut gussa hoon.", filler: "Main samajh sakti hoon, turant advisor se baat karwati hoon…" },
        { customer: "Ye AI call band karo, kisi insaan se baat karwao.", filler: "Zaroor, main aapko turant transfer karti hoon…", altFiller: "Maafi chahti hoon, main abhi advisor ko connect karti hoon…" },
        { customer: "Do ghante se wait kar raha hoon, koi jawab hi nahi mil raha.", filler: "Bahut afsos hai deri ke liye, main abhi escalate karti hoon…" },
    ],
    complaint: [
        { customer: "Service ke baad se gaadi se ajeeb awaaz aa rahi hai.", filler: "Samajh gayi, isko log kar deti hoon complaint me…" },
        { customer: "Bill me extra charge laga diya hai jo bataya nahi tha.", filler: "Maafi chahti hoon, main billing team ko batati hoon…" },
        { customer: "Mera part change nahi hua, purana hi laga diya lagta hai.", filler: "Ye important hai, main isse note kar rahi hoon…", altFiller: "Main abhi service advisor ko is baare me alert karti hoon…" },
    ],
    query_general: [
        { customer: "Aapka Kolar Road branch ka address kya hai?", filler: "Ek second, address batati hoon…" },
        { customer: "1st free service me kya kya cover hota hai?", filler: "Bilkul batati hoon, 1st free service me…" },
        { customer: "Aaj branch kitne baje tak khula hai?", filler: "Aaj hum khule hain…", altFiller: "Timing check karke batati hoon…" },
        { customer: "AMC lene ka price kya hai Activa ke liye?", filler: "AMC ki details batati hoon…" },
    ],
    call_end: [
        { customer: "Nahi bas, itna hi kaafi hai, dhanyavaad.", filler: "Dhanyavaad, aapka din shubh ho!" },
        { customer: "Theek hai, koi aur baat nahi, rakhta hoon.", filler: "Theek hai ji, dhanyavaad!" },
        { customer: "Bas ho gaya, alvida.", filler: "Alvida, apna khayal rakhiyega!" },
    ],
    greeting: [
        { customer: "Haan ji, bolo.", filler: "Namaste! Om Honda se bol rahi hoon…" },
        { customer: "Kaun bol raha hai?", filler: "Namaste, main Om Honda ki AI assistant Aarohi…" },
        { customer: "Haan haan, kaho.", filler: "Namaste ji, kaise hain aap?" },
    ],
    off_topic: [
        { customer: "Aapka naam kya hai, aap sach me robot ho?", filler: "Ji main Om Honda ki AI assistant hoon…" },
        { customer: "Aaj mausam kaisa hai aapke taraf?", filler: "Ji main sirf aapki service se juri madad kar sakti hoon…", altFiller: "Wapas topic par aate hain, main aapki kaise madad karoon?" },
        { customer: "Cricket match dekha kal ka?", filler: "Main isme madad nahi kar paungi, lekin service ke baare me poochiye…" },
    ],
    generic: [
        { customer: "Haan.", filler: "Theek hai…" },
        { customer: "Nahi nahi.", filler: "Samajh gayi…" },
        { customer: "Hmm, thik hai.", filler: "Achha, aage batati hoon…" },
        { customer: "Achha, theek.", filler: "Ji bilkul…" },
    ],
};

// Which mis-classifications are plausible for each intent (used for the
// small % of records that are deliberately marked as a mismatch).
const CONFUSABLE: Record<IntentCode, IntentCode[]> = {
    booking: ["query_general", "generic"],
    callback: ["generic", "call_end"],
    upset: ["complaint", "generic"],
    complaint: ["upset", "query_general"],
    query_general: ["generic", "off_topic"],
    call_end: ["generic", "greeting"],
    greeting: ["generic", "off_topic"],
    off_topic: ["generic", "query_general"],
    generic: ["off_topic", "call_end"],
};

// ======================================================
// TYPES
// ======================================================

export interface IntentSummary {
    code: IntentCode;
    label: string;
    description: string;
    worth: { level: WorthLevel; reason: string };
    totalTurns: number;
    positives: number; // detected intent matched the QA-suggested intent
    negatives: number; // mismatch
    accuracy: number; // 0-100
    avgConfidence: number; // 0-100
    weekOverWeekDelta: number; // +/- accuracy points
    topConfusedWith: IntentCode;
}

export interface IntentTurnRecord {
    id: string;
    intentCode: IntentCode;
    callSessionId: string;
    turnNumber: number;
    customerName: string;
    branch: string;
    timestamp: string; // ISO date
    customerText: string;
    detectedIntent: IntentCode;
    confidence: number; // 0-100
    correctIntent: IntentCode; // QA suggested_intent
    fillerUsed: string;
    suggestedFiller: string;
    match: boolean;
}

// ======================================================
// GENERATORS
// ======================================================

function buildSummary(code: IntentCode): IntentSummary {
    const rng = mulberry32(strSeed(code));

    const totalTurns = randInt(rng, 220, 2400);
    const accuracy = randInt(rng, 68, 97);
    const positives = Math.round((accuracy / 100) * totalTurns);
    const negatives = totalTurns - positives;
    const avgConfidence = randInt(rng, 55, 92);
    const weekOverWeekDelta = randInt(rng, -6, 8);

    return {
        code,
        label: INTENT_LABEL[code],
        description: INTENT_DESCRIPTION[code],
        worth: INTENT_WORTH[code],
        totalTurns,
        positives,
        negatives,
        accuracy,
        avgConfidence,
        weekOverWeekDelta,
        topConfusedWith: randPick(rng, CONFUSABLE[code]),
    };
}

export const INTENT_SUMMARIES: IntentSummary[] = INTENT_CODES.map(buildSummary);

export function getIntentSummary(code: IntentCode): IntentSummary | undefined {
    return INTENT_SUMMARIES.find((i) => i.code === code);
}

function buildTurnRecords(code: IntentCode, count: number): IntentTurnRecord[] {
    // `code` here is the CORRECT / ground-truth intent — i.e. what the
    // customer actually meant, per the LLM's hindsight QA pass
    // (CorrectIntent.suggested_intent). A turn lives on this intent's page
    // because that's what it truly is, even if the fast classifier
    // (CorrectIntent.intent) read it as something else in real time.
    const rng = mulberry32(strSeed(`turns:${code}`));
    const samples = SAMPLES[code];
    const records: IntentTurnRecord[] = [];

    for (let i = 0; i < count; i++) {
        const sample = randPick(rng, samples);
        const isMismatch = rng() < 0.22; // ~1 in 5 rows shown as a QA correction
        const detectedIntent = isMismatch ? randPick(rng, CONFUSABLE[code]) : code;
        const daysAgo = randInt(rng, 0, 21);
        const ts = new Date();
        ts.setDate(ts.getDate() - daysAgo);
        ts.setHours(randInt(rng, 9, 19), randInt(rng, 0, 59), 0, 0);

        // The filler actually played is whatever the real-time (possibly wrong)
        // detection picked — pulled from that intent's own filler pool. The
        // suggested filler is always the one that fits the true intent.
        const playedFillerSample = isMismatch ? randPick(rng, SAMPLES[detectedIntent]) : sample;

        records.push({
            id: `${code}-${i + 1}`,
            intentCode: code,
            callSessionId: `CS-${randInt(rng, 10000, 99999)}`,
            turnNumber: randInt(rng, 2, 14),
            customerName: randPick(rng, CUSTOMER_NAMES),
            branch: randPick(rng, BRANCHES),
            timestamp: ts.toISOString(),
            customerText: sample.customer,
            detectedIntent,
            confidence: isMismatch ? randInt(rng, 40, 74) : randInt(rng, 72, 99),
            correctIntent: code,
            fillerUsed: playedFillerSample.filler,
            suggestedFiller: sample.filler,
            match: !isMismatch,
        });
    }

    // Most recent first, like ConversationTurn ordering in the transcript viewer.
    return records.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
}

const TURN_RECORDS_BY_INTENT: Record<IntentCode, IntentTurnRecord[]> = INTENT_CODES.reduce(
    (acc, code) => {
        acc[code] = buildTurnRecords(code, randInt(mulberry32(strSeed(`count:${code}`)), 40, 95));
        return acc;
    },
    {} as Record<IntentCode, IntentTurnRecord[]>,
);

export function getIntentTurns(code: IntentCode): IntentTurnRecord[] {
    return TURN_RECORDS_BY_INTENT[code] ?? [];
}
// Bhopali-flavoured Hindi sample transcripts for live & demo calls.
// Used by the AI Voice module to showcase realistic local conversations to the client.

export type TranscriptLine = { who: "ai" | "user"; text: string; t?: string };

export type AgentGender = "female" | "male";

export interface CallScript {
  intent: string;
  summary: string;
  tags: string[];
  /** AI agent name shown in UI */
  agent: string;
  /** OpenAI TTS voice id */
  voice: "coral" | "shimmer" | "sage" | "alloy" | "ash" | "verse" | "echo";
  gender: AgentGender;
  lines: TranscriptLine[];
}

// Keyed by call.id. The 4 live calls in the mock are call_0, call_9, call_18, call_27.
// 3 calls use Aarohi (warm young female Bhopali voice) + 1 call uses Rohan (male agent).
export const CALL_SCRIPTS: Record<string, CallScript> = {
  call_0: {
    intent: "Free service reminder",
    summary:
      "Customer ko Activa ki free service ki yaad dilayi. Shanivaar subah 10 baje ka slot book ho gaya, free pick-up bhi confirm. WhatsApp pe confirmation bhej diya.",
    tags: ["Free Service", "Activa 6G", "Shanivaar slot", "Pick-up", "Bhopali Hindi"],
    agent: "Aarohi",
    voice: "coral",
    gender: "female",
    lines: [
      { who: "ai", text: "Namaste bhaiya, Om Honda Bhopal se Aarohi baat kar rai hoon. Rohit ji se baat ho rai hai na?", t: "0:00" },
      { who: "user", text: "Haan haan, bolo bhai. Kaiku phone kiye ho?", t: "0:04" },
      { who: "ai", text: "Aapki Activa 6G ki free service is mahine due hai ji. Bhopal mein abhi dhool bahut hai, ek baar scooty check karwa lete to badhiya rahega.", t: "0:08" },
      { who: "user", text: "Achha, kitna time lagega? Hum to MP Nagar mein rehte hain.", t: "0:18" },
      { who: "ai", text: "Bas do-teen ghante ka kaam hai bhaiya. Aur sunno — hum free pick-up aur drop bhi de denge, aapko aana bhi nai padega.", t: "0:23" },
      { who: "user", text: "Arre wah, ye to badhiya baat batayi. Shanivaar ko ho jayega kya?", t: "0:32" },
      { who: "ai", text: "Bilkul ji, Shanivaar subah 10 baje ka slot khali hai. Kolar Road waali branch bhi chalegi ya MP Nagar?", t: "0:37" },
      { who: "user", text: "MP Nagar hi theek hai, ghar ke paas hai.", t: "0:45" },
      { who: "ai", text: "Ho gaya bhaiya, book kar diya. WhatsApp pe abhi confirmation bhej rai hoon, ek OTP aayega usse confirm kar dijiyega. Aur kuch seva?", t: "0:48" },
      { who: "user", text: "Nai bas itna hi. Dhanyawaad.", t: "0:57" },
      { who: "ai", text: "Aapka din shubh ho ji, Om Honda parivar ki taraf se.", t: "1:00" },
    ],
  },

  call_9: {
    intent: "Insurance renewal",
    summary:
      "Shine 125 ki insurance 12 din mein expire ho rai. Customer ne quote maanga — ICICI Lombard ka renewal link WhatsApp pe bhej diya. Callback 2 din baad.",
    tags: ["Insurance", "Shine 125", "ICICI Lombard", "Callback 2 din", "Bhopali Hindi"],
    agent: "Aarohi",
    voice: "coral",
    gender: "female",
    lines: [
      { who: "ai", text: "Namaskar Priya ji, Om Honda Bhopal se Aarohi. Do minute baat ho sakti hai kya?", t: "0:00" },
      { who: "user", text: "Haan boliye, par jaldi batao, office ja rai hoon.", t: "0:05" },
      { who: "ai", text: "Ji bas chhoti si baat hai. Aapki Honda Shine 125 ki insurance bas 12 din mein expire ho rai hai. Hum aapke liye renewal ka intezaam kar denge.", t: "0:09" },
      { who: "user", text: "Achha, kitne ka padega is baar?", t: "0:19" },
      { who: "ai", text: "ICICI Lombard ka quote nikalwa diya hai — lagbhag tees sau pachas rupay saalana. No claim bonus bhi mil raha hai aapko.", t: "0:23" },
      { who: "user", text: "Hmm, pichli baar isse sasta tha. Thoda dekh ke batao.", t: "0:32" },
      { who: "ai", text: "Bilkul ji. Main HDFC Ergo aur Bajaj ka bhi quote nikaal ke WhatsApp pe abhi bhej deti hoon. Aap ghar pahunch ke aaram se dekh lijiyega.", t: "0:37" },
      { who: "user", text: "Theek hai, bhej do. Parso phone karna phir.", t: "0:47" },
      { who: "ai", text: "Ji, parso shaam ko 6 baje callback laga deti hoon. Dhanyawaad Priya ji, shubh din.", t: "0:51" },
    ],
  },

  call_18: {
    intent: "AMC renewal",
    summary:
      "Unicorn ka AMC Gold plan expire hone wala hai. Customer ne pricing maangi, Platinum upgrade option bataya. Branch visit Saturday ko schedule.",
    tags: ["AMC", "Unicorn", "Gold → Platinum", "Workshop visit", "Bhopali Hindi"],
    agent: "Rohan",
    voice: "ash",
    gender: "male",
    lines: [
      { who: "ai", text: "Namaste Aman bhaiya, Om Honda Bhopal se Rohan bol raha hoon. Theek thaak ho?", t: "0:00" },
      { who: "user", text: "Haan ji, sab badhiya. Kya kaam tha bhai?", t: "0:04" },
      { who: "ai", text: "Bhaiya aapki Honda Unicorn ka jo Gold AMC plan hai na, woh agle mahine khatam ho raha hai. Renewal karwa lo to bike ki tension hi khatam ho jayegi.", t: "0:08" },
      { who: "user", text: "Achha. Platinum mein kya extra milta hai?", t: "0:17" },
      { who: "ai", text: "Platinum mein do extra services, free chain lube aur wheel alignment, aur 24x7 roadside assistance bhi shamil hai. Bhopal ke andar pick-up bhi free hai bhaiya.", t: "0:21" },
      { who: "user", text: "Daam mein kitna farak padega?", t: "0:31" },
      { who: "ai", text: "Sirf saat sau rupay zyada saalana. Lekin ek roadside call mein hi paisa wasool ho jaata hai, sach bata raha hoon.", t: "0:35" },
      { who: "user", text: "Theek hai, soch ke batata hoon. Shanivaar ko khud aa jaunga branch.", t: "0:44" },
      { who: "ai", text: "Bilkul ji, Ayodhya Bypass branch mein Mohit ji ko bol deta hoon. 11 baje aa jaiyega, chai bhi pilayenge.", t: "0:49" },
      { who: "user", text: "Theek hai bhai, milte hain.", t: "0:58" },
    ],
  },

  call_27: {
    intent: "Win-back inactive customer",
    summary:
      "Customer 8 mahine se workshop nai aaye. Monsoon offer aur free check-up bataya. Interest dikha, WhatsApp pe brochure bhej diya.",
    tags: ["Win-back", "Dio", "Monsoon offer", "Free check-up", "Bhopali Hindi"],
    agent: "Aarohi",
    voice: "coral",
    gender: "female",
    lines: [
      { who: "ai", text: "Namaste Sneha ji, Om Honda Bhopal se Aarohi. Bahut din ho gaye aap apni Dio leke workshop nai aayi, sab kushal mangal?", t: "0:00" },
      { who: "user", text: "Haan haan, sab theek. Bas thoda busy chal raha tha.", t: "0:06" },
      { who: "ai", text: "Samajh sakti hoon ji. Bas aapko batane ke liye phone kiya — monsoon special chal raha hai, free 20-point check-up aur 15% off labour charges pe.", t: "0:11" },
      { who: "user", text: "Achha sach mein? Scooty mein thodi awaaz aa rai thi waise, aur brake bhi tight ho gaye hain.", t: "0:21" },
      { who: "ai", text: "To phir bilkul sahi time hai ji. Hum sun ke bata denge kya issue hai. Pick-up bhi free, aapko Arera Colony se scooty le aayenge.", t: "0:26" },
      { who: "user", text: "Hmm achha, brochure bhej do WhatsApp pe, dekh ke batati hoon.", t: "0:36" },
      { who: "ai", text: "Abhi bhej rai hoon ji. Aur is hafte slot khaali hai — Shukravaar ya Shanivaar, jo aapko theek lage.", t: "0:42" },
      { who: "user", text: "Theek hai, Shanivaar dekh ke confirm karti hoon.", t: "0:50" },
      { who: "ai", text: "Bahut badhiya ji. Aap reply kar dijiyega, hum slot block kar denge. Dhanyawaad, namaste.", t: "0:54" },
    ],
  },
};

export const DEFAULT_SCRIPT: CallScript = {
  intent: "Service follow-up",
  summary: "Standard service follow-up call. Customer ne interest dikhaya, slot ki pushti baki hai.",
  tags: ["Service", "Follow-up", "Bhopali Hindi"],
  agent: "Aarohi",
  voice: "coral",
  gender: "female",
  lines: [
    { who: "ai", text: "Namaste ji, Om Honda Bhopal se Aarohi. Aapki bike ki service ke baare mein baat karni thi." },
    { who: "user", text: "Haan boliye." },
    { who: "ai", text: "Aap kab tak workshop aa sakte ho? Hum pick-up bhi arrange kar denge." },
  ],
};

export function getCallScript(callId: string): CallScript {
  return CALL_SCRIPTS[callId] ?? DEFAULT_SCRIPT;
}

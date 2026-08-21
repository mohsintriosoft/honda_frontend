import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/AppShell";
import { WORKFLOW_LABEL, type AgentStatus } from "@/mocks/agents";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Bot, ArrowRight, Sparkles, BookOpen, ShieldCheck, GitBranch, GraduationCap } from "lucide-react";
import { formatNumber } from "@/lib/format";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

// ---- DB-backed shapes (subset of fields actually used here) ----
interface Segment {
  id: number;
  slug: string;
  name: string;
  description: string;
}
interface LLMSettingSummary {
  segment: { id: number };
  persona_name: string;
  voice: { voice_name: string; gender: string };
}

// ---- View-model the existing JSX was already written against ----
interface AgentCard {
  id: string; // segment slug, used as the route param
  name: string;
  description: string;
  status: AgentStatus;
  workflow: keyof typeof WORKFLOW_LABEL;
  persona: string;
  gender: "male" | "female";
  voice: string;
  language: string;
  version: string;
  lastTrained: string;
  metrics: { calls: number; connectRate: number; intentAccuracy: number; bookingRate: number };
  knowledge: unknown[]; // only .length is used, for the header's kbItems count
}

// ---- Seeded RNG so "random" fields are stable per segment across reloads,
// not just per render. Seeded off segment.id, not real entropy. ----
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

const LANGUAGES = ["Bhopali Hindi", "Hindi", "Hinglish"];
const VERSIONS = ["v1.0", "v1.8", "v2.1-beta", "v3.5", "v4.2", "v6.0"];
const STATUSES: AgentStatus[] = ["live", "training", "draft"];
const WORKFLOW_KEYS = Object.keys(WORKFLOW_LABEL) as (keyof typeof WORKFLOW_LABEL)[];
const VOICES = [
  { voice: "coral", gender: "female" as const },
  { voice: "ash", gender: "male" as const },
];

function randomizedFieldsFor(segmentId: number) {
  const rng = mulberry32(segmentId);
  const daysAgo = randInt(rng, 1, 60);
  const trained = new Date();
  trained.setDate(trained.getDate() - daysAgo);

  return {
    status: randPick(rng, STATUSES),
    workflow: randPick(rng, WORKFLOW_KEYS),
    language: randPick(rng, LANGUAGES),
    version: randPick(rng, VERSIONS),
    lastTrained: trained.toISOString().slice(0, 10),
    voicePick: randPick(rng, VOICES),
    metrics: {
      calls: randInt(rng, 150, 5000),
      connectRate: randInt(rng, 40, 90),
      intentAccuracy: randInt(rng, 60, 98),
      bookingRate: randInt(rng, 10, 50),
    },
    knowledgeCount: randInt(rng, 0, 15),
  };
}

export const Route = createFileRoute("/_app/agents/")({
  loader: async () => {
    const [segmentsRes, settingsRes] = await Promise.all([
      fetch(`${API_BASE}/api/segments/`),
      fetch(`${API_BASE}/api/llm-settings/`),
    ]);
    if (!segmentsRes.ok) throw notFound();

    const { segments }: { segments: Segment[] } = await segmentsRes.json();
    const { settings }: { settings: LLMSettingSummary[] } = settingsRes.ok
      ? await settingsRes.json()
      : { settings: [] };

    const settingBySegmentId = new Map(settings.map((s) => [s.segment.id, s]));

    const agents: AgentCard[] = segments.map((seg) => {
      const r = randomizedFieldsFor(seg.id);
      const setting = settingBySegmentId.get(seg.id);

      return {
        id: seg.slug,
        name: seg.name,
        description: seg.description,
        status: r.status,
        workflow: r.workflow,
        // persona/voice/gender come from the real LLMSetting when one
        // exists for this segment; otherwise fall back to the same
        // seeded pool as everything else on the card.
        persona: setting?.persona_name ?? "Aarohi",
        gender: (setting?.voice.gender as "male" | "female") ?? r.voicePick.gender,
        voice: setting?.voice.voice_name ?? r.voicePick.voice,
        language: r.language,
        version: r.version,
        lastTrained: r.lastTrained,
        metrics: r.metrics,
        knowledge: Array.from({ length: r.knowledgeCount }),
      };
    });

    return { agents };
  },
  head: () => ({
    meta: [
      { title: "AI Agent Training — Triosoft" },
      { name: "description", content: "Train and fine-tune AI calling agents for sales, service, insurance and AMC workflows." },
      { property: "og:title", content: "AI Agent Training — Triosoft" },
      { property: "og:description", content: "Configure persona, conversation flow, knowledge and guardrails for every calling workflow." },
    ],
  }),
  component: AgentsPage,
});

const STATUS_STYLE: Record<AgentStatus, string> = {
  live: "bg-[color:var(--success)]/12 text-[color:var(--success)] border-[color:var(--success)]/30",
  training: "bg-[color:var(--ai)]/12 text-[color:var(--ai)] border-[color:var(--ai)]/30",
  draft: "bg-secondary text-muted-foreground",
  paused: "bg-secondary text-muted-foreground",
};

function AgentsPage() {
  const { agents } = Route.useLoaderData();

  const live = agents.filter((a) => a.status === "live").length;
  const totalCalls = agents.reduce((s, a) => s + a.metrics.calls, 0);
  const avgAccuracy = Math.round(
    agents.filter((a) => a.metrics.intentAccuracy > 0).reduce((s, a) => s + a.metrics.intentAccuracy, 0) /
    agents.filter((a) => a.metrics.intentAccuracy > 0).length,
  );
  const kbItems = agents.reduce((s, a) => s + a.knowledge.length, 0);

  return (
    <>
      <PageHeader
        title="AI Agent Training"
        description="Fine-tune persona, conversation flow, knowledge and guardrails for each calling workflow."
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link to="/agents/training"><GraduationCap className="size-4" /> Training data</Link>
            </Button>
            <Button size="sm"><Sparkles className="size-4" /> New agent</Button>
          </div>
        }
      />

      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Agents live", value: `${live} / ${agents.length}`, icon: Bot },
            { label: "Calls handled", value: formatNumber(totalCalls), icon: GitBranch },
            { label: "Avg intent accuracy", value: `${avgAccuracy}%`, icon: ShieldCheck },
            { label: "Knowledge sources", value: String(kbItems), icon: BookOpen },
          ].map((k) => (
            <Card key={k.label}>
              <CardContent className="pt-6 flex items-center gap-3">
                <div className="size-9 rounded-lg bg-primary/10 text-primary grid place-items-center">
                  <k.icon className="size-4" />
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{k.label}</div>
                  <div className="text-xl font-semibold font-display tabular-nums">{k.value}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {agents.map((a) => (
            <Link key={a.id} to="/agents/$agentId" params={{ agentId: a.id }}>
              <Card className="h-full hover:shadow-md hover:border-primary/40 transition-all group">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-display font-semibold">{a.name}</span>
                        <Badge variant="outline" className={STATUS_STYLE[a.status]}>{a.status}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{a.description}</div>
                    </div>
                    <div className="size-9 shrink-0 rounded-lg bg-primary/10 text-primary grid place-items-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <Bot className="size-4" />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 text-[10px]">
                    <span className="rounded-full bg-secondary px-2 py-0.5">{WORKFLOW_LABEL[a.workflow]}</span>
                    <span className="rounded-full bg-secondary px-2 py-0.5">
                      {a.persona} • {a.gender === "male" ? "♂" : "♀"} {a.voice}
                    </span>
                    <span className="rounded-full bg-secondary px-2 py-0.5">{a.language}</span>
                    <span className="rounded-full bg-secondary px-2 py-0.5">{a.version}</span>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Intent accuracy</span>
                      <span className="tabular-nums">{a.metrics.intentAccuracy}%</span>
                    </div>
                    <Progress value={a.metrics.intentAccuracy} className="h-1.5 mt-1" />
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                      { l: "Calls", v: formatNumber(a.metrics.calls) },
                      { l: "Connect", v: `${a.metrics.connectRate}%` },
                      { l: "Booked", v: `${a.metrics.bookingRate}%` },
                    ].map((m) => (
                      <div key={m.l} className="rounded-md border p-2">
                        <div className="text-[10px] uppercase text-muted-foreground">{m.l}</div>
                        <div className="text-sm font-semibold tabular-nums">{m.v}</div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Trained {a.lastTrained}</span>
                    <span className="flex items-center gap-1 text-primary font-medium">
                      Configure <ArrowRight className="size-3" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { PageHeader } from "@/components/layout/AppShell";

import { WORKFLOW_LABEL, type AgentStatus } from "@/mocks/agents";

import { Card, CardContent } from "@/components/ui/card";

import { Button } from "@/components/ui/button";

import { Badge } from "@/components/ui/badge";

import { Progress } from "@/components/ui/progress";

import {
  Bot,
  ArrowRight,
  Sparkles,
  BookOpen,
  ShieldCheck,
  GitBranch,
  GraduationCap,
} from "lucide-react";

import { formatNumber } from "@/lib/format";

// ======================================================
// API
// ======================================================

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

// ======================================================
// API TYPES
// ======================================================

interface Segment {
  id: number;
  name: string;
  description: string;
}

interface LLMSettingSummary {
  segment: {
    id: number;
  };

  persona_name: string;

  voice: {
    voice_name: string;
    gender: string;
  };
}

// ======================================================
// VIEW MODEL
// ======================================================

interface AgentCard {
  id: string;

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

  metrics: {
    calls: number;
    connectRate: number;
    intentAccuracy: number;
    bookingRate: number;
  };

  knowledge: unknown[];
}

// ======================================================
// SEEDED RANDOM
// ======================================================

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
// CONSTANTS
// ======================================================

const LANGUAGES = ["Bhopali Hindi", "Hindi", "Hinglish"];

const VERSIONS = ["v1.0", "v1.8", "v2.1-beta", "v3.5", "v4.2", "v6.0"];

const STATUSES: AgentStatus[] = ["live", "training", "draft"];

const WORKFLOW_KEYS = Object.keys(WORKFLOW_LABEL) as (keyof typeof WORKFLOW_LABEL)[];

const VOICES = [
  {
    voice: "coral",
    gender: "female" as const,
  },
  {
    voice: "ash",
    gender: "male" as const,
  },
];

// ======================================================
// RANDOMIZED DEMO FIELDS
// ======================================================

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

// ======================================================
// STATUS STYLES
// ======================================================

const STATUS_STYLE: Record<AgentStatus, string> = {
  live: "bg-[color:var(--success)]/12 text-[color:var(--success)] border-[color:var(--success)]/30",

  training: "bg-[color:var(--ai)]/12 text-[color:var(--ai)] border-[color:var(--ai)]/30",

  draft: "bg-secondary text-muted-foreground",

  paused: "bg-secondary text-muted-foreground",
};

// ======================================================
// PAGE
// ======================================================

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentCard[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  // ====================================================
  // LOAD AGENTS
  // ====================================================

  useEffect(() => {
    let cancelled = false;

    async function loadAgents() {
      try {
        setLoading(true);
        setError(null);

        const [segmentsRes, settingsRes] = await Promise.all([
          fetch(`${API_BASE}/api/segments/`),

          fetch(`${API_BASE}/api/llm-settings/`),
        ]);

        // ----------------------------------------------
        // SEGMENTS ERROR
        // ----------------------------------------------

        if (!segmentsRes.ok) {
          throw new Error(`Failed to load segments (${segmentsRes.status})`);
        }

        // ----------------------------------------------
        // SEGMENTS
        // ----------------------------------------------

        const {
          segments,
        }: {
          segments: Segment[];
        } = await segmentsRes.json();

        // ----------------------------------------------
        // SETTINGS
        // ----------------------------------------------

        let settings: LLMSettingSummary[] = [];

        if (settingsRes.ok) {
          const data = await settingsRes.json();

          settings = data.settings ?? [];
        }

        // ----------------------------------------------
        // MAP SETTINGS
        // ----------------------------------------------

        const settingBySegmentId = new Map(
          settings.map((setting) => [setting.segment.id, setting]),
        );

        // ----------------------------------------------
        // CREATE AGENTS
        // ----------------------------------------------

        const mappedAgents: AgentCard[] = segments.map((segment) => {
          const randomized = randomizedFieldsFor(segment.id);

          const setting = settingBySegmentId.get(segment.id);

          return {
            id: String(segment.id),

            name: segment.name,

            description: segment.description,

            status: randomized.status,

            workflow: randomized.workflow,

            persona: setting?.persona_name ?? "Aarohi",

            gender: (setting?.voice?.gender as "male" | "female") ?? randomized.voicePick.gender,

            voice: setting?.voice?.voice_name ?? randomized.voicePick.voice,

            language: randomized.language,

            version: randomized.version,

            lastTrained: randomized.lastTrained,

            metrics: randomized.metrics,

            knowledge: Array.from({
              length: randomized.knowledgeCount,
            }),
          };
        });

        if (!cancelled) {
          setAgents(mappedAgents);
        }
      } catch (err) {
        console.error("Failed to load AI agents:", err);

        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load AI agents");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadAgents();

    return () => {
      cancelled = true;
    };
  }, []);

  // ====================================================
  // METRICS
  // ====================================================

  const live = agents.filter((agent) => agent.status === "live").length;

  const totalCalls = agents.reduce((sum, agent) => sum + agent.metrics.calls, 0);

  const accuracyAgents = agents.filter((agent) => agent.metrics.intentAccuracy > 0);

  const avgAccuracy =
    accuracyAgents.length > 0
      ? Math.round(
          accuracyAgents.reduce((sum, agent) => sum + agent.metrics.intentAccuracy, 0) /
            accuracyAgents.length,
        )
      : 0;

  const kbItems = agents.reduce((sum, agent) => sum + agent.knowledge.length, 0);

  // ====================================================
  // LOADING
  // ====================================================

  if (loading) {
    return (
      <>
        <PageHeader
          title="AI Agent Training"
          description="Fine-tune persona, conversation flow, knowledge and guardrails for each calling workflow."
        />

        <div className="p-4 md:p-6 lg:p-8">
          <div className="flex min-h-[300px] items-center justify-center">
            <div className="text-sm text-muted-foreground">Loading AI agents...</div>
          </div>
        </div>
      </>
    );
  }

  // ====================================================
  // ERROR
  // ====================================================

  if (error) {
    return (
      <>
        <PageHeader
          title="AI Agent Training"
          description="Fine-tune persona, conversation flow, knowledge and guardrails for each calling workflow."
        />

        <div className="p-4 md:p-6 lg:p-8">
          <Card>
            <CardContent className="py-12 text-center">
              <div className="text-sm font-medium text-destructive">Failed to load AI agents</div>

              <p className="mt-2 text-xs text-muted-foreground">{error}</p>

              <Button className="mt-4" variant="outline" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  // ====================================================
  // RENDER
  // ====================================================

  return (
    <>
      <PageHeader
        title="AI Agent Training"
        description="Fine-tune persona, conversation flow, knowledge and guardrails for each calling workflow."
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link to="/agents/training">
                <GraduationCap className="size-4" />
                Training data
              </Link>
            </Button>

            <Button size="sm">
              <Sparkles className="size-4" />
              New agent
            </Button>
          </div>
        }
      />

      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        {/* ==================================================
            SUMMARY CARDS
        ================================================== */}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "Agents live",
              value: `${live} / ${agents.length}`,
              icon: Bot,
            },

            {
              label: "Calls handled",
              value: formatNumber(totalCalls),
              icon: GitBranch,
            },

            {
              label: "Avg intent accuracy",
              value: `${avgAccuracy}%`,
              icon: ShieldCheck,
            },

            {
              label: "Knowledge sources",
              value: String(kbItems),
              icon: BookOpen,
            },
          ].map((item) => (
            <Card key={item.label}>
              <CardContent className="pt-6 flex items-center gap-3">
                <div className="size-9 rounded-lg bg-primary/10 text-primary grid place-items-center">
                  <item.icon className="size-4" />
                </div>

                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {item.label}
                  </div>

                  <div className="text-xl font-semibold font-display tabular-nums">
                    {item.value}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ==================================================
            EMPTY STATE
        ================================================== */}

        {agents.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Bot className="mx-auto size-8 text-muted-foreground" />

              <h3 className="mt-4 text-base font-semibold">No AI agents found</h3>

              <p className="mt-1 text-sm text-muted-foreground">
                Create a segment first to configure an AI agent.
              </p>
            </CardContent>
          </Card>
        ) : (
          /* ==================================================
             AGENT CARDS
          ================================================== */

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {agents.map((agent) => (
              <Link key={agent.id} to={`/agents/${agent.id}`} className="block">
                <Card className="h-full hover:shadow-md hover:border-primary/40 transition-all group">
                  <CardContent className="pt-6 space-y-4">
                    {/* --------------------------------------
                        HEADER
                    -------------------------------------- */}

                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-display font-semibold">{agent.name}</span>

                          <Badge variant="outline" className={STATUS_STYLE[agent.status]}>
                            {agent.status}
                          </Badge>
                        </div>

                        <div className="text-xs text-muted-foreground mt-1">
                          {agent.description}
                        </div>
                      </div>

                      <div className="size-9 shrink-0 rounded-lg bg-primary/10 text-primary grid place-items-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <Bot className="size-4" />
                      </div>
                    </div>

                    {/* --------------------------------------
                        TAGS
                    -------------------------------------- */}

                    <div className="flex flex-wrap gap-1.5 text-[10px]">
                      <span className="rounded-full bg-secondary px-2 py-0.5">
                        {WORKFLOW_LABEL[agent.workflow]}
                      </span>

                      <span className="rounded-full bg-secondary px-2 py-0.5">
                        {agent.persona} • {agent.gender === "male" ? "♂" : "♀"} {agent.voice}
                      </span>

                      <span className="rounded-full bg-secondary px-2 py-0.5">
                        {agent.language}
                      </span>

                      <span className="rounded-full bg-secondary px-2 py-0.5">{agent.version}</span>
                    </div>

                    {/* --------------------------------------
                        INTENT ACCURACY
                    -------------------------------------- */}

                    <div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Intent accuracy</span>

                        <span className="tabular-nums">{agent.metrics.intentAccuracy}%</span>
                      </div>

                      <Progress value={agent.metrics.intentAccuracy} className="h-1.5 mt-1" />
                    </div>

                    {/* --------------------------------------
                        METRICS
                    -------------------------------------- */}

                    <div className="grid grid-cols-3 gap-2 text-center">
                      {[
                        {
                          label: "Calls",
                          value: formatNumber(agent.metrics.calls),
                        },

                        {
                          label: "Connect",
                          value: `${agent.metrics.connectRate}%`,
                        },

                        {
                          label: "Booked",
                          value: `${agent.metrics.bookingRate}%`,
                        },
                      ].map((metric) => (
                        <div key={metric.label} className="rounded-md border p-2">
                          <div className="text-[10px] uppercase text-muted-foreground">
                            {metric.label}
                          </div>

                          <div className="text-sm font-semibold tabular-nums">{metric.value}</div>
                        </div>
                      ))}
                    </div>

                    {/* --------------------------------------
                        FOOTER
                    -------------------------------------- */}

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Trained {agent.lastTrained}</span>

                      <span className="flex items-center gap-1 text-primary font-medium">
                        Configure
                        <ArrowRight className="size-3" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

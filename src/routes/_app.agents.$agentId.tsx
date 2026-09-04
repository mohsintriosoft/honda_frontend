import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";

import Loader from "@/components/layout/Loader";
import { PageHeader } from "@/components/layout/AppShell";
import { getAgent, WORKFLOW_LABEL, TEST_UTTERANCES } from "@/mocks/agents";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";

import { ArrowLeft, Save, AlertCircle, ExternalLink } from "lucide-react";

import { formatNumber } from "@/lib/format";
import {
  server_get_data,
  server_patch_data,
  get_llm_settings,
  get_tts_voices,
  get_agent_knowledge,
} from "@/components/ServiceConnection/serviceconnection";
import { handleError } from "@/components/CommonJquery/CommonJquery";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface TTSVoice {
  id: number;
  voice_name: string;
  gender: string;
  provider_id: number | string;
  provider_name: string;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface LLMSetting {
  id: number;
  dealer_id: number;   // NEW
  module: string;        // NEW

  segment: {
    id: number;
    name: string;
    description: string;
    created_at: string | null;
    updated_at: string | null;
  };

  persona_name: string;
  opening_line: string;
  system_prompt: string;
  behaviour: string | null;

  voice: TTSVoice;

  tone: number;
  pace: number;
  barge_in_threshold: number;
  max_turns: number;
  allow_customer_barge_in: boolean;

  created_at: string | null;
  updated_at: string | null;
}

export interface AgentExtras {
  status: string;
  workflow: keyof typeof WORKFLOW_LABEL;
  language: string;
  version: string;
  lastTrained: string;
  goal: string;

  flow: any[];
  knowledge: any[];
  intents: any[];

  metrics: {
    calls: number;
    connectRate: number;
    intentAccuracy: number;
    bookingRate: number;
  };

  openingLine: string;
}

type AgentData = AgentExtras & {
  name: string;
  description: string;
};

/* -------------------------------------------------------------------------- */
/* Default data                                                               */
/* -------------------------------------------------------------------------- */

const DEFAULT_EXTRAS: AgentExtras = {
  status: "draft",

  workflow: Object.keys(WORKFLOW_LABEL)[0] as keyof typeof WORKFLOW_LABEL,

  language: "Hindi",
  version: "v1.0",
  lastTrained: "—",

  goal: "Not yet configured",

  flow: [],
  knowledge: [],
  intents: [],

  metrics: {
    calls: 0,
    connectRate: 0,
    intentAccuracy: 0,
    bookingRate: 0,
  },

  openingLine: "",
};

/* -------------------------------------------------------------------------- */
/* Knowledge — read-only, via segments (docs §9.9)                           */
/* -------------------------------------------------------------------------- */
/*
 * Editing knowledge NEVER happens inside an agent. This page only shows the
 * collections reachable through the agent's segments (GET /api/agents/{id}
 * /knowledge/) and links out to the Knowledge module, which is the single
 * place writes happen and the single place can_edit_knowledge is enforced.
 */

export interface AgentKnowledgeCollection {
  id: number;
  name: string;
  slug: string;
  doc_count: number;
  chunk_count: number;
  segments: string[]; // segment names this collection is tagged to
}

/* -------------------------------------------------------------------------- */
/* Main Component                                                             */
/* -------------------------------------------------------------------------- */

export default function AgentDetail() {
  const { agentId } = useParams<{ agentId: string }>();

  const [agent, setAgent] = useState<AgentData | null>(null);
  const [setting, setSetting] = useState<LLMSetting | null>(null);
  const [voices, setVoices] = useState<TTSVoice[]>([]);

  const [ShowLoaderAdmin, setShowLoaderAdmin] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  /* ---------------------------------------------------------------------- */
  /* Load agent (settings + voices), DashboardWow / AgentsPage style         */
  /* ---------------------------------------------------------------------- */

  const master_data_get = async () => {
    if (!agentId) {
      setErrorMsg("Agent ID is missing.");
      setShowLoaderAdmin(false);
      return;
    }

    setShowLoaderAdmin(true);
    setErrorMsg(null);

    try {
      const settingRes = await server_get_data(`${get_llm_settings}${agentId}/`);
      const setting_data: LLMSetting | undefined = settingRes?.setting;

      if (!setting_data) {
        handleError("Failed to load agent");
        setErrorMsg("Invalid agent response.");
        setShowLoaderAdmin(false);
        return;
      }

      let voices_data: TTSVoice[] = [];
      try {
        const voicesRes = await server_get_data(get_tts_voices);
        voices_data = Array.isArray(voicesRes?.voices) ? voicesRes.voices : [];
      } catch {
        // voices are optional, fall back to empty list silently
      }

      const mockExtras = getAgent(agentId) ?? DEFAULT_EXTRAS;

      const agentData: AgentData = {
        ...mockExtras,
        name: setting_data.segment.name,
        description: setting_data.segment.description,
      };

      setAgent(agentData);
      setSetting(setting_data);
      setVoices(voices_data);
    } catch (error) {
      console.error("Failed to load agent:", error);
      handleError("network");
      setErrorMsg("Failed to load this agent. Please check the agent ID and try again.");
    } finally {
      setShowLoaderAdmin(false);
    }
  };

  useEffect(() => {
    master_data_get();
  }, [agentId]);

  /* ---------------------------------------------------------------------- */
  /* Loading                                                                */
  /* ---------------------------------------------------------------------- */

  if (ShowLoaderAdmin) {
    return <Loader />;
  }

  /* ---------------------------------------------------------------------- */
  /* Error                                                                  */
  /* ---------------------------------------------------------------------- */

  if (errorMsg || !agent || !setting) {
    return (
      <div className="p-4 md:p-6 lg:p-8">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 rounded-full bg-destructive/10 p-3">
              <AlertCircle className="size-6 text-destructive" />
            </div>

            <h2 className="text-lg font-semibold">Agent not found</h2>

            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              {errorMsg ??
                "Unable to load this agent. Please check the agent ID and API connection."}
            </p>

            <div className="mt-5 flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => master_data_get()}>
                Retry
              </Button>

              <Button asChild variant="outline" size="sm">
                <Link to="/agents">
                  <ArrowLeft className="size-4" />
                  Back to Agents
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <AgentDetailContent
      agentId={agentId ?? ""}
      agent={agent}
      setting={setting}
      voices={voices}
      onSaved={master_data_get}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Agent Detail Content                                                       */
/* -------------------------------------------------------------------------- */

function AgentDetailContent({
  agentId,
  agent,
  setting,
  voices,
  onSaved,
}: {
  agentId: string;
  agent: AgentData;
  setting: LLMSetting;
  voices: TTSVoice[];
  onSaved: () => void;
}) {
  /* ---------------------------------------------------------------------- */
  /* State                                                                  */
  /* ---------------------------------------------------------------------- */

  const [personaName, setPersonaName] = useState(setting.persona_name);

  const [voiceId, setVoiceId] = useState(setting.voice.id);

  const [openingLine, setOpeningLine] = useState(setting.opening_line);

  const [systemPrompt, setSystemPrompt] = useState(setting.system_prompt);

  const [tone, setTone] = useState(setting.tone);

  const [pace, setPace] = useState(setting.pace);

  const [maxTurns, setMaxTurns] = useState(setting.max_turns);

  const [allowInterrupt, setAllowInterrupt] = useState(setting.allow_customer_barge_in);

  const [testInput, setTestInput] = useState("");

  const [saving, setSaving] = useState(false);

  const selectedVoice = voices.find((voice) => voice.id === voiceId) ?? setting.voice;

  /* ---------------------------------------------------------------------- */
  /* Knowledge tab — read only, via segments (docs §9.9)                    */
  /* ---------------------------------------------------------------------- */

  const [agentKnowledge, setAgentKnowledge] = useState<AgentKnowledgeCollection[]>([]);
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);
  const [knowledgeError, setKnowledgeError] = useState<string | null>(null);

  async function loadAgentKnowledge() {
    setKnowledgeLoading(true);
    setKnowledgeError(null);
    try {
      const res = await server_get_data(get_agent_knowledge(agentId));
      setAgentKnowledge(Array.isArray(res?.collections) ? res.collections : []);
    } catch (error) {
      console.error("Failed to load agent knowledge:", error);
      handleError("network");
      setKnowledgeError("Unable to load knowledge for this agent.");
    } finally {
      setKnowledgeLoading(false);
    }
  }

  useEffect(() => {
    loadAgentKnowledge();
  }, [agentId]);

  /* ---------------------------------------------------------------------- */
  /* Save                                                                   */
  /* ---------------------------------------------------------------------- */

  async function handleSave() {
    if (!agentId) {
      return;
    }

    setSaving(true);

    try {
      await server_patch_data(`${get_llm_settings}${agentId}/`, {
        persona_name: personaName,
        voice_id: voiceId,
        opening_line: openingLine,
        system_prompt: systemPrompt,
        tone,
        pace,
        max_turns: maxTurns,
        allow_customer_barge_in: allowInterrupt,
      });

      onSaved();
    } catch (error) {
      console.error("Failed to save agent:", error);
      handleError("network");
    } finally {
      setSaving(false);
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Render                                                                 */
  /* ---------------------------------------------------------------------- */

  return (
    <>
      <PageHeader
        title={agent.name}
        description={agent.description}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/agents">
              <ArrowLeft className="size-4" />
              Back
            </Link>
          </Button>
        }
      />

      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        {/* ---------------------------------------------------------------- */}
        {/* Agent Meta                                                       */}
        {/* ---------------------------------------------------------------- */}

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline">{WORKFLOW_LABEL[agent.workflow]}</Badge>

          <Badge variant="outline">{agent.status}</Badge>

          <Badge variant="outline">{agent.language}</Badge>

          <Badge variant="outline">{agent.version}</Badge>

          <span className="text-muted-foreground">Trained {agent.lastTrained}</span>

          <Link to="/agents/recordings" className="text-primary font-medium hover:underline">
            Trained from 612 call recordings →
          </Link>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Metrics                                                          */}
        {/* ---------------------------------------------------------------- */}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              l: "Calls",
              v: formatNumber(agent.metrics.calls),
            },
            {
              l: "Connect rate",
              v: `${agent.metrics.connectRate}%`,
            },
            {
              l: "Intent accuracy",
              v: `${agent.metrics.intentAccuracy}%`,
            },
            {
              l: "Booking rate",
              v: `${agent.metrics.bookingRate}%`,
            },
          ].map((metric) => (
            <Card key={metric.l}>
              <CardContent className="pt-6">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {metric.l}
                </div>

                <div className="text-xl font-semibold font-display tabular-nums">{metric.v}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Tabs                                                             */}
        {/* ---------------------------------------------------------------- */}

        <Tabs defaultValue="persona">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="persona">Persona & Voice</TabsTrigger>

            <TabsTrigger value="flow">Conversation Flow</TabsTrigger>

            <TabsTrigger value="knowledge">Knowledge</TabsTrigger>

          </TabsList>

          {/* ============================================================ */}
          {/* PERSONA                                                       */}
          {/* ============================================================ */}

          <TabsContent value="persona" className="mt-4">
            <Card>
              <CardContent className="grid gap-8 pt-6 lg:grid-cols-2">
                {/* Identity column */}
                <div className="space-y-4">
                  <h3 className="text-base font-semibold">Identity</h3>

                  <div className="space-y-1.5">
                    <Label>Persona name</Label>

                    <Input
                      value={personaName}
                      onChange={(event) => setPersonaName(event.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Voice</Label>

                      <select
                        className="w-full h-9 rounded-md border px-3 text-sm bg-background"
                        value={voiceId}
                        onChange={(event) => setVoiceId(Number(event.target.value))}
                      >
                        {voices.length === 0 && (
                          <option value={setting.voice.id}>{setting.voice.voice_name}</option>
                        )}

                        {voices.map((voice) => (
                          <option key={voice.id} value={voice.id}>
                            {voice.voice_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Gender</Label>

                      <Input value={selectedVoice.gender} disabled />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Opening line</Label>

                    <Textarea
                      rows={3}
                      value={openingLine}
                      onChange={(event) => setOpeningLine(event.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>System prompt</Label>

                    <Textarea
                      rows={7}
                      value={systemPrompt}
                      onChange={(event) => setSystemPrompt(event.target.value)}
                    />
                  </div>
                </div>

                {/* Behaviour column */}
                <div className="space-y-6">
                  <h3 className="text-base font-semibold">Behaviour</h3>

                  {[
                    {
                      label: "Tone (formal → friendly)",
                      value: tone,
                      setValue: setTone,
                    },
                    {
                      label: "Pace (slow → fast)",
                      value: pace,
                      setValue: setPace,
                    },
                  ].map((item) => (
                    <div key={item.label} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <Label>{item.label}</Label>

                        <span className="tabular-nums text-muted-foreground">{item.value}</span>
                      </div>

                      <Slider
                        value={[item.value]}
                        max={100}
                        step={1}
                        onValueChange={(value) => item.setValue(value[0] ?? 0)}
                      />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="space-y-1.5">
                    <Label>Max turns</Label>

                    <Input
                      type="number"
                      value={maxTurns}
                      onChange={(event) => setMaxTurns(Number(event.target.value))}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <div className="text-sm font-medium">Interruptible</div>

                      <div className="text-xs text-muted-foreground">
                        Customer can barge in mid-sentence
                      </div>
                    </div>

                    <Switch checked={allowInterrupt} onCheckedChange={setAllowInterrupt} />
                  </div>
                </div>

                {/* Save action — spans both columns, sits after Interruptible */}
                <div className="flex justify-end lg:col-span-2">
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    <Save className="size-4" />

                    {saving ? "Saving..." : "Save changes"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============================================================ */}
          {/* FLOW                                                           */}
          {/* ============================================================ */}

          <TabsContent value="flow" className="mt-4 space-y-3">
            <div className="text-sm text-muted-foreground">Goal: {agent.goal}</div>

            {agent.flow.length === 0 && (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  No conversation flow configured.
                </CardContent>
              </Card>
            )}

            {agent.flow.map((step: any, index: number) => (
              <Card key={step.id ?? index}>
                <CardContent className="pt-6 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="size-6 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-semibold">
                      {index + 1}
                    </span>

                    <span className="font-medium">{step.label}</span>

                    <span className="text-xs text-muted-foreground">— {step.goal}</span>
                  </div>

                  <div className="rounded-md bg-secondary p-3 text-sm">{step.say}</div>

                  <div className="flex flex-wrap gap-1.5">
                    {(step.branches ?? []).map(
                      (
                        branch: {
                          on: string;
                          next: string;
                        },
                        branchIndex: number,
                      ) => (
                        <span
                          key={`${branch.on}-${branchIndex}`}
                          className="rounded-full border px-2 py-0.5 text-[11px]"
                        >
                          {branch.on} → {branch.next}
                        </span>
                      ),
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* ============================================================ */}
          {/* KNOWLEDGE                                                      */}
          {/* ============================================================ */}

          <TabsContent value="knowledge" className="mt-4 space-y-4">
            {/*
              Read-only, per docs §9.9: "The Edit action navigates to the
              Knowledge module. Editing never happens inside an agent, so
              there is exactly one place where knowledge changes — and one
              permission (can_edit_knowledge) guarding it."
            */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Collections reachable through this agent's segments.
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link to="/knowledge">
                  Edit in Knowledge
                  <ExternalLink className="size-3.5" />
                </Link>
              </Button>
            </div>

            {knowledgeLoading && (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  Loading knowledge…
                </CardContent>
              </Card>
            )}

            {!knowledgeLoading && knowledgeError && (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  {knowledgeError}
                </CardContent>
              </Card>
            )}

            {!knowledgeLoading && !knowledgeError && agentKnowledge.length === 0 && (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  No knowledge collections are tagged to this agent's segments yet.
                </CardContent>
              </Card>
            )}

            {!knowledgeLoading &&
              !knowledgeError &&
              agentKnowledge.map((collection) => (
                <Card key={collection.id}>
                  <CardContent className="pt-6 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="font-medium text-sm">{collection.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {collection.doc_count} docs · {collection.chunk_count} chunks
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {collection.segments.map((segmentName) => (
                          <Badge key={segmentName} variant="outline">
                            {segmentName}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </TabsContent>
        </Tabs>
      </div >
    </>
  );
}
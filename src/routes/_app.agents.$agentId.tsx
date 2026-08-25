import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getAgent, WORKFLOW_LABEL, TEST_UTTERANCES } from "../mocks/agents";

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

import { ArrowLeft, Save, Sparkles, AlertCircle } from "lucide-react";

import { formatNumber } from "../lib/format";
import Loader from "@/components/layout/Loader";
import {
  server_post_data,
  get_llm_settings,
  get_tts_voices,
  update_llm_setting,
} from "@/components/ServiceConnection/serviceconnection";
import { handleError } from "@/components/CommonJquery/CommonJquery";

/* -------------------------------------------------------------------------- */
/* Default data                                                               */
/* -------------------------------------------------------------------------- */

const DEFAULT_EXTRAS = {
  status: "draft",
  workflow: Object.keys(WORKFLOW_LABEL)[0],
  language: "Hindi",
  version: "v1.0",
  lastTrained: "—",
  persistence: 50,
  callWindow: "9:00 AM – 7:00 PM",
  retryPolicy: "Retry once after 2 hours",
  goal: "Not yet configured",
  flow: [],
  knowledge: [],
  objections: [],
  intents: [],
  guardrails: [],
  escalation: [],
  metrics: {
    calls: 0,
    connectRate: 0,
    intentAccuracy: 0,
    bookingRate: 0,
  },
  openingLine: "",
};

/* -------------------------------------------------------------------------- */
/* Main Component                                                             */
/* -------------------------------------------------------------------------- */

export default function AgentDetail() {
  const { agentId } = useParams();

  const [agent, setAgent] = useState(null);
  const [setting, setSetting] = useState(null);
  const [voices, setVoices] = useState([]);

  const [ShowLoaderAdmin, setShowLoaderAdmin] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  const master_data_get = async () => {
    if (!agentId) {
      setErrorMsg("Agent ID is missing.");
      setShowLoaderAdmin(false);
      return;
    }

    setShowLoaderAdmin(true);
    setErrorMsg(null);

    let formdata = new FormData();
    formdata.append("agent_id", agentId);

    await server_post_data(get_llm_settings + agentId + "/", formdata)
      .then(async (Response) => {
        let data = Response.message.split("~@~");
        if (parseInt(data[0]) === 1) {
          handleError(data[1]);
          setErrorMsg(data[1]);
          setShowLoaderAdmin(false);
          return;
        }

        const parsed = JSON.parse(data[1]);
        const settingData = parsed.setting;

        if (!settingData) {
          setErrorMsg("Invalid agent response.");
          setShowLoaderAdmin(false);
          return;
        }

        // fetch voices, non-blocking on failure
        let voicesList = [];
        let voicesFormdata = new FormData();

        await server_post_data(get_tts_voices, voicesFormdata)
          .then((VoicesResponse) => {
            let voicesData = VoicesResponse.message.split("~@~");
            if (parseInt(voicesData[0]) !== 1) {
              const parsedVoices = JSON.parse(voicesData[1]);
              voicesList = Array.isArray(parsedVoices?.voices) ? parsedVoices.voices : [];
            }
          })
          .catch(() => {
            // voices are optional, ignore network errors here
          });

        const mockExtras = getAgent(agentId) ?? DEFAULT_EXTRAS;

        const agentData = {
          ...mockExtras,
          name: settingData.segment.name,
          description: settingData.segment.description,
        };

        setAgent(agentData);
        setSetting(settingData);
        setVoices(voicesList);
        setShowLoaderAdmin(false);
      })
      .catch((error) => {
        handleError("network");
        setErrorMsg("Failed to load agent.");
        setShowLoaderAdmin(false);
      });
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

            <Button asChild variant="outline" size="sm" className="mt-5">
              <Link to="/agents">
                <ArrowLeft className="size-4" />
                Back to Agents
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <AgentDetailContent agentId={agentId ?? ""} agent={agent} setting={setting} voices={voices} />
  );
}

/* -------------------------------------------------------------------------- */
/* Agent Detail Content                                                       */
/* -------------------------------------------------------------------------- */

function AgentDetailContent({ agentId, agent, setting, voices }) {
  /* ---------------------------------------------------------------------- */
  /* State                                                                  */
  /* ---------------------------------------------------------------------- */

  const [personaName, setPersonaName] = useState(setting.persona_name);
  const [voiceId, setVoiceId] = useState(setting.voice.id);
  const [openingLine, setOpeningLine] = useState(setting.opening_line);
  const [systemPrompt, setSystemPrompt] = useState(setting.system_prompt);
  const [tone, setTone] = useState(setting.tone);
  const [pace, setPace] = useState(setting.pace);
  const [persistence, setPersistence] = useState(agent.persistence);
  const [maxTurns, setMaxTurns] = useState(setting.max_turns);
  const [allowInterrupt, setAllowInterrupt] = useState(setting.allow_customer_barge_in);
  const [testInput, setTestInput] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedVoice = voices.find((voice) => voice.id === voiceId) ?? setting.voice;

  /* ---------------------------------------------------------------------- */
  /* Save                                                                   */
  /* ---------------------------------------------------------------------- */

  const handleSave = async () => {
    if (!agentId) {
      return;
    }

    setSaving(true);

    let formdata = new FormData();
    formdata.append("agent_id", agentId);
    formdata.append("persona_name", personaName);
    formdata.append("voice_id", voiceId);
    formdata.append("opening_line", openingLine);
    formdata.append("system_prompt", systemPrompt);
    formdata.append("tone", tone);
    formdata.append("pace", pace);
    formdata.append("max_turns", maxTurns);
    formdata.append("allow_customer_barge_in", allowInterrupt ? "1" : "0");

    await server_post_data(update_llm_setting, formdata)
      .then((Response) => {
        let data = Response.message.split("~@~");
        if (parseInt(data[0]) === 1) {
          handleError(data[1]);
        } else {
          console.log("Agent saved successfully");
        }
        setSaving(false);
      })
      .catch((error) => {
        handleError("network");
        setSaving(false);
      });
  };

  /* ---------------------------------------------------------------------- */
  /* Render                                                                 */
  /* ---------------------------------------------------------------------- */

  return (
    <>
      {saving && <Loader />}

      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        {/* ---------------------------------------------------------------- */}
        {/* Header                                                           */}
        {/* ---------------------------------------------------------------- */}

        <div className="d-flex justify-content-between align-items-center mb-24">
          <div>
            <h4 className="mb-0">{agent.name}</h4>
            <p className="text-secondary-light mb-0">{agent.description}</p>
          </div>

          <div className="d-flex align-items-center gap-2">
            <Link to="/agents" className="btn btn-outline-primary btn-sm">
              <ArrowLeft className="size-4 me-1" />
              Back
            </Link>

            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Save className="size-4" />
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </div>

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
            { l: "Calls", v: formatNumber(agent.metrics.calls) },
            { l: "Connect rate", v: `${agent.metrics.connectRate}%` },
            { l: "Intent accuracy", v: `${agent.metrics.intentAccuracy}%` },
            { l: "Booking rate", v: `${agent.metrics.bookingRate}%` },
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
            <TabsTrigger value="objections">Objections</TabsTrigger>
            <TabsTrigger value="intents">Intents</TabsTrigger>
            <TabsTrigger value="guardrails">Guardrails</TabsTrigger>
            <TabsTrigger value="test">Test console</TabsTrigger>
          </TabsList>

          {/* ============================================================ */}
          {/* PERSONA                                                       */}
          {/* ============================================================ */}

          <TabsContent value="persona" className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Identity</CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
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
              </CardContent>
            </Card>

            {/* Behaviour */}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Behaviour</CardTitle>
              </CardHeader>

              <CardContent className="space-y-6">
                {[
                  { label: "Tone (formal → friendly)", value: tone, setValue: setTone },
                  { label: "Pace (slow → fast)", value: pace, setValue: setPace },
                  { label: "Persistence", value: persistence, setValue: setPersistence },
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

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="space-y-1.5">
                    <Label>Max turns</Label>
                    <Input
                      type="number"
                      value={maxTurns}
                      onChange={(event) => setMaxTurns(Number(event.target.value))}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Call window</Label>
                    <Input defaultValue={agent.callWindow} />
                  </div>

                  <div className="space-y-1.5 col-span-2">
                    <Label>Retry policy</Label>
                    <Input defaultValue={agent.retryPolicy} />
                  </div>
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

            {agent.flow.map((step, index) => (
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
                    {(step.branches ?? []).map((branch, branchIndex) => (
                      <span
                        key={`${branch.on}-${branchIndex}`}
                        className="rounded-full border px-2 py-0.5 text-[11px]"
                      >
                        {branch.on} → {branch.next}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* ============================================================ */}
          {/* KNOWLEDGE                                                      */}
          {/* ============================================================ */}

          <TabsContent value="knowledge" className="mt-4 grid gap-3 md:grid-cols-2">
            {agent.knowledge.length === 0 && (
              <Card className="md:col-span-2">
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  No knowledge sources configured.
                </CardContent>
              </Card>
            )}

            {agent.knowledge.map((knowledge, index) => (
              <Card key={knowledge.id ?? index}>
                <CardContent className="pt-6 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm">{knowledge.title}</span>
                    <Badge variant="outline">{knowledge.status}</Badge>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    {knowledge.type} • {knowledge.chunks} chunks • updated {knowledge.updatedAt}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* ============================================================ */}
          {/* OBJECTIONS                                                     */}
          {/* ============================================================ */}

          <TabsContent value="objections" className="mt-4 space-y-3">
            {agent.objections.length === 0 && (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  No objections configured.
                </CardContent>
              </Card>
            )}

            {agent.objections.map((objection, index) => (
              <Card key={objection.id ?? index}>
                <CardContent className="pt-6 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-medium text-sm">{objection.trigger}</div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {objection.frequency}% of calls
                      </span>
                      <Switch defaultChecked={objection.enabled} />
                    </div>
                  </div>

                  <div className="rounded-md bg-secondary p-3 text-sm">{objection.response}</div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* ============================================================ */}
          {/* INTENTS                                                        */}
          {/* ============================================================ */}

          <TabsContent value="intents" className="mt-4 grid gap-3 md:grid-cols-2">
            {agent.intents.length === 0 && (
              <Card className="md:col-span-2">
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  No intents configured.
                </CardContent>
              </Card>
            )}

            {agent.intents.map((intent, index) => (
              <Card key={intent.id ?? index}>
                <CardContent className="pt-6 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{intent.intent}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {intent.accuracy}%
                    </span>
                  </div>

                  <Progress value={intent.accuracy} className="h-1.5" />

                  <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                    {(intent.utterances ?? []).map((utterance, utteranceIndex) => (
                      <li key={`${utterance}-${utteranceIndex}`}>{utterance}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* ============================================================ */}
          {/* GUARDRAILS                                                     */}
          {/* ============================================================ */}

          <TabsContent value="guardrails" className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Guardrails</CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                {agent.guardrails.length === 0 && (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    No guardrails configured.
                  </div>
                )}

                {agent.guardrails.map((guardrail, index) => (
                  <div
                    key={guardrail.id ?? index}
                    className="flex items-start justify-between gap-3 rounded-md border p-3"
                  >
                    <div>
                      <div className="text-sm font-medium">{guardrail.label}</div>
                      <div className="text-xs text-muted-foreground">{guardrail.detail}</div>
                    </div>

                    <Switch defaultChecked={guardrail.enabled} />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Escalation rules</CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                {agent.escalation.length === 0 && (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    No escalation rules configured.
                  </div>
                )}

                {agent.escalation.map((rule, index) => (
                  <div
                    key={rule.id ?? index}
                    className="flex items-start justify-between gap-3 rounded-md border p-3"
                  >
                    <div>
                      <div className="text-sm font-medium">{rule.when}</div>
                      <div className="text-xs text-muted-foreground">{rule.action}</div>
                    </div>

                    <Switch defaultChecked={rule.enabled} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============================================================ */}
          {/* TEST                                                           */}
          {/* ============================================================ */}

          <TabsContent value="test" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Test console</CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="rounded-md bg-secondary p-3 text-sm">
                  {agent.openingLine || setting.opening_line || "No opening line configured."}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {(TEST_UTTERANCES[agent.workflow] ?? []).map((utterance) => (
                    <button
                      key={utterance}
                      type="button"
                      onClick={() => setTestInput(utterance)}
                      className="rounded-full border px-2.5 py-1 text-xs hover:bg-secondary"
                    >
                      {utterance}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Input
                    value={testInput}
                    onChange={(event) => setTestInput(event.target.value)}
                    placeholder="Type a customer utterance…"
                  />

                  <Button
                    size="sm"
                    type="button"
                    onClick={() => {
                      console.log("Test utterance:", testInput);
                    }}
                  >
                    <Sparkles className="size-4" />
                    Run
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground">
                  Simulation runs against {agent.version} with the current persona settings.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

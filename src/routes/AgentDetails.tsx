import { Link, useParams } from "react-router-dom";
import {
  useEffect,
  useState,
  useRef,
  forwardRef,
  useImperativeHandle,
  type DragEvent,
} from "react";
import Loader from "@/components/layout/Loader";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

import {
  ArrowLeft,
  Save,
  AlertCircle,
  ExternalLink,
  Plus,
  Trash2,
  GripVertical,
} from "lucide-react";

import {
  server_get_data,
  server_patch_data,
  server_post_json,
  get_llm_settings,
  get_tts_voices,
  get_agent_knowledge,
  get_branches,
  patch_segment,
  get_provider_settings,
  post_provider_settings,
} from "@/components/ServiceConnection/serviceconnection";
import { handleError } from "@/components/CommonJquery/CommonJquery";
import { cn } from "@/lib/utils";

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

export interface SegmentSummary {
  id: number;
  name: string;
  description: string | null;
  match_service_type?: string | null;
  days_before?: number;
  days_after?: number;
  opening_line?: string;
  closing_line?: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface LLMSetting {
  id: number;
  dealer_id: number;
  module: string;

  segment: {
    id: number | null;
    name: string;
    description: string;
    created_at: string | null;
    updated_at: string | null;
  };
  segments: SegmentSummary[];

  persona_name: string;
  system_prompt: string;
  behaviour: string | null;

  voice: TTSVoice | null;

  tone: number;
  pace: number;
  barge_in_threshold: number;
  max_turns: number;
  allow_customer_barge_in: boolean;

  created_at: string | null;
  updated_at: string | null;
}

export interface AgentKnowledgeDocument {
  doc_id: string;
  title: string;
  category: string;
  segment_id: number | null;
  segment_ids?: number[];
  is_global: boolean;
  branch_ids: number[];
  status: string;
  chunk_count: number;
  indexed_at: string | null;
}

type SegmentLineField = "opening_line" | "closing_line";

const isForbidden = (error: any) => error?.response?.status === 403;

/* -------------------------------------------------------------------------- */
/* Main Component                                                             */
/* -------------------------------------------------------------------------- */
/*
 * Route param is a SEGMENT id. Agents are configured per MODULE (docs
 * §10.3), so this finds the module-wide LLMSetting serving this segment.
 */

export default function AgentDetail() {
  const { agentId: segmentId } = useParams<{ agentId: string }>();

  const [setting, setSetting] = useState<LLMSetting | null>(null);
  const [voices, setVoices] = useState<TTSVoice[]>([]);

  const [ShowLoaderAdmin, setShowLoaderAdmin] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const master_data_get = async () => {
    if (!segmentId) {
      setErrorMsg("Segment ID is missing.");
      setShowLoaderAdmin(false);
      return;
    }

    setShowLoaderAdmin(true);
    setErrorMsg(null);

    try {
      const settingsRes = await server_get_data(get_llm_settings);
      const settings: LLMSetting[] = settingsRes?.settings ?? [];

      if (!settingsRes?.settings) {
        handleError("Failed to load agent");
        setErrorMsg("Failed to load agent settings.");
        return;
      }

      const matched = settings.find((s) =>
        (s.segments ?? []).some((seg) => String(seg.id) === segmentId),
      );

      if (!matched) {
        setErrorMsg("No AI agent has been configured for this segment's module yet.");
        return;
      }

      let voices_data: TTSVoice[] = [];
      try {
        const voicesRes = await server_get_data(get_tts_voices);
        voices_data = Array.isArray(voicesRes?.voices) ? voicesRes.voices : [];
      } catch {
        // voices are optional
      }

      setSetting(matched);
      setVoices(voices_data);
    } catch (error: any) {
      console.error("Failed to load agent:", error);
      if (isForbidden(error)) {
        setErrorMsg("Your role does not have permission to view this agent.");
      } else {
        handleError("network");
        setErrorMsg("Failed to load this agent. Please try again.");
      }
    } finally {
      setShowLoaderAdmin(false);
    }
  };

  useEffect(() => {
    master_data_get();
  }, [segmentId]);

  // Keep the loaded setting in sync after a save, without a full reload
  // (a reload unmounts the page, resets the tab and drops unsaved edits).
  const handleSegmentUpdated = (segId: number, field: SegmentLineField, value: string) => {
    setSetting((prev) =>
      prev
        ? {
            ...prev,
            segments: prev.segments.map((s) => (s.id === segId ? { ...s, [field]: value } : s)),
          }
        : prev,
    );
  };

  if (ShowLoaderAdmin) {
    return <Loader />;
  }

  if (errorMsg || !setting) {
    return (
      <div className="p-4 md:p-6 lg:p-8">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 rounded-full bg-destructive/10 p-3">
              <AlertCircle className="size-6 text-destructive" />
            </div>

            <h2 className="text-lg font-semibold">Agent not found</h2>

            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              {errorMsg ?? "Unable to load this agent. Please check the API connection."}
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
      segmentId={segmentId ?? ""}
      setting={setting}
      voices={voices}
      onSettingUpdated={setSetting}
      onSegmentUpdated={handleSegmentUpdated}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Agent Detail Content                                                       */
/* -------------------------------------------------------------------------- */

function AgentDetailContent({
  segmentId,
  setting,
  voices,
  onSettingUpdated,
  onSegmentUpdated,
}: {
  segmentId: string;
  setting: LLMSetting;
  voices: TTSVoice[];
  onSettingUpdated: (setting: LLMSetting) => void;
  onSegmentUpdated: (segId: number, field: SegmentLineField, value: string) => void;
}) {
  const [personaName, setPersonaName] = useState(setting.persona_name);
  const [voiceId, setVoiceId] = useState<number>(setting.voice?.id ?? voices[0]?.id ?? 0);
  const [systemPrompt, setSystemPrompt] = useState(setting.system_prompt);
  const [tone, setTone] = useState(setting.tone);
  const [pace, setPace] = useState(setting.pace);
  const [maxTurns, setMaxTurns] = useState(setting.max_turns);
  const [allowInterrupt, setAllowInterrupt] = useState(setting.allow_customer_barge_in);
  const [saving, setSaving] = useState(false);

  const selectedVoice = voices.find((voice) => voice.id === voiceId) ?? setting.voice ?? null;

  // ------------------------------------------------------------------
  // AI Backend — LLM / STT provider picker (Dealer-level setting).
  // NOTE: state/fetch exists but no JSX renders it yet.
  // ------------------------------------------------------------------
  type ProviderChoice = { value: string; label: string };

  const [llmProvider, setLlmProvider] = useState<string>("");
  const [sttProvider, setSttProvider] = useState<string>("");
  const [llmChoices, setLlmChoices] = useState<ProviderChoice[]>([]);
  const [sttChoices, setSttChoices] = useState<ProviderChoice[]>([]);
  const [initialProviders, setInitialProviders] = useState<{ llm: string; stt: string } | null>(
    null,
  );
  const [providerLoading, setProviderLoading] = useState(true);
  const [providerSaving, setProviderSaving] = useState(false);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [providerSaved, setProviderSaved] = useState(false);

  useEffect(() => {
    (async () => {
      setProviderLoading(true);
      setProviderError(null);
      try {
        const res = await server_get_data(get_provider_settings);
        setLlmProvider(res?.llm_provider ?? "");
        setSttProvider(res?.stt_provider ?? "");
        setLlmChoices(res?.llm_choices ?? []);
        setSttChoices(res?.stt_choices ?? []);
        setInitialProviders({ llm: res?.llm_provider ?? "", stt: res?.stt_provider ?? "" });
      } catch (error) {
        console.error("Failed to load provider settings:", error);
        setProviderError("Unable to load LLM/STT provider settings.");
      } finally {
        setProviderLoading(false);
      }
    })();
  }, []);

  const providersDirty =
    initialProviders !== null &&
    (llmProvider !== initialProviders.llm || sttProvider !== initialProviders.stt);

  async function handleSaveProviders() {
    setProviderSaving(true);
    setProviderError(null);
    setProviderSaved(false);
    try {
      const res = await server_post_json(post_provider_settings, {
        llm_provider: llmProvider,
        stt_provider: sttProvider,
      });
      if (res?.success === false) throw new Error(res?.error || "Save failed");
      setInitialProviders({ llm: llmProvider, stt: sttProvider });
      setProviderSaved(true);
      setTimeout(() => setProviderSaved(false), 2500);
    } catch (error) {
      console.error("Failed to save provider settings:", error);
      setProviderError("Failed to save LLM/STT provider settings.");
    } finally {
      setProviderSaving(false);
    }
  }

  const currentSegment = setting.segments.find((s) => String(s.id) === segmentId);

  /* ---------------------------------------------------------------------- */
  /* Knowledge tab — read only, via segments (docs §9.9)                    */
  /* ---------------------------------------------------------------------- */

  const [agentKnowledge, setAgentKnowledge] = useState<AgentKnowledgeDocument[]>([]);
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);
  const [knowledgeError, setKnowledgeError] = useState<string | null>(null);
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const branchesRes = await server_get_data(get_branches, { dealer_id: setting.dealer_id });
        setBranches(branchesRes?.branches ?? []);
      } catch (error) {
        console.error("Failed to load branches:", error);
      }
    })();
  }, [setting.dealer_id]);

  async function loadAgentKnowledge() {
    setKnowledgeLoading(true);
    setKnowledgeError(null);
    try {
      const res = await server_get_data(get_agent_knowledge(setting.id));
      setAgentKnowledge(Array.isArray(res?.documents) ? res.documents : []);
    } catch (error: any) {
      console.error("Failed to load agent knowledge:", error);
      if (isForbidden(error)) {
        setKnowledgeError("Your role does not have permission to view this knowledge.");
      } else {
        handleError("network");
        setKnowledgeError("Unable to load knowledge for this agent.");
      }
    } finally {
      setKnowledgeLoading(false);
    }
  }

  useEffect(() => {
    loadAgentKnowledge();
  }, [setting.id]);

  // Only docs for THIS segment (any of a doc's effective segments), plus
  // global docs. segment_ids is the full list; segment_id is a fallback
  // for older backends that only send the first one.
  const currentSegmentIdNum = Number(segmentId);
  const visibleKnowledge = agentKnowledge.filter((item) => {
    if (item.is_global) return true;
    if (Array.isArray(item.segment_ids)) return item.segment_ids.includes(currentSegmentIdNum);
    return String(item.segment_id) === segmentId;
  });

  /* ---------------------------------------------------------------------- */
  /* Save                                                                   */
  /* ---------------------------------------------------------------------- */

  async function handleSave() {
    setSaving(true);

    try {
      // PATCH targets the module-wide LLMSetting's own id, not the segment id.
      const res = await server_patch_data(`${get_llm_settings}${setting.id}/`, {
        persona_name: personaName,
        voice_id: voiceId,
        system_prompt: systemPrompt,
        tone,
        pace,
        max_turns: maxTurns,
        allow_customer_barge_in: allowInterrupt,
      });

      if (res?.success === false) throw new Error(res?.error || "Save failed");
      if (res?.setting) onSettingUpdated(res.setting);
    } catch (error: any) {
      console.error("Failed to save agent:", error);
      if (isForbidden(error)) {
        handleError("You do not have permission to edit this agent");
      } else {
        handleError("network");
      }
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
        title={setting.segment.name}
        description={setting.segment.description}
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
        <Tabs defaultValue="persona">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="persona">Persona & Voice</TabsTrigger>
            <TabsTrigger value="flow">Conversation Flow</TabsTrigger>
            <TabsTrigger value="knowledge">Knowledge</TabsTrigger>
          </TabsList>

          {/* PERSONA */}
          <TabsContent value="persona" className="mt-4">
            <Card>
              <CardContent className="grid gap-8 pt-6 lg:grid-cols-2">
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
                        {voices.length === 0 && setting.voice && (
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
                      <Input value={selectedVoice?.gender ?? ""} disabled />
                    </div>
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

                <div className="space-y-6">
                  <h3 className="text-base font-semibold">Behaviour</h3>

                  {[
                    { label: "Tone (formal → friendly)", value: tone, setValue: setTone },
                    { label: "Pace (slow → fast)", value: pace, setValue: setPace },
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

                <div className="flex justify-end lg:col-span-2">
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    <Save className="size-4" />
                    {saving ? "Saving..." : "Save changes"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CONVERSATION FLOW */}
          <TabsContent value="flow" className="mt-4">
            {currentSegment ? (
              <div className="space-y-4">
                <SegmentFlowEditor
                  key={currentSegment.id}
                  segment={currentSegment}
                  onSegmentUpdated={onSegmentUpdated}
                />
              </div>
            ) : (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  This segment isn't in the list this agent currently serves — try reopening it from
                  the Agents list.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* KNOWLEDGE */}
          <TabsContent value="knowledge" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Documents tagged to this segment, plus global documents.
              </p>
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

            {!knowledgeLoading && !knowledgeError && visibleKnowledge.length === 0 && (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  No knowledge documents are tagged to this segment yet.
                </CardContent>
              </Card>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              {!knowledgeLoading &&
                !knowledgeError &&
                visibleKnowledge.map((item) => {
                  const moduleLabel = item.is_global
                    ? "Global"
                    : (currentSegment?.name ?? "Unknown module");
                  const branchLabel =
                    Array.isArray(item.branch_ids) && item.branch_ids.length
                      ? (branches.find((b) => b.id === item.branch_ids[0])?.name ??
                        "Unknown branch")
                      : "Global (all branches)";

                  return (
                    <Card key={item.doc_id}>
                      <CardContent className="pt-6 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-sm">{item.title}</span>
                          <Badge variant="outline">{item.status}</Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="secondary">{moduleLabel}</Badge>
                          <Badge variant="secondary">{branchLabel}</Badge>
                        </div>

                        <div className="text-xs text-muted-foreground">
                          {item.category} • {item.chunk_count} chunks
                          {item.indexed_at && ` • indexed ${item.indexed_at}`}
                        </div>

                        <div className="pt-2">
                          <Button variant="outline" size="sm" asChild>
                            <Link to="/knowledge" state={{ editDocId: item.doc_id }}>
                              Edit in Knowledge
                              <ExternalLink className="size-3.5" />
                            </Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Segment Flow Editor                                                        */
/* -------------------------------------------------------------------------- */

function SegmentFlowEditor({
  segment,
  onSegmentUpdated,
}: {
  segment: SegmentSummary;
  onSegmentUpdated: (segId: number, field: SegmentLineField, value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        This is exactly what <strong>{segment.name}</strong> says to open and close the call. Add
        wording or drop in a variable, then drag the grip handle to reorder them. Opening and
        closing save independently.
      </p>

      <SegmentLineCard
        segmentId={segment.id}
        field="opening_line"
        title="Opening line"
        description="How the call starts for this segment."
        initialValue={segment.opening_line ?? ""}
        placeholder="e.g. Namaste {customer_name} ji, main {branch_name} se..."
        onSaved={onSegmentUpdated}
      />

      <SegmentLineCard
        segmentId={segment.id}
        field="closing_line"
        title="Closing line"
        description="How the call wraps up for this segment."
        initialValue={segment.closing_line ?? ""}
        placeholder="e.g. Dhanyawad, aapka din shubh ho!"
        emptyMessage="No closing line yet — add one."
        onSaved={onSegmentUpdated}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Segment Line Card                                                          */
/* -------------------------------------------------------------------------- */

function SegmentLineCard({
  segmentId,
  field,
  title,
  description,
  initialValue,
  placeholder,
  emptyMessage,
  onSaved,
}: {
  segmentId: number;
  field: SegmentLineField;
  title: string;
  description: string;
  initialValue: string;
  placeholder: string;
  emptyMessage?: string;
  onSaved: (segId: number, field: SegmentLineField, value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const editorRef = useRef<SegmentLineEditorHandle>(null);

  async function handleSave() {
    setSaving(true);
    const trimmed = value.trim();
    try {
      const res = await server_patch_data(patch_segment(segmentId), { [field]: trimmed });
      if (res?.success === false) throw new Error(res?.error || "Save failed");
      onSaved(segmentId, field, res?.segment?.[field] ?? trimmed);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } catch (error: any) {
      console.error(`Failed to save ${field}:`, error);
      if (isForbidden(error)) {
        handleError("You do not have permission to edit this segment");
      } else {
        handleError("network");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {description} Vars: {"{customer_name}"} {"{branch_name}"} {"{vehicle_model}"}{" "}
            {"{due_date}"}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => editorRef.current?.addText()}
          >
            <Plus className="size-3.5" />
            Add text
          </Button>
          <VariableMenuButton onSelect={(key) => editorRef.current?.addVariable(key)} />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <SegmentLineEditor
          ref={editorRef}
          value={value}
          placeholder={placeholder}
          onChange={setValue}
          emptyMessage={emptyMessage}
        />

        <div className="flex items-center justify-end gap-3">
          {justSaved && !saving && <span className="text-xs text-muted-foreground">Saved</span>}
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="size-4" />
            {saving ? "Saving..." : `Save ${title.toLowerCase()}`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Variable Menu Button                                                       */
/* -------------------------------------------------------------------------- */

function VariableMenuButton({ onSelect }: { onSelect: (key: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>
        <Plus className="size-3.5" />
        Add variable
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-md border bg-popover p-1 shadow-md">
            {VARIABLE_DEFS.map((def) => (
              <button
                key={def.key}
                type="button"
                onClick={() => {
                  onSelect(def.key);
                  setOpen(false);
                }}
                className="flex w-full flex-col items-start rounded-sm px-2 py-1.5 text-left hover:bg-muted"
              >
                <span className="text-sm font-medium">{def.label}</span>
                <span className="text-xs text-muted-foreground">{`{${def.key}}`}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Line Segments                                                              */
/* -------------------------------------------------------------------------- */

type LineSegment =
  { id: string; type: "text"; value: string } | { id: string; type: "variable"; key: string };

const VARIABLE_DEFS: { key: string; label: string }[] = [
  { key: "customer_name", label: "Customer name" },
  { key: "branch_name", label: "Branch name" },
  { key: "vehicle_model", label: "Vehicle model" },
  { key: "due_date", label: "Due date" },
  { key: "segment_name", label: "Segment name" },
];
const VARIABLE_LOOKUP = new Map(VARIABLE_DEFS.map((v) => [v.key, v]));

function parseLineToSegments(
  raw: string,
  fallbackToBlank: boolean,
  makeId: () => string,
): LineSegment[] {
  const parts = (raw ?? "").split(/(\{[a-zA-Z_]+\})/g).filter((part) => part !== "");
  const segments: LineSegment[] = parts.map((part) => {
    const match = part.match(/^\{([a-zA-Z_]+)\}$/);
    if (match && VARIABLE_LOOKUP.has(match[1])) {
      return { id: makeId(), type: "variable", key: match[1] };
    }
    return { id: makeId(), type: "text", value: part };
  });
  if (segments.length > 0) return segments;
  return fallbackToBlank ? [{ id: makeId(), type: "text", value: "" }] : [];
}

function serializeSegments(segments: LineSegment[]): string {
  const joined = segments.map((s) => (s.type === "variable" ? `{${s.key}}` : s.value)).join(" ");
  return joined.replace(/ {2,}/g, " ");
}

export interface SegmentLineEditorHandle {
  addText: () => void;
  addVariable: (key: string) => void;
}

const SegmentLineEditor = forwardRef<
  SegmentLineEditorHandle,
  {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    emptyMessage?: string;
  }
>(function SegmentLineEditor({ value, onChange, placeholder, emptyMessage }, ref) {
  const idRef = useRef(0);
  const makeId = () => {
    idRef.current += 1;
    return `blk-${idRef.current}`;
  };

  const [segments, setSegments] = useState<LineSegment[]>(() =>
    parseLineToSegments(value, !emptyMessage, makeId),
  );
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const commit = (next: LineSegment[]) => {
    setSegments(next);
    onChange(serializeSegments(next));
  };

  const updateText = (index: number, text: string) => {
    commit(segments.map((s, i) => (i === index ? { ...s, type: "text", value: text } : s)));
  };

  const removeSegment = (index: number) => {
    const next = segments.filter((_, i) => i !== index);
    if (next.length === 0 && !emptyMessage) {
      commit([{ id: makeId(), type: "text", value: "" }]);
      return;
    }
    commit(next);
  };

  const addVariable = (key: string) =>
    commit([...segments, { id: makeId(), type: "variable", key }]);
  const addText = () => commit([...segments, { id: makeId(), type: "text", value: "" }]);

  useImperativeHandle(ref, () => ({ addText, addVariable }));

  const reorder = (from: number, to: number) => {
    if (from === to) return;
    const next = [...segments];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    commit(next);
  };

  const clearDrag = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  if (segments.length === 0) {
    return (
      <p className="text-sm italic text-muted-foreground">
        {emptyMessage ?? "Nothing here yet — add one."}
      </p>
    );
  }

  return (
    <div className="rounded-md border border-input bg-background p-3">
      <div className="space-y-2">
        {segments.map((segment, index) => {
          const isDragging = dragIndex === index;
          const isOver = overIndex === index && dragIndex !== null && dragIndex !== index;
          const dropTargetHandlers = {
            onDragOver: (event: DragEvent) => {
              event.preventDefault();
              if (overIndex !== index) setOverIndex(index);
            },
            onDrop: (event: DragEvent) => {
              event.preventDefault();
              if (dragIndex !== null) reorder(dragIndex, index);
              clearDrag();
            },
          };

          const dragHandleHandlers = {
            draggable: true,
            onDragStart: (event: DragEvent) => {
              event.stopPropagation();
              setDragIndex(index);
            },
            onDragEnd: clearDrag,
          };

          if (segment.type === "variable") {
            const def = VARIABLE_LOOKUP.get(segment.key);
            return (
              <div
                key={segment.id}
                {...dropTargetHandlers}
                title={`{${segment.key}}`}
                className={cn(
                  "group flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 transition-colors",
                  isDragging && "opacity-40",
                  isOver && "ring-2 ring-primary/50",
                )}
              >
                <div
                  {...dragHandleHandlers}
                  className="shrink-0 cursor-grab p-0.5 text-primary/50 active:cursor-grabbing"
                >
                  <GripVertical className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-primary">
                    {`{${segment.key}}`}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-primary/50 hover:text-destructive hover:bg-destructive/10"
                  onClick={() => removeSegment(index)}
                  aria-label={`Remove ${def?.label ?? segment.key} variable`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            );
          }

          return (
            <div
              key={segment.id}
              {...dropTargetHandlers}
              className={cn(
                "flex items-center gap-2 rounded-md transition-colors",
                isDragging && "opacity-40",
                isOver && "ring-2 ring-primary/50",
              )}
            >
              <div
                {...dragHandleHandlers}
                className="shrink-0 cursor-grab p-0.5 text-muted-foreground active:cursor-grabbing"
              >
                <GripVertical className="size-4" />
              </div>
              <Input
                value={segment.value}
                placeholder={segments.length === 1 ? placeholder : "..."}
                onChange={(event) => updateText(index, event.target.value)}
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeSegment(index)}
                aria-label="Remove text block"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
});

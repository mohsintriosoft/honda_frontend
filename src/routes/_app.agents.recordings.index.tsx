import { Link } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";

import { PageHeader } from "@/components/layout/AppShell";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { IngestDropzone } from "@/components/agents/IngestDropzone";
import { TranscriptViewer, SentimentStrip } from "@/components/agents/TranscriptViewer";
import { TrainingRunProgress } from "@/components/agents/TrainingRunProgress";
import { ModuleBadge } from "@/components/agents/ModuleBadge";
import { ClassificationPanel } from "@/components/agents/ClassificationPanel";

import {
  ModuleFallback,
  UploadModuleMapping,
  CampaignModuleMapping,
} from "@/components/agents/ModuleMappingControls";

import {
  recordings as seedRecordings,
  ingestJobs as seedJobs,
  minedSuggestions,
  trainingRuns,
  LIBRARY_TOTAL,
  OUTCOME_LABEL,
  formatDuration,
  totalHours,
  CAMPAIGN_MODULE_MAP,
  CONFIDENCE_THRESHOLD,
  classifyTranscript,
  needsClassification,
  type Recording,
  type IngestJob,
  type ModuleSource,
} from "@/mocks/recordings";

import { WORKFLOW_LABEL, agents, type AgentWorkflow } from "@/mocks/agents";

import { formatNumber } from "@/lib/format";

import { get_recordings, server_get_data, APL_LINK, AUDIO_BASE_URL } from "@/components/ServiceConnection/serviceconnection";

import {
  ArrowLeft,
  AudioLines,
  FileSpreadsheet,
  PhoneCall,
  Play,
  Pause,
  Rocket,
  ClipboardCheck,
  Clock,
  Sparkles,
  RefreshCw,
  ShieldAlert,
  Check,
  Loader2,
} from "lucide-react";

const MODULES: AgentWorkflow[] = ["sales", "service", "insurance", "amc", "winback", "feedback"];

const STATUS_TONE: Record<Recording["status"], string> = {
  queued: "bg-secondary text-muted-foreground",
  transcribing: "bg-[color:var(--ai)]/12 text-[color:var(--ai)]",
  mined: "bg-[color:var(--info)]/12 text-[color:var(--info)]",
  reviewed: "bg-[color:var(--success)]/12 text-[color:var(--success)]",
  failed: "bg-destructive/10 text-destructive",
};

const uid = () => Math.random().toString(36).slice(2, 9);

/**
 * OMH_<MODULE>_<ID>.mp3
 *
 * Example:
 * OMH_SERVICE_1042.mp3
 * OMH_INSURANCE_2210.mp3
 */
function parseModuleFromName(name: string): AgentWorkflow | null {
  const part = name.toUpperCase().split("_")[1]?.toLowerCase();

  return MODULES.find((m) => m === part) ?? null;
}

function outcomeLabel(code: string): string {
  return (OUTCOME_LABEL as Record<string, string>)[code] ?? code.replace(/_/g, " ");
}

function getFileName(path: string): string {
  if (!path) {
    return "";
  }

  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/");

  return parts[parts.length - 1] || path;
}

function joinUrl(...parts: string[]): string {
  return parts
    .map((p, i) => {
      if (i === 0) return p.replace(/\/+$/, "");
      return p.replace(/^\/+/, "").replace(/\/+$/, "");
    })
    .filter(Boolean)
    .join("/");
}

function getAudioSrc(r: Recording): string {
  if (!r.file) {
    return "";
  }

  if (/^https?:\/\//i.test(r.file)) {
    return r.file;
  }

  return joinUrl(APL_LINK, `/api/recordings/${r.id}/audio/`);
}

function mapRecordingApiToRecording(session: any): Recording {
  const customerName: string =
    session?.customer?.name || session?.customer?.phone_number || "Unknown customer";

  const agentName: string =
    session?.agent?.persona_name || session?.agent?.agent_name || "Unassigned agent";

  const module: AgentWorkflow =
    (session?.segment?.module as AgentWorkflow) ||
    (session?.agent?.module as AgentWorkflow) ||
    "service";

  const transcript = Array.isArray(session?.transcript)
    ? session.transcript.map((t: any) => ({
      speaker: t.speaker === "bot" ? "agent" : "customer",
      text: t.text ?? "",
      at: t.at ?? t.timestamp ?? "",
    }))
    : [];

  const detectedIntents: string[] = Array.isArray(session?.intent_history)
    ? Array.from(
      new Set(
        session.intent_history
          .map((h: any) => h?.intent)
          .filter((v: unknown): v is string => typeof v === "string" && v.length > 0),
      ),
    )
    : [];

  return {
    id: String(session.id),
    file: session.recording_mixed || session.recording_stereo || `session_${session.id}.wav`,
    customer: customerName,
    agentName,
    phone: session.phone ?? "unknown",
    language: (session.language ?? "Hindi") as Recording["language"],
    date: (session.started_at ?? "").slice(0, 10),
    durationSec: session.duration_seconds ?? 0,
    outcome: (session.final_intent_code || "callback") as Recording["outcome"],
    quality: 0,
    status: "reviewed",
    source: "manifest",
    module,
    moduleSource: "metadata",
    moduleConfidence: 100,
    moduleAlternatives: [],
    moduleSignals: [],
    moduleEvidence: session?.segment?.name
      ? `From segment: ${session.segment.name}`
      : "From live call session data",
    transcript,
    detectedIntents,
    objectionsRaised: [],
    sentiment: [],
  };
}

export default function RecordingsPage() {
  useEffect(() => {
    document.title = "Call Recordings — Agent Training — Triosoft";
  }, []);

  const [items, setItems] = useState<Recording[]>([]);
  const [jobs, setJobs] = useState<IngestJob[]>(seedJobs); // NOT DYNAMIC — see notes above

  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [totalFromApi, setTotalFromApi] = useState<number | null>(null);

  const [moduleFilter, setModuleFilter] = useState<string>("all");

  const [outcomeFilter, setOutcomeFilter] = useState<string>("all");

  const [q, setQ] = useState("");

  const [classFilter, setClassFilter] = useState<string>("all");

  const [open, setOpen] = useState<Recording | null>(null);

  // --------------------------------------------------
  // Audio playback (drawer)
  // --------------------------------------------------

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);

  // Reset playback state whenever a different recording is opened, and stop
  // playback when the drawer closes.
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setAudioDuration(0);
    setAudioError(null);

    const audio = audioRef.current;

    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  }, [open?.id]);

  const togglePlayback = () => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    if (isPlaying) {
      audio.pause();
    } else {
      void audio.play().catch(() => {
        setAudioError("Couldn't play this recording — the file may be unavailable.");
      });
    }
  };

  const seekTo = (ratio: number) => {
    const audio = audioRef.current;

    if (!audio || !audioDuration) {
      return;
    }

    const clamped = Math.min(1, Math.max(0, ratio));

    audio.currentTime = clamped * audioDuration;

    setCurrentTime(audio.currentTime);
  };

  // --------------------------------------------------
  // Fetch real recordings (CallSession rows) from the API
  // --------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function fetchRecordings() {
      setLoading(true);
      setFetchError(null);

      try {
        const data = await server_get_data(get_recordings, { page_size: 200 });

        // Supports either a plain array or DRF pagination shape
        // ({ count, results }) without caring which one the backend uses.
        const rows: any[] = Array.isArray(data) ? data : data?.results ?? [];
        const count: number | null = Array.isArray(data) ? data.length : data?.count ?? null;

        if (!cancelled) {
          setItems(rows.map(mapRecordingApiToRecording));
          setTotalFromApi(count);
        }
      } catch (err) {
        console.error("Failed to load recordings:", err);

        if (!cancelled) {
          // Offline / API-not-ready fallback so the page still demoes.
          setFetchError(
            "Couldn't reach the recordings API — showing sample data instead.",
          );
          setItems(seedRecordings);
          setTotalFromApi(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchRecordings();

    return () => {
      cancelled = true;
    };
  }, []);

  // --------------------------------------------------
  // Module mapping controls
  // --------------------------------------------------

  const [uploadMode, setUploadMode] = useState("filename");

  const [forcedModule, setForcedModule] = useState<AgentWorkflow>("service");

  const [fallback, setFallback] = useState("ai");

  const [campaignMap, setCampaignMap] = useState(CAMPAIGN_MODULE_MAP);

  // --------------------------------------------------
  // Training run simulation
  // --------------------------------------------------

  const [trainAgent, setTrainAgent] = useState(agents[1]?.id ?? agents[0]?.id ?? "");

  const [step, setStep] = useState(-1);

  const [progress, setProgress] = useState(0);

  const [done, setDone] = useState(false);

  // --------------------------------------------------
  // Derived data
  // --------------------------------------------------

  const pending = minedSuggestions.filter((s) => s.status === "pending").length; // NOT DYNAMIC

  const unclassified = useMemo(() => items.filter(needsClassification), [items]);

  const filtered = useMemo(
    () =>
      items.filter((r) => {
        const matchesModule =
          moduleFilter === "all" || (r.moduleSource !== "unknown" && r.module === moduleFilter);

        const matchesClassification =
          classFilter === "all" ||
          (classFilter === "review" ? needsClassification(r) : !needsClassification(r));

        const matchesOutcome = outcomeFilter === "all" || r.outcome === outcomeFilter;

        const search = q.trim().toLowerCase();

        const matchesSearch =
          search === "" ||
          r.customer.toLowerCase().includes(search) ||
          r.file.toLowerCase().includes(search);

        return matchesModule && matchesClassification && matchesOutcome && matchesSearch;
      }),
    [items, moduleFilter, classFilter, outcomeFilter, q],
  );

  const trainable = useMemo(() => filtered.filter((r) => !needsClassification(r)), [filtered]);

  // Real count when the API gave us one; otherwise fall back to what we have
  // in memory (matches old mock-based behavior).
  const libraryTotal = totalFromApi ?? LIBRARY_TOTAL + items.length - seedRecordings.length;

  // --------------------------------------------------
  // Upload / ingest (still local-only — no backend endpoint for this yet,
  // see "IngestJob list" in the NOT DYNAMIC notes above)
  // --------------------------------------------------

  const addUploads = (files: File[], source: Recording["source"], label: string) => {
    if (files.length === 0) {
      return;
    }

    const created: Recording[] = files.map((f, i) => {
      const base = seedRecordings[i % seedRecordings.length]!;

      const tagged = parseModuleFromName(f.name);

      const forced = source === "upload" && uploadMode === "forced";

      const explicit: AgentWorkflow | null = forced
        ? forcedModule
        : source === "manifest"
          ? base.module
          : source === "dialer"
            ? (campaignMap[i % campaignMap.length]?.module ?? base.module)
            : tagged;

      if (explicit) {
        return {
          ...base,

          id: `rec_new_${uid()}`,

          file: f.name,

          status: "queued" as const,

          source,

          date: "2026-08-14",

          module: explicit,

          moduleSource: "metadata" as ModuleSource,

          moduleConfidence: 100,

          moduleAlternatives: [],

          moduleSignals: [],

          moduleEvidence: forced
            ? `Forced for this batch: ${WORKFLOW_LABEL[forcedModule]}`
            : source === "manifest"
              ? `CSV column "module" = ${explicit}`
              : source === "dialer"
                ? `Dialer campaign: ${campaignMap[i % campaignMap.length]?.campaign ?? "—"}`
                : `Filename tag in ${f.name}`,
        };
      }

      const ai = fallback === "ai" ? classifyTranscript(base.transcript) : null;

      return {
        ...base,

        id: `rec_new_${uid()}`,

        file: f.name,

        status: "queued" as const,

        source,

        date: "2026-08-14",

        module: ai?.module ?? base.module,

        moduleSource: (ai ? "ai" : "unknown") as ModuleSource,

        moduleConfidence: ai?.confidence ?? 0,

        moduleAlternatives: ai?.alternatives ?? [],

        moduleSignals: ai?.signals ?? [],

        moduleEvidence: ai
          ? "Predicted from transcript keywords + detected intents"
          : "No module tag found — waiting for a human to classify",
      };
    });

    setItems((current) => [...created, ...current]);

    const job: IngestJob = {
      id: uid(),

      source,

      label,

      files: files.length,

      hours: Math.round(((files.length * 4.2) / 60) * 10) / 10,

      startedAt: "Just now",

      progress: 0,

      status: "running",
    };

    setJobs((current) => [job, ...current]);

    const timer = setInterval(() => {
      setJobs((all) =>
        all.map((x) => {
          if (x.id !== job.id) {
            return x;
          }

          const p = Math.min(100, x.progress + 12);

          if (p === 100) {
            clearInterval(timer);

            setItems((records) =>
              records.map((r) =>
                created.some((c) => c.id === r.id)
                  ? {
                    ...r,
                    status: "mined" as const,
                  }
                  : r,
              ),
            );

            return {
              ...x,
              progress: 100,
              status: "done",
            };
          }

          return {
            ...x,
            progress: p,
          };
        }),
      );
    }, 260);
  };

  // --------------------------------------------------
  // Manual module classification (local state only — wire a
  // patch_recording PATCH call here once the backend exposes
  // a "module override" field on CallSession/Segment)
  // --------------------------------------------------

  const setModule = (id: string, module: AgentWorkflow) => {
    setItems((all) =>
      all.map((r) =>
        r.id === id
          ? {
            ...r,

            module,

            moduleSource: "manual" as ModuleSource,

            moduleConfidence: 100,

            moduleAlternatives: [],

            moduleEvidence: "Set by a reviewer in the library",
          }
          : r,
      ),
    );

    setOpen((current) =>
      current && current.id === id
        ? {
          ...current,

          module,

          moduleSource: "manual",

          moduleConfidence: 100,

          moduleAlternatives: [],

          moduleEvidence: "Set by a reviewer in the library",
        }
        : current,
    );
  };

  // --------------------------------------------------
  // Training simulation — NOT DYNAMIC, no TrainingRun table exists.
  // --------------------------------------------------

  const runTraining = () => {
    setDone(false);

    setStep(0);

    setProgress(0);

    const timer = setInterval(() => {
      setProgress((current) => {
        const next = current + 5;

        setStep(Math.min(4, Math.floor(next / 20)));

        if (next >= 100) {
          clearInterval(timer);

          setStep(5);

          setDone(true);

          return 100;
        }

        return next;
      });
    }, 140);
  };

  const trainedAgent = agents.find((a) => a.id === trainAgent) ?? agents[0];

  if (!trainedAgent) {
    return null;
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[
          {
            label: "AI Agents",
            to: "/agents",
          },
          {
            label: "Call recordings",
          },
        ]}
        title="Train from call recordings"
        description="Bring in your existing call archive, auto-transcribe it, and mine real conversations for intents, objections and answers."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/agents">
                <ArrowLeft className="size-4" />
                Agents
              </Link>
            </Button>

            <Button size="sm" asChild>
              <Link to="/agents/recordings/review">
                <ClipboardCheck className="size-4" />
                Review queue ({pending})
              </Link>
            </Button>
          </div>
        }
      />

      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        {fetchError && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs">
            <ShieldAlert className="size-4 shrink-0 text-destructive" />
            <span>{fetchError}</span>
          </div>
        )}

        {/* ==================================================
            Stats
        ================================================== */}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            {
              l: "Recordings in library",
              v: formatNumber(libraryTotal),
              i: AudioLines,
            },
            {
              l: "Hours of audio",
              // Dynamic when items come from the API (durationSec is real);
              // LIBRARY_TOTAL padding factor only kicks in for the mock
              // fallback so the number doesn't look wrong offline.
              v: `${totalFromApi !== null ? totalHours(items).toFixed(0) : (LIBRARY_TOTAL * 0.068 + totalHours(items)).toFixed(0)} h`,
              i: Clock,
            },
            {
              l: "Need module review",
              v: String(unclassified.length),
              i: ShieldAlert,
            },
            {
              l: "Mined suggestions", // NOT DYNAMIC
              v: String(minedSuggestions.length),
              i: Sparkles,
            },
            {
              l: "Pending review", // NOT DYNAMIC
              v: String(pending),
              i: ClipboardCheck,
            },
          ].map((k) => (
            <Card key={k.l}>
              <CardContent className="pt-6 flex items-center gap-3">
                <div className="size-9 rounded-lg bg-primary/10 text-primary grid place-items-center">
                  <k.i className="size-4" />
                </div>

                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {k.l}
                  </div>

                  <div className="text-xl font-semibold font-display tabular-nums">{k.v}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ==================================================
            Recording library
        ================================================== */}

        <Card>
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                Recording library
                {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
              </CardTitle>

              <div className="flex flex-wrap gap-2">
                <Input
                  placeholder="Search customer or file…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="h-9 w-56"
                />

                <Select value={moduleFilter} onValueChange={setModuleFilter}>
                  <SelectTrigger className="h-9 w-40">
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="all">All modules</SelectItem>

                    {MODULES.map((m) => (
                      <SelectItem key={m} value={m}>
                        {WORKFLOW_LABEL[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={classFilter} onValueChange={setClassFilter}>
                  <SelectTrigger className="h-9 w-44">
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="all">All classifications</SelectItem>

                    <SelectItem value="confirmed">Confirmed module</SelectItem>

                    <SelectItem value="review">Needs module review</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
                  <SelectTrigger className="h-9 w-40">
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="all">All outcomes</SelectItem>

                    {Object.entries(OUTCOME_LABEL).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>

                    <TableHead>Module</TableHead>

                    <TableHead>Agent</TableHead>

                    <TableHead>Date</TableHead>

                    <TableHead>Duration</TableHead>

                    <TableHead>Outcome</TableHead>

                    <TableHead>Quality</TableHead>

                    <TableHead>Status</TableHead>

                    <TableHead>LLM Cost</TableHead>

                    <TableHead />
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filtered.slice(0, 25).map((r) => (
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => setOpen(r)}>
                      <TableCell>
                        <div className="font-medium">{r.customer}</div>

                        <div className="text-xs text-muted-foreground font-mono">{r.file}</div>
                      </TableCell>

                      <TableCell>
                        <ModuleBadge r={r} />
                      </TableCell>

                      <TableCell className="text-sm">{r.agentName}</TableCell>

                      <TableCell className="text-sm tabular-nums">{r.date}</TableCell>

                      <TableCell className="tabular-nums">
                        {formatDuration(r.durationSec)}
                      </TableCell>

                      <TableCell>{outcomeLabel(r.outcome)}</TableCell>

                      {/* NOT DYNAMIC — no quality field on CallSession */}
                      <TableCell className="tabular-nums text-muted-foreground">
                        {r.quality || "—"}
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground tabular-nums">
                        {/* NOT DYNAMIC — no llm_cost field on CallSession yet */}
                        —
                      </TableCell>

                      <TableCell>
                        <Badge className={STATUS_TONE[r.status]}>{r.status}</Badge>
                      </TableCell>


                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpen(r);
                          }}
                        >
                          <Play className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="px-4 py-3 text-xs text-muted-foreground">
              Showing {Math.min(25, filtered.length)} of {formatNumber(filtered.length)} filtered •{" "}
              {formatNumber(libraryTotal)} total in archive
            </div>
          </CardContent>
        </Card>

        {/* ==================================================
            Needs classification
        ================================================== */}

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldAlert className="size-4 text-destructive" />
                  Needs classification ({unclassified.length})
                </CardTitle>

                <CardDescription>
                  Calls with no module tag, or an AI guess below {CONFIDENCE_THRESHOLD}% confidence.
                  They are excluded from training until confirmed. Rows loaded from the live API
                  already carry a confirmed module (from Segment), so this list will mostly show
                  manually-uploaded recordings.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {unclassified.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-muted-foreground">
                Every call in the library has a confirmed module.
              </p>
            ) : (
              <div className="divide-y">
                {unclassified.slice(0, 8).map((r) => (
                  <div key={r.id} className="flex flex-wrap items-start justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{r.customer}</span>

                        <span className="font-mono text-[11px] text-muted-foreground">
                          {r.file}
                        </span>
                      </div>

                      <p className="mt-1 max-w-xl truncate text-xs text-muted-foreground">
                        "{r.transcript[1]?.text ?? r.transcript[0]?.text}"
                      </p>

                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {r.moduleEvidence}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {MODULES.map((m) => (
                        <Button
                          key={m}
                          size="sm"
                          variant={
                            r.moduleSource === "ai" && r.module === m ? "secondary" : "outline"
                          }
                          className="h-7 px-2 text-xs"
                          onClick={() => setModule(r.id, m)}
                        >
                          {r.moduleSource === "ai" && r.module === m && (
                            <Check className="size-3" />
                          )}

                          {WORKFLOW_LABEL[m]}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {unclassified.length > 8 && (
              <div className="px-4 py-3 text-xs text-muted-foreground">
                Showing 8 of {unclassified.length} • filter the library by "Needs module review" to
                see them all
              </div>
            )}
          </CardContent>
        </Card>

        {/* ==================================================
            Training run — NOT DYNAMIC (see notes at top of file)
        ================================================== */}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Train an agent from these calls</CardTitle>

            <CardDescription>
              Only calls with a confirmed module and approved suggestions from the review queue are
              used. The progress simulation and "Recent training runs" list below are still mocked
              — there's no TrainingRun table in the backend yet.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,300px)_1fr] md:items-end">
              <div className="space-y-1.5">
                <Label>Target agent</Label>

                <Select value={trainAgent} onValueChange={setTrainAgent}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={runTraining} disabled={step >= 0 && !done}>
                  <Rocket className="size-4" />
                  Train from {formatNumber(trainable.length)} calls
                </Button>

                <span className="text-xs text-muted-foreground">
                  {trainedAgent.version} → {bump(trainedAgent.version)} •{" "}
                  {minedSuggestions.filter((s) => s.targetAgentId === trainAgent).length} items
                  ready
                </span>
              </div>
            </div>

            {filtered.length - trainable.length > 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs">
                <ShieldAlert className="size-4 shrink-0 text-destructive" />

                <span>
                  {formatNumber(filtered.length - trainable.length)} calls excluded — module
                  unconfirmed. Confirm them in "Needs classification" above so they train the right
                  agent.
                </span>
              </div>
            )}

            {step >= 0 && <TrainingRunProgress step={step} progress={progress} />}

            {done && (
              <div className="grid gap-3 sm:grid-cols-4">
                {[
                  {
                    l: "Intent accuracy",
                    v: `${trainedAgent.metrics.intentAccuracy}% → ${Math.min(
                      99,
                      trainedAgent.metrics.intentAccuracy + 5,
                    )}%`,
                  },
                  {
                    l: "New intents learned",
                    v: "6",
                  },
                  {
                    l: "Objection coverage",
                    v: "87%",
                  },
                  {
                    l: "Version",
                    v: `${trainedAgent.version} → ${bump(trainedAgent.version)}`,
                  },
                ].map((m) => (
                  <div key={m.l} className="rounded-lg border p-3">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {m.l}
                    </div>

                    <div className="mt-1 text-sm font-semibold tabular-nums">{m.v}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-lg border divide-y">
              {trainingRuns.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"
                >
                  <span>{agents.find((a) => a.id === r.agentId)?.name ?? r.agentId}</span>

                  <span className="text-xs text-muted-foreground">
                    {r.fromCalls} calls • {r.items} items • {r.fromVersion} → {r.toVersion} •
                    accuracy {r.accuracyBefore}% → {r.accuracyAfter}%
                  </span>

                  <span className="text-xs text-muted-foreground">{r.ranAt}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ==================================================
          Detail drawer
      ================================================== */}

      <Sheet
        open={!!open}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setOpen(null);
          }
        }}
      >
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {open && (
            <>
              <SheetHeader>
                <SheetTitle>{open.customer}</SheetTitle>

                <SheetDescription>
                  {open.moduleSource === "unknown" ? "Unclassified" : WORKFLOW_LABEL[open.module]} •{" "}
                  {open.agentName} • {open.date} • {formatDuration(open.durationSec)}
                </SheetDescription>
              </SheetHeader>

              <div className="px-4 pb-6 space-y-5">
                {/* Audio */}
                <div className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <audio
                      ref={audioRef}
                      src={getAudioSrc(open)}
                      preload="metadata"
                      onLoadedMetadata={(e) => setAudioDuration(e.currentTarget.duration || 0)}
                      onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onEnded={() => setIsPlaying(false)}
                      onError={() =>
                        setAudioError("Couldn't load this recording — the file may be unavailable.")
                      }
                    />

                    <Button size="icon" variant="secondary" onClick={togglePlayback}>
                      {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
                    </Button>

                    <div className="flex-1">
                      <div className="text-xs text-muted-foreground font-mono">{open.file}</div>

                      <div
                        className="mt-2 cursor-pointer"
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const ratio = (e.clientX - rect.left) / rect.width;
                          seekTo(ratio);
                        }}
                      >
                        <Progress
                          value={audioDuration ? (currentTime / audioDuration) * 100 : 0}
                          className="h-1.5"
                        />
                      </div>
                    </div>

                    <span className="text-xs tabular-nums text-muted-foreground">
                      {formatDuration(Math.floor(currentTime))} /{" "}
                      {formatDuration(Math.floor(audioDuration || open.durationSec))}
                    </span>
                  </div>

                  {audioError && (
                    <div className="flex items-center gap-2 text-xs text-destructive">
                      <ShieldAlert className="size-3.5 shrink-0" />
                      <span>{audioError}</span>
                    </div>
                  )}
                </div>

                {/* Classification */}
                <ClassificationPanel r={open} onOverride={setModule} />

                {/* Sentiment — NOT DYNAMIC, no backend field */}
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                    Sentiment
                  </div>

                  {open.sentiment.length > 0 ? (
                    <SentimentStrip points={open.sentiment} />
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Not available — CallSession has no sentiment field.
                    </p>
                  )}
                </div>

                {/* Intents / objections */}
                <div className="flex flex-wrap gap-1.5">
                  {open.detectedIntents.map((intent) => (
                    <Badge key={intent} variant="outline" className="font-mono text-[10px]">
                      {intent}
                    </Badge>
                  ))}

                  {/* NOT DYNAMIC — no objections field on the backend */}
                  {open.objectionsRaised.map((objection) => (
                    <Badge key={objection} variant="secondary" className="text-[10px]">
                      "{objection}"
                    </Badge>
                  ))}
                </div>

                {/* Transcript */}
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                    Transcript
                  </div>

                  <TranscriptViewer turns={open.transcript} />
                </div>

                {/* Mine training */}
                <Button className="w-full" asChild>
                  <Link to="/agents/recordings/review">
                    <Sparkles className="size-4" />
                    Mine this call into training data
                  </Link>
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function bump(v: string) {
  const m = v.match(/v(\d+)\.(\d+)/);

  if (!m) {
    return v;
  }

  return `v${m[1]}.${Number(m[2]) + 1}`;
}
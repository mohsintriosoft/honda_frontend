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

import {
  get_recordings,
  get_recording_detail,
  server_get_data,
  APL_LINK,
  AUDIO_BASE_URL,
} from "@/components/ServiceConnection/serviceconnection";

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
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const MODULES: AgentWorkflow[] = ["sales", "service", "insurance", "amc", "winback", "feedback"];

// How many rows we pull from the backend per request. Keep this small —
// this is what actually protects the DB. Raising this back up to 200
// (like the old page_size did) defeats the point of paginating at all.
const PAGE_SIZE = 25;

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
      // 🔥 NEW: filler line (bot turns only) — save_turn() now writes this
      // onto the transcript entry alongside speaker/text/at (see backend
      // views.py). Optional, so older sessions without it fall back to "".
      filler: t.filler ?? "",
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
    file: getFileName(
      session.recording_mixed ||
      session.recording_stereo ||
      `session_${session.id}.wav`
    ),
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

  // Pagination — page is 1-indexed to match DRF's PageNumberPagination.
  const [page, setPage] = useState(1);

  const [moduleFilter, setModuleFilter] = useState<string>("all");

  const [outcomeFilter, setOutcomeFilter] = useState<string>("all");

  const [q, setQ] = useState("");

  // Debounced search — the input above updates `q` on every keystroke for
  // instant UI feedback, but the network request (and therefore the DB
  // query) only fires ~400ms after the user stops typing. Without this,
  // "customer name" would be 15 separate list requests instead of 1.
  const [debouncedQ, setDebouncedQ] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q.trim()), 400);
    return () => clearTimeout(timer);
  }, [q]);

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

  // The <audio> element only gets a `src` once this flips true. Until then
  // the browser has nothing to fetch — opening the drawer does NOT pull the
  // audio file, only clicking Play does.
  const [audioReady, setAudioReady] = useState(false);

  // Reset playback state whenever a different recording is opened, and stop
  // playback when the drawer closes.
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setAudioDuration(0);
    setAudioError(null);
    setAudioReady(false);

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
      return;
    }

    if (!audioReady) {
      // First tap on Play for this recording — this is the moment the
      // audio file is actually requested from the server. The effect
      // below fires playback once the <audio> element has picked up the
      // new src (setting React state doesn't update the DOM until the
      // next render, so we can't just call audio.play() here).
      setAudioReady(true);
      return;
    }

    void audio.play().catch(() => {
      setAudioError("Couldn't play this recording — the file may be unavailable.");
    });
  };

  useEffect(() => {
    if (!audioReady) {
      return;
    }

    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    void audio.play().catch(() => {
      setAudioError("Couldn't play this recording — the file may be unavailable.");
    });
  }, [audioReady]);

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
  //
  // Only ONE page worth of rows is ever requested. Re-runs whenever page,
  // search, module, or outcome change (see the dependency array below), so
  // the backend only ever has to plan a query for PAGE_SIZE rows instead
  // of the whole table.
  //
  // The list serializer (_serialize_recording_summary in views_admin.py)
  // deliberately leaves out `transcript` / `intent_history` / `call_summary`
  // — that's the expensive part per row. Full detail, transcript included,
  // is fetched separately, one recording at a time, only when its row is
  // opened (see the detail effect below, which hits GET /api/recordings/:id/,
  // handled by recording_detail() on the backend).
  // --------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function fetchRecordings() {
      setLoading(true);
      setFetchError(null);

      try {
        const data = await server_get_data(get_recordings, {
          page,
          page_size: PAGE_SIZE,
          // Backend now filters these server-side (see recordings() in
          // views_admin.py) instead of us pulling extra pages and
          // filtering in JS. classFilter has no backend equivalent yet
          // (it's derived from moduleSource/confidence, not a DB column),
          // so that one still only narrows the current page below.
          ...(debouncedQ ? { search: debouncedQ } : {}),
          ...(moduleFilter !== "all" ? { module: moduleFilter } : {}),
          ...(outcomeFilter !== "all" ? { outcome: outcomeFilter } : {}),
        });

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
          setItems(seedRecordings.slice(0, PAGE_SIZE));
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
  }, [page, debouncedQ, moduleFilter, outcomeFilter]);

  // Reset back to page 1 whenever a filter changes. Note: classFilter has
  // no server-side equivalent (see the fetch effect above, and `filtered`
  // below), so it only ever narrows whatever page is already loaded.
  useEffect(() => {
    setPage(1);
  }, [moduleFilter, outcomeFilter, classFilter, debouncedQ]);

  // --------------------------------------------------
  // Fetch full recording detail (transcript, intents, etc.) on demand
  //
  // The list call above intentionally only carries summary fields. The
  // heavy per-row data — transcript turns — is pulled here, one recording
  // at a time, only when the user opens that row's drawer. Closing the
  // drawer and opening a different row triggers a fresh, separate fetch;
  // nothing is bulk-loaded up front.
  // --------------------------------------------------

  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    if (!open?.id) {
      return;
    }

    let cancelled = false;

    async function fetchDetail() {
      setDetailLoading(true);
      setDetailError(null);

      try {
        const session = await server_get_data(get_recording_detail(open!.id));
        const detailed = mapRecordingApiToRecording(session);

        if (cancelled) {
          return;
        }

        // Merge in only the fields the list endpoint doesn't already have
        // (transcript + anything derived from it), so anything the user
        // has locally set on this row in the meantime — e.g. a manual
        // module override via setModule — isn't clobbered.
        const patch = {
          transcript: detailed.transcript,
          detectedIntents: detailed.detectedIntents,
        };

        setOpen((current) => (current && current.id === open!.id ? { ...current, ...patch } : current));
        setItems((all) => all.map((r) => (r.id === open!.id ? { ...r, ...patch } : r)));
      } catch (err) {
        console.error("Failed to load recording detail:", err);

        if (!cancelled) {
          setDetailError("Couldn't load the transcript for this recording.");
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    }

    fetchDetail();

    return () => {
      cancelled = true;
    };
  }, [open?.id]);

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

  // Module, outcome, and search are now filtered server-side (passed as
  // query params in the fetch effect above), so this mostly re-applies the
  // same filters to what's already a matching page — cheap, and keeps the
  // UI correct instantly while a debounced search request is in flight.
  // classFilter is the one exception: "needs review" isn't a DB column,
  // it's derived from moduleSource/confidence, so it only ever filters
  // within the current page.
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
            }
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
                  {/* No client-side slicing here anymore — `items` already
                      IS one backend page (PAGE_SIZE rows). Filters below
                      only narrow within that page; see the note above
                      `filtered` for what server-side filtering would take. */}
                  {filtered.map((r) => (
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

            <div className="flex items-center justify-between px-4 py-3 text-xs text-muted-foreground">
              <span>
                Page {page} • {formatNumber(filtered.length)} of {formatNumber(items.length)} on this page match filters •{" "}
                {formatNumber(libraryTotal)} total in archive
              </span>

              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="size-3.5" />
                  Prev
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  disabled={loading || items.length < PAGE_SIZE || (totalFromApi !== null && page * PAGE_SIZE >= totalFromApi)}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
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
                      // No src (and preload="none") until the user actually
                      // hits Play — that's what stops every row render /
                      // drawer open from silently pulling an audio file.
                      src={audioReady ? getAudioSrc(open) : undefined}
                      preload="none"
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

                {/* Transcript — fetched lazily, only while this drawer is open */}
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-2">
                    Transcript
                    {detailLoading && <Loader2 className="size-3.5 animate-spin" />}
                  </div>

                  {detailError && (
                    <div className="flex items-center gap-2 text-xs text-destructive mb-2">
                      <ShieldAlert className="size-3.5 shrink-0" />
                      <span>{detailError}</span>
                    </div>
                  )}

                  <TranscriptViewer turns={open.transcript} />
                </div>

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
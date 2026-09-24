import { Link } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";

import { PageHeader } from "@/components/layout/AppShell";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

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

import { TranscriptViewer } from "@/components/agents/TranscriptViewer";
import { ModuleBadge } from "@/components/agents/ModuleBadge";

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
  server_download_file,
  getAudioUrl,
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

const MODULES: AgentWorkflow[] = ["service", "insurance", "amc"];

const PAGE_SIZE = 25;

const CALL_STATUS_LABEL: Record<string, string> = {
  ringing: "Ringing",
  ongoing: "Ongoing",
  completed: "Completed",
  dropped: "Dropped",
  declined: "Declined",
};

const CALL_STATUS_TONE: Record<string, string> = {
  ringing: "bg-[color:var(--ai)]/12 text-[color:var(--ai)]",
  ongoing: "bg-[color:var(--ai)]/12 text-[color:var(--ai)]",
  completed: "bg-[color:var(--success)]/12 text-[color:var(--success)]",
  dropped: "bg-destructive/10 text-destructive",
  declined: "bg-[color:var(--warning)]/12 text-[color:var(--warning)]",
};

function callStatusLabel(status: string): string {
  if (!status) {
    return "—";
  }
  return CALL_STATUS_LABEL[status] ?? status.replace(/_/g, " ");
}

function callStatusTone(status: string): string {
  return CALL_STATUS_TONE[status] ?? "bg-secondary text-muted-foreground";
}

// Priority order: Booked > Callback > Not interested > No answer.
const OUTCOME_OPTIONS = [
  { value: "booked", label: "Booked" },
  { value: "callback", label: "Callback" },
  { value: "declined", label: "Not interested" },
  { value: "no_answer", label: "No answer" },
] as const;

function mapCallStatusToRecordingStatus(status: string): Recording["status"] {
  switch (status) {
    case "completed":
      return "reviewed";
    case "ringing":
    case "ongoing":
      return "transcribing";
    default:
      return "failed";
  }
}

function formatCost(cost: number | null): string {
  if (cost === null || Number.isNaN(cost)) {
    return "—";
  }
  return `₹${cost.toFixed(2)}`;
}

const uid = () => Math.random().toString(36).slice(2, 9);

function parseModuleFromName(name: string): AgentWorkflow | null {
  const part = name.toUpperCase().split("_")[1]?.toLowerCase();

  return MODULES.find((m) => m === part) ?? null;
}

function outcomeLabel(code: string): string {
  if (!code) {
    return "Not classified";
  }
  return (
    OUTCOME_OPTIONS.find((o) => o.value === code)?.label ??
    (OUTCOME_LABEL as Record<string, string>)[code] ??
    code.replace(/_/g, " ")
  );
}

function getFileName(path: string): string {
  if (!path) {
    return "";
  }

  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/");

  return parts[parts.length - 1] || path;
}

type RecordingRow = Recording & {
  callStatus: string;
  llmCost: number | null;
  timeIst: string | null;
  qualityKnown?: boolean;
};

function joinUrl(...parts: string[]): string {
  return parts
    .map((p, i) => {
      if (i === 0) return p.replace(/\/+$/, "");
      return p.replace(/^\/+/, "").replace(/\/+$/, "");
    })
    .filter(Boolean)
    .join("/");
}

function toRecordingRow(r: Recording): RecordingRow {
  return {
    ...r,
    callStatus: r.status === "reviewed" ? "completed" : r.status,
    llmCost: null,
    timeIst: null,
  };
}

function mapRecordingApiToRecording(session: any): RecordingRow {
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

  // accuracy is stored as 0-100 on the backend -- no 0-1 scaling.
  let quality = 0;
  let qualityKnown = false;
  if (typeof session.quality_pct === "number") {
    quality = session.quality_pct;
    qualityKnown = true;
  } else if (typeof session.accuracy === "number") {
    quality = Math.round(session.accuracy);
    qualityKnown = true;
  }

  const llmCost: number | null = typeof session.total_cost === "number" ? session.total_cost : null;

  const callStatus: string = session.status || "";

  const istDate: string =
    session.started_at_ist_date ??
    (session.started_at
      ? new Date(session.started_at).toLocaleDateString("en-IN", {
          timeZone: "Asia/Kolkata",
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "");

  const istTime: string | null =
    session.started_at_ist_time ??
    (session.started_at
      ? new Date(session.started_at).toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
      : null);

  return {
    id: String(session.id),
    file: getFileName(
      session.recording_mixed || session.recording_stereo || `session_${session.id}.wav`,
    ),
    customer: customerName,
    agentName,
    phone: session?.customer?.phone_number ?? "unknown",
    language: (session.language ?? "Hindi") as Recording["language"],
    date: istDate,
    durationSec: session.duration_seconds ?? 0,
    outcome: (session.final_intent_code || "") as Recording["outcome"],
    quality,
    qualityKnown,
    status: mapCallStatusToRecordingStatus(callStatus),
    callStatus,
    llmCost,
    timeIst: istTime,
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

  const [items, setItems] = useState<RecordingRow[]>([]);
  const [jobs, setJobs] = useState<IngestJob[]>(seedJobs);

  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [totalFromApi, setTotalFromApi] = useState<number | null>(null);
  const [totalDurationSec, setTotalDurationSec] = useState<number | null>(null);

  const [page, setPage] = useState(1);

  const [moduleFilter, setModuleFilter] = useState<string>("all");

  const [outcomeFilter, setOutcomeFilter] = useState<string>("all");

  const [q, setQ] = useState("");

  const [debouncedQ, setDebouncedQ] = useState("");

  // Debounce + page reset in the same tick, so a new search triggers ONE
  // fetch (page 1), not one for the old page and another for page 1.
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = q.trim();
      if (next !== debouncedQ) {
        setDebouncedQ(next);
        setPage(1);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [q, debouncedQ]);

  const [classFilter, setClassFilter] = useState<string>("all");

  const handleModuleFilter = (value: string) => {
    setModuleFilter(value);
    setPage(1);
  };

  const handleOutcomeFilter = (value: string) => {
    setOutcomeFilter(value);
    setPage(1);
  };

  const [open, setOpen] = useState<RecordingRow | null>(null);

  // --------------------------------------------------
  // Audio playback (drawer)
  // --------------------------------------------------

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const openIdRef = useRef<string | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);

  // Blob URL of the fetched recording. Only set after the first Play click,
  // so opening the drawer never downloads audio.
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);

  useEffect(() => {
    openIdRef.current = open?.id ?? null;

    setIsPlaying(false);
    setCurrentTime(0);
    setAudioDuration(0);
    setAudioError(null);
    setAudioLoading(false);
    setAudioSrc(null);

    const audio = audioRef.current;

    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  }, [open?.id]);

  // Free the previous blob whenever it's replaced or the page unmounts.
  useEffect(() => {
    return () => {
      if (audioSrc && audioSrc.startsWith("blob:")) {
        URL.revokeObjectURL(audioSrc);
      }
    };
  }, [audioSrc]);

  const togglePlayback = async () => {
    const audio = audioRef.current;

    if (!audio || !open) {
      return;
    }

    if (isPlaying) {
      audio.pause();
      return;
    }

    if (!audioSrc) {
      const requestedId = open.id;
      const url = getAudioUrl(open);

      if (/^https?:\/\//i.test(open.file)) {
        setAudioSrc(url);
        return;
      }

      setAudioLoading(true);
      setAudioError(null);

      try {
        const res = await server_download_file(url);
        if (openIdRef.current !== requestedId) {
          return;
        }
        setAudioSrc(URL.createObjectURL(res.data));
      } catch (err: any) {
        console.error("Failed to load recording audio:", err);
        if (openIdRef.current === requestedId) {
          setAudioError(
            err?.response?.status === 404
              ? "No recording file is available for this call."
              : "Couldn't load this recording — the file may be unavailable.",
          );
        }
      } finally {
        if (openIdRef.current === requestedId) {
          setAudioLoading(false);
        }
      }
      return;
    }

    void audio.play().catch(() => {
      setAudioError("Couldn't play this recording — the file may be unavailable.");
    });
  };

  // Auto-play once the blob URL lands on the <audio> element.
  useEffect(() => {
    if (!audioSrc) {
      return;
    }

    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    void audio.play().catch(() => {
      setAudioError("Couldn't play this recording — the file may be unavailable.");
    });
  }, [audioSrc]);

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
  // Fetch recordings (one backend page at a time)
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
          ...(debouncedQ ? { search: debouncedQ } : {}),
          ...(moduleFilter !== "all" ? { module: moduleFilter } : {}),
          ...(outcomeFilter !== "all" ? { outcome: outcomeFilter } : {}),
        });

        const rows: any[] = Array.isArray(data) ? data : (data?.results ?? []);
        const count: number | null = Array.isArray(data) ? data.length : (data?.count ?? null);
        const durationTotal: number | null =
          !Array.isArray(data) && typeof data?.total_duration_seconds === "number"
            ? data.total_duration_seconds
            : null;

        if (!cancelled) {
          setItems(rows.map(mapRecordingApiToRecording));
          setTotalFromApi(count);
          setTotalDurationSec(durationTotal);
        }
      } catch (err) {
        console.error("Failed to load recordings:", err);

        if (!cancelled) {
          setFetchError("Couldn't reach the recordings API — showing sample data instead.");
          setItems(seedRecordings.slice(0, PAGE_SIZE).map(toRecordingRow));
          setTotalFromApi(null);
          setTotalDurationSec(null);
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

  // --------------------------------------------------
  // Fetch full recording detail on demand
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

        const patch = {
          transcript: detailed.transcript,
          detectedIntents: detailed.detectedIntents,
        };

        setOpen((current) =>
          current && current.id === open!.id ? { ...current, ...patch } : current,
        );
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

  const pending = minedSuggestions.filter((s) => s.status === "pending").length;

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
          r.file.toLowerCase().includes(search) ||
          r.phone.toLowerCase().includes(search);

        return matchesModule && matchesClassification && matchesOutcome && matchesSearch;
      }),
    [items, moduleFilter, classFilter, outcomeFilter, q],
  );

  const trainable = useMemo(() => filtered.filter((r) => !needsClassification(r)), [filtered]);

  const libraryTotal = totalFromApi ?? LIBRARY_TOTAL + items.length - seedRecordings.length;

  // Library-wide hours from the backend aggregate; mock padding only for
  // the offline fallback.
  const libraryHours =
    totalDurationSec !== null ? totalDurationSec / 3600 : LIBRARY_TOTAL * 0.068 + totalHours(items);

  // --------------------------------------------------
  // Upload / ingest (local-only)
  // --------------------------------------------------

  const addUploads = (files: File[], source: Recording["source"], label: string) => {
    if (files.length === 0) {
      return;
    }

    const created: RecordingRow[] = files.map((f, i) => {
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
          ...toRecordingRow(base),
          id: `rec_new_${uid()}`,
          file: f.name,
          status: "queued" as const,
          callStatus: "queued",
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
        ...toRecordingRow(base),
        id: `rec_new_${uid()}`,
        file: f.name,
        status: "queued" as const,
        callStatus: "queued",
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
                created.some((c) => c.id === r.id) ? { ...r, status: "mined" as const } : r,
              ),
            );

            return { ...x, progress: 100, status: "done" };
          }

          return { ...x, progress: p };
        }),
      );
    }, 260);
  };

  // --------------------------------------------------
  // Manual module classification (local state only)
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
  // Training simulation — NOT DYNAMIC
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
        breadcrumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Call recordings" }]}
        title="Train from call recordings"
        description="Bring in your existing call archive, auto-transcribe it, and mine real conversations for intents, objections and answers."
        actions={<div className="flex items-center gap-2" />}
      />

      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        {fetchError && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs">
            <ShieldAlert className="size-4 shrink-0 text-destructive" />
            <span>{fetchError}</span>
          </div>
        )}

        {/* Stats */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            {
              l: "Recordings in library",
              v: formatNumber(libraryTotal),
              i: AudioLines,
            },
            {
              l: "Hours of audio",
              v: `${libraryHours.toFixed(0)} h`,
              i: Clock,
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

        {/* Recording library */}
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

                <Select value={moduleFilter} onValueChange={handleModuleFilter}>
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

                <Select value={outcomeFilter} onValueChange={handleOutcomeFilter}>
                  <SelectTrigger className="h-9 w-40">
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="all">All outcomes</SelectItem>

                    {OUTCOME_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
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
                    <TableHead>Time (IST)</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead>Quality</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>

                <TableBody>
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

                      <TableCell className="text-sm tabular-nums text-muted-foreground">
                        {r.timeIst ?? "—"}
                      </TableCell>

                      <TableCell className="tabular-nums">
                        {formatDuration(r.durationSec)}
                      </TableCell>

                      <TableCell className={r.outcome ? "" : "text-muted-foreground"}>
                        {outcomeLabel(r.outcome)}
                      </TableCell>

                      <TableCell className="tabular-nums text-muted-foreground">
                        {r.qualityKnown || r.quality ? `${r.quality}%` : "—"}
                      </TableCell>

                      <TableCell>
                        <Badge className={callStatusTone(r.callStatus)}>
                          {callStatusLabel(r.callStatus)}
                        </Badge>
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
                Page {page} • {formatNumber(filtered.length)} of {formatNumber(items.length)} on
                this page match filters • {formatNumber(libraryTotal)} total in archive
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
                  disabled={
                    loading ||
                    items.length < PAGE_SIZE ||
                    (totalFromApi !== null && page * PAGE_SIZE >= totalFromApi)
                  }
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

      {/* Detail drawer */}
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
                  {open.agentName} • {open.date}
                  {open.timeIst ? `, ${open.timeIst} IST` : ""} • {formatDuration(open.durationSec)}
                </SheetDescription>
              </SheetHeader>

              <div className="px-4 pb-6 space-y-5">
                {/* Audio */}
                <div className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <audio
                      ref={audioRef}
                      src={audioSrc ?? undefined}
                      preload="none"
                      onLoadedMetadata={(e) => setAudioDuration(e.currentTarget.duration || 0)}
                      onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onEnded={() => setIsPlaying(false)}
                      onError={() => {
                        if (audioSrc) {
                          setAudioError(
                            "Couldn't load this recording — the file may be unavailable.",
                          );
                        }
                      }}
                    />

                    <Button
                      size="icon"
                      variant="secondary"
                      onClick={togglePlayback}
                      disabled={audioLoading}
                    >
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

                {/* Transcript */}
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

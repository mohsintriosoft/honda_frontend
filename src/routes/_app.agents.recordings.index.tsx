import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { IngestDropzone } from "@/components/agents/IngestDropzone";
import { TranscriptViewer, SentimentStrip } from "@/components/agents/TranscriptViewer";
import { TrainingRunProgress } from "@/components/agents/TrainingRunProgress";
import { ModuleBadge } from "@/components/agents/ModuleBadge";
import { ClassificationPanel } from "@/components/agents/ClassificationPanel";
import {
  ModuleFallback, UploadModuleMapping, CampaignModuleMapping,
} from "@/components/agents/ModuleMappingControls";
import {
  recordings as seedRecordings, ingestJobs as seedJobs, minedSuggestions,
  trainingRuns, LIBRARY_TOTAL, OUTCOME_LABEL, formatDuration, totalHours,
  CAMPAIGN_MODULE_MAP, CONFIDENCE_THRESHOLD, classifyTranscript, needsClassification,
  type Recording, type IngestJob, type ModuleSource,
} from "@/mocks/recordings";
import { WORKFLOW_LABEL, agents, type AgentWorkflow } from "@/mocks/agents";
import { formatNumber } from "@/lib/format";
import {
  ArrowLeft, AudioLines, FileSpreadsheet, PhoneCall, Play, Rocket,
  ClipboardCheck, Clock, Sparkles, RefreshCw, ShieldAlert, Check,
} from "lucide-react";

export const Route = createFileRoute("/_app/agents/recordings/")({
  head: () => ({
    meta: [
      { title: "Call Recordings — Agent Training — Triosoft" },
      { name: "description", content: "Ingest thousands of call recordings by upload, CSV/ZIP manifest or dialer sync, transcribe them and mine training data for your AI calling agents." },
      { property: "og:title", content: "Call Recordings — Agent Training" },
      { property: "og:description", content: "Turn your Om Honda call archive into intents, objections and Q&A for AI voice agents." },
    ],
  }),
  component: RecordingsPage,
});

const MODULES: AgentWorkflow[] = ["sales", "service", "insurance", "amc", "winback", "feedback"];

const STATUS_TONE: Record<Recording["status"], string> = {
  queued: "bg-secondary text-muted-foreground",
  transcribing: "bg-[color:var(--ai)]/12 text-[color:var(--ai)]",
  mined: "bg-[color:var(--info)]/12 text-[color:var(--info)]",
  reviewed: "bg-[color:var(--success)]/12 text-[color:var(--success)]",
  failed: "bg-destructive/10 text-destructive",
};

const uid = () => Math.random().toString(36).slice(2, 9);

/** OMH_<MODULE>_<ID>.mp3 → module, or null when the name carries no tag. */
function parseModuleFromName(name: string): AgentWorkflow | null {
  const part = name.toUpperCase().split("_")[1]?.toLowerCase();
  return MODULES.find((m) => m === part) ?? null;
}

function RecordingsPage() {
  const [items, setItems] = useState<Recording[]>(seedRecordings);
  const [jobs, setJobs] = useState<IngestJob[]>(seedJobs);
  const [moduleFilter, setModuleFilter] = useState<string>("all");
  const [outcomeFilter, setOutcomeFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [open, setOpen] = useState<Recording | null>(null);

  // module-mapping controls
  const [uploadMode, setUploadMode] = useState("filename");
  const [forcedModule, setForcedModule] = useState<AgentWorkflow>("service");
  const [fallback, setFallback] = useState("ai");
  const [campaignMap, setCampaignMap] = useState(CAMPAIGN_MODULE_MAP);

  // training run simulation
  const [trainAgent, setTrainAgent] = useState(agents[1]?.id ?? agents[0]!.id);
  const [step, setStep] = useState(-1);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  const pending = minedSuggestions.filter((s) => s.status === "pending").length;
  const unclassified = useMemo(() => items.filter(needsClassification), [items]);

  const filtered = useMemo(
    () =>
      items.filter(
        (r) =>
          (moduleFilter === "all" ||
            (r.moduleSource !== "unknown" && r.module === moduleFilter)) &&
          (classFilter === "all" ||
            (classFilter === "review" ? needsClassification(r) : !needsClassification(r))) &&
          (outcomeFilter === "all" || r.outcome === outcomeFilter) &&
          (q.trim() === "" ||
            r.customer.toLowerCase().includes(q.toLowerCase()) ||
            r.file.toLowerCase().includes(q.toLowerCase())),
      ),
    [items, moduleFilter, classFilter, outcomeFilter, q],
  );

  const trainable = useMemo(() => filtered.filter((r) => !needsClassification(r)), [filtered]);


  const addUploads = (files: File[], source: Recording["source"], label: string) => {
    if (files.length === 0) return;
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
    setItems((s) => [...created, ...s]);
    const job: IngestJob = {
      id: uid(),
      source,
      label,
      files: files.length,
      hours: Math.round((files.length * 4.2) / 60 * 10) / 10,
      startedAt: "Just now",
      progress: 0,
      status: "running",
    };
    setJobs((j) => [job, ...j]);
    const timer = setInterval(() => {
      setJobs((all) =>
        all.map((x) => {
          if (x.id !== job.id) return x;
          const p = Math.min(100, x.progress + 12);
          if (p === 100) {
            clearInterval(timer);
            setItems((rs) => rs.map((r) => (created.some((c) => c.id === r.id) ? { ...r, status: "mined" } : r)));
            return { ...x, progress: 100, status: "done" };
          }
          return { ...x, progress: p };
        }),
      );
    }, 260);
  };

  const setModule = (id: string, module: AgentWorkflow) => {
    setItems((all) =>
      all.map((r) =>
        r.id === id
          ? {
              ...r, module, moduleSource: "manual" as ModuleSource, moduleConfidence: 100,
              moduleAlternatives: [], moduleEvidence: "Set by a reviewer in the library",
            }
          : r,
      ),
    );
    setOpen((o) =>
      o && o.id === id
        ? { ...o, module, moduleSource: "manual", moduleConfidence: 100, moduleAlternatives: [], moduleEvidence: "Set by a reviewer in the library" }
        : o,
    );
  };

  const runTraining = () => {
    setDone(false);
    setStep(0);
    setProgress(0);
    const timer = setInterval(() => {
      setProgress((p) => {
        const next = p + 5;
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

  const trainedAgent = agents.find((a) => a.id === trainAgent)!;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "AI Agents", to: "/agents" }, { label: "Call recordings" }]}
        title="Train from call recordings"
        description="Bring in your existing call archive, auto-transcribe it, and mine real conversations for intents, objections and answers."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/agents"><ArrowLeft className="size-4" /> Agents</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/agents/recordings/review">
                <ClipboardCheck className="size-4" /> Review queue ({pending})
              </Link>
            </Button>
          </div>
        }
      />

      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        {/* Stats */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { l: "Recordings in library", v: formatNumber(LIBRARY_TOTAL + items.length - seedRecordings.length), i: AudioLines },
            { l: "Hours of audio", v: `${(LIBRARY_TOTAL * 0.068 + totalHours(items)).toFixed(0)} h`, i: Clock },
            { l: "Need module review", v: String(unclassified.length), i: ShieldAlert },
            { l: "Mined suggestions", v: String(minedSuggestions.length), i: Sparkles },
            { l: "Pending review", v: String(pending), i: ClipboardCheck },
          ].map((k) => (
            <Card key={k.l}>
              <CardContent className="pt-6 flex items-center gap-3">
                <div className="size-9 rounded-lg bg-primary/10 text-primary grid place-items-center">
                  <k.i className="size-4" />
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{k.l}</div>
                  <div className="text-xl font-semibold font-display tabular-nums">{k.v}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Ingest */}
        <Tabs defaultValue="upload">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="upload"><AudioLines className="size-4" /> Bulk upload</TabsTrigger>
            <TabsTrigger value="manifest"><FileSpreadsheet className="size-4" /> CSV / ZIP manifest</TabsTrigger>
            <TabsTrigger value="dialer"><PhoneCall className="size-4" /> Dialer sync</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Upload recordings</CardTitle>
                <CardDescription>Drop a whole folder exported from your dialer. Each file is transcribed and tagged automatically.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <IngestDropzone onFiles={(f) => addUploads(f, "upload", `${f.length} files uploaded`)} />
                <UploadModuleMapping
                  mode={uploadMode}
                  onMode={setUploadMode}
                  forced={forcedModule}
                  onForced={setForcedModule}
                  sampleFiles={[
                    { name: "OMH_SERVICE_1042.mp3", parsed: "Service" },
                    { name: "OMH_INSURANCE_2210.mp3", parsed: "Insurance" },
                    { name: "call_20260714_0931.mp3", parsed: null },
                  ]}
                />
                <ModuleFallback value={fallback} onChange={setFallback} />
                <p className="text-xs text-muted-foreground">
                  Language auto-detects Bhopali Hindi / Hinglish. Anything the pattern can't tag falls back to
                  {fallback === "ai" ? " the transcript classifier" : " the Needs-classification queue"} and can always be corrected in the library.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="manifest" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Import a manifest</CardTitle>
                <CardDescription>ZIP of audio, or a CSV of recording URLs plus metadata.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <IngestDropzone
                  accept=".csv,.zip"
                  title="Drop manifest.csv or recordings.zip"
                  hint="CSV columns: url, module, agent, date, outcome, language"
                  onFiles={(f) => addUploads(f, "manifest", f[0]?.name ?? "manifest import")}
                />
                <div className="rounded-lg border">
                  <div className="border-b px-3 py-2 text-xs font-medium">Column mapping preview</div>
                  <div className="grid gap-2 p-3 sm:grid-cols-3">
                    {[
                      ["url", "Recording file"],
                      ["module", "Workflow / module"],
                      ["agent", "Agent on call"],
                      ["date", "Call date"],
                      ["outcome", "Call outcome"],
                      ["language", "Language"],
                    ].map(([csv, field]) => (
                      <div key={csv} className="flex items-center justify-between rounded-md bg-muted/50 px-2.5 py-1.5 text-xs">
                        <span className="font-mono">
                          {csv}
                          {csv === "module" && <span className="ml-1 text-destructive">*</span>}
                        </span>
                        <span className="text-muted-foreground">→ {field}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t px-3 py-2 text-xs text-muted-foreground">
                    <span className="text-destructive">*</span> required — rows with a missing or unknown{" "}
                    <span className="font-mono">module</span> value are flagged in the preview and routed by the fallback rule.
                    <span className="ml-1 font-medium">3 of 208 rows flagged.</span>
                  </div>
                </div>
                <ModuleFallback value={fallback} onChange={setFallback} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dialer" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sync from the dialer</CardTitle>
                <CardDescription>Pull recordings automatically from your telephony provider.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="space-y-1.5">
                    <Label>Provider</Label>
                    <Select defaultValue="exotel">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="exotel">Exotel</SelectItem>
                        <SelectItem value="knowlarity">Knowlarity</SelectItem>
                        <SelectItem value="ozonetel">Ozonetel</SelectItem>
                        <SelectItem value="twilio">Twilio</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Modules</Label>
                    <Select defaultValue="all">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All modules</SelectItem>
                        {MODULES.map((m) => (
                          <SelectItem key={m} value={m}>{WORKFLOW_LABEL[m]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>From date</Label>
                    <Input type="date" defaultValue="2026-01-01" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Schedule</Label>
                    <Select defaultValue="daily">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hourly">Every hour</SelectItem>
                        <SelectItem value="daily">Daily 2:00 AM</SelectItem>
                        <SelectItem value="manual">Manual only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <CampaignModuleMapping
                  map={campaignMap}
                  onChange={(campaign, module) =>
                    setCampaignMap((m) => m.map((c) => (c.campaign === campaign ? { ...c, module } : c)))
                  }
                />
                <ModuleFallback value={fallback} onChange={setFallback} />
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="sm" onClick={() => addUploads(
                    Array.from({ length: 25 }, (_, i) => new File([], `DIALER_${i}.mp3`)),
                    "dialer",
                    "Dialer sync — manual run",
                  )}>
                    <RefreshCw className="size-4" /> Sync now
                  </Button>
                  <span className="text-xs text-muted-foreground">Last sync: today 09:12 • 612 recordings pulled</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Ingest jobs */}
        <Card>
          <CardHeader><CardTitle className="text-base">Ingest jobs</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {jobs.map((j) => (
              <div key={j.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="truncate">{j.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {j.files} files • {j.hours} h • {j.startedAt}
                  </span>
                </div>
                <Progress value={j.progress} className="h-1.5" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Library */}
        <Card>
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">Recording library</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Input
                  placeholder="Search customer or file…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="h-9 w-56"
                />
                <Select value={moduleFilter} onValueChange={setModuleFilter}>
                  <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All modules</SelectItem>
                    {MODULES.map((m) => (
                      <SelectItem key={m} value={m}>{WORKFLOW_LABEL[m]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={classFilter} onValueChange={setClassFilter}>
                  <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All classifications</SelectItem>
                    <SelectItem value="confirmed">Confirmed module</SelectItem>
                    <SelectItem value="review">Needs module review</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
                  <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All outcomes</SelectItem>
                    {Object.entries(OUTCOME_LABEL).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
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
                      <TableCell><ModuleBadge r={r} /></TableCell>
                      <TableCell className="text-sm">{r.agentName}</TableCell>
                      <TableCell className="text-sm tabular-nums">{r.date}</TableCell>
                      <TableCell className="tabular-nums">{formatDuration(r.durationSec)}</TableCell>
                      <TableCell>{OUTCOME_LABEL[r.outcome]}</TableCell>
                      <TableCell className="tabular-nums">{r.quality}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_TONE[r.status]}>{r.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setOpen(r); }}>
                          <Play className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="px-4 py-3 text-xs text-muted-foreground">
              Showing {Math.min(25, filtered.length)} of {formatNumber(filtered.length)} filtered • {formatNumber(LIBRARY_TOTAL)} total in archive
            </div>
          </CardContent>
        </Card>

        {/* Needs classification */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldAlert className="size-4 text-destructive" />
                  Needs classification ({unclassified.length})
                </CardTitle>
                <CardDescription>
                  Calls with no module tag, or an AI guess below {CONFIDENCE_THRESHOLD}% confidence. They are excluded from training until confirmed.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {unclassified.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-muted-foreground">Every call in the library has a confirmed module.</p>
            ) : (
              <div className="divide-y">
                {unclassified.slice(0, 8).map((r) => (
                  <div key={r.id} className="flex flex-wrap items-start justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{r.customer}</span>
                        <span className="font-mono text-[11px] text-muted-foreground">{r.file}</span>
                      </div>
                      <p className="mt-1 max-w-xl truncate text-xs text-muted-foreground">
                        “{r.transcript[1]?.text ?? r.transcript[0]?.text}”
                      </p>
                      <div className="mt-1 text-[11px] text-muted-foreground">{r.moduleEvidence}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {MODULES.map((m) => (
                        <Button
                          key={m}
                          size="sm"
                          variant={r.moduleSource === "ai" && r.module === m ? "secondary" : "outline"}
                          className="h-7 px-2 text-xs"
                          onClick={() => setModule(r.id, m)}
                        >
                          {r.moduleSource === "ai" && r.module === m && <Check className="size-3" />}
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
                Showing 8 of {unclassified.length} • filter the library by “Needs module review” to see them all
              </div>
            )}
          </CardContent>
        </Card>

        {/* Training run */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Train an agent from these calls</CardTitle>
            <CardDescription>
              Only calls with a confirmed module and approved suggestions from the review queue are used.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,300px)_1fr] md:items-end">
              <div className="space-y-1.5">
                <Label>Target agent</Label>
                <Select value={trainAgent} onValueChange={setTrainAgent}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={runTraining} disabled={step >= 0 && !done}>
                  <Rocket className="size-4" /> Train from {formatNumber(trainable.length)} calls
                </Button>
                <span className="text-xs text-muted-foreground">
                  {trainedAgent.version} → {bump(trainedAgent.version)} • {minedSuggestions.filter((s) => s.targetAgentId === trainAgent).length} items ready
                </span>
              </div>
            </div>

            {filtered.length - trainable.length > 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs">
                <ShieldAlert className="size-4 shrink-0 text-destructive" />
                <span>
                  {formatNumber(filtered.length - trainable.length)} calls excluded — module unconfirmed. Confirm them in
                  “Needs classification” above so they train the right agent.
                </span>
              </div>
            )}

            {step >= 0 && <TrainingRunProgress step={step} progress={progress} />}

            {done && (
              <div className="grid gap-3 sm:grid-cols-4">
                {[
                  { l: "Intent accuracy", v: `${trainedAgent.metrics.intentAccuracy}% → ${Math.min(99, trainedAgent.metrics.intentAccuracy + 5)}%` },
                  { l: "New intents learned", v: "6" },
                  { l: "Objection coverage", v: "87%" },
                  { l: "Version", v: `${trainedAgent.version} → ${bump(trainedAgent.version)}` },
                ].map((m) => (
                  <div key={m.l} className="rounded-lg border p-3">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{m.l}</div>
                    <div className="mt-1 text-sm font-semibold tabular-nums">{m.v}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-lg border divide-y">
              {trainingRuns.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <span>{agents.find((a) => a.id === r.agentId)?.name ?? r.agentId}</span>
                  <span className="text-xs text-muted-foreground">
                    {r.fromCalls} calls • {r.items} items • {r.fromVersion} → {r.toVersion} • accuracy {r.accuracyBefore}% → {r.accuracyAfter}%
                  </span>
                  <span className="text-xs text-muted-foreground">{r.ranAt}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detail drawer */}
      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {open && (
            <>
              <SheetHeader>
                <SheetTitle>{open.customer}</SheetTitle>
                <SheetDescription>
                  {open.moduleSource === "unknown" ? "Unclassified" : WORKFLOW_LABEL[open.module]} • {open.agentName} • {open.date} • {formatDuration(open.durationSec)}
                </SheetDescription>
              </SheetHeader>
              <div className="px-4 pb-6 space-y-5">
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <Button size="icon" variant="secondary"><Play className="size-4" /></Button>
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground font-mono">{open.file}</div>
                    <Progress value={0} className="h-1.5 mt-2" />
                  </div>
                  <span className="text-xs tabular-nums text-muted-foreground">{formatDuration(open.durationSec)}</span>
                </div>

                <ClassificationPanel r={open} onOverride={setModule} />

                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Sentiment</div>
                  <SentimentStrip points={open.sentiment} />
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {open.detectedIntents.map((i) => (
                    <Badge key={i} variant="outline" className="font-mono text-[10px]">{i}</Badge>
                  ))}
                  {open.objectionsRaised.map((o) => (
                    <Badge key={o} variant="secondary" className="text-[10px]">“{o}”</Badge>
                  ))}
                </div>

                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Transcript</div>
                  <TranscriptViewer turns={open.transcript} />
                </div>

                <Button className="w-full" asChild>
                  <Link to="/agents/recordings/review">
                    <Sparkles className="size-4" /> Mine this call into training data
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
  if (!m) return v;
  return `v${m[1]}.${Number(m[2]) + 1}`;
}

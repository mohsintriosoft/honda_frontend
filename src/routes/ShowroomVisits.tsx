import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  FileSpreadsheet,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UploadCloud,
} from "lucide-react";

import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { cn } from "@/lib/utils";
import { hasPerm } from "@/lib/permissions";
import {
  get_visit_batches,
  post_visit_upload,
  visit_batch_url,
  post_visit_process,
  get_visit_records,
  visit_record_url,
  get_visit_summary,
  get_visit_mappings,
  post_visit_mapping,
  visit_mapping_url,
  post_visit_mappings_reapply,
  server_get_data,
  server_post_json,
  server_patch_data,
  server_delete_data,
  server_upload_file,
} from "@/components/ServiceConnection/serviceconnection";

/* ------------------------------------------------------------------
   Types -- mirror views_showroom.py
------------------------------------------------------------------ */

type Outcome = "visited" | "booked" | "rescheduled" | "not_contacted" | "lost" | "unresolved";

type Batch = {
  id: number;
  file_name: string;
  sheet_name: string;
  report_date: string | null;
  status: string;
  stalled: boolean;
  total_rows: number;
  matched_rows: number;
  unmatched_rows: number;
  failed_rows: number;
  visited_rows: number;
  service_records_written: number;
  uploaded_by: string | null;
  created_at: string | null;
  errors: number;
  preview?: {
    outcomes?: Record<Outcome, number>;
    projected_match?: { chassis: number; registration: number; phone: number; unmatched: number };
    columns_missing?: string[];
    replaces_batch_id?: number | null;
  };
  error_log?: { row: number | null; error: string }[];
};

type VisitRecord = {
  id: number;
  batch_id: number;
  report_date: string;
  customer_name: string;
  contact_number: string;
  model_name: string;
  registration_no: string;
  chassis_no: string;
  branch: string | null;
  call_status: string;
  appointment_status: string;
  comments: string;
  visit_outcome: Outcome;
  outcome_source: string;
  outcome_overridden: boolean;
  match_method: string;
  customer: { id: number; name: string } | null;
  vehicle: { id: number; name: string; chassis_no: string } | null;
  call: { session_id: string; started_at: string; campaign: string | null; final_intent: string | null } | null;
  appointment: { id: number; slot_date: string; status: string } | null;
  service_record: { id: number; service_date: string; service_type: string } | null;
  service_appointment_date: string | null;
  next_call_plan_date: string | null;
  cre_user_id: string;
  raw_data?: Record<string, unknown>;
};

type Summary = {
  date_from: string;
  date_to: string;
  rows: number;
  matched: number;
  unmatched: number;
  outcomes: Record<Outcome, number>;
  visited_vehicles: number;
  booked_vehicles: number;
  visited_by_bot: number;
  booked_by_bot: number;
  bot_called_vehicles: number;
  bot_visit_rate: number | null;
  service_records_written: number;
  lookback_days: number;
  by_date: ({ date: string; total: number } & Record<Outcome, number>)[];
  by_campaign: { campaign_id: number; campaign: string; visited: number; booked: number }[];
};

type Mapping = {
  id: number;
  field: "appointment_status" | "comment" | "call_status";
  raw_value: string;
  normalized_outcome: Outcome;
  priority: number;
  is_active: boolean;
  seen: number | null;
};

/* ------------------------------------------------------------------
   Constants / helpers
------------------------------------------------------------------ */

const OUTCOMES: Outcome[] = ["visited", "booked", "rescheduled", "not_contacted", "lost", "unresolved"];

const OUTCOME_META: Record<Outcome, { label: string; bar: string; chip: string }> = {
  visited: {
    label: "Visited",
    bar: "bg-emerald-500",
    chip: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  booked: {
    label: "Booked",
    bar: "bg-sky-500",
    chip: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  },
  rescheduled: {
    label: "Rescheduled",
    bar: "bg-amber-500",
    chip: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  not_contacted: {
    label: "Not contacted",
    bar: "bg-slate-400",
    chip: "border-border bg-muted text-muted-foreground",
  },
  lost: {
    label: "Lost",
    bar: "bg-rose-500",
    chip: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400",
  },
  unresolved: {
    label: "Needs triage",
    bar: "bg-violet-400",
    chip: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-400",
  },
};

const FIELD_LABELS: Record<Mapping["field"], string> = {
  appointment_status: "Appointment Status is",
  comment: "Comments contain",
  call_status: "Call Status is",
};

const MATCH_LABELS: Record<string, string> = {
  chassis: "Frame #",
  registration: "Registration",
  phone_model: "Phone + model",
  phone: "Customer only",
  manual: "Manual",
  "": "Unmatched",
};

const RUNNING = new Set(["uploaded", "parsing", "processing"]);

const STATUS_META: Record<string, { label: string; className: string }> = {
  uploaded: { label: "Queued", className: "bg-muted text-muted-foreground" },
  parsing: { label: "Reading…", className: "bg-sky-500/10 text-sky-700 dark:text-sky-400" },
  preview_ready: { label: "Ready to process", className: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  processing: { label: "Processing…", className: "bg-sky-500/10 text-sky-700 dark:text-sky-400" },
  done: { label: "Done", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  failed: { label: "Failed", className: "bg-destructive/10 text-destructive" },
  superseded: { label: "Replaced", className: "bg-muted text-muted-foreground line-through" },
};

function apiError(err: any, fallback: string) {
  if (err?.response?.status === 403) return "You don't have permission to do this.";
  return err?.response?.data?.error || fallback;
}

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const pct = (part: number, whole: number) => (whole ? Math.round((part * 100) / whole) : 0);

function OutcomeBadge({ outcome, overridden }: { outcome: Outcome; overridden?: boolean }) {
  const meta = OUTCOME_META[outcome] ?? OUTCOME_META.unresolved;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        meta.chip,
      )}
    >
      {meta.label}
      {overridden && <span title="Set by staff">•</span>}
    </span>
  );
}

function StatusChip({ batch }: { batch: Batch }) {
  const meta = STATUS_META[batch.status] ?? { label: batch.status, className: "bg-muted" };
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", meta.className)}>
      {batch.stalled && RUNNING.has(batch.status) ? "Stalled" : meta.label}
    </span>
  );
}

function OutcomeBar({ counts, total }: { counts: Partial<Record<Outcome, number>>; total: number }) {
  if (!total) return <div className="h-2 rounded-full bg-muted" />;
  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label="Outcome split">
      {OUTCOMES.map((o) =>
        counts[o] ? (
          <div
            key={o}
            className={OUTCOME_META[o].bar}
            style={{ width: `${((counts[o] ?? 0) * 100) / total}%` }}
            title={`${OUTCOME_META[o].label}: ${counts[o]}`}
          />
        ) : null,
      )}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {OUTCOMES.map((o) => (
        <span key={o} className="inline-flex items-center gap-1.5">
          <span className={cn("size-2 rounded-full", OUTCOME_META[o].bar)} />
          {OUTCOME_META[o].label}
        </span>
      ))}
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-semibold font-display tabular-nums">{value}</div>
        {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------
   Overview
------------------------------------------------------------------ */

function OverviewTab() {
  const [range, setRange] = useState({ from: "", to: "" });
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (from?: string, to?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (from) params.date_from = from;
      if (to) params.date_to = to;
      const res = await server_get_data(get_visit_summary, params);
      if (!res?.success) throw { response: { data: res } };
      setData(res);
      setRange({ from: res.date_from, to: res.date_to });
    } catch (err) {
      setError(apiError(err, "Couldn't load the reconciliation numbers."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const maxDay = useMemo(() => Math.max(1, ...(data?.by_date ?? []).map((d) => d.total)), [data]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">From</Label>
          <Input
            type="date"
            className="mt-1 w-40"
            value={range.from}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
          />
        </div>
        <div>
          <Label className="text-xs">To</Label>
          <Input
            type="date"
            className="mt-1 w-40"
            value={range.to}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
          />
        </div>
        <Button variant="outline" onClick={() => load(range.from, range.to)} disabled={loading}>
          <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          Apply
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {!data && loading && (
        <div className="flex items-center gap-2 py-16 justify-center text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      )}

      {data && data.rows === 0 && !loading && (
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            No CRE rows in this date range yet. Upload the daily file from the Imports tab.
          </CardContent>
        </Card>
      )}

      {data && data.rows > 0 && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              label="Vehicles visited"
              value={data.visited_vehicles}
              hint={`${data.booked_vehicles} more booked, not yet in`}
            />
            <Kpi
              label="Visited after an Aarohi call"
              value={data.visited_by_bot}
              hint={`call within ${data.lookback_days} days before the visit`}
            />
            <Kpi
              label="Bot visit rate"
              value={data.bot_visit_rate != null ? `${data.bot_visit_rate}%` : "—"}
              hint={`of ${data.bot_called_vehicles} vehicles Aarohi reached`}
            />
            <Kpi
              label="Rows matched"
              value={`${pct(data.matched, data.rows)}%`}
              hint={`${data.unmatched} rows need a manual match`}
            />
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-display">CRE outcome by day</CardTitle>
              <Legend />
            </CardHeader>
            <CardContent className="space-y-2">
              {data.by_date.map((d) => (
                <div key={d.date} className="grid grid-cols-[90px_1fr_60px] items-center gap-3 text-sm">
                  <span className="text-muted-foreground tabular-nums">{fmtDate(d.date)}</span>
                  <div style={{ width: `${Math.max(8, (d.total * 100) / maxDay)}%` }}>
                    <OutcomeBar counts={d} total={d.total} />
                  </div>
                  <span className="text-right tabular-nums text-muted-foreground">{d.total}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-display">All rows in range</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {OUTCOMES.map((o) => (
                  <div key={o} className="flex items-center justify-between text-sm">
                    <OutcomeBadge outcome={o} />
                    <span className="tabular-nums">
                      {data.outcomes[o]}{" "}
                      <span className="text-muted-foreground">({pct(data.outcomes[o], data.rows)}%)</span>
                    </span>
                  </div>
                ))}
                <p className="pt-2 text-xs text-muted-foreground">
                  A customer the CRE calls on several days appears once per day here. The vehicle
                  counts above are de-duplicated.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-display">By campaign (Aarohi calls)</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {data.by_campaign.length === 0 ? (
                  <p className="px-6 pb-6 text-sm text-muted-foreground">
                    No visit or booking in this range could be traced to a campaign call yet.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Campaign</TableHead>
                        <TableHead className="text-right">Visited</TableHead>
                        <TableHead className="text-right">Booked</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.by_campaign.map((c) => (
                        <TableRow key={c.campaign_id}>
                          <TableCell>
                            <Link to={`/campaigns/${c.campaign_id}`} className="hover:text-primary">
                              {c.campaign}
                            </Link>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{c.visited}</TableCell>
                          <TableCell className="text-right tabular-nums">{c.booked}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------
   Imports
------------------------------------------------------------------ */

function PreviewDialog({
  batchId,
  onClose,
  onProcess,
  canEdit,
}: {
  batchId: number | null;
  onClose: () => void;
  onProcess: (id: number) => void;
  canEdit: boolean;
}) {
  const [batch, setBatch] = useState<Batch | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (batchId == null) return;
    setBatch(null);
    setError(null);
    server_get_data(visit_batch_url(batchId))
      .then((res) => setBatch(res?.batch ?? null))
      .catch((err) => setError(apiError(err, "Couldn't load this import.")));
  }, [batchId]);

  const p = batch?.preview;
  const outcomeTotal = OUTCOMES.reduce((n, o) => n + (p?.outcomes?.[o] ?? 0), 0);

  return (
    <Dialog open={batchId != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {batch ? `${fmtDate(batch.report_date)} · sheet "${batch.sheet_name}"` : "Import"}
          </DialogTitle>
          <DialogDescription>
            {batch ? `${batch.total_rows} rows from ${batch.file_name}` : "Loading…"}
          </DialogDescription>
        </DialogHeader>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {!batch && !error && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        )}

        {batch && p && (
          <div className="space-y-4 text-sm">
            {p.replaces_batch_id && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-800 dark:text-amber-300">
                This date was already imported. Processing replaces it — rows missing from this file
                are retired and their service records undone.
              </div>
            )}

            <div>
              <div className="mb-2 font-medium">What the CRE rows say</div>
              <OutcomeBar counts={p.outcomes ?? {}} total={outcomeTotal} />
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                {OUTCOMES.map((o) => (
                  <div key={o} className="flex justify-between">
                    <span className="text-muted-foreground">{OUTCOME_META[o].label}</span>
                    <span className="tabular-nums">{p.outcomes?.[o] ?? 0}</span>
                  </div>
                ))}
              </div>
            </div>

            {p.projected_match && (
              <div>
                <div className="mb-2 font-medium">Expected matching</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <span className="text-muted-foreground">By frame number</span>
                  <span className="text-right tabular-nums">{p.projected_match.chassis}</span>
                  <span className="text-muted-foreground">By registration</span>
                  <span className="text-right tabular-nums">{p.projected_match.registration}</span>
                  <span className="text-muted-foreground">By phone</span>
                  <span className="text-right tabular-nums">{p.projected_match.phone}</span>
                  <span className="text-muted-foreground">No match</span>
                  <span className="text-right tabular-nums">{p.projected_match.unmatched}</span>
                </div>
              </div>
            )}

            {!!p.columns_missing?.length && (
              <p className="text-xs text-muted-foreground">
                Columns not found (ignored): {p.columns_missing.join(", ")}
              </p>
            )}

            {!!batch.error_log?.length && (
              <div className="max-h-32 overflow-auto rounded-md border bg-muted/30 p-2 text-xs">
                {batch.error_log.map((e, i) => (
                  <div key={i}>
                    {e.row ? `Row ${e.row}: ` : ""}
                    {e.error}
                  </div>
                ))}
              </div>
            )}

            {canEdit && ["preview_ready", "done", "failed"].includes(batch.status) && (
              <Button className="w-full" onClick={() => onProcess(batch.id)}>
                <Play className="size-4" />
                {batch.status === "done" ? "Process again" : "Process now"}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ImportsTab({ canEdit, onOpenRecords }: { canEdit: boolean; onOpenRecords: (b: Batch) => void }) {
  const [batches, setBatches] = useState<Batch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [reportDate, setReportDate] = useState("");
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await server_get_data(get_visit_batches);
      setBatches(res?.batches ?? []);
      setError(null);
    } catch (err) {
      setError(apiError(err, "Couldn't load imports."));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Poll while anything is still being read or processed.
  const anyRunning = (batches ?? []).some((b) => RUNNING.has(b.status) && !b.stalled);
  useEffect(() => {
    if (!anyRunning) return;
    const t = window.setInterval(load, 3000);
    return () => window.clearInterval(t);
  }, [anyRunning, load]);

  async function upload() {
    if (!file) return;
    if (!/\.(xlsx|xlsm)$/i.test(file.name)) {
      setError("Upload the CRE export as .xlsx. Save an old .xls file as .xlsx first.");
      return;
    }
    setUploading(true);
    setError(null);
    setNotice(null);
    try {
      // Only send report_date when one was actually picked -- an unset
      // value would otherwise go out as the text "undefined".
      const extra: Record<string, string> = {};
      if (reportDate) extra.report_date = reportDate;
      const res = await server_upload_file(post_visit_upload, file, "file", extra);
      if (!res?.success) throw { response: { data: res } };
      if (res.warning) setNotice(res.warning);
      setFile(null);
      setReportDate("");
      if (fileInput.current) fileInput.current.value = "";
      await load();
    } catch (err) {
      setError(apiError(err, "Upload failed."));
    } finally {
      setUploading(false);
    }
  }

  async function processBatch(id: number) {
    setBusyId(id);
    setError(null);
    setPreviewId(null);
    try {
      const res = await server_post_json(post_visit_process(id), {});
      if (!res?.success) throw { response: { data: res } };
      await load();
    } catch (err) {
      setError(apiError(err, "Couldn't start processing."));
    } finally {
      setBusyId(null);
    }
  }

  async function processAllReady() {
    for (const b of (batches ?? []).filter((x) => x.status === "preview_ready")) {
      // one at a time -- same-date sheets must not race each other
      // eslint-disable-next-line no-await-in-loop
      await processBatch(b.id);
    }
  }

  async function remove(b: Batch) {
    if (!window.confirm(`Delete the ${fmtDate(b.report_date)} import? Its service records are undone.`)) return;
    setBusyId(b.id);
    try {
      const res = await server_delete_data(visit_batch_url(b.id));
      if (res?.success === false) throw { response: { data: res } };
      await load();
    } catch (err) {
      setError(apiError(err, "Couldn't delete this import."));
    } finally {
      setBusyId(null);
    }
  }

  const readyCount = (batches ?? []).filter((b) => b.status === "preview_ready").length;

  return (
    <div className="space-y-4">
      {canEdit && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display">Upload the CRE daily file</CardTitle>
            <p className="text-sm text-muted-foreground">
              Every sheet becomes one report day. The date is read from the sheet name ("5 august",
              "8 AUST", "11") and the CRE's own timestamps. Nothing is written until you process it.
            </p>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="min-w-64 flex-1">
              <Label className="text-xs">Workbook (.xlsx)</Label>
              <Input
                ref={fileInput}
                type="file"
                accept=".xlsx,.xlsm"
                className="mt-1"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div>
              <Label className="text-xs">Report date — optional, one-sheet files only</Label>
              <Input
                type="date"
                className="mt-1 w-44"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
              />
            </div>
            <Button onClick={upload} disabled={!file || uploading}>
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
          {notice}
        </div>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base font-display">Imported days</CardTitle>
          <div className="flex gap-2">
            {canEdit && readyCount > 1 && (
              <Button size="sm" onClick={processAllReady} disabled={busyId != null}>
                <Play className="size-4" /> Process all ready ({readyCount})
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={load}>
              <RefreshCw className="size-4" /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {batches === null ? (
            <div className="flex items-center gap-2 px-6 pb-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          ) : batches.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 pb-10 pt-4 text-center text-sm text-muted-foreground">
              <FileSpreadsheet className="size-6" />
              No CRE files imported yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Report date</TableHead>
                    <TableHead>Sheet</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Rows</TableHead>
                    <TableHead className="text-right">Matched</TableHead>
                    <TableHead className="text-right">Visited</TableHead>
                    <TableHead className="text-right">Service records</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((b) => (
                    <TableRow key={b.id} className={b.status === "superseded" ? "opacity-60" : ""}>
                      <TableCell className="font-medium whitespace-nowrap">{fmtDate(b.report_date)}</TableCell>
                      <TableCell>
                        <div className="text-sm">{b.sheet_name}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-48">{b.file_name}</div>
                      </TableCell>
                      <TableCell>
                        <StatusChip batch={b} />
                        {b.failed_rows > 0 && (
                          <div className="mt-1 text-xs text-destructive">{b.failed_rows} rows failed</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{b.total_rows}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {b.status === "done" || b.status === "superseded" ? (
                          <>
                            {b.matched_rows}
                            <span className="text-muted-foreground"> / {b.total_rows}</span>
                          </>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {b.status === "done" ? b.visited_rows : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {b.status === "done" ? b.service_records_written : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {b.status !== "uploaded" && b.status !== "parsing" && (
                            <Button size="sm" variant="ghost" onClick={() => setPreviewId(b.id)}>
                              <Eye className="size-4" />
                            </Button>
                          )}
                          {canEdit && (b.status === "preview_ready" || (b.status === "processing" && b.stalled)) && (
                            <Button size="sm" onClick={() => processBatch(b.id)} disabled={busyId === b.id}>
                              {busyId === b.id ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <Play className="size-4" />
                              )}
                              {b.stalled ? "Resume" : "Process"}
                            </Button>
                          )}
                          {(b.status === "done" || b.status === "superseded") && (
                            <Button size="sm" variant="outline" onClick={() => onOpenRecords(b)}>
                              Rows
                            </Button>
                          )}
                          {canEdit && !RUNNING.has(b.status) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => remove(b)}
                              disabled={busyId === b.id}
                              aria-label="Delete import"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <PreviewDialog
        batchId={previewId}
        onClose={() => setPreviewId(null)}
        onProcess={processBatch}
        canEdit={canEdit}
      />
    </div>
  );
}

/* ------------------------------------------------------------------
   Records
------------------------------------------------------------------ */

function RecordDialog({
  recordId,
  canEdit,
  onClose,
  onSaved,
}: {
  recordId: number | null;
  canEdit: boolean;
  onClose: () => void;
  onSaved: (r: VisitRecord) => void;
}) {
  const [rec, setRec] = useState<VisitRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [frame, setFrame] = useState("");
  const [saving, setSaving] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    if (recordId == null) return;
    setRec(null);
    setError(null);
    setFrame("");
    setShowRaw(false);
    server_get_data(visit_record_url(recordId))
      .then((res) => setRec(res?.record ?? null))
      .catch((err) => setError(apiError(err, "Couldn't load this row.")));
  }, [recordId]);

  async function patch(body: Record<string, unknown>) {
    if (!rec) return;
    setSaving(true);
    setError(null);
    try {
      const res = await server_patch_data(visit_record_url(rec.id), body);
      if (!res?.success) throw { response: { data: res } };
      setRec(res.record);
      onSaved(res.record);
      setFrame("");
    } catch (err) {
      setError(apiError(err, "Couldn't save."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={recordId != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{rec ? rec.customer_name || "Customer" : "Row"}</DialogTitle>
          <DialogDescription>
            {rec ? `${fmtDate(rec.report_date)} · ${rec.contact_number || "no phone"}` : "Loading…"}
          </DialogDescription>
        </DialogHeader>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {!rec && !error && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        )}

        {rec && (
          <div className="space-y-4 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border p-3">
                <div className="text-xs uppercase text-muted-foreground">CRE said</div>
                <div className="mt-1 font-medium">{rec.appointment_status || "—"}</div>
                <div className="text-muted-foreground">{rec.call_status || "—"}</div>
                <div className="mt-1 break-words">{rec.comments || "No comment"}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {rec.cre_user_id || "CRE"} · next call {fmtDateTime(rec.next_call_plan_date)}
                </div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs uppercase text-muted-foreground">Vehicle in the file</div>
                <div className="mt-1 font-medium">{rec.model_name || "—"}</div>
                <div className="font-mono text-xs">{rec.chassis_no || "no frame #"}</div>
                <div className="font-mono text-xs text-muted-foreground">{rec.registration_no || "—"}</div>
                <div className="mt-1 text-xs text-muted-foreground">{rec.branch || "Branch not recognised"}</div>
              </div>
            </div>

            <div className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs uppercase text-muted-foreground">Outcome</div>
                <OutcomeBadge outcome={rec.visit_outcome} overridden={rec.outcome_overridden} />
              </div>
              <p className="text-xs text-muted-foreground">
                {rec.outcome_overridden
                  ? "Set by staff — rule changes won't touch it."
                  : `From the ${rec.outcome_source.replace("_", " ")} rule.`}
              </p>
              {canEdit && (
                <Select
                  value={rec.outcome_overridden ? rec.visit_outcome : "auto"}
                  onValueChange={(v) => patch({ visit_outcome: v })}
                  disabled={saving}
                >
                  <SelectTrigger className="w-60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Automatic (use rules)</SelectItem>
                    {OUTCOMES.map((o) => (
                      <SelectItem key={o} value={o}>
                        {OUTCOME_META[o].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs uppercase text-muted-foreground">Matched to</div>
                <Badge variant="outline">{MATCH_LABELS[rec.match_method] ?? rec.match_method}</Badge>
              </div>
              {rec.customer ? (
                <div>
                  <Link to={`/customers/${rec.customer.id}`} className="font-medium hover:text-primary">
                    {rec.customer.name || `Customer #${rec.customer.id}`}
                  </Link>
                  {rec.vehicle ? (
                    <div className="text-xs text-muted-foreground">
                      {rec.vehicle.name} · <span className="font-mono">{rec.vehicle.chassis_no || "—"}</span>
                    </div>
                  ) : (
                    <div className="text-xs text-amber-700 dark:text-amber-400">
                      Customer found, but not which vehicle — no service record is written until a
                      vehicle is matched.
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">Not matched to anyone in the system.</p>
              )}
              {canEdit && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Input
                    placeholder="Frame # of the right vehicle"
                    className="w-64 font-mono"
                    value={frame}
                    onChange={(e) => setFrame(e.target.value.toUpperCase())}
                  />
                  <Button size="sm" onClick={() => patch({ chassis_no: frame })} disabled={!frame.trim() || saving}>
                    Match
                  </Button>
                  {rec.match_method === "manual" && (
                    <Button size="sm" variant="ghost" onClick={() => patch({ vehicle_id: null })} disabled={saving}>
                      Un-match
                    </Button>
                  )}
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border p-3">
                <div className="text-xs uppercase text-muted-foreground">Aarohi call</div>
                {rec.call ? (
                  <>
                    <div className="mt-1">{fmtDateTime(rec.call.started_at)}</div>
                    <div className="text-xs text-muted-foreground">{rec.call.campaign || "No campaign"}</div>
                  </>
                ) : (
                  <div className="mt-1 text-muted-foreground">None in window</div>
                )}
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs uppercase text-muted-foreground">Appointment</div>
                {rec.appointment ? (
                  <>
                    <div className="mt-1">{fmtDate(rec.appointment.slot_date)}</div>
                    <div className="text-xs text-muted-foreground capitalize">{rec.appointment.status}</div>
                  </>
                ) : (
                  <div className="mt-1 text-muted-foreground">None</div>
                )}
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs uppercase text-muted-foreground">Service record</div>
                {rec.service_record ? (
                  <>
                    <div className="mt-1 inline-flex items-center gap-1">
                      <CheckCircle2 className="size-3.5 text-emerald-600" />
                      {fmtDate(rec.service_record.service_date)}
                    </div>
                    <div className="text-xs text-muted-foreground">{rec.service_record.service_type}</div>
                  </>
                ) : (
                  <div className="mt-1 text-muted-foreground">Not written</div>
                )}
              </div>
            </div>

            <div>
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => setShowRaw((s) => !s)}
              >
                {showRaw ? "Hide" : "Show"} all columns from the file
              </button>
              {showRaw && (
                <div className="mt-2 max-h-64 overflow-auto rounded-md border">
                  <table className="w-full text-xs">
                    <tbody>
                      {Object.entries(rec.raw_data ?? {}).map(([k, v]) => (
                        <tr key={k} className="border-b last:border-0">
                          <td className="px-2 py-1 text-muted-foreground align-top w-48">{k}</td>
                          <td className="px-2 py-1 break-words">{v == null || v === "" ? "—" : String(v)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RecordsTab({
  canEdit,
  batchFilter,
  onClearBatch,
}: {
  canEdit: boolean;
  batchFilter: Batch | null;
  onClearBatch: () => void;
}) {
  const PAGE_SIZE = 50;
  const [outcome, setOutcome] = useState("all");
  const [matched, setMatched] = useState("all");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<VisitRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => setPage(1), [outcome, matched, debouncedQ, batchFilter?.id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params: Record<string, string | number> = { page, page_size: PAGE_SIZE };
    if (outcome !== "all") params.outcome = outcome;
    if (matched !== "all") params.matched = matched;
    if (debouncedQ) params.q = debouncedQ;
    if (batchFilter) params.batch = batchFilter.id;
    server_get_data(get_visit_records, params)
      .then((res) => {
        if (cancelled) return;
        setRows(res?.records ?? []);
        setTotal(res?.count ?? 0);
      })
      .catch((err) => !cancelled && setError(apiError(err, "Couldn't load rows.")))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, outcome, matched, debouncedQ, batchFilter]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-64 flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Name, phone, frame # or registration"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select value={outcome} onValueChange={setOutcome}>
          <SelectTrigger className="w-44" aria-label="Filter by outcome">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All outcomes</SelectItem>
            {OUTCOMES.map((o) => (
              <SelectItem key={o} value={o}>
                {OUTCOME_META[o].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={matched} onValueChange={setMatched}>
          <SelectTrigger className="w-40" aria-label="Filter by match">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Matched + unmatched</SelectItem>
            <SelectItem value="yes">Matched</SelectItem>
            <SelectItem value="no">Unmatched</SelectItem>
          </SelectContent>
        </Select>
        {batchFilter && (
          <button
            type="button"
            onClick={onClearBatch}
            className="rounded-full border bg-muted px-3 py-1 text-xs hover:bg-accent"
          >
            {fmtDate(batchFilter.report_date)} only ✕
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>CRE note</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Match</TableHead>
                  <TableHead>Aarohi call</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                      <Loader2 className="mr-2 inline size-4 animate-spin" /> Loading…
                    </TableCell>
                  </TableRow>
                )}
                {!loading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                      No rows match these filters.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => setOpenId(r.id)}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {fmtDate(r.report_date)}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{r.customer_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{r.contact_number}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{r.model_name || "—"}</div>
                      <div className="font-mono text-xs text-muted-foreground">{r.chassis_no}</div>
                    </TableCell>
                    <TableCell className="max-w-64">
                      <div className="text-xs">{r.appointment_status || r.call_status || "—"}</div>
                      <div className="truncate text-xs text-muted-foreground">{r.comments}</div>
                    </TableCell>
                    <TableCell>
                      <OutcomeBadge outcome={r.visit_outcome} overridden={r.outcome_overridden} />
                      {r.service_record && (
                        <div className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-400">
                          service recorded
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.match_method ? (
                        <span className="text-xs">{MATCH_LABELS[r.match_method] ?? r.match_method}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                          <AlertCircle className="size-3.5" /> Unmatched
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.call ? (
                        <>
                          <div>{fmtDate(r.call.started_at)}</div>
                          <div className="text-muted-foreground">{r.call.campaign || ""}</div>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {total > 0 && (
            <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
              <span>
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()}
              </span>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <RecordDialog
        recordId={openId}
        canEdit={canEdit}
        onClose={() => setOpenId(null)}
        onSaved={(updated) => setRows((list) => list.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)))}
      />
    </div>
  );
}

/* ------------------------------------------------------------------
   Rules (VisitOutcomeMapping)
------------------------------------------------------------------ */

function RulesTab({ canEdit }: { canEdit: boolean }) {
  const [rules, setRules] = useState<Mapping[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [draft, setDraft] = useState<{ field: Mapping["field"]; raw_value: string; normalized_outcome: Outcome; priority: number }>({
    field: "comment",
    raw_value: "",
    normalized_outcome: "not_contacted",
    priority: 90,
  });
  const [adding, setAdding] = useState(false);
  const [reapplying, setReapplying] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await server_get_data(get_visit_mappings);
      setRules(res?.mappings ?? []);
      setError(null);
    } catch (err) {
      setError(apiError(err, "Couldn't load rules."));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function update(m: Mapping, body: Partial<Mapping>) {
    setBusyId(m.id);
    setError(null);
    try {
      const res = await server_patch_data(visit_mapping_url(m.id), body);
      if (!res?.success) throw { response: { data: res } };
      setRules((list) => (list ?? []).map((x) => (x.id === m.id ? { ...x, ...res.mapping } : x)));
      setNotice("Rules changed — re-apply them to update rows already imported.");
    } catch (err) {
      setError(apiError(err, "Couldn't save this rule."));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(m: Mapping) {
    if (!window.confirm(`Delete the rule for "${m.raw_value}"?`)) return;
    setBusyId(m.id);
    try {
      const res = await server_delete_data(visit_mapping_url(m.id));
      if (res?.success === false) throw { response: { data: res } };
      setRules((list) => (list ?? []).filter((x) => x.id !== m.id));
      setNotice("Rules changed — re-apply them to update rows already imported.");
    } catch (err) {
      setError(apiError(err, "Couldn't delete this rule."));
    } finally {
      setBusyId(null);
    }
  }

  async function add() {
    if (!draft.raw_value.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await server_post_json(post_visit_mapping, draft);
      if (!res?.success) throw { response: { data: res } };
      setDraft((d) => ({ ...d, raw_value: "" }));
      await load();
      setNotice("Rules changed — re-apply them to update rows already imported.");
    } catch (err) {
      setError(apiError(err, "Couldn't add this rule."));
    } finally {
      setAdding(false);
    }
  }

  async function reapply() {
    setReapplying(true);
    setError(null);
    try {
      const res = await server_post_json(post_visit_mappings_reapply, {});
      if (!res?.success) throw { response: { data: res } };
      setNotice("Re-applying in the background. Staff-set outcomes are left alone.");
    } catch (err) {
      setError(apiError(err, "Couldn't start re-applying."));
    } finally {
      setReapplying(false);
    }
  }

  const groups: Mapping["field"][] = ["appointment_status", "comment", "call_status"];

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-5 text-sm text-muted-foreground space-y-1">
          <p>
            Each CRE row gets one outcome. The <strong>Appointment Status</strong> rule is used first
            unless it says "needs triage" (like "Other"); then the first <strong>Comments</strong> rule
            that matches whole words (lowest priority number first); then <strong>Call Status</strong>.
          </p>
          <p>Only "Visited" writes a service record and counts toward campaign visits.</p>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      {notice && canEdit && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          <span>{notice}</span>
          <Button size="sm" onClick={reapply} disabled={reapplying}>
            {reapplying && <Loader2 className="size-4 animate-spin" />}
            Re-apply to imported rows
          </Button>
        </div>
      )}

      {canEdit && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display">Add a rule</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-2">
            <Select value={draft.field} onValueChange={(v) => setDraft((d) => ({ ...d, field: v as Mapping["field"] }))}>
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g} value={g}>
                    {FIELD_LABELS[g]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="min-w-48 flex-1"
              placeholder='e.g. "SERVICE DONE"'
              value={draft.raw_value}
              onChange={(e) => setDraft((d) => ({ ...d, raw_value: e.target.value }))}
            />
            <Select
              value={draft.normalized_outcome}
              onValueChange={(v) => setDraft((d) => ({ ...d, normalized_outcome: v as Outcome }))}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OUTCOMES.map((o) => (
                  <SelectItem key={o} value={o}>
                    {OUTCOME_META[o].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {draft.field === "comment" && (
              <Input
                type="number"
                className="w-24"
                title="Priority — lower is checked first"
                value={draft.priority}
                onChange={(e) => setDraft((d) => ({ ...d, priority: Number(e.target.value) }))}
              />
            )}
            <Button onClick={add} disabled={adding || !draft.raw_value.trim()}>
              {adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Add
            </Button>
          </CardContent>
        </Card>
      )}

      {rules === null ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading rules…
        </div>
      ) : (
        groups.map((g) => {
          const list = rules.filter((r) => r.field === g);
          return (
            <Card key={g}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-display">{FIELD_LABELS[g]}…</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {list.length === 0 ? (
                  <p className="px-6 pb-5 text-sm text-muted-foreground">No rules.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Text</TableHead>
                        {g !== "comment" && <TableHead className="text-right">Seen</TableHead>}
                        {g === "comment" && <TableHead>Priority</TableHead>}
                        <TableHead>Outcome</TableHead>
                        <TableHead>On</TableHead>
                        {canEdit && <TableHead />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {list.map((m) => (
                        <TableRow key={m.id} className={m.is_active ? "" : "opacity-50"}>
                          <TableCell className="font-mono text-xs">{m.raw_value}</TableCell>
                          {g !== "comment" && (
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {m.seen ?? 0}
                            </TableCell>
                          )}
                          {g === "comment" && (
                            <TableCell>
                              {canEdit ? (
                                <Input
                                  type="number"
                                  className="h-8 w-20"
                                  defaultValue={m.priority}
                                  disabled={busyId === m.id}
                                  onBlur={(e) =>
                                    Number(e.target.value) !== m.priority &&
                                    update(m, { priority: Number(e.target.value) })
                                  }
                                />
                              ) : (
                                m.priority
                              )}
                            </TableCell>
                          )}
                          <TableCell>
                            {canEdit ? (
                              <Select
                                value={m.normalized_outcome}
                                onValueChange={(v) => update(m, { normalized_outcome: v as Outcome })}
                                disabled={busyId === m.id}
                              >
                                <SelectTrigger className="h-8 w-44">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {OUTCOMES.map((o) => (
                                    <SelectItem key={o} value={o}>
                                      {OUTCOME_META[o].label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <OutcomeBadge outcome={m.normalized_outcome} />
                            )}
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={m.is_active}
                              disabled={!canEdit || busyId === m.id}
                              onCheckedChange={(v) => update(m, { is_active: v })}
                              aria-label="Rule on/off"
                            />
                          </TableCell>
                          {canEdit && (
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => remove(m)}
                                disabled={busyId === m.id}
                                aria-label="Delete rule"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}

/* ------------------------------------------------------------------
   Page
------------------------------------------------------------------ */

export default function ShowroomVisitsPage() {
  const canEdit = hasPerm("imports.manage");
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "overview";
  const [batchFilter, setBatchFilter] = useState<Batch | null>(null);

  const setTab = (value: string) => {
    const next = new URLSearchParams(params);
    next.set("tab", value);
    setParams(next, { replace: true });
  };

  return (
    <>
      <PageHeader
        title="Showroom visits"
        description="The CRE team's daily follow-up file, matched to customers and Aarohi's calls — did the calls actually bring vehicles into the workshop?"
      />

      <div className="p-4 md:p-6 lg:p-8">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="imports">Imports</TabsTrigger>
            <TabsTrigger value="records">Rows</TabsTrigger>
            <TabsTrigger value="rules">Outcome rules</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <OverviewTab />
          </TabsContent>

          <TabsContent value="imports" className="mt-4">
            <ImportsTab
              canEdit={canEdit}
              onOpenRecords={(b) => {
                setBatchFilter(b);
                setTab("records");
              }}
            />
          </TabsContent>

          <TabsContent value="records" className="mt-4">
            <RecordsTab canEdit={canEdit} batchFilter={batchFilter} onClearBatch={() => setBatchFilter(null)} />
          </TabsContent>

          <TabsContent value="rules" className="mt-4">
            <RulesTab canEdit={canEdit} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
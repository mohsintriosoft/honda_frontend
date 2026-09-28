import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, Trash2, Upload, UploadCloud, X } from "lucide-react";

import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  server_get_data,
  server_post_json,
  server_patch_data,
  server_delete_data,
  server_upload_file,
} from "@/components/ServiceConnection/serviceconnection";

/* ------------------------------------------------------------------
   Rule of this page: a customer who appears in the CRE file = a customer
   who arrived at the showroom. No outcome classification, no rules.
------------------------------------------------------------------ */

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
  service_records_written: number;
  created_at: string | null;
  errors: number;
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
  match_method: string;
  customer: { id: number; name: string } | null;
  vehicle: { id: number; name: string; chassis_no: string } | null;
  call: { session_id: string; started_at: string; campaign: string | null } | null;
  service_record: { id: number; service_date: string; service_type: string } | null;
  raw_data?: Record<string, unknown>;
};

type Summary = {
  date_from: string;
  date_to: string;
  arrived_rows: number;
  arrived_customers: number;
  arrived_vehicles: number;
  matched: number;
  unmatched: number;
  arrived_after_call: number;
  service_records_written: number;
  by_date: { date: string; total: number }[];
  by_campaign: { campaign_id: number; campaign: string; visited: number }[];
};

const MATCH_LABELS: Record<string, string> = {
  chassis: "Frame #",
  registration: "Registration",
  phone_model: "Phone + model",
  phone: "Customer only",
  manual: "Manual",
  "": "Not found",
};

const RUNNING = new Set(["uploaded", "parsing", "processing"]);

const STATUS_META: Record<string, { label: string; className: string }> = {
  uploaded: { label: "Queued", className: "bg-muted text-muted-foreground" },
  parsing: { label: "Reading…", className: "bg-sky-500/10 text-sky-700 dark:text-sky-400" },
  preview_ready: { label: "Starting…", className: "bg-sky-500/10 text-sky-700 dark:text-sky-400" },
  processing: { label: "Updating records…", className: "bg-sky-500/10 text-sky-700 dark:text-sky-400" },
  done: { label: "Done", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  failed: { label: "Failed", className: "bg-destructive/10 text-destructive" },
  superseded: { label: "Replaced", className: "bg-muted text-muted-foreground line-through" },
};

const MAX_UPLOAD_MB = 25;

function fileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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

function Kpi({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------
   1. Overview
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
      setError(apiError(err, "Couldn't load the numbers."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const maxDay = Math.max(1, ...(data?.by_date ?? []).map((d) => d.total));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <div className="mb-1 text-xs text-muted-foreground">From</div>
          <Input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
        </div>
        <div>
          <div className="mb-1 text-xs text-muted-foreground">To</div>
          <Input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
        </div>
        <Button variant="outline" onClick={() => load(range.from, range.to)} disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Apply
        </Button>
      </div>

      {error && !canEdit && <div className="text-sm text-destructive">{error}</div>}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Kpi label="Customers arrived" value={data.arrived_customers} hint={`${data.arrived_vehicles} vehicles`} />
            <Kpi
              label="Found in our records"
              value={data.matched}
              hint={data.unmatched ? `${data.unmatched} not found` : "all rows found"}
            />
            <Kpi label="Service records updated" value={data.service_records_written} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Arrivals by day</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.by_date.length === 0 && <div className="text-sm text-muted-foreground">No data in this range.</div>}
                {data.by_date.map((d) => (
                  <div key={d.date} className="flex items-center gap-3 text-sm">
                    <div className="w-24 shrink-0 text-muted-foreground">{fmtDate(d.date)}</div>
                    <div className="h-2 flex-1 rounded bg-muted">
                      <div className="h-2 rounded bg-emerald-500" style={{ width: `${(d.total * 100) / maxDay}%` }} />
                    </div>
                    <div className="w-10 text-right tabular-nums">{d.total}</div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Arrivals after Aarohi calls, by campaign</CardTitle>
              </CardHeader>
              <CardContent>
                {data.by_campaign.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No arrivals linked to a call yet.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Campaign</TableHead>
                        <TableHead className="text-right">Arrived</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.by_campaign.map((c) => (
                        <TableRow key={c.campaign_id}>
                          <TableCell>{c.campaign}</TableCell>
                          <TableCell className="text-right tabular-nums">{c.visited}</TableCell>
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
   2. Imports  --  upload once; reading and updating happen automatically
------------------------------------------------------------------ */

function ImportsTab({
  canEdit,
  onOpenRows,
  onOpenErrors,
}: {
  canEdit: boolean;
  onOpenRows: (b: Batch) => void;
  onOpenErrors: (b: Batch) => void;
}) {
  const [batches, setBatches] = useState<Batch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [reportDate, setReportDate] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const started = useRef<Set<number>>(new Set());

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

  const anyRunning = (batches ?? []).some((b) => RUNNING.has(b.status) && !b.stalled);
  useEffect(() => {
    if (!anyRunning) return;
    const t = window.setInterval(load, 3000);
    return () => window.clearInterval(t);
  }, [anyRunning, load]);

  // As soon as a sheet has been read, start updating customers/vehicles.
  // One at a time so two sheets never race each other.
  useEffect(() => {
    if (!canEdit || !batches) return;
    if (batches.some((b) => b.status === "processing" && !b.stalled)) return;
    const next = batches.find((b) => b.status === "preview_ready" && b.total_rows > 0 && !started.current.has(b.id));
    if (!next) return;
    started.current.add(next.id);
    server_post_json(post_visit_process(next.id), {})
      .catch((err) => setError(apiError(err, "Couldn't start updating records.")))
      .finally(load);
  }, [batches, canEdit, load]);

  function pickFile(f: File | null | undefined) {
    if (!f) return;
    setNotice(null);
    if (!/\.(xlsx|xlsm)$/i.test(f.name)) {
      setError("Upload the CRE export as .xlsx. Save an old .xls file as .xlsx first.");
      return;
    }
    if (f.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setError(`That file is larger than ${MAX_UPLOAD_MB} MB.`);
      return;
    }
    setError(null);
    setFile(f);
  }

  function clearFile() {
    setFile(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function upload() {
    if (!file || uploading) return;
    setUploading(true);
    setError(null);
    setNotice(null);
    try {
      const extra: Record<string, string> = {};
      if (reportDate) extra.report_date = reportDate;
      const res = await server_upload_file(post_visit_upload, file, "file", extra);
      if (!res?.success) throw { response: { data: res } };
      if (res.warning) setNotice(res.warning);
      clearFile();
      setReportDate("");
      await load();
    } catch (err) {
      setError(apiError(err, "Upload failed."));
    } finally {
      setUploading(false);
    }
  }

  async function remove(b: Batch) {
    if (!window.confirm(`Delete the ${fmtDate(b.report_date)} import? The service records it wrote are undone.`)) return;
    try {
      const res = await server_delete_data(visit_batch_url(b.id));
      if (!res?.success) throw { response: { data: res } };
      await load();
    } catch (err) {
      setError(apiError(err, "Couldn't delete this import."));
    }
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <Card>
          <CardContent className="space-y-4 p-4">
            <input
              ref={fileInput}
              type="file"
              accept=".xlsx,.xlsm"
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => {
                pickFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />

            {!file ? (
              <div
                role="button"
                tabIndex={0}
                aria-label="Choose the CRE daily file"
                onClick={() => fileInput.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInput.current?.click();
                  }
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  pickFile(e.dataTransfer.files?.[0]);
                }}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors",
                  "hover:border-primary/50 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  dragging ? "border-primary bg-primary/5" : "border-border",
                )}
              >
                <div className="grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-primary">
                  <UploadCloud className="h-5 w-5" />
                </div>
                <div className="text-sm font-medium">
                  {dragging ? "Drop the file to select it" : "Drag the CRE daily file here, or click to browse"}
                </div>
                <div className="text-xs text-muted-foreground">
                  .xlsx or .xlsm, up to {MAX_UPLOAD_MB} MB. Every customer in the file is counted as arrived, and one
                  sheet per day is read automatically.
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600">
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{file.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {fileSize(file.size)} · ready to upload
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={clearFile}
                    disabled={uploading}
                    aria-label="Remove selected file"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex flex-wrap items-end justify-between gap-3">
                  {/* <div className="space-y-1">
                    <label htmlFor="visit-report-date" className="text-xs text-muted-foreground">
                      Report date <span className="opacity-70">(optional)</span>
                    </label>
                    <Input
                      id="visit-report-date"
                      type="date"
                      className="w-44"
                      value={reportDate}
                      onChange={(e) => setReportDate(e.target.value)}
                      disabled={uploading}
                    />
                    <p className="max-w-xs text-[11px] text-muted-foreground">
                      Leave empty to read the date from the sheet name. Ignored for files with more than one sheet.
                    </p>
                  </div> */}
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={clearFile} disabled={uploading}>
                      Cancel
                    </Button>
                    <Button onClick={upload} disabled={uploading}>
                      {uploading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      {uploading ? "Uploading…" : "Upload file"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {notice && <div className="text-sm text-amber-700 dark:text-amber-400">{notice}</div>}
      {error && <div className="text-sm text-destructive">{error}</div>}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Report date</TableHead>
                <TableHead>Sheet</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Customers</TableHead>
                <TableHead className="text-right">Found</TableHead>
                <TableHead className="text-right">Not found</TableHead>
                <TableHead className="text-right">Service updated</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches === null && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">Loading…</TableCell>
                </TableRow>
              )}
              {batches?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    No imports yet. Upload the CRE file above.
                  </TableCell>
                </TableRow>
              )}
              {(batches ?? []).map((b) => {
                const meta = STATUS_META[b.status] ?? STATUS_META.uploaded;
                return (
                  <TableRow key={b.id} className={b.status === "superseded" ? "opacity-60" : ""}>
                    <TableCell className="whitespace-nowrap font-medium">{fmtDate(b.report_date)}</TableCell>
                    <TableCell className="text-muted-foreground">{b.sheet_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("border-0", meta.className)}>
                        {b.stalled ? "Stalled" : meta.label}
                      </Badge>
                      {b.errors > 0 && (
                        <button
                          type="button"
                          onClick={() => onOpenErrors(b)}
                          className="ml-2 text-xs text-destructive underline-offset-2 hover:underline"
                          title="See what went wrong"
                        >
                          {b.errors} {b.errors === 1 ? "error" : "errors"}
                        </button>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{b.total_rows}</TableCell>
                    <TableCell className="text-right tabular-nums">{b.matched_rows}</TableCell>
                    <TableCell className="text-right tabular-nums">{b.unmatched_rows}</TableCell>
                    <TableCell className="text-right tabular-nums">{b.service_records_written}</TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      <Button variant="ghost" size="sm" onClick={() => onOpenRows(b)}>View rows</Button>
                      {canEdit && (
                        <Button variant="ghost" size="icon" onClick={() => remove(b)} aria-label="Delete import">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------
   3. Row  --  every customer row, with a fix for ones we couldn't find
------------------------------------------------------------------ */

function RowDialog({
  recordId,
  canEdit,
  onClose,
  onSaved,
}: {
  recordId: number | null;
  canEdit: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rec, setRec] = useState<VisitRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [frame, setFrame] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (recordId == null) return;
    setRec(null);
    setError(null);
    setFrame("");
    server_get_data(visit_record_url(recordId))
      .then((res) => setRec(res?.record ?? null))
      .catch((err) => setError(apiError(err, "Couldn't load this row.")));
  }, [recordId]);

  async function link() {
    if (!rec || !frame.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await server_patch_data(visit_record_url(rec.id), { chassis_no: frame.trim() });
      if (!res?.success) throw { response: { data: res } };
      setRec(res.record);
      setFrame("");
      onSaved();
    } catch (err) {
      setError(apiError(err, "Couldn't link this vehicle."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={recordId != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{rec?.customer_name ?? "Row"}</DialogTitle>
        </DialogHeader>
        {error && <div className="text-sm text-destructive">{error}</div>}
        {!rec && !error && <Loader2 className="h-4 w-4 animate-spin" />}
        {rec && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Arrived on" value={fmtDate(rec.report_date)} />
              <Field label="Phone" value={rec.contact_number} />
              <Field label="Model" value={rec.model_name} />
              <Field label="Branch" value={rec.branch ?? "—"} />
              <Field label="Frame #" value={rec.chassis_no} mono />
              <Field label="Registration" value={rec.registration_no} mono />
              <Field label="Matched by" value={MATCH_LABELS[rec.match_method] ?? rec.match_method} />
              <Field
                label="Service record"
                value={rec.service_record ? `${rec.service_record.service_type} · ${fmtDate(rec.service_record.service_date)}` : "Not written"}
              />
              <Field
                label="Aarohi call"
                value={rec.call ? `${rec.call.campaign ?? "Call"} · ${fmtDate(rec.call.started_at)}` : "—"}
              />
            </div>

            {canEdit && !rec.vehicle && (
              <div className="rounded-md border p-3">
                <div className="mb-2 font-medium">Not found in our records</div>
                <div className="flex gap-2">
                  <Input placeholder="Enter the correct Frame #" value={frame} onChange={(e) => setFrame(e.target.value)} />
                  <Button onClick={link} disabled={saving || !frame.trim()}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Link
                  </Button>
                </div>
              </div>
            )}

            {rec.raw_data && (
              <details>
                <summary className="cursor-pointer text-muted-foreground">Original Excel row</summary>
                <pre className="mt-2 max-h-72 overflow-auto rounded bg-muted p-3 text-xs">
                  {JSON.stringify(rec.raw_data, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn(mono && "font-mono text-xs")}>{value || "—"}</div>
    </div>
  );
}

function RowsTab({
  canEdit,
  batchFilter,
  onClearBatch,
}: {
  canEdit: boolean;
  batchFilter: Batch | null;
  onClearBatch: () => void;
}) {
  const PAGE_SIZE = 50;
  const [matched, setMatched] = useState("all");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<VisitRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q), 350);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [matched, debouncedQ, dateFrom, dateTo, batchFilter?.id]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = { page, page_size: PAGE_SIZE };
      if (batchFilter) params.batch = batchFilter.id;
      if (matched !== "all") params.matched = matched;
      if (debouncedQ) params.q = debouncedQ;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const res = await server_get_data(get_visit_records, params);
      if (!res?.success) throw { response: { data: res } };
      setRows(res.records);
      setTotal(res.count);
    } catch (err) {
      setError(apiError(err, "Couldn't load rows."));
    } finally {
      setLoading(false);
    }
  }, [page, batchFilter, matched, debouncedQ, dateFrom, dateTo]);

  useEffect(() => {
    load();
  }, [load]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          className="w-64"
          placeholder="Name, phone, Frame # or registration"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Input type="date" className="w-40" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <Input type="date" className="w-40" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        <Select value={matched} onValueChange={setMatched}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All rows</SelectItem>
            <SelectItem value="yes">Found in our records</SelectItem>
            <SelectItem value="no">Not found</SelectItem>
          </SelectContent>
        </Select>
        {batchFilter && (
          <Badge variant="secondary" className="cursor-pointer" onClick={onClearBatch}>
            {fmtDate(batchFilter.report_date)} only ✕
          </Badge>
        )}
        <div className="ml-auto text-sm text-muted-foreground">{total} rows</div>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Arrived on</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Matched by</TableHead>
                <TableHead>Aarohi call</TableHead>
                <TableHead>Service record</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Loading…</TableCell>
                </TableRow>
              )}
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No rows match.</TableCell>
                </TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => setOpenId(r.id)}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{fmtDate(r.report_date)}</TableCell>
                  <TableCell>
                    <div className="font-medium">{r.customer_name}</div>
                    <div className="text-xs text-muted-foreground">{r.contact_number}</div>
                  </TableCell>
                  <TableCell>
                    <div>{r.model_name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{r.chassis_no}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.match_method ? "secondary" : "destructive"}>
                      {MATCH_LABELS[r.match_method] ?? r.match_method}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{r.call ? (r.call.campaign ?? "Yes") : "—"}</TableCell>
                  <TableCell className="text-xs">
                    {r.service_record ? fmtDate(r.service_record.service_date) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2 text-sm">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
        <span className="text-muted-foreground">Page {page} of {pages}</span>
        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
      </div>

      <RowDialog recordId={openId} canEdit={canEdit} onClose={() => setOpenId(null)} onSaved={load} />
    </div>
  );
}

/* ------------------------------------------------------------------
   3. Errors  --  what went wrong while reading / updating each sheet
------------------------------------------------------------------ */

type ImportError = { row: number | null; error: string };

function csvCell(v: unknown) {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

function ErrorsTab({ focusBatch }: { focusBatch: Batch | null }) {
  const [batches, setBatches] = useState<Batch[] | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Batch | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await server_get_data(get_visit_batches);
      const withErrors = ((res?.batches ?? []) as Batch[]).filter((b) => b.errors > 0 || b.status === "failed");
      setBatches(withErrors);
      setError(null);
    } catch (err) {
      setError(apiError(err, "Couldn't load imports."));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Pick a sheet: the one opened from the Imports tab, else the first with errors.
  useEffect(() => {
    if (!batches) return;
    if (focusBatch && batches.some((b) => b.id === focusBatch.id)) {
      setSelectedId(focusBatch.id);
    } else if (selectedId == null || !batches.some((b) => b.id === selectedId)) {
      setSelectedId(batches[0]?.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batches, focusBatch]);

  useEffect(() => {
    if (selectedId == null) {
      setDetail(null);
      return;
    }
    let live = true;
    setLoadingDetail(true);
    server_get_data(visit_batch_url(selectedId), { full: 1 })
      .then((res) => {
        if (live) setDetail(res?.batch ?? null);
      })
      .catch((err) => {
        if (live) setError(apiError(err, "Couldn't load the errors for this sheet."));
      })
      .finally(() => {
        if (live) setLoadingDetail(false);
      });
    return () => {
      live = false;
    };
  }, [selectedId]);

  const log: ImportError[] = (detail?.error_log ?? []).map((e: any) =>
    typeof e === "string" ? { row: null, error: e } : { row: e?.row ?? null, error: String(e?.error ?? e?.message ?? JSON.stringify(e)) },
  );

  // How many rows share each message, so 400 identical errors read as one line.
  const summary = Object.values(
    log.reduce<Record<string, { error: string; count: number }>>((acc, e) => {
      (acc[e.error] ??= { error: e.error, count: 0 }).count += 1;
      return acc;
    }, {}),
  ).sort((a, b) => b.count - a.count);

  function downloadCsv() {
    if (!detail) return;
    const lines = [["Row", "Error"].map(csvCell).join(",")].concat(
      log.map((e) => [e.row ?? "", e.error].map(csvCell).join(",")),
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `import_errors_${detail.report_date ?? detail.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (batches === null) {
    return (
      <div className="grid place-items-center py-16 text-muted-foreground">
        {error ? <span className="text-sm text-destructive">{error}</span> : <Loader2 className="h-5 w-5 animate-spin" />}
      </div>
    );
  }

  if (batches.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
          <div className="grid h-11 w-11 place-items-center rounded-full bg-emerald-500/10 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="text-sm font-medium">No import errors</div>
          <div className="text-xs text-muted-foreground">Every sheet was read and updated without problems.</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Sheet</div>
          <Select value={selectedId != null ? String(selectedId) : undefined} onValueChange={(v) => setSelectedId(Number(v))}>
            <SelectTrigger className="w-72">
              <SelectValue placeholder="Choose a sheet" />
            </SelectTrigger>
            <SelectContent>
              {batches.map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>
                  {fmtDate(b.report_date)} · sheet {b.sheet_name} · {b.errors} {b.errors === 1 ? "error" : "errors"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={downloadCsv} disabled={!detail || log.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Download CSV
        </Button>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}

      {loadingDetail && !detail ? (
        <div className="grid place-items-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : detail ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Kpi label="Errors in this sheet" value={detail.errors} />
            <Kpi label="Different problems" value={summary.length} />
            <Kpi label="Rows read" value={detail.total_rows} hint={`${detail.failed_rows} failed`} />
          </div>

          {detail.status === "failed" && log.length === 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              This sheet failed, but no error details were recorded.
            </div>
          )}

          {summary.length > 1 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-display">What went wrong</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {summary.map((s) => (
                  <div key={s.error} className="flex items-start justify-between gap-4 text-sm">
                    <span className="break-words">{s.error}</span>
                    <Badge variant="outline" className="shrink-0 border-0 bg-destructive/10 text-destructive">
                      {s.count} {s.count === 1 ? "row" : "rows"}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Row</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {log.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="py-10 text-center text-muted-foreground">
                        No details were recorded for this sheet.
                      </TableCell>
                    </TableRow>
                  )}
                  {log.map((e, i) => (
                    <TableRow key={i}>
                      <TableCell className="tabular-nums text-muted-foreground">{e.row ?? "—"}</TableCell>
                      <TableCell className="whitespace-pre-wrap break-words text-sm">{e.error}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------
   Page  --  four sections
------------------------------------------------------------------ */

export default function ShowroomVisitsPage() {
  const canEdit = hasPerm("imports.manage");
  const [params, setParams] = useSearchParams();
  const tab = ["overview", "imports", "rows", "errors"].includes(params.get("tab") ?? "") ? params.get("tab")! : "overview";
  const [batchFilter, setBatchFilter] = useState<Batch | null>(null);
  const [errorBatch, setErrorBatch] = useState<Batch | null>(null);

  const setTab = (value: string) => {
    const next = new URLSearchParams(params);
    next.set("tab", value);
    setParams(next, { replace: true });
  };

  return (
    <>
      <PageHeader
        title="Showroom visits"
        description="Customers in the daily CRE file are counted as arrived. Their customer and vehicle service records are updated from it."
      />
      <div className="p-4 md:p-6 lg:p-8">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="imports">Imports</TabsTrigger>
            <TabsTrigger value="rows">Row</TabsTrigger>
            <TabsTrigger value="errors">Errors</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <OverviewTab />
          </TabsContent>
          <TabsContent value="imports" className="mt-4">
            <ImportsTab
              canEdit={canEdit}
              onOpenRows={(b) => {
                setBatchFilter(b);
                setTab("rows");
              }}
              onOpenErrors={(b) => {
                setErrorBatch(b);
                setTab("errors");
              }}
            />
          </TabsContent>
          <TabsContent value="rows" className="mt-4">
            <RowsTab canEdit={canEdit} batchFilter={batchFilter} onClearBatch={() => setBatchFilter(null)} />
          </TabsContent>
          <TabsContent value="errors" className="mt-4">
            <ErrorsTab focusBatch={errorBatch} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
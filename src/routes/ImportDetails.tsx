import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  RotateCcw,
  PlayCircle,
  Building2,
  CalendarDays,
  FileSpreadsheet,
} from "lucide-react";

import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  get_import_detail,
  get_import_preview,
  post_import_commit,
  get_import_errors,
  get_import_unmatched,
  get_import_rows,
  server_get_data,
  server_post_data,
} from "@/components/ServiceConnection/serviceconnection";

/* =========================================================
   TYPES
========================================================= */

type ImportStatus =
  "uploaded" | "parsing" | "preview_ready" | "processing" | "done" | "failed" | "reverted";

type ListType = "service" | "missed" | "amc" | "insurance" | "other";

interface CsvStatsRow {
  id: number;
  branch: { id: number; name: string };
  list_type: ListType;
  file_name: string;
  sheet_name: string;
  period_month: string | null;
  status: ImportStatus;
  last_heartbeat_at: string | null;
  commit_stalled: boolean;
  parse_stalled: boolean;
  commit_resumable?: boolean;
  total_rows: number;
  customers_created: number;
  customers_updated: number;
  vehicles_created: number;
  vehicles_updated: number;
  segment_data_created: number;
  unmatched_count: number;
  unmatched_types: Record<string, number>;
  skipped_count: number;
  failed_count: number;
  column_map: Record<string, string>;
  reconciles: boolean;
  error_log?: { stage: string; error: string }[];
  created_at: string | null;
}

interface ServicePreview {
  total_rows: number;
  list_type: string;
  segment_counts: Record<string, number | null>;
  segments_without_campaign: string[];
  campaign_warning: string | null;
  missed_service_column_present: boolean;
  missed_service_count: number;
  missed_service_warning: string | null;
  reconciles: boolean;
}

interface ExpiryPreview {
  total_rows: number;
  list_type: string;
  expiry_column_present: boolean;
  rows_with_expiry_date: number;
  segment_configured: boolean;
  campaign_linked: boolean;
  warning: string | null;
  reconciles: boolean;
}

type Preview = (ServicePreview | ExpiryPreview) & { error?: string };

interface CsvDetailsRow {
  id: number;
  row_number: number;
  process_status: "pending" | "done" | "unmatched" | "skipped" | "failed";
  error: string;
  phone_raw: string;
  frame_no: string;
  next_service_type_raw: string;
  next_service_date: string | null;
  crm_call_status: string;
  customer_id: number | null;
  vehicle_id: number | null;
  raw: Record<string, unknown>;
}

const LIST_TYPE_LABEL: Record<ListType, string> = {
  service: "Service due",
  missed: "Missed / lost service",
  amc: "AMC renewal",
  insurance: "Insurance renewal",
  other: "Other",
};

const LIVE_STATUSES: ImportStatus[] = ["uploaded", "parsing", "processing"];

// row_number counts data rows only (header excluded), so the line the
// admin sees in Excel is always one more. Used everywhere a row is shown.
function excelRow(r: CsvDetailsRow) {
  return r.row_number + 1;
}

function num(n: number | null | undefined) {
  return Number(n ?? 0);
}

function apiErrorMessage(err: any, fallback: string) {
  if (err?.response?.status === 403) return "You don't have permission to do this.";
  return err?.response?.data?.error || fallback;
}

function isServicePreview(p: Preview): p is ServicePreview & { error?: string } {
  return "segment_counts" in p;
}

function StatusBadge({ status }: { status: ImportStatus }) {
  const map: Record<ImportStatus, { label: string; className: string; icon: typeof Clock }> = {
    uploaded: { label: "Uploaded", className: "bg-muted text-muted-foreground", icon: Clock },
    parsing: {
      label: "Parsing",
      className: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
      icon: Loader2,
    },
    preview_ready: {
      label: "Preview ready",
      className: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
      icon: AlertTriangle,
    },
    processing: {
      label: "Committing",
      className: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
      icon: Loader2,
    },
    done: {
      label: "Done",
      className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
      icon: CheckCircle2,
    },
    failed: { label: "Failed", className: "bg-destructive/15 text-destructive", icon: XCircle },
    reverted: { label: "Reverted", className: "bg-muted text-muted-foreground", icon: RotateCcw },
  };
  const { label, className, icon: Icon } = map[status] ?? map.uploaded;
  const spinning = status === "parsing" || status === "processing";
  return (
    <Badge variant="secondary" className={cn("gap-1 font-medium", className)}>
      <Icon className={cn("size-3", spinning && "animate-spin")} />
      {label}
    </Badge>
  );
}

function StatCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "warn" | "bad" | "good";
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-card px-4 py-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-xl font-display font-semibold tabular-nums",
          tone === "warn" && "text-amber-600 dark:text-amber-400",
          tone === "bad" && "text-destructive",
          tone === "good" && "text-emerald-600 dark:text-emerald-400",
        )}
      >
        {value}
      </span>
    </div>
  );
}

/* =========================================================
   COMMIT DIALOG
========================================================= */

function CommitDialog({
  row,
  onCommitted,
  resuming = false,
  hasUnmatchedRows,
  onBlocked,
}: {
  row: CsvStatsRow;
  onCommitted: (row: CsvStatsRow) => void;
  resuming?: boolean;
  hasUnmatchedRows: boolean;
  onBlocked: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCommit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await server_post_data(post_import_commit(row.id));
      if (!res?.success) throw { response: { data: res } };
      onCommitted(res.import as CsvStatsRow);
      setOpen(false);
    } catch (err: any) {
      setError(apiErrorMessage(err, "Commit failed"));
      if (err?.response?.data?.import) onCommitted(err.response.data.import as CsvStatsRow);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        className="gap-2"
        onClick={() => {
          if (hasUnmatchedRows) {
            onBlocked();
            return;
          }
          setOpen(true);
        }}
        variant={resuming ? "outline" : "default"}
      >
        <PlayCircle className="size-4" />
        {resuming ? "Resume commit" : "Confirm import"}
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{resuming ? "Resume this commit?" : "Commit this import?"}</DialogTitle>
          <DialogDescription>
            {resuming ? (
              <>
                The previous commit run stopped before finishing. Rows it already finished were
                written for good and won't be touched again; this only continues with whatever is
                still pending.
              </>
            ) : (
              <>
                Every row is written inside its own atomic transaction — a bad row is marked failed
                and skipped without touching rows that already succeeded. Previous batches for the
                segments this file touches will be frozen (not deleted) and their pending queued
                calls skipped, per the standard month-to-month supersede rule.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="text-sm text-muted-foreground space-y-1">
          <p>
            <span className="font-medium text-foreground">
              {num(row.total_rows).toLocaleString()}
            </span>{" "}
            rows total for <span className="font-medium text-foreground">{row.branch?.name}</span>.
          </p>
          <p>
            Runs in the background — you can safely close or reload this page while it works; the
            status above updates automatically.
          </p>
        </div>
        {error && (
          <Alert variant="destructive">
            <XCircle className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleCommit} disabled={busy} className="gap-2">
            {busy && <Loader2 className="size-4 animate-spin" />}
            {busy ? "Committing…" : "Commit import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* =========================================================
   UNMATCHED ROW
========================================================= */

function UnmatchedRow({ row }: { row: CsvDetailsRow }) {
  return (
    <TableRow>
      <TableCell className="tabular-nums font-semibold text-destructive">
        #{excelRow(row)}
      </TableCell>
      <TableCell>{row.phone_raw || "—"}</TableCell>
      <TableCell className="font-mono text-xs">{row.frame_no || "—"}</TableCell>
      <TableCell>
        <span className="text-amber-600 dark:text-amber-400">
          {row.next_service_type_raw || "(blank)"}
        </span>
      </TableCell>
      <TableCell className="max-w-xs text-sm text-muted-foreground">
        {row.error || "Unknown reason — check server logs"}
      </TableCell>
      <TableCell className="text-sm text-destructive font-medium whitespace-nowrap">
        Row number {excelRow(row)} of the excel is unmatched
      </TableCell>
    </TableRow>
  );
}

/* =========================================================
   RAW ROW DIALOG
========================================================= */

function RawRowDialog({
  row,
  onOpenChange,
}: {
  row: CsvDetailsRow;
  onOpenChange: (open: boolean) => void;
}) {
  const entries = Object.entries(row.raw ?? {});
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Excel row #{excelRow(row)}</DialogTitle>
          <DialogDescription>
            Every column exactly as it appeared in the uploaded file.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto rounded-md border">
          {entries.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No raw data stored for this row.
            </div>
          ) : (
            <Table>
              <TableBody>
                {entries.map(([col, val]) => (
                  <TableRow key={col}>
                    <TableCell className="w-1/3 align-top font-medium text-muted-foreground">
                      {col}
                    </TableCell>
                    <TableCell className="whitespace-pre-wrap break-words">
                      {val === null || val === undefined || val === "" ? "—" : String(val)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* =========================================================
   PAGE
========================================================= */

export default function ImportDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const importId = Number(id);

  const [row, setRow] = useState<CsvStatsRow | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [unmatchedRows, setUnmatchedRows] = useState<CsvDetailsRow[] | null>(null);
  const [unmatchedCursor, setUnmatchedCursor] = useState<number | null>(null);
  const [unmatchedHasMore, setUnmatchedHasMore] = useState(false);
  const [unmatchedPreviewOnly, setUnmatchedPreviewOnly] = useState(false);
  const [unmatchedLoadingMore, setUnmatchedLoadingMore] = useState(false);

  const [errorRows, setErrorRows] = useState<CsvDetailsRow[] | null>(null);
  const [errorsCursor, setErrorsCursor] = useState<number | null>(null);
  const [errorsHasMore, setErrorsHasMore] = useState(false);
  const [errorsPreviewOnly, setErrorsPreviewOnly] = useState(false);
  const [errorsLoadingMore, setErrorsLoadingMore] = useState(false);

  const [rawRows, setRawRows] = useState<CsvDetailsRow[] | null>(null);
  const [rawPage, setRawPage] = useState(1);
  const [selectedRawRow, setSelectedRawRow] = useState<CsvDetailsRow | null>(null);

  const [commitBlocked, setCommitBlocked] = useState(false);
  const [activeTab, setActiveTab] = useState<"unmatched" | "errors" | "rows">("unmatched");

  const fetchDetail = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await server_get_data(get_import_detail(importId));
        if (!res?.success) throw { response: { data: res } };
        setRow(res.import as CsvStatsRow);
        setError(null);
      } catch (err: any) {
        if (!silent) setError(apiErrorMessage(err, "Could not load this import"));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [importId],
  );

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // Poll only while genuinely running -- a stalled parse/commit never
  // finishes on its own.
  const isLive =
    !!row && LIVE_STATUSES.includes(row.status) && !row.parse_stalled && !row.commit_stalled;

  useEffect(() => {
    if (isLive) {
      pollRef.current = setInterval(() => fetchDetail(true), 3000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isLive, fetchDetail]);

  // Preview once ready/committed. The backend refreshes this import's
  // preview-stage counters while building it (segment/campaign setup may
  // have changed since upload), so re-read the detail right after.
  useEffect(() => {
    if (!row) return;
    if (row.status !== "preview_ready" && row.status !== "done") {
      setPreview(null);
      return;
    }
    let cancelled = false;
    server_get_data(get_import_preview(importId))
      .then((res) => {
        if (cancelled) return;
        if (res?.success) setPreview(res.preview as Preview);
        if (row.status === "preview_ready") fetchDetail(true);
      })
      .catch(() => {
        if (!cancelled) setPreview(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.status, importId]);

  const loadUnmatched = useCallback(
    (opts?: { more?: boolean }) => {
      const more = opts?.more ?? false;
      if (more) setUnmatchedLoadingMore(true);
      server_get_data(get_import_unmatched(importId), {
        page_size: 100,
        ...(more && unmatchedCursor != null ? { after_row: unmatchedCursor } : {}),
      })
        .then((res) => {
          const newRows: CsvDetailsRow[] = res?.rows ?? [];
          setUnmatchedRows((prev) => (more && prev ? [...prev, ...newRows] : newRows));
          setUnmatchedCursor(res?.next_after_row ?? null);
          setUnmatchedHasMore(res?.next_after_row != null);
          setUnmatchedPreviewOnly(Boolean(res?.preview_only));
        })
        .catch(() => {
          if (!more) setUnmatchedRows([]);
        })
        .finally(() => setUnmatchedLoadingMore(false));
    },
    [importId, unmatchedCursor],
  );

  const loadErrors = useCallback(
    (opts?: { more?: boolean }) => {
      const more = opts?.more ?? false;
      if (more) setErrorsLoadingMore(true);
      server_get_data(get_import_errors(importId), {
        page_size: 100,
        ...(more && errorsCursor != null ? { after_row: errorsCursor } : {}),
      })
        .then((res) => {
          const newRows: CsvDetailsRow[] = res?.rows ?? [];
          setErrorRows((prev) => (more && prev ? [...prev, ...newRows] : newRows));
          setErrorsCursor(res?.next_after_row ?? null);
          setErrorsHasMore(res?.next_after_row != null);
          setErrorsPreviewOnly(Boolean(res?.preview_only));
        })
        .catch(() => {
          if (!more) setErrorRows([]);
        })
        .finally(() => setErrorsLoadingMore(false));
    },
    [importId, errorsCursor],
  );

  // Status left preview_ready -> cached dry-run rows are stale.
  const prevStatusRef = useRef<ImportStatus | null>(null);
  useEffect(() => {
    if (!row) return;
    if (prevStatusRef.current === "preview_ready" && row.status !== "preview_ready") {
      setUnmatchedRows(null);
      setUnmatchedCursor(null);
      setErrorRows(null);
      setErrorsCursor(null);
    }
    prevStatusRef.current = row.status;
  }, [row?.status]);

  const loadRows = useCallback(
    (page: number) => {
      server_get_data(get_import_rows(importId), { page })
        .then((res) => setRawRows(res?.rows ?? []))
        .catch(() => setRawRows([]));
    },
    [importId],
  );

  useEffect(() => {
    if (!row) return;
    if (row.status === "uploaded" || row.status === "parsing") return;
    if (activeTab === "unmatched" && unmatchedRows === null) loadUnmatched();
    if (activeTab === "errors" && errorRows === null) loadErrors();
    if (activeTab === "rows" && rawRows === null) loadRows(rawPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.status, activeTab, unmatchedRows, errorRows, rawRows]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh] gap-2 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" /> Loading import…
      </div>
    );
  }

  if (error || !row) {
    return (
      <div className="px-4 md:px-6 lg:px-8 py-10">
        <Alert variant="destructive">
          <XCircle className="size-4" />
          <AlertDescription>{error || "Import not found"}</AlertDescription>
        </Alert>
        <Button variant="ghost" className="mt-4" onClick={() => navigate("/imports")}>
          Back to Data Import
        </Button>
      </div>
    );
  }

  // The unmatched block only applies to a FIRST commit (the backend only
  // checks it then). A resume must never be blocked by it. Prefer the
  // live dry-run scan once it has loaded; until then use the (freshly
  // refreshed) counter.
  const isFirstCommit = row.status === "preview_ready";
  const hasUnmatchedRows =
    isFirstCommit &&
    (unmatchedRows !== null ? unmatchedRows.length > 0 : num(row.unmatched_count) > 0);

  const isResumable =
    (row.status === "processing" && row.commit_stalled) ||
    (row.status === "failed" && Boolean(row.commit_resumable));
  const canAttemptCommit = isFirstCommit || isResumable;
  const isLiveCommitting = row.status === "processing" && !row.commit_stalled;

  const lastError = (row.error_log ?? []).slice(-1)[0] ?? null;

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: "Data Import", to: "/imports" }, { label: row.file_name }]}
        title={
          <span className="flex items-center gap-3">
            <FileSpreadsheet className="size-6 text-muted-foreground" />
            {row.file_name}
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1">
              <Building2 className="size-3.5" /> {row.branch?.name}
            </span>
            <span>{LIST_TYPE_LABEL[row.list_type] ?? row.list_type}</span>
            {row.period_month && (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3.5" />
                {new Date(`${row.period_month}T00:00:00`).toLocaleDateString(undefined, {
                  month: "long",
                  year: "numeric",
                })}
              </span>
            )}
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={row.status} />
            {isLiveCommitting && (
              <Badge variant="secondary" className="gap-1 font-medium">
                <Loader2 className="size-3 animate-spin" /> Committing…
              </Badge>
            )}
            {canAttemptCommit && !(commitBlocked && hasUnmatchedRows) && (
              <CommitDialog
                row={row}
                onCommitted={(r) => {
                  setCommitBlocked(false);
                  setRow(r);
                }}
                resuming={isResumable}
                hasUnmatchedRows={hasUnmatchedRows}
                onBlocked={() => setCommitBlocked(true)}
              />
            )}
            {canAttemptCommit && commitBlocked && hasUnmatchedRows && (
              <Badge
                variant="secondary"
                className="gap-1 font-medium bg-destructive/15 text-destructive"
              >
                <XCircle className="size-3" />
                Import blocked — unmatched rows
              </Badge>
            )}
          </div>
        }
      />

      <div className="px-4 md:px-6 lg:px-8 py-6 space-y-6">
        {row.status === "failed" && (
          <Alert variant="destructive">
            <XCircle className="size-4" />
            <AlertTitle>
              {lastError?.stage === "parse" ? "This file could not be read" : "This import failed"}
            </AlertTitle>
            <AlertDescription className="space-y-1">
              {lastError?.error && <p className="font-medium">{lastError.error}</p>}
              <p>
                {lastError?.stage === "parse"
                  ? "Nothing was imported. Fix the file (or the sheet name) and upload it again."
                  : row.commit_resumable
                    ? 'Rows that committed before the failure are kept. Use "Resume commit" to finish the rest.'
                    : "Rows that already committed before the failure are unaffected — each row is its own transaction."}
              </p>
            </AlertDescription>
          </Alert>
        )}

        {row.status === "processing" && row.commit_stalled && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>Commit stopped responding</AlertTitle>
            <AlertDescription>
              No progress has been reported in a while — the server likely restarted or crashed
              partway through. Nothing was lost: every row that finished is written for good, and
              rows still pending are unaffected. Use "Resume commit" above to continue with the rows
              that are left.
            </AlertDescription>
          </Alert>
        )}

        {row.status === "parsing" && row.parse_stalled && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>Upload stopped responding</AlertTitle>
            <AlertDescription>
              Parsing this file hasn't progressed in a while and likely crashed before any rows were
              saved. Delete this upload from the Data Import list and upload the file again.
            </AlertDescription>
          </Alert>
        )}

        {!row.reconciles && (row.status === "done" || row.status === "processing") && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>Reconciliation doesn't balance</AlertTitle>
            <AlertDescription>
              total_rows should equal segment_data_created + unmatched + skipped + failed. Some rows
              may be unaccounted for — worth a look before trusting this batch.
            </AlertDescription>
          </Alert>
        )}

        {commitBlocked && hasUnmatchedRows && (
          <Alert variant="destructive">
            <XCircle className="size-4" />
            <AlertTitle>Unmatched rows found — this data cannot be imported yet</AlertTitle>
            <AlertDescription className="text-xs space-y-1">
              <p>
                {unmatchedRows !== null
                  ? `${unmatchedRows.length.toLocaleString()}${unmatchedHasMore ? "+" : ""}`
                  : num(row.unmatched_count).toLocaleString()}{" "}
                row(s) in this file could not be matched to a segment. Check the reason on each row
                in the "Unmatched" tab: fix the file and re-upload, or — if the reason is a missing
                segment/campaign — fix that setup and reload this page.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {/* Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <StatCell label="Total rows" value={num(row.total_rows).toLocaleString()} />
          <StatCell
            label="Will be queued"
            value={num(row.segment_data_created).toLocaleString()}
            tone="good"
          />
          <StatCell
            label="Unmatched"
            value={num(row.unmatched_count).toLocaleString()}
            tone={row.unmatched_count ? "warn" : undefined}
          />
          <StatCell label="Skipped (DNC)" value={num(row.skipped_count).toLocaleString()} />
          <StatCell
            label="Failed"
            value={num(row.failed_count).toLocaleString()}
            tone={row.failed_count ? "bad" : undefined}
          />
          <StatCell
            label="Customers new / updated"
            value={`${num(row.customers_created)} / ${num(row.customers_updated)}`}
          />
          <StatCell
            label="Vehicles new / updated"
            value={`${num(row.vehicles_created)} / ${num(row.vehicles_updated)}`}
          />
        </div>

        {/* Preview / reconciliation detail */}
        {preview && !preview.error && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {row.status === "done" ? "What was committed" : "Preview — nothing written yet"}
              </CardTitle>
              <CardDescription>
                {isServicePreview(preview)
                  ? "One row can only feed one campaign. A vehicle with an open missed service is counted there, never under its Next Service Type as well."
                  : "This file is classified as a whole — every row targets the same segment."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {isServicePreview(preview) ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="rounded-md border bg-muted/30 px-3 py-2">
                      <div className="text-xs text-muted-foreground">Missed Service</div>
                      <div className="text-lg font-semibold tabular-nums">
                        {num(preview.missed_service_count).toLocaleString()}
                      </div>
                    </div>
                    {Object.entries(preview.segment_counts ?? {}).map(([name, count]) => {
                      const missingCampaign = preview.segments_without_campaign?.includes(name);
                      return (
                        <div
                          key={name}
                          className={`rounded-md border px-3 py-2 ${
                            missingCampaign ? "border-amber-500/40 bg-amber-500/5" : "bg-muted/30"
                          }`}
                        >
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            {name}
                            {missingCampaign && <AlertTriangle className="size-3 text-amber-600" />}
                          </div>
                          <div className="text-lg font-semibold tabular-nums">
                            {count === null ? "—" : count.toLocaleString()}
                          </div>
                          {missingCampaign && (
                            <div className="text-[11px] text-amber-600 mt-0.5">
                              No campaign linked
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {preview.missed_service_warning && (
                    <Alert className="border-amber-500/30 bg-amber-500/5">
                      <AlertTriangle className="size-4 text-amber-600" />
                      <AlertDescription className="text-xs">
                        {preview.missed_service_warning}
                      </AlertDescription>
                    </Alert>
                  )}
                  {preview.campaign_warning && (
                    <Alert className="border-amber-500/30 bg-amber-500/5">
                      <AlertTriangle className="size-4 text-amber-600" />
                      <AlertDescription className="text-xs">
                        {preview.campaign_warning}
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="rounded-md border bg-muted/30 px-3 py-2">
                    <div className="text-xs text-muted-foreground">Date column found</div>
                    <div className="text-sm font-medium">
                      {preview.expiry_column_present ? "Yes" : "No"}
                    </div>
                  </div>
                  <div className="rounded-md border bg-muted/30 px-3 py-2">
                    <div className="text-xs text-muted-foreground">Rows with a due date</div>
                    <div className="text-lg font-semibold tabular-nums">
                      {num(preview.rows_with_expiry_date).toLocaleString()}
                    </div>
                  </div>
                  <div className="rounded-md border bg-muted/30 px-3 py-2">
                    <div className="text-xs text-muted-foreground">Segment configured</div>
                    <div className="text-sm font-medium">
                      {preview.segment_configured ? "Yes" : "No"}
                    </div>
                  </div>
                  <div
                    className={`rounded-md border px-3 py-2 ${
                      preview.segment_configured && !preview.campaign_linked
                        ? "border-amber-500/40 bg-amber-500/5"
                        : "bg-muted/30"
                    }`}
                  >
                    <div className="text-xs text-muted-foreground">Campaign linked</div>
                    <div className="text-sm font-medium">
                      {!preview.segment_configured ? "—" : preview.campaign_linked ? "Yes" : "No"}
                    </div>
                  </div>
                </div>
              )}
              {!isServicePreview(preview) && preview.warning && (
                <Alert className="border-amber-500/30 bg-amber-500/5">
                  <AlertTriangle className="size-4 text-amber-600" />
                  <AlertDescription className="text-xs">{preview.warning}</AlertDescription>
                </Alert>
              )}

              <Separator />
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Accounted for:</span>
                <span className="font-medium tabular-nums">
                  {num(row.segment_data_created) +
                    num(row.unmatched_count) +
                    num(row.skipped_count) +
                    num(row.failed_count)}
                </span>
                <span className="text-muted-foreground">of</span>
                <span className="font-medium tabular-nums">{num(row.total_rows)}</span>
                {row.reconciles ? (
                  <CheckCircle2 className="size-4 text-emerald-600" />
                ) : (
                  <XCircle className="size-4 text-destructive" />
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {(row.status === "uploaded" || row.status === "parsing") && !row.parse_stalled && (
          <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Parsing file…
          </div>
        )}

        {/* Detail tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "unmatched" | "errors" | "rows")}
        >
          <TabsList>
            <TabsTrigger value="unmatched" className="gap-1.5">
              Unmatched
              {num(row.unmatched_count) > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  {row.unmatched_count}
                </Badge>
              )}
              {num(row.unmatched_count) === 0 && unmatchedRows && unmatchedRows.length > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  {unmatchedRows.length}
                  {unmatchedHasMore ? "+" : ""}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="errors" className="gap-1.5">
              Errors
              {num(row.failed_count) > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  {row.failed_count}
                </Badge>
              )}
              {num(row.failed_count) === 0 && errorRows && errorRows.length > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  {errorRows.length}
                  {errorsHasMore ? "+" : ""}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="rows">Raw rows</TabsTrigger>
          </TabsList>

          <TabsContent value="unmatched">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Unmatched rows</CardTitle>
                <CardDescription>
                  Each row landed here for its own reason — see "Why unmatched" below. It isn't
                  always a bad value: a segment can match and still have no linked campaign, or the
                  vehicle can be missing a due date.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {unmatchedPreviewOnly && unmatchedRows !== null && unmatchedRows.length > 0 && (
                  <Alert className="m-4 mb-0">
                    <AlertTriangle className="size-4" />
                    <AlertDescription className="text-xs">
                      Nothing has been committed yet — these are the rows that would land in
                      Unmatched if you commit right now.
                    </AlertDescription>
                  </Alert>
                )}
                {unmatchedRows === null ? (
                  <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
                    <Loader2 className="size-4 animate-spin" /> Loading…
                  </div>
                ) : unmatchedRows.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    Nothing unmatched — every row was routed to a segment.
                  </div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-20">Excel Row</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Frame no.</TableHead>
                          <TableHead>Next Service Type (raw)</TableHead>
                          <TableHead>Why unmatched</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {unmatchedRows.map((r) => (
                          <UnmatchedRow key={r.id} row={r} />
                        ))}
                      </TableBody>
                    </Table>
                    {unmatchedHasMore && (
                      <div className="flex justify-center py-3 border-t">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={unmatchedLoadingMore}
                          onClick={() => loadUnmatched({ more: true })}
                          className="gap-2"
                        >
                          {unmatchedLoadingMore && <Loader2 className="size-3.5 animate-spin" />}
                          Load more
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="errors">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Failed rows</CardTitle>
                <CardDescription>
                  Rows that couldn't be processed at all — usually an invalid or missing phone
                  number. The rest of the file was unaffected.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {errorsPreviewOnly && errorRows !== null && errorRows.length > 0 && (
                  <Alert className="m-4 mb-0">
                    <AlertTriangle className="size-4" />
                    <AlertDescription className="text-xs">
                      Nothing has been committed yet — these are the rows that would fail if you
                      commit right now.
                    </AlertDescription>
                  </Alert>
                )}
                {errorRows === null ? (
                  <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
                    <Loader2 className="size-4 animate-spin" /> Loading…
                  </div>
                ) : errorRows.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    No failed rows in this upload.
                  </div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-20">Excel Row</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Frame no.</TableHead>
                          <TableHead>Reason</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {errorRows.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="tabular-nums text-muted-foreground">
                              #{excelRow(r)}
                            </TableCell>
                            <TableCell>{r.phone_raw || "—"}</TableCell>
                            <TableCell className="font-mono text-xs">{r.frame_no || "—"}</TableCell>
                            <TableCell className="text-destructive text-sm">
                              {r.error || "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {errorsHasMore && (
                      <div className="flex justify-center py-3 border-t">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={errorsLoadingMore}
                          onClick={() => loadErrors({ more: true })}
                          className="gap-2"
                        >
                          {errorsLoadingMore && <Loader2 className="size-3.5 animate-spin" />}
                          Load more
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rows">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Raw rows</CardTitle>
                <CardDescription>
                  Every line exactly as received, for tracing a specific customer back to its source
                  line.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {rawRows === null ? (
                  <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
                    <Loader2 className="size-4 animate-spin" /> Loading…
                  </div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-20">Excel Row</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Frame no.</TableHead>
                          <TableHead>Next Service Type</TableHead>
                          <TableHead>Next Service Date</TableHead>
                          <TableHead>CRM Status</TableHead>
                          <TableHead>Outcome</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rawRows.map((r) => (
                          <TableRow
                            key={r.id}
                            className="cursor-pointer"
                            onClick={() => setSelectedRawRow(r)}
                          >
                            <TableCell className="tabular-nums text-muted-foreground">
                              #{excelRow(r)}
                            </TableCell>
                            <TableCell>{r.phone_raw || "—"}</TableCell>
                            <TableCell className="font-mono text-xs">{r.frame_no || "—"}</TableCell>
                            <TableCell>{r.next_service_type_raw || "—"}</TableCell>
                            <TableCell>{r.next_service_date || "—"}</TableCell>
                            <TableCell>{r.crm_call_status || "—"}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-[10px]">
                                {r.process_status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {selectedRawRow && (
                      <RawRowDialog
                        row={selectedRawRow}
                        onOpenChange={(open) => {
                          if (!open) setSelectedRawRow(null);
                        }}
                      />
                    )}
                    <div className="flex items-center justify-between px-4 py-3 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={rawPage <= 1}
                        onClick={() => {
                          const p = rawPage - 1;
                          setRawPage(p);
                          loadRows(p);
                        }}
                      >
                        Previous
                      </Button>
                      <span className="text-xs text-muted-foreground">Page {rawPage}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={rawRows.length < 100}
                        onClick={() => {
                          const p = rawPage + 1;
                          setRawPage(p);
                          loadRows(p);
                        }}
                      >
                        Next
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

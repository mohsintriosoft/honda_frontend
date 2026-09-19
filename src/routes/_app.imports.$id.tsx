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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
// NOTE: adjust this path to match where serviceconnection.js actually
// lives in your tree — same file the rest of the app imports from.
import {
  get_import_detail,
  get_import_preview,
  post_import_commit,
  post_import_revert,
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
  | "uploaded"
  | "parsing"
  | "preview_ready"
  | "processing"
  | "done"
  | "failed"
  | "reverted";

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
  created_at: string;
}

interface ServicePreview {
  total_rows: number;
  list_type: string;
  segment_counts: Record<string, number | null>;
  // NEW — a segment can match rows here and still be a dead end: it needs
  // a linked campaign too, or those rows land in Unmatched at commit.
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
  // NEW — segment_configured alone used to look "green" even when the
  // segment had no campaign linked; this catches that case explicitly.
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
  // Every column exactly as it appeared in the uploaded Excel/CSV, keyed
  // by original header -- see RawRowDialog below.
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

function isServicePreview(p: Preview): p is ServicePreview & { error?: string } {
  return "segment_counts" in p;
}

function StatusBadge({ status }: { status: ImportStatus }) {
  const map: Record<ImportStatus, { label: string; className: string; icon: typeof Clock }> = {
    uploaded: { label: "Uploaded", className: "bg-muted text-muted-foreground", icon: Clock },
    parsing: { label: "Parsing", className: "bg-blue-500/15 text-blue-600 dark:text-blue-400", icon: Loader2 },
    preview_ready: { label: "Preview ready", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400", icon: AlertTriangle },
    processing: { label: "Committing", className: "bg-blue-500/15 text-blue-600 dark:text-blue-400", icon: Loader2 },
    done: { label: "Done", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", icon: CheckCircle2 },
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

function StatCell({ label, value, tone }: { label: string; value: string | number; tone?: "warn" | "bad" | "good" }) {
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
   COMMIT / REVERT CONFIRMATION DIALOGS
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
      if (!res?.success) throw new Error(res?.error || "Commit failed");
      onCommitted(res.import as CsvStatsRow);
      setOpen(false);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Commit failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        className="gap-2"
        onClick={() => {
          // Same preview-only scan that feeds the Unmatched tab -- checked
          // now, at the moment of the click, rather than the instant that
          // scan finishes loading, so the page doesn't look broken before
          // anyone has even tried to commit. See commitBlocked below.
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
                The previous commit run stopped responding (no progress in a while — likely a
                server restart or crash mid-file). Rows it already finished were written for
                good and won't be touched again; this only continues with whatever is still
                pending.
              </>
            ) : (
              <>
                Every row is written inside its own atomic transaction — a bad row is marked
                failed and skipped without touching rows that already succeeded. Previous
                batches for the segments this file touches will be frozen (not deleted) and
                their pending queued calls skipped, per the standard month-to-month supersede
                rule.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="text-sm text-muted-foreground space-y-1">
          <p>
            <span className="font-medium text-foreground">{row.total_rows.toLocaleString()}</span>{" "}
            rows total for{" "}
            <span className="font-medium text-foreground">{row.branch?.name}</span>.
          </p>
          <p>Runs in the background — you can safely close or reload this page while it works; the status above updates automatically.</p>
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

function RevertDialog({
  row,
  onReverted,
}: {
  row: CsvStatsRow;
  onReverted: (row: CsvStatsRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRevert = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await server_post_data(post_import_revert(row.id));
      if (!res?.success) throw new Error(res?.error || "Revert failed");
      onReverted(res.import as CsvStatsRow);
      setOpen(false);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Revert failed, nothing was changed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" className="gap-2" onClick={() => setOpen(true)}>
        <RotateCcw className="size-4" />
        Revert
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revert this import?</DialogTitle>
          <DialogDescription>
            Use this when the wrong file, branch, or month was committed.
          </DialogDescription>
        </DialogHeader>
        <Alert variant="destructive" className="border-destructive/30">
          <AlertTriangle className="size-4" />
          <AlertTitle className="text-sm">This flags data, it doesn't delete it</AlertTitle>
          <AlertDescription className="text-xs space-y-1">
            <p>The segment data this import created will be retired and any call tasks still pending will be skipped.</p>
            <p>Customers and vehicles that were created or updated are <span className="font-medium">not</span> rolled back — they may have been touched by a later import since. Raw rows stay for audit either way.</p>
          </AlertDescription>
        </Alert>
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
          <Button variant="destructive" onClick={handleRevert} disabled={busy} className="gap-2">
            {busy && <Loader2 className="size-4 animate-spin" />}
            {busy ? "Reverting…" : "Revert import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* =========================================================
   UNMATCHED ROW — manual segment assignment
========================================================= */

function UnmatchedRow({ row }: { row: CsvDetailsRow }) {
  return (
    <TableRow>
      <TableCell className="tabular-nums font-semibold text-destructive">#{row.row_number + 1}</TableCell>
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
        Row number {row.row_number + 1} of the excel is unmatched
      </TableCell>
    </TableRow>
  );
}

/* =========================================================
   RAW ROW DIALOG — every column exactly as it appeared in the
   uploaded file, for a single row (see CsvDetails.raw).
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
          <DialogTitle>Excel row #{row.row_number}</DialogTitle>
          <DialogDescription>Every column exactly as it appeared in the uploaded file.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto rounded-md border">
          {entries.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">No raw data stored for this row.</div>
          ) : (
            <Table>
              <TableBody>
                {entries.map(([col, val]) => (
                  <TableRow key={col}>
                    <TableCell className="w-1/3 align-top font-medium text-muted-foreground">{col}</TableCell>
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

  // Whether an attempted commit has been refused for having unmatched
  // rows. Deliberately NOT computed automatically from the preview scan
  // -- it only flips true from CommitDialog's onBlocked, i.e. the moment
  // "Confirm import"/"Resume commit" is actually clicked. Combined with
  // hasUnmatchedRows below when rendering, so it stops showing on its
  // own again if the unmatched rows disappear (a re-upload, a fixed
  // segment/campaign, etc.) without needing to be reset explicitly.
  const [commitBlocked, setCommitBlocked] = useState(false);

  // Which detail tab is showing. Kept as real state (not just Tabs'
  // uncontrolled defaultValue) because Radix's onValueChange only fires
  // on a user-driven change -- it never fires for the tab that's already
  // showing via defaultValue on mount. "Unmatched" is that default tab,
  // so on a fresh page load (or a reload straight into an already-done
  // import, as in the screenshot) its data was NEVER fetched and the tab
  // sat on "Loading…" forever, however small or large the file was. The
  // effect below covers exactly that gap.
  const [activeTab, setActiveTab] = useState<"unmatched" | "errors" | "rows">("unmatched");

  const fetchDetail = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await server_get_data(get_import_detail(importId));
        if (!res?.success) throw new Error(res?.error || "Import not found");
        setRow(res.import as CsvStatsRow);
        setError(null);
      } catch (err: any) {
        setError(err?.message || "Could not load this import");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [importId],
  );

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // Poll while the file is still parsing or a commit is in flight.
  useEffect(() => {
    const live = row ? LIVE_STATUSES.includes(row.status) : false;
    if (live) {
      pollRef.current = setInterval(() => fetchDetail(true), 3000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [row?.status, fetchDetail]);

  // Preview once the file is ready to review or already committed.
  useEffect(() => {
    if (!row) return;
    if (row.status !== "preview_ready" && row.status !== "done") {
      setPreview(null);
      return;
    }
    server_get_data(get_import_preview(importId))
      .then((res) => {
        if (res?.success) setPreview(res.preview as Preview);
      })
      .catch(() => setPreview(null));
  }, [row?.status, importId]);

  // Both loaders page with a row-number cursor (?after_row=) instead of
  // fetching everything at once -- see _scan_dry_run_rows()/
  // _paginated_rows_response() on the backend. Before commit, the backend
  // returns preview_only:true and computes the same outcome commit would
  // reach, read-only, so this now shows real content on a preview_ready
  // import instead of always coming back empty.
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
          setUnmatchedHasMore(Boolean(res?.next_after_row));
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
          setErrorsHasMore(Boolean(res?.next_after_row));
          setErrorsPreviewOnly(Boolean(res?.preview_only));
        })
        .catch(() => {
          if (!more) setErrorRows([]);
        })
        .finally(() => setErrorsLoadingMore(false));
    },
    [importId, errorsCursor],
  );

  // Once a preview_ready import actually gets committed, the cached
  // preview-only unmatched/errors rows are stale (dry-run guesses, not
  // what actually happened) -- drop them so the tabs refetch the real
  // committed outcome next time they're opened.
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

  // Fetches whichever tab is currently active as soon as its data is
  // missing and the import is in a state that has something to show
  // (still-'pending' rows during parsing/uploaded render their own
  // spinner instead, see below) -- covers both the initial default-tab
  // mount case above and the "row.status flipped and cleared the cached
  // rows" case that used to only re-fetch if the user happened to
  // re-click the tab.
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

  // A genuinely live commit (heartbeat still fresh) shouldn't offer a
  // clickable "Confirm import" button at all -- the backend would just
  // 409 it. Only preview_ready (first commit) or a stalled 'processing'
  // (previous run's process/thread died -- see commit_stalled) are
  // actionable; anything else in between shows a plain "Committing…"
  // indicator instead.
  // row.unmatched_count is only populated after a real commit; before
  // that, hasUnmatchedRows falls back to the preview-only unmatched scan
  // (unmatchedRows). Either source finding at least one row means the
  // admin needs to fix or manually route it first -- but that's only
  // enforced at the moment a commit is actually attempted (commitBlocked,
  // set from CommitDialog's onBlocked), not the instant the scan
  // finishes, so the page doesn't show a block before anyone has tried.
  const hasUnmatchedRows =
    row.unmatched_count > 0 || (unmatchedRows !== null && unmatchedRows.length > 0);

  const canAttemptCommit =
    row.status === "preview_ready" || (row.status === "processing" && row.commit_stalled);
  const isLiveCommitting = row.status === "processing" && !row.commit_stalled;
  const canRevert = row.status === "done";

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
                {new Date(row.period_month).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
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
                resuming={row.status === "processing"}
                hasUnmatchedRows={hasUnmatchedRows}
                onBlocked={() => setCommitBlocked(true)}
              />
            )}
            {canAttemptCommit && commitBlocked && hasUnmatchedRows && (
              <Badge variant="secondary" className="gap-1 font-medium bg-destructive/15 text-destructive">
                <XCircle className="size-3" />
                Import blocked — unmatched rows
              </Badge>
            )}
            {canRevert && <RevertDialog row={row} onReverted={setRow} />}
          </div>
        }
      />

      <div className="px-4 md:px-6 lg:px-8 py-6 space-y-6">
        {row.status === "failed" && (
          <Alert variant="destructive">
            <XCircle className="size-4" />
            <AlertTitle>This import failed</AlertTitle>
            <AlertDescription>
              Check the server logs for the exact stage. Rows that already committed before the
              failure are unaffected — each row is its own transaction.
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
              rows still pending are unaffected. Use "Resume commit" above to continue with the
              rows that are left.
            </AlertDescription>
          </Alert>
        )}

        {row.status === "parsing" && row.parse_stalled && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>Upload stopped responding</AlertTitle>
            <AlertDescription>
              Parsing this file hasn't progressed in a while and likely crashed before any rows
              were saved (parsing writes the whole file as one unit, so nothing partial is left
              behind). Please re-upload the file.
            </AlertDescription>
          </Alert>
        )}

        {!row.reconciles && (row.status === "done" || row.status === "processing") && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>Reconciliation doesn't balance</AlertTitle>
            <AlertDescription>
              total_rows should equal segment_data_created + unmatched + skipped + failed. Some
              rows may be unaccounted for — worth a look before trusting this batch.
            </AlertDescription>
          </Alert>
        )}

        {commitBlocked && hasUnmatchedRows && (row.status === "preview_ready" || (row.status === "processing" && row.commit_stalled)) && (
          <Alert variant="destructive">
            <XCircle className="size-4" />
            <AlertTitle>Unmatched rows found — this data cannot be imported</AlertTitle>
            <AlertDescription className="text-xs space-y-1">
              <p>
                {row.unmatched_count > 0
                  ? `${row.unmatched_count.toLocaleString()} row${row.unmatched_count !== 1 ? "s" : ""}`
                  : `${unmatchedRows!.length.toLocaleString()}${unmatchedHasMore ? "+" : ""} row${unmatchedRows!.length !== 1 ? "s" : ""}`}{" "}
                in this file could not be matched to a segment. The data cannot be imported until
                every row is matched correctly — fix the file and re-upload. See the "Unmatched"
                tab below for the exact rows.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {/* Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <StatCell label="Total rows" value={row.total_rows.toLocaleString()} />
          <StatCell label="Will be queued" value={row.segment_data_created.toLocaleString()} tone="good" />
          <StatCell label="Unmatched" value={row.unmatched_count.toLocaleString()} tone={row.unmatched_count ? "warn" : undefined} />
          <StatCell label="Skipped (DNC)" value={row.skipped_count.toLocaleString()} />
          <StatCell label="Failed" value={row.failed_count.toLocaleString()} tone={row.failed_count ? "bad" : undefined} />
          <StatCell label="Customers new / updated" value={`${row.customers_created} / ${row.customers_updated}`} />
          <StatCell label="Vehicles new / updated" value={`${row.vehicles_created} / ${row.vehicles_updated}`} />
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
                        {preview.missed_service_count.toLocaleString()}
                      </div>
                    </div>
                    {Object.entries(preview.segment_counts).map(([name, count]) => {
                      const missingCampaign = preview.segments_without_campaign?.includes(name);
                      return (
                        <div
                          key={name}
                          className={`rounded-md border px-3 py-2 ${missingCampaign ? "border-amber-500/40 bg-amber-500/5" : "bg-muted/30"
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
                            <div className="text-[11px] text-amber-600 mt-0.5">No campaign linked</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {preview.missed_service_warning && (
                    <Alert className="border-amber-500/30 bg-amber-500/5">
                      <AlertTriangle className="size-4 text-amber-600" />
                      <AlertDescription className="text-xs">{preview.missed_service_warning}</AlertDescription>
                    </Alert>
                  )}
                  {preview.campaign_warning && (
                    <Alert className="border-amber-500/30 bg-amber-500/5">
                      <AlertTriangle className="size-4 text-amber-600" />
                      <AlertDescription className="text-xs">{preview.campaign_warning}</AlertDescription>
                    </Alert>
                  )}
                </>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="rounded-md border bg-muted/30 px-3 py-2">
                    <div className="text-xs text-muted-foreground">Date column found</div>
                    <div className="text-sm font-medium">{preview.expiry_column_present ? "Yes" : "No"}</div>
                  </div>
                  <div className="rounded-md border bg-muted/30 px-3 py-2">
                    <div className="text-xs text-muted-foreground">Rows with a due date</div>
                    <div className="text-lg font-semibold tabular-nums">{preview.rows_with_expiry_date.toLocaleString()}</div>
                  </div>
                  <div className="rounded-md border bg-muted/30 px-3 py-2">
                    <div className="text-xs text-muted-foreground">Segment configured</div>
                    <div className="text-sm font-medium">{preview.segment_configured ? "Yes" : "No"}</div>
                  </div>
                  <div
                    className={`rounded-md border px-3 py-2 ${preview.segment_configured && !preview.campaign_linked
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
                  {row.segment_data_created + row.unmatched_count + row.skipped_count + row.failed_count}
                </span>
                <span className="text-muted-foreground">of</span>
                <span className="font-medium tabular-nums">{row.total_rows}</span>
                {row.reconciles ? (
                  <CheckCircle2 className="size-4 text-emerald-600" />
                ) : (
                  <XCircle className="size-4 text-destructive" />
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {(row.status === "uploaded" || row.status === "parsing") && (
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
              {row.unmatched_count > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  {row.unmatched_count}
                </Badge>
              )}
              {/* row.unmatched_count is only populated at commit -- before
                  that, show what the preview scan has turned up so far
                  (it stops once it's found a page, so this is a floor,
                  not the exact total, hence the "+"). */}
              {row.unmatched_count === 0 && unmatchedRows && unmatchedRows.length > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  {unmatchedRows.length}
                  {unmatchedHasMore ? "+" : ""}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="errors" className="gap-1.5">
              Errors
              {row.failed_count > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  {row.failed_count}
                </Badge>
              )}
              {row.failed_count === 0 && errorRows && errorRows.length > 0 && (
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
                  always a bad value: a segment can match and still have no linked campaign, or
                  the vehicle can be missing a due date.
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
                          <TableHead className="w-16">Row</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Frame no.</TableHead>
                          <TableHead>Reason</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {errorRows.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="tabular-nums text-muted-foreground">{r.row_number}</TableCell>
                            <TableCell>{r.phone_raw || "—"}</TableCell>
                            <TableCell className="font-mono text-xs">{r.frame_no || "—"}</TableCell>
                            <TableCell className="text-destructive text-sm">{r.error || "—"}</TableCell>
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
                <CardDescription>Every line exactly as received, for tracing a specific customer back to its source line.</CardDescription>
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
                          <TableHead className="w-16">Row</TableHead>
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
                            <TableCell className="tabular-nums text-muted-foreground">{r.row_number}</TableCell>
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
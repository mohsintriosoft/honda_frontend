import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    UploadCloud,
    FileSpreadsheet,
    Loader2,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Clock,
    RotateCcw,
    ChevronRight,
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
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
// NOTE: adjust this path to wherever serviceconnection.js actually lives
// in your tree (it currently imports "../LocalConnection/LocalConnection.js",
// so it's likely under something like src/API/ or src/Connection/ — this
// file only needs the named exports below, not the path itself).
import {
    get_imports,
    post_import_upload,
    get_branches,
    get_dialer_schedule,
    post_dialer_schedule,
    server_get_data,
    server_post_json,
    server_upload_file,
} from "@/components/ServiceConnection/serviceconnection";

/* =========================================================
   TYPES — mirror _serialize_csv_stats() in views_import.py
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
    // Present once a parse/commit has hit a problem worth recording; the
    // BLOCK-ON-UNMATCHED refusal (see views_import.py's _parse()) lands
    // here as stage: "parse" with unmatched_rows naming every offending
    // Excel row, so the admin knows exactly what to fix before
    // re-uploading instead of just seeing a generic "Failed" badge.
    error_log?: {
        stage: string;
        error: string;
        unmatched_rows?: { row_number: number; excel_row: number; reason: string }[];
    }[];
    created_at: string;
}

interface Branch {
    id: number;
    name: string;
}

// In-flight statuses worth polling on — the row is still changing on its
// own (parse happens synchronously server-side today, but this keeps the
// list honest if that ever moves to a background job per the docs' "known
// limitation" note).
const LIVE_STATUSES: ImportStatus[] = ["uploaded", "parsing", "processing"];

const LIST_TYPE_LABEL: Record<ListType, string> = {
    service: "Service due",
    missed: "Missed / lost service",
    amc: "AMC renewal",
    insurance: "Insurance renewal",
    other: "Other",
};

// Only these are offered when uploading a new file. "missed" and "other"
// stay out of the picker on purpose:
//   - "missed" is redundant with "service" -- a regular service-due upload
//     already routes rows with a missed_service_date to the Missed Service
//     campaign automatically (see the "Missed Service takes priority"
//     notice below), and picking "missed" for this dealer's actual monthly
//     export would wrongly force EVERY row in the file into Missed Service
//     regardless of its real Next Service Type.
//   - "other" is a backend safety-net fallback for an unrecognised
//     list_type value coming from somewhere other than this form, not a
//     real choice meant to be made here.
// LIST_TYPE_LABEL above is kept complete (not trimmed) so past uploads
// that used either value still render a proper label in the table.
const UPLOADABLE_LIST_TYPES: ListType[] = ["service", "insurance", "amc"];

function StatusBadge({ status }: { status: ImportStatus }) {
    const map: Record<
        ImportStatus,
        { label: string; className: string; icon: typeof Clock }
    > = {
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

// The admin should never have to guess why a file was refused -- pull the
// most recent error_log entry (parse or commit) so its message, and any
// named Excel rows, can render right next to the file instead of only the
// generic "Failed" badge.
function latestImportError(row: CsvStatsRow) {
    const log = row.error_log ?? [];
    return log.length > 0 ? log[log.length - 1] : null;
}

function ReconcileBadge({ row }: { row: CsvStatsRow }) {
    if (row.status !== "done" && row.status !== "processing") return null;
    return row.reconciles ? (
        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-3.5" /> Balanced
        </span>
    ) : (
        <span className="inline-flex items-center gap-1 text-xs text-destructive">
            <AlertTriangle className="size-3.5" /> Mismatch
        </span>
    );
}

/* =========================================================
   UPLOAD DIALOG
========================================================= */

function UploadDialog({
    branches,
    onUploaded,
}: {
    branches: Branch[];
    onUploaded: (row: CsvStatsRow) => void;
}) {
    const [open, setOpen] = useState(false);
    const [branchId, setBranchId] = useState<string>("");
    const [listType, setListType] = useState<ListType>("service");
    const [sheetName, setSheetName] = useState<string>("");
    const [file, setFile] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const reset = () => {
        setBranchId("");
        setListType("service");
        setSheetName("");
        setFile(null);
        setError(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const canSubmit = Boolean(branchId) && Boolean(file) && !submitting;

    const handleSubmit = async () => {
        if (!file || !branchId) return;
        setSubmitting(true);
        setError(null);
        try {
            const res = await server_upload_file(post_import_upload, file, "file", {
                branch_id: branchId,
                list_type: listType,
                sheet_name: sheetName || undefined,
            });
            if (!res?.success) {
                throw new Error(res?.error || "Upload failed");
            }
            onUploaded(res.import as CsvStatsRow);
            setOpen(false);
            reset();
        } catch (err: any) {
            setError(
                err?.response?.data?.error ||
                err?.message ||
                "Upload failed — check the file and try again.",
            );
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                setOpen(o);
                if (!o) reset();
            }}
        >
            <DialogTrigger asChild>
                <Button className="gap-2">
                    <UploadCloud className="size-4" />
                    Upload call list
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Upload a call list</DialogTitle>
                    <DialogDescription>
                        One file, one branch. The file is stored and parsed immediately —
                        nothing is queued to call until you review and confirm the
                        preview on the next screen.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="branch">Branch</Label>
                            <Select value={branchId} onValueChange={setBranchId}>
                                <SelectTrigger id="branch">
                                    <SelectValue placeholder="Select branch" />
                                </SelectTrigger>
                                <SelectContent>
                                    {branches.map((b) => (
                                        <SelectItem key={b.id} value={String(b.id)}>
                                            {b.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="list-type">List type</Label>
                            <Select value={listType} onValueChange={(v) => setListType(v as ListType)}>
                                <SelectTrigger id="list-type">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {UPLOADABLE_LIST_TYPES.map((lt) => (
                                        <SelectItem key={lt} value={lt}>
                                            {LIST_TYPE_LABEL[lt]}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="sheet">Sheet name (optional)</Label>
                        <Input
                            id="sheet"
                            placeholder="e.g. SEPTEMBER 2026"
                            value={sheetName}
                            onChange={(e) => setSheetName(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            Month covered is detected automatically from the file once it's parsed.
                        </p>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="file">File</Label>
                        <Input
                            id="file"
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.xlsm,.xls,.csv"
                            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                        />
                        <p className="text-xs text-muted-foreground">
                            .xlsx, .xlsm, .xls or .csv. Column names can vary month to
                            month — they're matched by alias, not position.
                        </p>
                    </div>

                    {listType === "service" && (
                        <Alert className="border-amber-500/30 bg-amber-500/5">
                            <AlertTriangle className="size-4 text-amber-600" />
                            <AlertTitle className="text-sm">Missed Service takes priority</AlertTitle>
                            <AlertDescription className="text-xs">
                                A vehicle carrying an earlier missed service is queued for
                                that call only — never both. It won't also appear under its
                                Next Service Type.
                            </AlertDescription>
                        </Alert>
                    )}

                    {error && (
                        <Alert variant="destructive">
                            <XCircle className="size-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={!canSubmit} className="gap-2">
                        {submitting && <Loader2 className="size-4 animate-spin" />}
                        {submitting ? "Uploading…" : "Upload and parse"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/* =========================================================
   SCHEDULER TIME CARD
   Sets the daily local time run_dialer.py's nightly scheduler wakes
   up at to build tomorrow's call queue (Dealer.call_scheduler_hour /
   call_scheduler_minute -- see dialer_schedule / update_dialer_schedule
   in views_admin.py). Just the setter, no status info by design.
========================================================= */

function SchedulerTimeCard() {
    const [value, setValue] = useState<string>(""); // "HH:MM", <input type="time"> format
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        server_get_data(get_dialer_schedule)
            .then((res) => {
                if (res?.success) {
                    const hh = String(res.hour).padStart(2, "0");
                    const mm = String(res.minute).padStart(2, "0");
                    setValue(`${hh}:${mm}`);
                } else {
                    setError(res?.error || "Could not load scheduler time");
                }
            })
            .catch((err: any) => setError(err?.message || "Could not load scheduler time"))
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        if (!value) return;
        const [hh, mm] = value.split(":").map(Number);
        setSaving(true);
        setError(null);
        setSaved(false);
        try {
            const res = await server_post_json(post_dialer_schedule, { hour: hh, minute: mm });
            if (!res?.success) throw new Error(res?.error || "Save failed");
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err: any) {
            setError(err?.response?.data?.error || err?.message || "Save failed");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card className="mb-4">
            <CardHeader className="pb-3">
                <CardTitle className="text-base">Dialer scheduler time</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-3">
                {loading ? (
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                ) : (
                    <>
                        <Input
                            type="time"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            className="w-32"
                        />
                        <Button onClick={handleSave} disabled={saving || !value} className="gap-2">
                            {saving && <Loader2 className="size-4 animate-spin" />}
                            {saving ? "Saving…" : "Save"}
                        </Button>
                        {saved && (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="size-3.5" /> Saved
                            </span>
                        )}
                        {error && <span className="text-xs text-destructive">{error}</span>}
                    </>
                )}
            </CardContent>
        </Card>
    );
}

/* =========================================================
   PAGE
========================================================= */

export default function Imports() {
    const navigate = useNavigate();
    const [rows, setRows] = useState<CsvStatsRow[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchImports = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await server_get_data(get_imports);
            if (res?.success) {
                setRows(res.imports ?? []);
                setError(null);
            } else {
                setError(res?.error || "Could not load uploads");
            }
        } catch (err: any) {
            setError(err?.message || "Could not load uploads");
        } finally {
            if (!silent) setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchImports();
        server_get_data(get_branches)
            .then((res) => setBranches(res?.branches ?? res?.results ?? res ?? []))
            .catch(() => setBranches([]));
    }, [fetchImports]);

    // Poll while anything is still uploading/parsing/committing, so the
    // status column updates without a manual refresh.
    const hasLiveRows = useMemo(
        () => rows.some((r) => LIVE_STATUSES.includes(r.status)),
        [rows],
    );

    useEffect(() => {
        if (hasLiveRows) {
            pollRef.current = setInterval(() => fetchImports(true), 4000);
        }
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [hasLiveRows, fetchImports]);

    return (
        <div>
            <PageHeader
                title="Data Import"
                description="The entry point for every customer, vehicle, and call task. Upload the monthly CRM list, review the reconciliation, then commit."
                actions={<UploadDialog branches={branches} onUploaded={() => fetchImports()} />}
            />

            <div className="px-4 md:px-6 lg:px-8 py-6">
                {error && (
                    <Alert variant="destructive" className="mb-4">
                        <XCircle className="size-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                <SchedulerTimeCard />

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Recent uploads</CardTitle>
                        <CardDescription>
                            Every commit is per-row and atomic — a bad row is marked
                            failed and skipped, it never rolls back rows that already
                            succeeded. A fully committed import can still be reverted.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
                                <Loader2 className="size-4 animate-spin" /> Loading uploads…
                            </div>
                        ) : rows.length === 0 ? (
                            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                                <FileSpreadsheet className="size-8 text-muted-foreground" />
                                <p className="text-sm font-medium">No uploads yet</p>
                                <p className="text-xs text-muted-foreground max-w-xs">
                                    Upload this month's call list to get started — the CRM
                                    export usually lands on the 1st.
                                </p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>File</TableHead>
                                        <TableHead>Branch</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead className="text-right">Rows</TableHead>
                                        <TableHead className="text-right">Queued</TableHead>
                                        <TableHead className="text-right">Unmatched</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Reconciliation</TableHead>
                                        <TableHead>Uploaded</TableHead>
                                        <TableHead className="w-8" />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rows.map((row) => {
                                        const lastError = row.status === "failed" ? latestImportError(row) : null;
                                        return (
                                            <TableRow
                                                key={row.id}
                                                className="cursor-pointer"
                                                onClick={() => navigate(`/imports/${row.id}`)}
                                            >
                                                <TableCell className="font-medium max-w-[220px]">
                                                    <div className="truncate">{row.file_name}</div>
                                                    {lastError && (
                                                        <div
                                                            className="mt-1 flex items-start gap-1 text-xs font-normal text-destructive"
                                                            title={lastError.error}
                                                        >
                                                            <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                                                            <span className="line-clamp-2">
                                                                {lastError.error}
                                                                {lastError.unmatched_rows && lastError.unmatched_rows.length > 0 && (
                                                                    <>
                                                                        {" "}
                                                                        Upload again after fixing the unmatched
                                                                        row{lastError.unmatched_rows.length !== 1 ? "s" : ""}.
                                                                    </>
                                                                )}
                                                            </span>
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell>{row.branch?.name}</TableCell>
                                                <TableCell className="text-muted-foreground">
                                                    {LIST_TYPE_LABEL[row.list_type] ?? row.list_type}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {row.total_rows.toLocaleString()}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {row.segment_data_created.toLocaleString()}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {row.unmatched_count > 0 ? (
                                                        <span className="text-amber-600 dark:text-amber-400">
                                                            {row.unmatched_count.toLocaleString()}
                                                        </span>
                                                    ) : (
                                                        "0"
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <StatusBadge status={row.status} />
                                                </TableCell>
                                                <TableCell>
                                                    <ReconcileBadge row={row} />
                                                </TableCell>
                                                <TableCell className="text-muted-foreground whitespace-nowrap">
                                                    {new Date(row.created_at).toLocaleString(undefined, {
                                                        day: "2-digit",
                                                        month: "short",
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    })}
                                                </TableCell>
                                                <TableCell>
                                                    <ChevronRight className="size-4 text-muted-foreground" />
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
import { useEffect, useMemo, useState, useCallback } from "react";
import { PhoneIncoming, Users2, RefreshCw, Check, X } from "lucide-react";

import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    get_callbacks,
    patch_callback,
    server_get_data,
    server_patch_data,
} from "@/components/ServiceConnection/serviceconnection";

type CallbackRow = {
    id: number;
    branchId: number | null;
    branchName: string | null;
    customerName: string;
    phoneNumber: string;
    callbackType: "customer" | "team";
    department: string | null;
    reason: string;
    requestedFor: string | null;
    status: "pending" | "completed" | "cancelled";
    handledBy: string | null;
    handledAt: string | null;
    staffNotes: string;
    sessionId: string | null;
    createdAt: string | null;
};

const STATUS_FILTERS = ["all", "pending", "completed", "cancelled"] as const;
const TYPE_FILTERS = ["all", "customer", "team"] as const;

function formatDate(value: string | null) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(value: string | null) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString(undefined, {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function StatusBadge({ status }: { status: CallbackRow["status"] }) {
    if (status === "completed") {
        return (
            <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15 dark:text-emerald-400">
                Completed
            </Badge>
        );
    }
    if (status === "cancelled") {
        return <Badge variant="destructive">Cancelled</Badge>;
    }
    return <Badge variant="outline">Pending</Badge>;
}

function TypeBadge({ row }: { row: CallbackRow }) {
    if (row.callbackType === "team") {
        return (
            <div className="flex items-center gap-1.5 text-sm">
                <Users2 className="size-3.5 text-muted-foreground" />
                <span>{row.department || "Team"}</span>
            </div>
        );
    }
    return (
        <div className="flex items-center gap-1.5 text-sm">
            <PhoneIncoming className="size-3.5 text-muted-foreground" />
            <span>Arohi (self)</span>
        </div>
    );
}

export default function Callbacks() {
    const [rows, setRows] = useState<CallbackRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("all");
    const [typeFilter, setTypeFilter] = useState<(typeof TYPE_FILTERS)[number]>("all");
    const [updatingId, setUpdatingId] = useState<number | null>(null);

    const fetchCallbacks = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params: Record<string, string> = {};
            if (statusFilter !== "all") params.status = statusFilter;
            if (typeFilter !== "all") params.callback_type = typeFilter;

            const data = await server_get_data(get_callbacks, params);
            setRows(data?.callbacks ?? []);
        } catch (err) {
            console.error(err);
            setError("Couldn't load callbacks. Try refreshing.");
        } finally {
            setLoading(false);
        }
    }, [statusFilter, typeFilter]);

    useEffect(() => {
        fetchCallbacks();
    }, [fetchCallbacks]);

    const updateStatus = async (row: CallbackRow, status: "completed" | "cancelled") => {
        setUpdatingId(row.id);
        try {
            await server_patch_data(patch_callback(row.id), { status });
            setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status } : r)));
        } catch (err) {
            console.error(err);
            setError("Couldn't update that callback. Try again.");
        } finally {
            setUpdatingId(null);
        }
    };

    const pendingCount = useMemo(() => rows.filter((r) => r.status === "pending").length, [rows]);

    return (
        <div className="pb-10">
            <PageHeader
                title="Callbacks"
                description="Customers waiting on a call back from Arohi or another team, straight off the live calls."
                breadcrumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Callbacks" }]}
                actions={
                    <Button variant="outline" size="sm" onClick={fetchCallbacks} disabled={loading}>
                        <RefreshCw className={loading ? "size-4 mr-1.5 animate-spin" : "size-4 mr-1.5"} />
                        Refresh
                    </Button>
                }
            />

            <div className="px-4 md:px-6 lg:px-8 pt-5">
                <div className="flex flex-wrap items-center gap-2 mb-4">
                    <div className="flex items-center rounded-md border bg-muted/30 p-0.5 text-sm">
                        {STATUS_FILTERS.map((s) => (
                            <button
                                key={s}
                                onClick={() => setStatusFilter(s)}
                                className={
                                    "px-3 py-1.5 rounded-[5px] capitalize transition-colors " +
                                    (statusFilter === s
                                        ? "bg-background shadow-sm font-medium"
                                        : "text-muted-foreground hover:text-foreground")
                                }
                            >
                                {s === "all" ? "All statuses" : s}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center rounded-md border bg-muted/30 p-0.5 text-sm">
                        {TYPE_FILTERS.map((t) => (
                            <button
                                key={t}
                                onClick={() => setTypeFilter(t)}
                                className={
                                    "px-3 py-1.5 rounded-[5px] capitalize transition-colors " +
                                    (typeFilter === t
                                        ? "bg-background shadow-sm font-medium"
                                        : "text-muted-foreground hover:text-foreground")
                                }
                            >
                                {t === "all" ? "All types" : t === "customer" ? "Arohi callback" : "Team callback"}
                            </button>
                        ))}
                    </div>

                    <div className="ml-auto text-sm text-muted-foreground">
                        {loading ? "Loading…" : `${rows.length} shown • ${pendingCount} pending`}
                    </div>
                </div>

                {error && (
                    <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                        {error}
                    </div>
                )}

                <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/40 text-muted-foreground">
                            <tr className="text-left">
                                <th className="px-4 py-2.5 font-medium">Customer</th>
                                <th className="px-4 py-2.5 font-medium">Requested by</th>
                                <th className="px-4 py-2.5 font-medium">Reason</th>
                                <th className="px-4 py-2.5 font-medium">Branch</th>
                                <th className="px-4 py-2.5 font-medium">Requested for</th>
                                <th className="px-4 py-2.5 font-medium">Status</th>
                                <th className="px-4 py-2.5 font-medium">Created</th>
                                <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {!loading && rows.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                                        No callbacks match these filters.
                                    </td>
                                </tr>
                            )}

                            {rows.map((row) => (
                                <tr key={row.id} className="hover:bg-muted/20">
                                    <td className="px-4 py-3">
                                        <div className="font-medium">{row.customerName}</div>
                                        <div className="text-xs text-muted-foreground">{row.phoneNumber}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <TypeBadge row={row} />
                                    </td>
                                    <td className="px-4 py-3 max-w-[260px]">
                                        <span className="text-muted-foreground">{row.reason || "—"}</span>
                                    </td>
                                    <td className="px-4 py-3">{row.branchName || "—"}</td>
                                    <td className="px-4 py-3">{formatDate(row.requestedFor)}</td>
                                    <td className="px-4 py-3">
                                        <StatusBadge status={row.status} />
                                        {row.status !== "pending" && row.handledBy && (
                                            <div className="text-xs text-muted-foreground mt-1">by {row.handledBy}</div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground">{formatDateTime(row.createdAt)}</td>
                                    <td className="px-4 py-3">
                                        {row.status === "pending" ? (
                                            <div className="flex items-center justify-end gap-1.5">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={updatingId === row.id}
                                                    onClick={() => updateStatus(row, "completed")}
                                                >
                                                    <Check className="size-3.5 mr-1" />
                                                    Done
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    disabled={updatingId === row.id}
                                                    onClick={() => updateStatus(row, "cancelled")}
                                                >
                                                    <X className="size-3.5 mr-1" />
                                                    Cancel
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="text-right text-xs text-muted-foreground">
                                                {row.handledAt ? formatDateTime(row.handledAt) : "—"}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
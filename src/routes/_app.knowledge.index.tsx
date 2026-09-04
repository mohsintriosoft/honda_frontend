import { useEffect, useState } from "react";

import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2 } from "lucide-react";

import {
    server_get_data,
    server_post_json,
    server_put_data,
    server_delete_data,
    get_dealers,
    get_branches,
    get_segments,
    get_kb_documents,
    kb_store_url,
    kb_document_update_url,
    kb_document_delete_url,
} from "@/components/ServiceConnection/serviceconnection";
import { handleError } from "@/components/CommonJquery/CommonJquery";

const isValidCategorySource = (value: string) => /^[a-zA-Z0-9_]+$/.test(value);

// 🔥 The 4 real KnowledgeCollections (backend: kb_{dealer.code}_{slug}).
// This is NOT the 7-segment list and NOT the full MODULE_CHOICES enum on
// Segment/LLMSetting — those have sales/winback/feedback values that have
// no corresponding KnowledgeCollection row, which is why picking them used
// to fail silently on save (module_to_collection_slug() had nothing to
// resolve them to). Keep this in sync with KnowledgeCollection, not with
// MODULE_CHOICES.
const COLLECTION_OPTIONS: { value: string; label: string }[] = [
    { value: "general", label: "Common Info (Global)" },
    { value: "service", label: "Service Rate Card" },
    { value: "insurance", label: "Insurance Info" },
    { value: "amc", label: "AMC Plans" },
];

interface Branch {
    id: number;
    name: string;
}

interface Segment {
    id: number;
    name: string;          // "FREE 01", "Insurance Due", ...
    module: string;        // service | insurance | amc
}

interface MetadataRow {
    key: string;
    value: string;
}

interface KnowledgeFormState {
    docId: string;
    title: string;
    content: string;
    category: string;
    sourceDoc: string;
    module: string;             // which of the 4 KnowledgeCollections
    segmentIds: number[];       // optional override — which of the 7 segments
    branchId: number | null;    // null => Global branch (applies to every branch)
    metadata: MetadataRow[];
}

const EMPTY_FORM: KnowledgeFormState = {
    docId: "", title: "", content: "", category: "", sourceDoc: "",
    module: "general", segmentIds: [], branchId: null, metadata: [],
};

export default function KnowledgeGlobal() {
    // Single-dealer install assumed — resolved silently, never shown in the UI.
    // If this becomes multi-dealer, this needs to come from auth/workspace
    // context instead of "just take the first one".
    const [dealerId, setDealerId] = useState<number | null>(null);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [segments, setSegments] = useState<Segment[]>([]);

    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const [showForm, setShowForm] = useState(false);
    const [editingDocId, setEditingDocId] = useState<string | null>(null);
    const [form, setForm] = useState<KnowledgeFormState>(EMPTY_FORM);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Filters — "" means "All"; branch filter additionally accepts "global".
    const [filterModule, setFilterModule] = useState<string>("");
    const [filterBranch, setFilterBranch] = useState<string>("");

    useEffect(() => {
        (async () => {
            try {
                const res = await server_get_data(get_dealers);
                const list = res?.dealers ?? [];
                if (list.length > 0) setDealerId(list[0].id);
            } catch (error) {
                console.error("Failed to load dealer:", error);
                handleError("network");
            }
        })();
    }, []);

    useEffect(() => {
        if (!dealerId) return;
        (async () => {
            try {
                const res = await server_get_data(get_branches, { dealer_id: dealerId });
                setBranches(res?.branches ?? []);
            } catch (error) {
                console.error("Failed to load branches:", error);
                handleError("network");
            }
        })();
    }, [dealerId]);

    // 🔥 The real 7 segments — FREE 01/02/03, PAID, Missed Service, Insurance
    // Due, AMC Due. Flat, not user-creatable (see docs §8.7), so this list
    // always comes from the API, never hardcoded here.
    useEffect(() => {
        if (!dealerId) return;
        (async () => {
            try {
                const res = await server_get_data(get_segments, { dealer_id: dealerId });
                setSegments(res?.segments ?? []);
            } catch (error) {
                console.error("Failed to load segments:", error);
                handleError("network");
            }
        })();
    }, [dealerId]);

    async function loadDocs() {
        if (!dealerId) return;
        setLoading(true);
        try {
            const params: Record<string, any> = { dealer_id: dealerId };
            if (filterModule) params.module = filterModule;

            const res = await server_get_data(get_kb_documents, params);
            let docs = res?.documents ?? [];

            if (filterBranch === "global") {
                docs = docs.filter(
                    (d: any) => !Array.isArray(d.branch_ids) || d.branch_ids.length === 0,
                );
            } else if (filterBranch) {
                const branchId = Number(filterBranch);
                docs = docs.filter(
                    (d: any) => Array.isArray(d.branch_ids) && d.branch_ids.includes(branchId),
                );
            }

            setItems(docs);
        } catch (error) {
            console.error("Failed to load knowledge base:", error);
            handleError("network");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadDocs();
    }, [dealerId, filterModule, filterBranch]);

    function openAdd() {
        setEditingDocId(null);
        setForm(EMPTY_FORM);
        setErrors({});
        setShowForm(true);
    }

    function openEdit(item: any) {
        const metadataRows: MetadataRow[] = Object.entries(item.metadata ?? {}).map(
            ([key, value]) => ({ key, value: String(value) }),
        );
        setEditingDocId(item.doc_id);
        setForm({
            docId: item.doc_id ?? "",
            title: item.title ?? "",
            content: item.content ?? "",
            category: item.category ?? "",
            sourceDoc: (item.source ?? "").replace(/\.pdf$/, ""),
            module: item.module ?? "general",
            segmentIds: Array.isArray(item.segment_ids) ? item.segment_ids : [],
            branchId: Array.isArray(item.branch_ids) && item.branch_ids.length ? item.branch_ids[0] : null,
            metadata: metadataRows,
        });
        setErrors({});
        setShowForm(true);
    }

    function closeForm() {
        setShowForm(false);
        setEditingDocId(null);
        setForm(EMPTY_FORM);
        setErrors({});
    }

    function fieldChange(
        field: keyof Omit<KnowledgeFormState, "metadata" | "branchId" | "segmentIds">,
        value: string,
    ) {
        setForm((prev) => ({ ...prev, [field]: value }));
    }

    function toggleSegment(segmentId: number) {
        setForm((prev) => ({
            ...prev,
            segmentIds: prev.segmentIds.includes(segmentId)
                ? prev.segmentIds.filter((id) => id !== segmentId)
                : [...prev.segmentIds, segmentId],
        }));
    }

    function addMetadataRow() {
        setForm((prev) => ({ ...prev, metadata: [...prev.metadata, { key: "", value: "" }] }));
    }
    function updateMetadataRow(index: number, field: keyof MetadataRow, value: string) {
        setForm((prev) => ({
            ...prev,
            metadata: prev.metadata.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
        }));
    }
    function deleteMetadataRow(index: number) {
        setForm((prev) => ({ ...prev, metadata: prev.metadata.filter((_, i) => i !== index) }));
    }

    function validate() {
        const next: Record<string, string> = {};
        if (editingDocId !== null && !form.docId.trim()) {
            next.docId = "Document ID is required";
        } else if (form.docId.trim() && !isValidCategorySource(form.docId)) {
            next.docId = "Only alphabets, numbers, and underscore (_) allowed";
        }
        if (!form.title.trim()) next.title = "Title is required";
        if (!form.content.trim()) next.content = "Content is required";
        if (!form.category.trim()) {
            next.category = "Category is required";
        } else if (!isValidCategorySource(form.category)) {
            next.category = "Only alphabets, numbers, and underscore (_) allowed";
        }
        if (form.sourceDoc.trim() && !isValidCategorySource(form.sourceDoc)) {
            next.sourceDoc = "Only alphabets, numbers, and underscore (_) allowed";
        }
        form.metadata.forEach((row, index) => {
            if (!row.key.trim()) next[`metadata_${index}_key`] = "Key is required";
        });
        setErrors(next);
        return Object.keys(next).length === 0;
    }

    async function handleSave() {
        if (!validate() || !dealerId) return;

        const metadata: Record<string, string | number> = {};
        form.metadata.forEach((row) => {
            if (row.key.trim()) {
                const num = Number(row.value);
                metadata[row.key.trim()] = row.value === "" || isNaN(num) ? row.value : num;
            }
        });
        const source = form.sourceDoc.trim() ? `${form.sourceDoc.trim()}.pdf` : "";

        const payload = {
            dealer_id: dealerId,
            module: form.module || "general",
            segment_ids: form.segmentIds,
            branch_ids: form.branchId ? [form.branchId] : [],
            doc_id: form.docId || undefined,
            title: form.title,
            category: form.category,
            content: form.content,
            source,
            metadata,
        };

        setSaving(true);
        try {
            if (editingDocId !== null) {
                await server_put_data(kb_document_update_url(editingDocId), payload);
            } else {
                await server_post_json(kb_store_url, payload);
            }
            closeForm();
            await loadDocs();
        } catch (error) {
            console.error("Failed to save global knowledge document:", error);
            handleError("network");
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(docId: string) {
        if (!dealerId) return;
        try {
            await server_delete_data(kb_document_delete_url(docId), {}, { params: { dealer_id: dealerId } });
            await loadDocs();
        } catch (error) {
            console.error("Failed to delete global knowledge document:", error);
            handleError("network");
        }
    }

    return (
        <>
            <PageHeader
                title="Knowledge Base"
                description="Manage knowledge sources across the 4 collections and 7 segments — scope each one to a branch or make it global."
                actions={
                    <Button size="sm" onClick={openAdd}>
                        <Plus className="size-4" /> Add
                    </Button>
                }
            />

            <div className="p-4 md:p-6 lg:p-8 space-y-6">
                <Card>
                    <CardContent className="pt-6">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label>Filter by collection</Label>
                                <select
                                    className="w-full h-9 rounded-md border px-3 text-sm bg-background"
                                    value={filterModule}
                                    onChange={(event) => setFilterModule(event.target.value)}
                                >
                                    <option value="">All collections</option>
                                    {COLLECTION_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <Label>Filter by branch</Label>
                                <select
                                    className="w-full h-9 rounded-md border px-3 text-sm bg-background"
                                    value={filterBranch}
                                    onChange={(event) => setFilterBranch(event.target.value)}
                                >
                                    <option value="">All branches</option>
                                    <option value="global">Global (all branches)</option>
                                    {branches.map((branch) => (
                                        <option key={branch.id} value={branch.id}>
                                            {branch.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {showForm && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">
                                {editingDocId !== null ? "Edit knowledge source" : "Add knowledge source"}
                            </CardTitle>
                        </CardHeader>

                        <CardContent className="space-y-6">
                            <div className="space-y-1.5">
                                <Label>Document ID <span className="text-destructive">*</span></Label>
                                <Input
                                    value={form.docId}
                                    disabled={editingDocId !== null}
                                    placeholder="e.g. dealer_wide_price_list"
                                    onChange={(event) => fieldChange("docId", event.target.value)}
                                />
                                {errors.docId && <p className="text-xs text-destructive">{errors.docId}</p>}
                                {editingDocId === null && (
                                    <p className="text-xs text-muted-foreground">Leave empty to auto-generate</p>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <Label>Title <span className="text-destructive">*</span></Label>
                                <Input value={form.title} onChange={(event) => fieldChange("title", event.target.value)} />
                                {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label>Collection <span className="text-destructive">*</span></Label>
                                    <select
                                        className="w-full h-9 rounded-md border px-3 text-sm bg-background"
                                        value={form.module}
                                        onChange={(event) =>
                                            setForm((prev) => ({ ...prev, module: event.target.value }))
                                        }
                                    >
                                        {COLLECTION_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-muted-foreground">
                                        Which vector store this document is indexed into.
                                    </p>
                                </div>

                                <div className="space-y-1.5">
                                    <Label>Branch</Label>
                                    <select
                                        className="w-full h-9 rounded-md border px-3 text-sm bg-background"
                                        value={form.branchId ?? ""}
                                        onChange={(event) =>
                                            setForm((prev) => ({
                                                ...prev,
                                                branchId: event.target.value ? Number(event.target.value) : null,
                                            }))
                                        }
                                    >
                                        <option value="">Global (all branches)</option>
                                        {branches.map((branch) => (
                                            <option key={branch.id} value={branch.id}>
                                                {branch.name}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-muted-foreground">
                                        Leave as "Global" to apply this to every branch.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label>Segments</Label>
                                <div className="flex flex-wrap gap-2 rounded-md border border-dashed p-3">
                                    {segments.length === 0 ? (
                                        <p className="text-xs text-muted-foreground">
                                            Loading segments…
                                        </p>
                                    ) : (
                                        segments.map((segment) => {
                                            const active = form.segmentIds.includes(segment.id);
                                            return (
                                                <button
                                                    key={segment.id}
                                                    type="button"
                                                    onClick={() => toggleSegment(segment.id)}
                                                    className={
                                                        active
                                                            ? "rounded-full border border-primary bg-primary px-3 py-1 text-xs text-primary-foreground"
                                                            : "rounded-full border px-3 py-1 text-xs text-muted-foreground"
                                                    }
                                                >
                                                    {segment.name}
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Optional. Leave empty to inherit the collection's default segments — pick specific
                                    segments only when this document should apply more narrowly.
                                </p>
                            </div>

                            <div className="space-y-1.5">
                                <Label>Content <span className="text-destructive">*</span></Label>
                                <Textarea
                                    rows={5}
                                    value={form.content}
                                    placeholder="Enter service description in Hindi/English…"
                                    onChange={(event) => fieldChange("content", event.target.value)}
                                />
                                {errors.content && <p className="text-xs text-destructive">{errors.content}</p>}
                            </div>

                            <div className="h-px bg-border" />

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label>Category <span className="text-destructive">*</span></Label>
                                    <Input
                                        value={form.category}
                                        placeholder="e.g. free_service"
                                        onChange={(event) => fieldChange("category", event.target.value)}
                                    />
                                    {errors.category && <p className="text-xs text-destructive">{errors.category}</p>}
                                </div>

                                <div className="space-y-1.5">
                                    <Label>Source document</Label>
                                    <div className="flex items-center">
                                        <Input
                                            className="rounded-r-none"
                                            value={form.sourceDoc}
                                            placeholder="e.g. service_manual_2024"
                                            onChange={(event) => fieldChange("sourceDoc", event.target.value)}
                                        />
                                        <span className="flex h-9 items-center rounded-r-md border border-l-0 bg-secondary px-3 text-sm text-muted-foreground">
                                            .pdf
                                        </span>
                                    </div>
                                    {errors.sourceDoc && <p className="text-xs text-destructive">{errors.sourceDoc}</p>}
                                </div>
                            </div>

                            <div>
                                <div className="mb-3 flex items-center justify-between">
                                    <h4 className="text-xs font-semibold uppercase tracking-wide text-primary">
                                        Additional metadata
                                    </h4>
                                    <Button type="button" variant="outline" size="sm" onClick={addMetadataRow}>
                                        <Plus className="size-3.5" /> Add field
                                    </Button>
                                </div>

                                <div className="rounded-md border border-dashed p-4">
                                    {form.metadata.length === 0 ? (
                                        <p className="py-2 text-center text-xs text-muted-foreground">
                                            No fields added. Click "Add field" to add metadata.
                                        </p>
                                    ) : (
                                        <div className="space-y-3">
                                            {form.metadata.map((row, index) => (
                                                <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-start gap-2">
                                                    <div>
                                                        <Input
                                                            value={row.key}
                                                            placeholder="Field name"
                                                            onChange={(event) => updateMetadataRow(index, "key", event.target.value)}
                                                        />
                                                        {errors[`metadata_${index}_key`] && (
                                                            <p className="mt-1 text-xs text-destructive">
                                                                {errors[`metadata_${index}_key`]}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <Input
                                                        value={row.value}
                                                        placeholder="Value"
                                                        onChange={(event) => updateMetadataRow(index, "value", event.target.value)}
                                                    />
                                                    <Button
                                                        type="button" variant="outline" size="icon" className="text-destructive"
                                                        onClick={() => deleteMetadataRow(index)}
                                                    >
                                                        <Trash2 className="size-3.5" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={closeForm}>Cancel</Button>
                                <Button size="sm" onClick={handleSave} disabled={saving}>
                                    {saving ? "Saving..." : editingDocId !== null ? "Update" : "Add"}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <div className="grid gap-3 md:grid-cols-2">
                    {loading && (
                        <Card className="md:col-span-2">
                            <CardContent className="py-10 text-center text-sm text-muted-foreground">
                                Loading knowledge sources…
                            </CardContent>
                        </Card>
                    )}

                    {!loading && items.length === 0 && !showForm && (
                        <Card className="md:col-span-2">
                            <CardContent className="py-10 text-center text-sm text-muted-foreground">
                                No knowledge sources match this filter.
                            </CardContent>
                        </Card>
                    )}

                    {!loading &&
                        items.map((item: any) => {
                            const collectionLabel =
                                COLLECTION_OPTIONS.find((option) => option.value === item.module)?.label ?? item.module;
                            const branchLabel =
                                Array.isArray(item.branch_ids) && item.branch_ids.length
                                    ? branches.find((b) => b.id === item.branch_ids[0])?.name ?? "Unknown branch"
                                    : "Global (all branches)";
                            const segmentLabels: string[] = Array.isArray(item.segment_ids)
                                ? item.segment_ids
                                    .map((id: number) => segments.find((s) => s.id === id)?.name)
                                    .filter(Boolean)
                                : [];

                            return (
                                <Card key={item.doc_id}>
                                    <CardContent className="pt-6 space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-medium text-sm">{item.title}</span>
                                            <Badge variant="outline">{item.status}</Badge>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <Badge variant="secondary">{collectionLabel}</Badge>
                                            <Badge variant="secondary">{branchLabel}</Badge>
                                            {segmentLabels.map((label) => (
                                                <Badge key={label} variant="outline">{label}</Badge>
                                            ))}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {item.category} • {item.chunk_count} chunks
                                            {item.indexed_at && ` • indexed ${item.indexed_at}`}
                                        </div>
                                        <div className="flex gap-2 pt-2">
                                            <Button variant="outline" size="sm" onClick={() => openEdit(item)}>
                                                <Pencil className="size-3.5" /> Edit
                                            </Button>
                                            <Button variant="outline" size="sm" onClick={() => handleDelete(item.doc_id)}>
                                                <Trash2 className="size-3.5" /> Delete
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                </div>
            </div>
        </>
    );
}
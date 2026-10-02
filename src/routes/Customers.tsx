import { Link } from "react-router-dom";
import { useEffect, useState } from "react";

import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/data/StatusBadge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials, formatCurrency, formatRelative } from "@/lib/format";
import { Filter, Search, Download, Sparkles, Plus, Loader2, X } from "lucide-react";

import { get_customers, server_get_data } from "@/components/ServiceConnection/serviceconnection";

interface ApiCustomer {
  id: number;
  name: string;
  phone: string;
  branch: string;
  vehicle: { model: string; regNo: string };
  lifecycleStage: string;
  insurance: { status: string };
  amc: { status: string };
  totalSpend: number;
  lastInteractionAt: string | null;
}

interface BranchOption {
  id: number;
  name: string;
}

interface Filters {
  branch: string;
  // lifecycle: string;
  insurance: string;
  amc: string;
  lastCalled: string;
  // minSpend: string;
  dnd: string;
}

const EMPTY_FILTERS: Filters = {
  branch: "",
  // lifecycle: "",
  insurance: "",
  amc: "",
  lastCalled: "",
  // minSpend: "",
  dnd: "",
};

type Option = { value: string; label: string };

// const LIFECYCLE_OPTIONS: Option[] = [
//   { value: "enquiry", label: "Enquiry" },
//   { value: "qualified", label: "Qualified" },
//   { value: "purchased", label: "Purchased" },
//   { value: "free_service", label: "Free service" },
//   { value: "paid_service", label: "Paid service" },
//   { value: "insurance_due", label: "Insurance due" },
//   { value: "amc_due", label: "AMC due" },
//   { value: "loyal", label: "Loyal" },
// ];

const EXPIRY_OPTIONS: Option[] = [
  { value: "active", label: "Active" },
  { value: "due_soon", label: "Due in 30 days" },
  { value: "expired", label: "Expired" },
  { value: "none", label: "None" },
];

const LAST_CALLED_OPTIONS: Option[] = [
  { value: "today", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "never", label: "Never called" },
];

// const SPEND_OPTIONS: Option[] = [
//   { value: "5000", label: "₹5,000+" },
//   { value: "20000", label: "₹20,000+" },
//   { value: "50000", label: "₹50,000+" },
//   { value: "100000", label: "₹1,00,000+" },
// ];

const DND_OPTIONS: Option[] = [
  { value: "0", label: "Callable only" },
  { value: "1", label: "Do not call" },
];

const PAGE_SIZE = 30;

function FilterSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "Any",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1 min-w-40 flex-1">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function loadErrorMessage(err: any): string {
  if (err?.response?.status === 403) return "Your role does not have permission to view customers.";
  return err?.response?.data?.error ?? "Could not load customers. Please try again.";
}

export default function CustomersPage() {
  const [q, setQ] = useState("");

  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [branches, setBranches] = useState<BranchOption[]>([]);

  const setFilter = (key: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  // Debounce + page reset in the same tick -> one fetch per search, on page 1.
  const [debouncedQ, setDebouncedQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      const next = q.trim();
      if (next !== debouncedQ) {
        setDebouncedQ(next);
        setPage(1);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q, debouncedQ]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    server_get_data(get_customers, {
      q: debouncedQ || undefined,
      page,
      page_size: PAGE_SIZE,
      branch: filters.branch || undefined,
      insurance: filters.insurance || undefined,
      amc: filters.amc || undefined,
      last_called: filters.lastCalled || undefined,
      dnd: filters.dnd || undefined,
    })
      .then((res) => {
        if (cancelled) return;
        if (res?.success) {
          setCustomers(res.customers ?? []);
          setTotal(res.count ?? 0);
          if (res.branches) setBranches(res.branches);
        } else {
          setError(res?.error || "Could not load customers.");
        }
      })
      .catch((err) => {
        if (!cancelled) setError(loadErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page, debouncedQ, filters]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Chips for every active filter, so it's always clear why the list is short.
  const labelFor = (opts: Option[], v: string) => opts.find((o) => o.value === v)?.label ?? v;
  const activeChips: { key: keyof Filters; text: string }[] = [
    filters.branch && {
      key: "branch" as const,
      text: `Branch: ${branches.find((b) => String(b.id) === filters.branch)?.name ?? filters.branch}`,
    },
    // filters.lifecycle && {
    //   key: "lifecycle" as const,
    //   text: `Lifecycle: ${labelFor(LIFECYCLE_OPTIONS, filters.lifecycle)}`,
    // },
    filters.insurance && {
      key: "insurance" as const,
      text: `Insurance: ${labelFor(EXPIRY_OPTIONS, filters.insurance)}`,
    },
    filters.amc && { key: "amc" as const, text: `AMC: ${labelFor(EXPIRY_OPTIONS, filters.amc)}` },
    filters.lastCalled && {
      key: "lastCalled" as const,
      text: `Called: ${labelFor(LAST_CALLED_OPTIONS, filters.lastCalled)}`,
    },
    // filters.minSpend && {
    //   key: "minSpend" as const,
    //   text: `Spend: ${labelFor(SPEND_OPTIONS, filters.minSpend)}`,
    // },
    filters.dnd && { key: "dnd" as const, text: labelFor(DND_OPTIONS, filters.dnd) },
  ].filter(Boolean) as { key: keyof Filters; text: string }[];

  const activeCount = activeChips.length;

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  };

  return (
    <>
      <PageHeader
        title="Customer 360"
        description="Every customer imported from the monthly CRM list — vehicle, service, insurance, AMC, and AI interactions in one view."
      />

      <div className="p-4 md:p-6 lg:p-8 space-y-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {["All customers"].map((view, index) => (
            <button
              key={view}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${index === 0
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card hover:bg-accent"
                }`}
            >
              {view}
            </button>
          ))}
        </div>

        <Card>
          <CardHeader className="flex-row items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />

              <Input
                placeholder="Search name, phone, registration…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-8"
              />
            </div>

            <Button
              variant={showFilters || activeCount ? "secondary" : "outline"}
              size="sm"
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
            >
              <Filter className="size-4" />
              Filters
              {activeCount > 0 && (
                <span className="ml-1 rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                  {activeCount}
                </span>
              )}
            </Button>

            {showFilters && (
              <div className="basis-full grid gap-3 border-t pt-3 sm:grid-cols-2 lg:grid-cols-4">
                <FilterSelect
                  label="Branch"
                  value={filters.branch}
                  onChange={(v) => setFilter("branch", v)}
                  options={branches.map((b) => ({ value: String(b.id), label: b.name }))}
                  placeholder="All branches"
                />
                {/* <FilterSelect
                  label="Lifecycle"
                  value={filters.lifecycle}
                  onChange={(v) => setFilter("lifecycle", v)}
                  options={LIFECYCLE_OPTIONS}
                /> */}
                <FilterSelect
                  label="Insurance"
                  value={filters.insurance}
                  onChange={(v) => setFilter("insurance", v)}
                  options={EXPIRY_OPTIONS}
                />
                <FilterSelect
                  label="AMC"
                  value={filters.amc}
                  onChange={(v) => setFilter("amc", v)}
                  options={EXPIRY_OPTIONS}
                />
                <FilterSelect
                  label="Last called"
                  value={filters.lastCalled}
                  onChange={(v) => setFilter("lastCalled", v)}
                  options={LAST_CALLED_OPTIONS}
                />
                {/* <FilterSelect
                  label="Total spend"
                  value={filters.minSpend}
                  onChange={(v) => setFilter("minSpend", v)}
                  options={SPEND_OPTIONS}
                /> */}
                <FilterSelect
                  label="Call status"
                  value={filters.dnd}
                  onChange={(v) => setFilter("dnd", v)}
                  options={DND_OPTIONS}
                  placeholder="All"
                />
              </div>
            )}

            {activeCount > 0 && (
              <div className="basis-full flex flex-wrap items-center gap-1.5">
                {activeChips.map((chip) => (
                  <button
                    key={chip.key}
                    onClick={() => setFilter(chip.key, "")}
                    className="inline-flex items-center gap-1 rounded-full border bg-muted px-2.5 py-1 text-xs hover:bg-accent"
                  >
                    {chip.text}
                    <X className="size-3" />
                  </button>
                ))}
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={clearFilters}>
                  Clear all
                </Button>
              </div>
            )}
          </CardHeader>

          <CardContent className="p-0">
            {error && <div className="px-4 py-3 text-sm text-destructive border-b">{error}</div>}

            {loading && !customers.length && !error ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
                <Loader2 className="size-4 animate-spin" /> Loading customers…
              </div>
            ) : !loading && !customers.length && !error ? (
              <div className="flex flex-col items-center justify-center gap-1 py-16 text-center">
                <p className="text-sm font-medium">
                  {debouncedQ || activeCount
                    ? "No customers match these filters"
                    : "No customers yet"}
                </p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  {debouncedQ || activeCount
                    ? "Try a different search or loosen the filters."
                    : "Upload a call list under Data Import to bring customers in."}
                </p>
                {activeCount > 0 && (
                  <Button variant="outline" size="sm" className="mt-2" onClick={clearFilters}>
                    Clear filters
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Lifecycle</TableHead>
                      <TableHead>Insurance</TableHead>
                      <TableHead>AMC</TableHead>
                      <TableHead>Last interaction</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {customers.map((c) => (
                      <TableRow key={c.id} className="cursor-pointer">
                        <TableCell>
                          <Link
                            to={`/customers/${c.id}`}
                            className="flex items-center gap-2.5 group"
                          >
                            <Avatar className="size-8">
                              <AvatarFallback className="text-xs">
                                {initials(c.name ?? "")}
                              </AvatarFallback>
                            </Avatar>

                            <div className="min-w-0">
                              <div className="font-medium group-hover:text-primary truncate">
                                {c.name}
                              </div>

                              <div className="text-xs text-muted-foreground">
                                {c.phone} • {c.branch}
                              </div>
                            </div>
                          </Link>
                        </TableCell>

                        <TableCell>
                          <div className="text-sm">{c.vehicle?.model ?? "—"}</div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {c.vehicle?.regNo ?? "—"}
                          </div>
                        </TableCell>

                        <TableCell>
                          <span className="capitalize text-xs">
                            {(c.lifecycleStage ?? "").replace(/_/g, " ") || "—"}
                          </span>
                        </TableCell>

                        <TableCell>
                          <StatusBadge status={c.insurance?.status ?? "none"} />
                        </TableCell>

                        <TableCell>
                          <StatusBadge status={c.amc?.status ?? "none"} />
                        </TableCell>

                        <TableCell className="text-xs text-muted-foreground">
                          {c.lastInteractionAt ? formatRelative(c.lastInteractionAt) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {total > 0 && (
              <div className="border-t px-4 py-3 text-xs text-muted-foreground flex justify-between items-center">
                <span>
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of{" "}
                  {total.toLocaleString()} customers
                </span>

                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={page >= totalPages || loading}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
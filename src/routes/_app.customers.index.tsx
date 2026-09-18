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
import { Filter, Search, Download, Sparkles, Plus, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

import { get_customers, server_get_data } from "@/components/ServiceConnection/serviceconnection";

/* -------------------------------------------------------------------------- */
/* Types — mirrors views_admin._serialize_customer_row()                     */
/* -------------------------------------------------------------------------- */

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

const PAGE_SIZE = 30;

export default function CustomersPage() {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<number[]>([]);

  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce search: wait for typing to settle, then jump back to page 1
  // and fetch. Page changes (Previous/Next) fetch immediately.
  const [debouncedQ, setDebouncedQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    server_get_data(get_customers, { q: debouncedQ || undefined, page, page_size: PAGE_SIZE })
      .then((res) => {
        if (cancelled) return;
        if (res?.success) {
          setCustomers(res.customers ?? []);
          setTotal(res.count ?? 0);
        } else {
          setError(res?.error || "Could not load customers");
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || "Could not load customers");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page, debouncedQ]);

  const toggle = (id: number) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Customer 360"
        description="Every customer imported from the monthly CRM list — vehicle, service, insurance, AMC, and AI interactions in one view."
      // actions={
      //   <>
      //     <Button variant="outline" size="sm">
      //       <Download className="size-4" />
      //       Export
      //     </Button>

      //     <Button size="sm">
      //       <Plus className="size-4" />
      //       Add customer
      //     </Button>
      //   </>
      // }
      />

      <div className="p-4 md:p-6 lg:p-8 space-y-4">
        {/* Saved views */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            "All customers",
          ].map((view, index) => (
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

            <Button variant="outline" size="sm">
              <Filter className="size-4" />
              Filters
            </Button>

          </CardHeader>

          <CardContent className="p-0">
            {/* Bulk actions */}
            {selected.length > 0 && (
              <div className="flex items-center justify-between bg-primary/10 border-y px-4 py-2 text-sm">
                <span className="font-medium">{selected.length} selected</span>

                <div className="flex gap-2">
                  <Button size="sm" variant="ghost">
                    Add to campaign
                  </Button>

                  <Button size="sm" variant="ghost">
                    Tag
                  </Button>

                  <Button size="sm" variant="ghost">
                    Export
                  </Button>
                </div>
              </div>
            )}

            {error && (
              <div className="px-4 py-3 text-sm text-destructive border-b">{error}</div>
            )}

            {loading && !customers.length && !error ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
                <Loader2 className="size-4 animate-spin" /> Loading customers…
              </div>
            ) : !loading && !customers.length && !error ? (
              <div className="flex flex-col items-center justify-center gap-1 py-16 text-center">
                <p className="text-sm font-medium">No customers yet</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Upload a call list under Data Import to bring customers in.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8" />
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
                          <Checkbox
                            checked={selected.includes(c.id)}
                            onCheckedChange={() => toggle(c.id)}
                          />
                        </TableCell>

                        <TableCell>
                          <Link to={`/customers/${c.id}`} className="flex items-center gap-2.5 group">
                            <Avatar className="size-8">
                              <AvatarFallback className="text-xs">{initials(c.name)}</AvatarFallback>
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
                          <div className="text-sm">{c.vehicle.model}</div>

                          <div className="text-xs text-muted-foreground font-mono">
                            {c.vehicle.regNo}
                          </div>
                        </TableCell>

                        <TableCell>
                          <span className="capitalize text-xs">
                            {c.lifecycleStage.replace(/_/g, " ")}
                          </span>
                        </TableCell>

                        <TableCell>
                          <StatusBadge status={c.insurance.status} />
                        </TableCell>

                        <TableCell>
                          <StatusBadge status={c.amc.status} />
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

            {/* Pagination */}
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
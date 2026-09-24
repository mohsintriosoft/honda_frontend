import { useEffect, useState } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/data/StatusBadge";
import { MetricTile } from "@/components/data/KpiCard";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials, formatDate, formatNumber } from "@/lib/format";
import { Sparkles, Megaphone, Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  get_segment_detail,
  get_segment_customers,
  server_get_data,
} from "@/components/ServiceConnection/serviceconnection";
import { canAccessPath, hasPerm } from "@/lib/permissions";

interface ApiSegment {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  customers: number;
  due_today: number;
  conversion: number | null;
  active_campaign: string | null;
  campaign_id: number | null;
  campaign_status: "live" | "paused" | "draft" | null;
  opening_line: string | null;
  closing_line: string | null;
  call_start_time: string | null;
  call_end_time: string | null;
}

interface ApiSegmentCustomer {
  rowId?: number;
  id: number;
  name: string;
  phone: string;
  vehicle: { model: string; regNo: string };
  insurance: { status: string };
  amc: { status: string };
  lastServiceOn: string | null;
  dueDate: string | null;
}

const CUSTOMERS_PAGE_SIZE = 20;

export default function SegmentDetailPage() {
  const { id } = useParams();
  const canSeeCustomers = hasPerm("customers.view", "campaigns.edit");

  const [segment, setSegment] = useState<ApiSegment | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [matching, setMatching] = useState<ApiSegmentCustomer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [customersTotal, setCustomersTotal] = useState(0);

  // Page is remembered per segment id, so switching segments starts on
  // page 1 in the same render -- one fetch, not stale-page-then-page-1.
  const [pager, setPager] = useState<{ id: string | undefined; page: number }>({ id, page: 1 });
  const customersPage = pager.id === id ? pager.page : 1;
  const setCustomersPage = (page: number) => setPager({ id, page });

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setLoadError(null);

    server_get_data(get_segment_detail(id))
      .then((res) => {
        if (cancelled) return;
        if (!res?.success || !res?.segment) {
          setNotFound(true);
          return;
        }
        setSegment(res.segment);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err?.response?.status === 404) setNotFound(true);
        else if (err?.response?.status === 403)
          setLoadError("Your role does not have permission to view segments.");
        else setLoadError("Couldn't load this segment. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id || !canSeeCustomers) return;

    let cancelled = false;
    setCustomersLoading(true);
    server_get_data(get_segment_customers(id, customersPage, CUSTOMERS_PAGE_SIZE))
      .then((res) => {
        if (cancelled) return;
        setMatching(res?.success ? (res.customers ?? []) : []);
        setCustomersTotal(res?.success ? (res.count ?? 0) : 0);
      })
      .catch(() => {
        if (!cancelled) {
          setMatching([]);
          setCustomersTotal(0);
        }
      })
      .finally(() => {
        if (!cancelled) setCustomersLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, customersPage, canSeeCustomers]);

  if (notFound) {
    return <Navigate to="/segments" replace />;
  }

  if (loadError && !segment) {
    return (
      <>
        <PageHeader title="Segment" breadcrumbs={[{ label: "Segments", to: "/segments" }]} />
        <div className="p-8 text-center text-sm text-destructive">{loadError}</div>
      </>
    );
  }

  if (loading || !segment) {
    return (
      <>
        <PageHeader title="Segment" breadcrumbs={[{ label: "Segments", to: "/segments" }]} />
        <div className="p-4 md:p-6 lg:p-8">
          <div className="text-sm text-muted-foreground py-8 text-center">Loading segment…</div>
        </div>
      </>
    );
  }

  const totalPages = Math.max(1, Math.ceil(customersTotal / CUSTOMERS_PAGE_SIZE));

  return (
    <>
      <PageHeader
        title={segment.name}
        description={segment.description ?? undefined}
        breadcrumbs={[{ label: "Segments", to: "/segments" }, { label: segment.name }]}
        actions={
          segment.campaign_id != null && canAccessPath("/campaigns") ? (
            <Button size="sm" asChild>
              <Link to={`/campaigns/${segment.campaign_id}`}>
                <Megaphone className="size-4" />
                Launch campaign
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="p-4 md:p-6 lg:p-8 space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <MetricTile label="Total customers" value={formatNumber(segment.customers ?? 0)} />
          <MetricTile label="Due today" value={segment.due_today ?? 0} tone="info" />
          <MetricTile
            label="Conversion"
            value={segment.conversion != null ? `${segment.conversion}%` : "—"}
            tone="success"
          />
          <MetricTile label="Active campaign" value={segment.active_campaign ?? "—"} />
        </div>

        {canSeeCustomers && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-display">Customers in this segment</CardTitle>
          </CardHeader>

          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Insurance</TableHead>
                  <TableHead>AMC</TableHead>
                  <TableHead>Last service</TableHead>
                  <TableHead>Due</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {customersLoading && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-sm text-muted-foreground py-8"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" /> Loading customers…
                      </span>
                    </TableCell>
                  </TableRow>
                )}

                {!customersLoading &&
                  matching.map((c, index) => (
                    <TableRow key={c.rowId ?? `${c.id}-${index}`}>
                      <TableCell>
                        <Link
                          to={`/customers/${c.id}`}
                          className="flex items-center gap-2.5 hover:text-primary"
                        >
                          <Avatar className="size-8">
                            <AvatarFallback className="text-xs">
                              {initials(c.name ?? "")}
                            </AvatarFallback>
                          </Avatar>

                          <div>
                            <div className="font-medium text-sm">{c.name}</div>
                            <div className="text-xs text-muted-foreground">{c.phone}</div>
                          </div>
                        </Link>
                      </TableCell>

                      <TableCell className="text-sm">
                        {c.vehicle?.model ?? "—"}
                        <div className="text-xs text-muted-foreground font-mono">
                          {c.vehicle?.regNo ?? "—"}
                        </div>
                      </TableCell>

                      <TableCell>
                        <StatusBadge status={c.insurance?.status ?? "none"} />
                      </TableCell>

                      <TableCell>
                        <StatusBadge status={c.amc?.status ?? "none"} />
                      </TableCell>

                      <TableCell className="text-xs">
                        {c.lastServiceOn ? formatDate(c.lastServiceOn) : "—"}
                      </TableCell>

                      <TableCell className="text-xs">
                        {c.dueDate ? formatDate(c.dueDate) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}

                {!customersLoading && !matching.length && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-sm text-muted-foreground py-8"
                    >
                      No customers currently queued for this segment.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {customersTotal > 0 && (
              <div className="border-t px-4 py-3 text-xs text-muted-foreground flex justify-between items-center">
                <span>
                  Showing {(customersPage - 1) * CUSTOMERS_PAGE_SIZE + 1}–
                  {Math.min(customersPage * CUSTOMERS_PAGE_SIZE, customersTotal)} of{" "}
                  {customersTotal.toLocaleString()} customers
                </span>

                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={customersPage <= 1 || customersLoading}
                    onClick={() => setCustomersPage(Math.max(1, customersPage - 1))}
                  >
                    Previous
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={customersPage >= totalPages || customersLoading}
                    onClick={() => setCustomersPage(Math.min(totalPages, customersPage + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        )}
      </div>
    </>
  );
}
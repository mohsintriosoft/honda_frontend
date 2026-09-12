import { useEffect, useState } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { PageHeader } from "@/components/layout/AppShell";
import { customers as mockCustomers } from "@/mocks/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/data/StatusBadge";
import { MetricTile } from "@/components/data/KpiCard";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials, formatDate, formatNumber } from "@/lib/format";
import { Sparkles, Megaphone } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { get_segment_detail, server_get_data } from "@/components/ServiceConnection/serviceconnection";

/* -------------------------------------------------------------------------- */
/* Types — mirrors views_admin.segment_detail()/_serialize_segment           */
/* -------------------------------------------------------------------------- */

interface ApiSegment {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  customers: number;
  due_today: number;
  conversion: number | null;
  active_campaign: string | null;
  campaign_status: "live" | "paused" | "draft" | null;
}

export default function SegmentDetailPage() {
  const { id } = useParams();

  const [segment, setSegment] = useState<ApiSegment | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    setNotFound(false);

    server_get_data(get_segment_detail(id))
      .then((res) => {
        if (!res?.success || !res?.segment) {
          setNotFound(true);
          return;
        }

        setSegment(res.segment);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (notFound) {
    return <Navigate to="/segments" replace />;
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

  // 🔥 No customers-by-segment endpoint on the backend yet (api/customers/
  // isn't wired up in urls.py) — fall back to the mock customer list,
  // filtered down to this segment via its slug so the table still only
  // shows customers who'd plausibly belong here.
  const matching = mockCustomers
    .filter((c) => c.segments.includes(segment.slug))
    .slice(0, 20);

  return (
    <>
      <PageHeader
        title={segment.name}
        description={segment.description ?? undefined}
        breadcrumbs={[
          {
            label: "Segments",
            to: "/segments",
          },
          {
            label: segment.name,
          },
        ]}
        actions={
          <>
            <Button variant="outline" size="sm">
              <Sparkles className="size-4 text-[color:var(--ai)]" />
              Predict best time
            </Button>

            <Button size="sm" asChild>
              <Link to="/campaigns/new">
                <Megaphone className="size-4" />
                Launch campaign
              </Link>
            </Button>
          </>
        }
      />

      <div className="p-4 md:p-6 lg:p-8 space-y-4">
        {/* Metrics */}
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

        {/* Customers */}
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
                </TableRow>
              </TableHeader>

              <TableBody>
                {matching.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link
                        to={`/customers/${c.id}`}
                        className="flex items-center gap-2.5 hover:text-primary"
                      >
                        <Avatar className="size-8">
                          <AvatarFallback className="text-xs">{initials(c.name)}</AvatarFallback>
                        </Avatar>

                        <div>
                          <div className="font-medium text-sm">{c.name}</div>

                          <div className="text-xs text-muted-foreground">{c.phone}</div>
                        </div>
                      </Link>
                    </TableCell>

                    <TableCell className="text-sm">
                      {c.vehicle.model}

                      <div className="text-xs text-muted-foreground font-mono">
                        {c.vehicle.regNo}
                      </div>
                    </TableCell>

                    <TableCell>
                      <StatusBadge status={c.insurance.status} />
                    </TableCell>

                    <TableCell>
                      <StatusBadge status={c.amc.status} />
                    </TableCell>

                    <TableCell className="text-xs">
                      {c.vehicle.lastServiceOn ? formatDate(c.vehicle.lastServiceOn) : "—"}
                    </TableCell>
                  </TableRow>
                ))}

                {!matching.length && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                      No customers found for this segment.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
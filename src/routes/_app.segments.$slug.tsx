import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/AppShell";
import { segments, customers } from "@/mocks/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/data/StatusBadge";
import { MetricTile } from "@/components/data/KpiCard";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials, formatDate, formatNumber } from "@/lib/format";
import { Sparkles, Megaphone } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_app/segments/$slug")({
  loader: ({ params }) => {
    const segment = segments.find((s) => s.slug === params.slug);
    if (!segment) throw notFound();
    return { segment };
  },
  head: ({ params }) => ({ meta: [{ title: `${params.slug} — Segment — Triosoft` }] }),
  component: SegmentDetailPage,
});

function SegmentDetailPage() {
  const { segment } = Route.useLoaderData();
  const matching = customers.filter((c) => c.segments.includes(segment.slug)).slice(0, 20);

  return (
    <>
      <PageHeader
        title={segment.label}
        description={segment.description}
        breadcrumbs={[{ label: "Segments", to: "/segments" }, { label: segment.label }]}
        actions={
          <>
            <Button variant="outline" size="sm"><Sparkles className="size-4 text-[color:var(--ai)]" /> Predict best time</Button>
            <Button size="sm" asChild>
              <Link to="/campaigns/new"><Megaphone className="size-4" /> Launch campaign</Link>
            </Button>
          </>
        }
      />
      <div className="p-4 md:p-6 lg:p-8 space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <MetricTile label="Total customers" value={formatNumber(segment.customers)} />
          <MetricTile label="Due today" value={segment.dueToday} tone="info" />
          <MetricTile label="Conversion" value={`${segment.conversion}%`} tone="success" />
          <MetricTile label="Active campaign" value={segment.activeCampaign ?? "—"} />
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base font-display">Customers in this segment</CardTitle></CardHeader>
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
                      <Link to="/customers/$id" params={{ id: c.id }} className="flex items-center gap-2.5 hover:text-primary">
                        <Avatar className="size-8"><AvatarFallback className="text-xs">{initials(c.name)}</AvatarFallback></Avatar>
                        <div>
                          <div className="font-medium text-sm">{c.name}</div>
                          <div className="text-xs text-muted-foreground">{c.phone}</div>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{c.vehicle.model}<div className="text-xs text-muted-foreground font-mono">{c.vehicle.regNo}</div></TableCell>
                    <TableCell><StatusBadge status={c.insurance.status} /></TableCell>
                    <TableCell><StatusBadge status={c.amc.status} /></TableCell>
                    <TableCell className="text-xs">{c.vehicle.lastServiceOn ? formatDate(c.vehicle.lastServiceOn) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

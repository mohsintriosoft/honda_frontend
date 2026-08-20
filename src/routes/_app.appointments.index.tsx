import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/AppShell";
import { appointments } from "@/mocks/data";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/data/StatusBadge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { Plus, CalendarDays } from "lucide-react";
import { MetricTile } from "@/components/data/KpiCard";

export const Route = createFileRoute("/_app/appointments/")({
  head: () => ({ meta: [{ title: "Appointments — Triosoft" }] }),
  component: AppointmentsPage,
});

const HOURS = Array.from({ length: 10 }, (_, i) => 9 + i);
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function AppointmentsPage() {
  const upcoming = appointments.filter((a) => a.status === "upcoming").length;
  const completed = appointments.filter((a) => a.status === "completed").length;
  const missed = appointments.filter((a) => a.status === "missed").length;
  const cancelled = appointments.filter((a) => a.status === "cancelled").length;

  return (
    <>
      <PageHeader
        title="Appointments"
        description="Workshop bookings — auto-created by AI calls and WhatsApp confirmations."
        actions={<Button size="sm"><Plus className="size-4" /> Manual booking</Button>}
      />

      <div className="p-4 md:p-6 lg:p-8 space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <MetricTile label="Upcoming" value={upcoming} tone="info" />
          <MetricTile label="Completed" value={completed} tone="success" />
          <MetricTile label="Missed" value={missed} tone="destructive" />
          <MetricTile label="Cancelled" value={cancelled} />
        </div>

        <Tabs defaultValue="calendar">
          <TabsList>
            <TabsTrigger value="calendar"><CalendarDays className="size-4" /> Calendar</TabsTrigger>
            <TabsTrigger value="list">List</TabsTrigger>
          </TabsList>

          <TabsContent value="calendar" className="mt-4">
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <div className="grid grid-cols-[60px_repeat(6,1fr)] min-w-[800px]">
                  <div className="border-b border-r p-2" />
                  {DAYS.map((d) => (
                    <div key={d} className="border-b border-r p-2 text-xs font-medium text-center">{d}</div>
                  ))}
                  {HOURS.map((h) => (
                    <>
                      <div key={`h${h}`} className="border-r border-b p-2 text-xs text-muted-foreground text-right">{h}:00</div>
                      {DAYS.map((d) => {
                        const apts = appointments.filter((_, i) => i % HOURS.length === h - 9 && i % DAYS.length === DAYS.indexOf(d)).slice(0, 1);
                        return (
                          <div key={`${h}-${d}`} className="border-r border-b min-h-[60px] p-1 relative">
                            {apts.map((a) => (
                              <div key={a.id} className={`text-[10px] rounded p-1.5 leading-tight ${
                                a.status === "upcoming" ? "bg-primary/15 border-l-2 border-primary text-primary" :
                                a.status === "missed" ? "bg-destructive/15 border-l-2 border-destructive text-destructive" :
                                "bg-muted border-l-2 border-border"
                              }`}>
                                <div className="font-medium truncate">{a.customerName}</div>
                                <div className="opacity-75 truncate">{a.type} • {a.bay}</div>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="list" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Advisor</TableHead>
                      <TableHead>Bay</TableHead>
                      <TableHead>When</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {appointments.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium text-sm">{a.customerName}</TableCell>
                        <TableCell className="text-xs">{a.vehicle}</TableCell>
                        <TableCell className="text-sm">{a.type}</TableCell>
                        <TableCell className="text-sm">{a.advisor}</TableCell>
                        <TableCell className="text-xs">{a.bay}</TableCell>
                        <TableCell className="text-xs">{formatDateTime(a.scheduledFor)}</TableCell>
                        <TableCell className="text-xs">{a.source}</TableCell>
                        <TableCell><StatusBadge status={a.status} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

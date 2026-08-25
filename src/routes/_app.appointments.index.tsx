import { PageHeader } from "@/components/layout/AppShell";
import { appointments } from "@/mocks/data";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/data/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { Plus, CalendarDays } from "lucide-react";
import { MetricTile } from "@/components/data/KpiCard";

const HOURS = Array.from({ length: 10 }, (_, i) => 9 + i);

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function AppointmentsPage() {
  const upcoming = appointments.filter((a) => a.status === "upcoming").length;

  const completed = appointments.filter((a) => a.status === "completed").length;

  const missed = appointments.filter((a) => a.status === "missed").length;

  const cancelled = appointments.filter((a) => a.status === "cancelled").length;

  return (
    <>
      <PageHeader
        title="Appointments"
        description="Workshop bookings — auto-created by AI calls and WhatsApp confirmations."
        actions={
          <Button size="sm">
            <Plus className="size-4" />
            Manual booking
          </Button>
        }
      />

      <div className="p-4 md:p-6 lg:p-8 space-y-4">
        {/* Metrics */}
        <div className="grid gap-3 md:grid-cols-4">
          <MetricTile label="Upcoming" value={upcoming} tone="info" />

          <MetricTile label="Completed" value={completed} tone="success" />

          <MetricTile label="Missed" value={missed} tone="destructive" />

          <MetricTile label="Cancelled" value={cancelled} />
        </div>

        <Tabs defaultValue="calendar">
          <TabsList>
            <TabsTrigger value="calendar" className="gap-2">
              <CalendarDays className="size-4" />
              Calendar
            </TabsTrigger>

            <TabsTrigger value="list">List</TabsTrigger>
          </TabsList>

          {/* Calendar */}
          <TabsContent value="calendar" className="mt-4">
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <div className="grid grid-cols-[60px_repeat(6,1fr)] min-w-[800px]">
                  <div className="border-b border-r p-2" />

                  {DAYS.map((day) => (
                    <div
                      key={day}
                      className="border-b border-r p-2 text-xs font-medium text-center"
                    >
                      {day}
                    </div>
                  ))}

                  {HOURS.map((hour) => (
                    <div key={`hour-${hour}`} className="contents">
                      <div className="border-r border-b p-2 text-xs text-muted-foreground text-right">
                        {hour}:00
                      </div>

                      {DAYS.map((day) => {
                        const dayIndex = DAYS.indexOf(day);

                        const appointmentsForSlot = appointments
                          .filter(
                            (_, index) =>
                              index % HOURS.length === hour - 9 && index % DAYS.length === dayIndex,
                          )
                          .slice(0, 1);

                        return (
                          <div
                            key={`${hour}-${day}`}
                            className="border-r border-b min-h-[60px] p-1 relative"
                          >
                            {appointmentsForSlot.map((appointment) => (
                              <div
                                key={appointment.id}
                                className={`text-[10px] rounded p-1.5 leading-tight ${
                                  appointment.status === "upcoming"
                                    ? "bg-primary/15 border-l-2 border-primary text-primary"
                                    : appointment.status === "missed"
                                      ? "bg-destructive/15 border-l-2 border-destructive text-destructive"
                                      : "bg-muted border-l-2 border-border"
                                }`}
                              >
                                <div className="font-medium truncate">
                                  {appointment.customerName}
                                </div>

                                <div className="opacity-75 truncate">
                                  {appointment.type} • {appointment.bay}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* List */}
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
                    {appointments.map((appointment) => (
                      <TableRow key={appointment.id}>
                        <TableCell className="font-medium text-sm">
                          {appointment.customerName}
                        </TableCell>

                        <TableCell className="text-xs">{appointment.vehicle}</TableCell>

                        <TableCell className="text-sm">{appointment.type}</TableCell>

                        <TableCell className="text-sm">{appointment.advisor}</TableCell>

                        <TableCell className="text-xs">{appointment.bay}</TableCell>

                        <TableCell className="text-xs">
                          {formatDateTime(appointment.scheduledFor)}
                        </TableCell>

                        <TableCell className="text-xs">{appointment.source}</TableCell>

                        <TableCell>
                          <StatusBadge status={appointment.status} />
                        </TableCell>
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

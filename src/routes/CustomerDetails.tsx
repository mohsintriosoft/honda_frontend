import { useEffect, useState } from "react";
import { Link, useParams, Navigate } from "react-router-dom";

import { PageHeader } from "@/components/layout/AppShell";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";

import { Button } from "@/components/ui/button";

import { StatusBadge } from "@/components/data/StatusBadge";

import { initials, formatCurrency, formatDate, formatDateTime, formatRelative } from "@/lib/format";

import {
  Phone,
  MessageSquare,
  Mail,
  Car,
  Wrench,
  Shield,
  FileCheck,
  Sparkles,
  PhoneCall,
  CalendarDays,
  ChevronRight,
  Plus,
  Loader2,
} from "lucide-react";

import {
  get_customer_detail,
  server_get_data,
} from "@/components/ServiceConnection/serviceconnection";
import { hasPerm } from "@/lib/permissions";

interface ApiVehicle {
  model: string;
  variant: string;
  regNo: string;
  purchasedOn: string | null;
  kms: number | null;
  lastServiceOn: string | null;
}

interface ApiCall {
  id: number;
  intent: string;
  disposition: string;
  summary: string;
  startedAt: string | null;
  durationSec: number | null;
}

interface ApiAppointment {
  id: number;
  type: string;
  advisor: string;
  bay: string;
  status: string;
  scheduledFor: string | null;
}

interface ApiServiceRecord {
  id: number;
  serviceType: string;
  serviceDate: string | null;
  amount: number;
  kmReading: number | null;
  remarks: string;
}

interface ApiCustomerDetail {
  id: number;
  name: string;
  phone: string;
  email: string;
  branch: string;
  satisfaction: number | null;
  lifecycleStage: string;
  totalSpend: number;
  vehicle: ApiVehicle | null;
  insurance: { provider: string; status: string };
  amc: { plan: string; status: string };
  calls: ApiCall[];
  appointments: ApiAppointment[];
  serviceRecords: ApiServiceRecord[];
}

function formatCallDuration(sec: number | null | undefined) {
  if (sec == null || sec <= 0) return "—";
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [customer, setCustomer] = useState<ApiCustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setLoadError(null);

    server_get_data(get_customer_detail(id))
      .then((res) => {
        if (cancelled) return;
        if (!res?.success || !res?.customer) {
          setNotFound(true);
          return;
        }
        setCustomer(res.customer);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err?.response?.status === 404) setNotFound(true);
        else if (err?.response?.status === 403)
          setLoadError("You don't have permission to view this customer.");
        else setLoadError("Couldn't load this customer. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  if (notFound) {
    return <Navigate to="/customers" replace />;
  }

  if (loadError && !customer) {
    return (
      <>
        <PageHeader title="Customer" breadcrumbs={[{ label: "Customer 360", to: "/customers" }]} />
        <div className="p-8 text-center space-y-3">
          <p className="text-sm text-destructive">{loadError}</p>
          <Button variant="outline" size="sm" onClick={() => setReloadKey((k) => k + 1)}>
            Retry
          </Button>
        </div>
      </>
    );
  }

  if (loading || !customer) {
    return (
      <>
        <PageHeader title="Customer" breadcrumbs={[{ label: "Customer 360", to: "/customers" }]} />
        <div className="p-4 md:p-6 lg:p-8 flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading customer…
        </div>
      </>
    );
  }

  const c = customer;
  const calls = c.calls ?? [];
  const appointments = c.appointments ?? [];
  const serviceRecords = c.serviceRecords ?? [];

  type TimelineEvent = {
    key: string;
    at: string;
    icon: React.ReactNode;
    title: string;
    body: string;
    tag?: string;
  };

  const timeline: TimelineEvent[] = [
    ...calls
      .filter((call) => call.startedAt)
      .map((call) => ({
        key: `call-${call.id}`,
        at: call.startedAt as string,
        icon: <PhoneCall className="size-3.5" />,
        title: `AI Call — ${call.intent}`,
        body: call.summary || "No summary recorded.",
        tag: call.disposition,
      })),
    ...appointments
      .filter((a) => a.scheduledFor)
      .map((a) => ({
        key: `appt-${a.id}`,
        at: a.scheduledFor as string,
        icon: <CalendarDays className="size-3.5" />,
        title: `Appointment — ${a.type}`,
        body: `${a.advisor} • ${a.bay}`,
        tag: a.status,
      })),
    ...serviceRecords
      .filter((r) => r.serviceDate)
      .map((r) => ({
        key: `svc-${r.id}`,
        at: r.serviceDate as string,
        icon: <Wrench className="size-3.5" />,
        title: `Service completed — ${r.serviceType}`,
        body: `${formatCurrency(r.amount)}${r.remarks ? ` • ${r.remarks}` : ""}`,
      })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 8);

  return (
    <>
      {/* <PageHeader
        title={c.name}
        breadcrumbs={[{ label: "Customer 360", to: "/customers" }, { label: c.name }]}
        actions={
          <>
            {hasPerm("calls.place") && (
              <Button variant="outline" size="sm">
                <Phone className="size-4" />
                Call
              </Button>
            )}

            <Button variant="outline" size="sm">
              <MessageSquare className="size-4" />
              WhatsApp
            </Button>
          </>
        }
      /> */}

      <div className="p-4 md:p-6 lg:p-8 grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Identity rail */}
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <Avatar className="size-16">
                  <AvatarFallback className="text-lg">{initials(c.name ?? "")}</AvatarFallback>
                </Avatar>

                <div className="mt-3 font-display font-semibold text-lg">{c.name}</div>

                <div className="text-xs text-muted-foreground">{c.branch}</div>

                <div className="mt-2 flex items-center gap-1.5 text-xs">
                  {c.satisfaction != null && (
                    <span className="rounded-full bg-[color:var(--success)]/15 text-[color:var(--success)] px-2 py-0.5 font-medium">
                      CSAT {c.satisfaction}
                    </span>
                  )}

                  <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 font-medium capitalize">
                    {(c.lifecycleStage ?? "").replace(/_/g, " ")}
                  </span>
                </div>
              </div>

              <div className="mt-5 space-y-2.5 text-sm">
                <Row icon={<Phone className="size-3.5" />} label="Phone" value={c.phone} />

                {c.vehicle ? (
                  <>
                    <Row
                      icon={<Car className="size-3.5" />}
                      label="Vehicle"
                      value={`${c.vehicle.model}${c.vehicle.variant ? ` ${c.vehicle.variant}` : ""}`}
                    />
                    <Row
                      label="Reg No"
                      value={<span className="font-mono">{c.vehicle.regNo}</span>}
                    />
                    <Row
                      label="Purchased"
                      value={c.vehicle.purchasedOn ? formatDate(c.vehicle.purchasedOn) : "—"}
                    />
                    <Row
                      label="KM"
                      value={c.vehicle.kms != null ? c.vehicle.kms.toLocaleString() : "—"}
                    />
                  </>
                ) : (
                  <Row
                    icon={<Car className="size-3.5" />}
                    label="Vehicle"
                    value="No vehicle on file"
                  />
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-display">Status</CardTitle>
            </CardHeader>

            <CardContent className="space-y-3 text-sm">
              <StatusRow
                icon={<Wrench className="size-4" />}
                label="Last service"
                value={c.vehicle?.lastServiceOn ? formatDate(c.vehicle.lastServiceOn) : "—"}
              />

              <StatusRow
                icon={<Shield className="size-4" />}
                label="Insurance"
                value={c.insurance?.provider || "—"}
                extra={<StatusBadge status={c.insurance?.status ?? "none"} />}
              />

              <StatusRow
                icon={<FileCheck className="size-4" />}
                label="AMC"
                value={c.amc?.plan || "—"}
                extra={<StatusBadge status={c.amc?.status ?? "none"} />}
              />
            </CardContent>
          </Card>
        </div>

        {/* Main content */}
        <div className="space-y-4 min-w-0">
          <Tabs defaultValue="timeline">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="calls">AI Calls</TabsTrigger>
              <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
              <TabsTrigger value="appointments">Appointments</TabsTrigger>
              <TabsTrigger value="service">Service History</TabsTrigger>
            </TabsList>

            <TabsContent value="timeline" className="mt-4">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  {timeline.length === 0 && (
                    <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
                  )}

                  {timeline.map((event) => (
                    <TimelineItem
                      key={event.key}
                      icon={event.icon}
                      when={formatRelative(event.at)}
                      title={event.title}
                      body={event.body}
                      tag={event.tag}
                    />
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="calls" className="mt-4 space-y-2">
              {calls.length === 0 && (
                <p className="text-sm text-muted-foreground">No AI calls yet.</p>
              )}

              {calls.map((call) => (
                <Card key={call.id}>
                  <CardContent className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <PhoneCall className="size-4 text-muted-foreground" />
                        <div className="font-medium text-sm">{call.intent}</div>
                        <StatusBadge status={call.disposition} />
                      </div>

                      <div className="mt-1 text-xs text-muted-foreground truncate">
                        {call.summary || "No summary recorded."}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs text-muted-foreground">
                        {call.startedAt ? formatDateTime(call.startedAt) : "—"}
                      </div>
                      <div className="text-xs">{formatCallDuration(call.durationSec)}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="whatsapp" className="mt-4 space-y-2">
              <Card>
                <CardContent className="pt-6 text-sm text-muted-foreground">
                  WhatsApp isn't wired up to a backend table yet — nothing to show here.
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="appointments" className="mt-4 space-y-2">
              {appointments.length === 0 && (
                <p className="text-sm text-muted-foreground">No appointments yet.</p>
              )}

              {appointments.map((appointment) => (
                <Card key={appointment.id}>
                  <CardContent className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{appointment.type}</div>
                      <div className="text-xs text-muted-foreground">
                        {appointment.advisor} • {appointment.bay}
                      </div>
                    </div>

                    <div className="text-right">
                      <StatusBadge status={appointment.status} />
                      <div className="text-xs text-muted-foreground mt-1">
                        {appointment.scheduledFor ? formatDateTime(appointment.scheduledFor) : "—"}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="service" className="mt-4 space-y-2">
              {serviceRecords.length === 0 && (
                <Card>
                  <CardContent className="pt-6 text-sm text-muted-foreground">
                    No service history on file for this vehicle yet.
                  </CardContent>
                </Card>
              )}

              {serviceRecords.map((record) => (
                <Card key={record.id}>
                  <CardContent className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{record.serviceType}</div>
                      <div className="text-xs text-muted-foreground">
                        {record.remarks || "No remarks"}
                        {record.kmReading != null
                          ? ` • ${record.kmReading.toLocaleString()} km`
                          : ""}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-medium">{formatCurrency(record.amount)}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {record.serviceDate ? formatDate(record.serviceDate) : "—"}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
        {icon}
        {label}
      </span>
      <span className="text-sm text-right truncate">{value}</span>
    </div>
  );
}

function StatusRow({
  icon,
  label,
  value,
  extra,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="flex items-center gap-2">
        {value}
        {extra}
      </span>
    </div>
  );
}

function TimelineItem({
  icon,
  when,
  title,
  body,
  tag,
}: {
  icon: React.ReactNode;
  when: string;
  title: string;
  body: string;
  tag?: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="size-7 rounded-full bg-primary/10 text-primary grid place-items-center">
          {icon}
        </div>
        <div className="flex-1 w-px bg-border mt-1" />
      </div>

      <div className="flex-1 pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="font-medium text-sm">{title}</div>
          {tag && <StatusBadge status={tag} />}
        </div>
        <div className="text-xs text-muted-foreground">{body}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">{when}</div>
      </div>
    </div>
  );
}

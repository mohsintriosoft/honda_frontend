import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/AppShell";
import { customers, calls, appointments, waThreads } from "@/mocks/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/data/StatusBadge";
import { initials, formatCurrency, formatDate, formatDateTime, formatRelative } from "@/lib/format";
import {
  Phone, MessageSquare, Mail, Car, Wrench, Shield, FileCheck,
  Sparkles, PhoneCall, CalendarDays, Megaphone, ChevronRight, Plus,
} from "lucide-react";

export const Route = createFileRoute("/_app/customers/$id")({
  head: ({ params }) => ({ meta: [{ title: `Customer ${params.id} — Triosoft` }] }),
  component: CustomerDetailPage,
});

const STAGES = ["enquiry","qualified","purchased","free_service","paid_service","insurance_due","amc_due","loyal"] as const;

function CustomerDetailPage() {
  const { id } = Route.useParams();
  const c = customers.find((x) => x.id === id);
  if (!c) throw notFound();
  const stageIdx = Math.max(0, STAGES.indexOf(c.lifecycleStage as typeof STAGES[number]));


  const cCalls = calls.filter((x) => x.customerId === c.id).slice(0, 4);
  const cAppts = appointments.filter((x) => x.customerId === c.id).slice(0, 4);
  const cWA = waThreads.filter((x) => x.customerId === c.id).slice(0, 4);

  return (
    <>
      <PageHeader
        title={c.name}
        breadcrumbs={[{ label: "Customer 360", to: "/customers" }, { label: c.name }]}
        actions={
          <>
            <Button variant="outline" size="sm"><Phone className="size-4" /> Call</Button>
            <Button variant="outline" size="sm"><MessageSquare className="size-4" /> WhatsApp</Button>
            <Button size="sm"><Sparkles className="size-4" /> Add to campaign</Button>
          </>
        }
      />

      <div className="p-4 md:p-6 lg:p-8 grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Identity rail */}
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <Avatar className="size-16">
                  <AvatarFallback className="text-lg">{initials(c.name)}</AvatarFallback>
                </Avatar>
                <div className="mt-3 font-display font-semibold text-lg">{c.name}</div>
                <div className="text-xs text-muted-foreground">{c.branch} • Bhopal</div>
                <div className="mt-2 flex items-center gap-1.5 text-xs">
                  <span className="rounded-full bg-[color:var(--success)]/15 text-[color:var(--success)] px-2 py-0.5 font-medium">CSAT {c.satisfaction}</span>
                  <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 font-medium capitalize">{c.lifecycleStage.replace(/_/g," ")}</span>
                </div>
              </div>

              <div className="mt-5 space-y-2.5 text-sm">
                <Row icon={<Phone className="size-3.5" />} label="Phone" value={c.phone} />
                <Row icon={<Mail className="size-3.5" />} label="Email" value={c.email} />
                <Row icon={<Car className="size-3.5" />} label="Vehicle" value={`${c.vehicle.model} ${c.vehicle.variant}`} />
                <Row label="Reg No" value={<span className="font-mono">{c.vehicle.regNo}</span>} />
                <Row label="Purchased" value={formatDate(c.vehicle.purchasedOn)} />
                <Row label="KM" value={c.vehicle.kms.toLocaleString()} />
                <Row label="Total spend" value={<span className="font-semibold">{formatCurrency(c.totalSpend)}</span>} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm font-display">Status</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <StatusRow icon={<Wrench className="size-4" />} label="Last service" value={c.vehicle.lastServiceOn ? formatDate(c.vehicle.lastServiceOn) : "—"} />
              <StatusRow icon={<Shield className="size-4" />} label="Insurance" value={`${c.insurance.provider}`} extra={<StatusBadge status={c.insurance.status} />} />
              <StatusRow icon={<FileCheck className="size-4" />} label="AMC" value={`${c.amc.plan}`} extra={<StatusBadge status={c.amc.status} />} />
            </CardContent>
          </Card>
        </div>

        {/* Main */}
        <div className="space-y-4 min-w-0">
          {/* Lifecycle stepper */}
          <Card>
            <CardContent className="py-4">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Lifecycle stage</div>
              <div className="flex items-center gap-1 overflow-x-auto">
                {STAGES.map((s, i) => (
                  <div key={s} className="flex items-center gap-1 shrink-0">
                    <div className={`rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${
                      i <= stageIdx ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}>{s.replace(/_/g," ")}</div>
                    {i < STAGES.length - 1 && <ChevronRight className="size-3 text-muted-foreground" />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="timeline">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="calls">AI Calls</TabsTrigger>
              <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
              <TabsTrigger value="appointments">Appointments</TabsTrigger>
              <TabsTrigger value="service">Service History</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>

            <TabsContent value="timeline" className="mt-4">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <TimelineItem icon={<PhoneCall className="size-3.5" />} when="2h ago"
                    title="AI Call — Service reminder" body="Customer interested. Booked Saturday 10:00 AM slot. AI confidence 91%." tag="booked" />
                  <TimelineItem icon={<MessageSquare className="size-3.5" />} when="2h ago"
                    title="WhatsApp confirmation sent" body="Template: free_service_reminder_v3" tag="delivered" />
                  <TimelineItem icon={<CalendarDays className="size-3.5" />} when="1d ago"
                    title="Appointment auto-booked" body="Bay 3 with Anil Khanna • Free Service" tag="upcoming" />
                  <TimelineItem icon={<Megaphone className="size-3.5" />} when="3d ago"
                    title="Added to campaign" body="Free Service Nudge — Nov" />
                  <TimelineItem icon={<Wrench className="size-3.5" />} when="90d ago"
                    title="Service completed" body="2nd Free Service • ₹0 • Bay 5" />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="calls" className="mt-4 space-y-2">
              {cCalls.length === 0 && <p className="text-sm text-muted-foreground">No AI calls yet.</p>}
              {cCalls.map((call) => (
                <Card key={call.id}>
                  <CardContent className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <PhoneCall className="size-4 text-muted-foreground" />
                        <div className="font-medium text-sm">{call.intent}</div>
                        <StatusBadge status={call.disposition} />
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground truncate">{call.summary}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-muted-foreground">{formatDateTime(call.startedAt)}</div>
                      <div className="text-xs">{Math.floor(call.durationSec/60)}m {call.durationSec%60}s</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="whatsapp" className="mt-4 space-y-2">
              {cWA.length === 0 && <p className="text-sm text-muted-foreground">No WhatsApp threads yet.</p>}
              {cWA.map((w) => (
                <Card key={w.id}>
                  <CardContent className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm truncate">{w.lastMessage}</div>
                      <div className="text-xs text-muted-foreground capitalize">{w.channel}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <StatusBadge status={w.status} />
                      <div className="text-xs text-muted-foreground mt-1">{formatRelative(w.lastAt)}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="appointments" className="mt-4 space-y-2">
              {cAppts.length === 0 && <p className="text-sm text-muted-foreground">No appointments yet.</p>}
              {cAppts.map((a) => (
                <Card key={a.id}>
                  <CardContent className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{a.type}</div>
                      <div className="text-xs text-muted-foreground">{a.advisor} • {a.bay}</div>
                    </div>
                    <div className="text-right">
                      <StatusBadge status={a.status} />
                      <div className="text-xs text-muted-foreground mt-1">{formatDateTime(a.scheduledFor)}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="service" className="mt-4">
              <Card>
                <CardContent className="pt-6 text-sm text-muted-foreground">
                  Synced from DMS — full service & job-card history will appear here in Phase 2.
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notes" className="mt-4">
              <Card>
                <CardContent className="pt-6">
                  <Button size="sm" variant="outline"><Plus className="size-4" /> Add note</Button>
                  <p className="mt-3 text-sm text-muted-foreground">No notes yet.</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
}

function Row({ icon, label, value }: { icon?: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-1.5 text-muted-foreground text-xs">{icon}{label}</span>
      <span className="text-sm text-right truncate">{value}</span>
    </div>
  );
}
function StatusRow({ icon, label, value, extra }: { icon: React.ReactNode; label: string; value: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-muted-foreground">{icon}{label}</span>
      <span className="flex items-center gap-2">{value}{extra}</span>
    </div>
  );
}
function TimelineItem({ icon, when, title, body, tag }: { icon: React.ReactNode; when: string; title: string; body: string; tag?: string }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="size-7 rounded-full bg-primary/10 text-primary grid place-items-center">{icon}</div>
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

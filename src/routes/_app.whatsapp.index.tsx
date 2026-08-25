import { PageHeader } from "@/components/layout/AppShell";
import { waThreads, customers } from "@/mocks/data";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/data/StatusBadge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatRelative, initials } from "@/lib/format";
import { useState } from "react";
import { Send, Paperclip, Smile, Search } from "lucide-react";

export default function WhatsAppPage() {
  const [active, setActive] = useState(waThreads[0]?.id);

  const activeThread = waThreads.find((t) => t.id === active);

  const activeCustomer = activeThread
    ? customers.find((c) => c.id === activeThread.customerId)
    : undefined;

  return (
    <>
      <PageHeader
        title="WhatsApp Automation"
        description="Two-way conversations powered by templates, AI replies, and human takeover."
      />

      <div className="p-4 md:p-6 lg:p-8">
        <Tabs defaultValue="inbox">
          <TabsList>
            <TabsTrigger value="inbox">Inbox</TabsTrigger>

            <TabsTrigger value="templates">Templates</TabsTrigger>

            <TabsTrigger value="broadcasts">Broadcasts</TabsTrigger>

            <TabsTrigger value="reports">Delivery</TabsTrigger>
          </TabsList>

          <TabsContent value="inbox" className="mt-4">
            <Card className="overflow-hidden">
              <div className="grid lg:grid-cols-[300px_1fr_280px] h-[70vh]">
                {/* Threads */}
                <aside className="border-r flex flex-col min-h-0">
                  <div className="p-2 border-b">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />

                      <Input placeholder="Search" className="pl-8 h-9" />
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    {waThreads.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setActive(t.id)}
                        className={`w-full text-left p-3 border-b hover:bg-accent ${
                          active === t.id ? "bg-accent" : ""
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Avatar className="size-9">
                            <AvatarFallback className="text-xs">
                              {initials(t.customerName)}
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium truncate">{t.customerName}</span>

                              <span className="text-[10px] text-muted-foreground shrink-0">
                                {formatRelative(t.lastAt)}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-xs text-muted-foreground truncate flex-1">
                                {t.lastMessage}
                              </span>

                              {t.unread > 0 && (
                                <span className="text-[10px] bg-primary text-primary-foreground rounded-full size-4 grid place-items-center">
                                  {t.unread}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </aside>

                {/* Conversation */}
                <section className="flex flex-col min-h-0">
                  <div className="border-b p-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">{activeThread?.customerName}</div>

                      <div className="text-xs text-muted-foreground">
                        Online • Honda Activa 6G • Bhopal
                      </div>
                    </div>

                    <StatusBadge status={activeThread?.status ?? "open"} />
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/30">
                    <Bubble out>
                      Hi {activeThread?.customerName?.split(" ")[0]}, your Honda Activa 6G is due
                      for a free service. Would you like to book this Saturday?
                    </Bubble>

                    <Bubble>Yes, please book for Saturday morning.</Bubble>

                    <Bubble out>
                      Great! Saturday 10:00 AM with Anil Khanna at Bay 3. Pick-up needed?
                    </Bubble>

                    <Bubble>Yes please</Bubble>

                    <Bubble out>
                      Confirmed. We'll send a reminder a day before. Reply STOP to opt out.
                    </Bubble>
                  </div>

                  <div className="border-t p-2 flex items-center gap-1">
                    <Button variant="ghost" size="icon">
                      <Paperclip className="size-4" />
                    </Button>

                    <Button variant="ghost" size="icon">
                      <Smile className="size-4" />
                    </Button>

                    <Input placeholder="Type a reply…" className="flex-1" />

                    <Button size="icon">
                      <Send className="size-4" />
                    </Button>
                  </div>
                </section>

                {/* Context */}
                <aside className="border-l p-4 hidden lg:block overflow-y-auto">
                  <div className="text-xs font-medium text-muted-foreground uppercase">
                    Customer context
                  </div>

                  <div className="mt-3 space-y-2 text-sm">
                    {activeCustomer ? (
                      <>
                        <Row k="Vehicle" v={activeCustomer.vehicle.model} />

                        <Row k="Reg" v={activeCustomer.vehicle.regNo} />

                        <Row k="Branch" v={activeCustomer.branch} />

                        <Row k="Lifecycle" v={activeCustomer.lifecycleStage.replace(/_/g, " ")} />

                        <Row k="CSAT" v={`${activeCustomer.satisfaction}`} />
                      </>
                    ) : null}
                  </div>

                  <div className="mt-5 rounded-lg ai-gradient ai-border border p-3 text-xs">
                    <div className="font-medium">AI suggestion</div>

                    <p className="text-muted-foreground mt-1">
                      Send T-3h reminder template for Saturday's appointment.
                    </p>
                  </div>
                </aside>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="templates" className="mt-4 grid gap-3 md:grid-cols-3">
            {[
              "free_service_reminder_v3",
              "service_booking_confirmation",
              "insurance_renewal_v2",
              "amc_renewal_v1",
              "winback_offer_v2",
              "enquiry_followup_v1",
            ].map((t) => (
              <Card key={t}>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs">{t}</span>

                    <span className="text-[10px] rounded-full bg-[color:var(--success)]/15 text-[color:var(--success)] px-2 py-0.5">
                      Approved
                    </span>
                  </div>

                  <div className="rounded-md bg-[#dcf8c6] dark:bg-[#005c4b]/40 text-sm p-3 text-foreground">
                    Hi {"{{first_name}}"}, your {"{{vehicle_model}}"} is due for service. Reply YES
                    to book.
                  </div>

                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Marketing</span>
                    <span>Used 1,420 times</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="broadcasts" className="mt-4">
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Broadcast list — schedule bulk template sends to a segment.
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports" className="mt-4">
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Delivery report — Sent / Delivered / Read / Replied / Failed by template.
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

function Bubble({ children, out }: { children: React.ReactNode; out?: boolean }) {
  return (
    <div className={`flex ${out ? "justify-end" : ""}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
          out ? "bg-[#dcf8c6] text-foreground dark:bg-[#005c4b]/60" : "bg-card border"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground text-xs">{k}</span>

      <span className="text-xs capitalize">{v}</span>
    </div>
  );
}

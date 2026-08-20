import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { segments } from "@/mocks/data";
import { Check, ChevronRight, Megaphone, Mic, MessageSquare, FileText, Calendar, Sparkles } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_app/campaigns/new")({
  head: () => ({ meta: [{ title: "New campaign — Triosoft" }] }),
  component: NewCampaignWizard,
});

const STEPS = [
  { key: "segment", label: "Segment", icon: Megaphone },
  { key: "voice", label: "AI Voice", icon: Mic },
  { key: "whatsapp", label: "WhatsApp", icon: MessageSquare },
  { key: "script", label: "Script", icon: FileText },
  { key: "schedule", label: "Schedule", icon: Calendar },
  { key: "review", label: "Review", icon: Check },
] as const;

const VOICES = [
  { id: "aarohi", name: "Aarohi", language: "Hindi", tone: "Warm, conversational" },
  { id: "kabir", name: "Kabir", language: "English", tone: "Professional, crisp" },
  { id: "zara", name: "Zara", language: "Hinglish", tone: "Friendly, casual" },
];

function NewCampaignWizard() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    name: "Free Service Nudge — Dec",
    segment: "free-service",
    voice: "aarohi",
    template: "free_service_reminder_v3",
    script: "Hello {{first_name}}, this is Aarohi from Om Honda. Your {{vehicle_model}} is due for a free service. May I help you book a convenient slot this week?",
    sendWhatsApp: true,
    startDate: new Date().toISOString().slice(0, 10),
    startTime: "10:00",
  });
  const navigate = useNavigate();

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const prev = () => setStep((s) => Math.max(0, s - 1));

  return (
    <>
      <PageHeader
        title="Create campaign"
        breadcrumbs={[{ label: "Campaigns", to: "/campaigns" }, { label: "New" }]}
      />

      <div className="p-4 md:p-6 lg:p-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {/* Stepper */}
          <div className="flex items-center gap-1 overflow-x-auto bg-card border rounded-lg p-2">
            {STEPS.map((s, i) => (
              <button key={s.key} onClick={() => setStep(i)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm shrink-0 transition-colors ${
                  i === step ? "bg-primary text-primary-foreground" :
                  i < step ? "text-foreground hover:bg-accent" : "text-muted-foreground hover:bg-accent"
                }`}>
                <s.icon className="size-4" />
                {s.label}
                {i < STEPS.length - 1 && <ChevronRight className="size-3 opacity-50 ml-1" />}
              </button>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-display">{STEPS[step]!.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {step === 0 && (
                <>
                  <div>
                    <Label>Campaign name</Label>
                    <Input className="mt-1" value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} />
                  </div>
                  <div>
                    <Label>Target segment</Label>
                    <RadioGroup value={data.segment} onValueChange={(v) => setData({ ...data, segment: v })} className="mt-2 grid gap-2">
                      {segments.map((s) => (
                        <label key={s.slug} className={`flex items-center gap-3 border rounded-md p-3 cursor-pointer hover:bg-accent ${data.segment === s.slug ? "border-primary bg-accent" : ""}`}>
                          <RadioGroupItem value={s.slug} />
                          <div className="flex-1">
                            <div className="text-sm font-medium">{s.label}</div>
                            <div className="text-xs text-muted-foreground">{s.customers.toLocaleString()} customers • {s.conversion}% historical conversion</div>
                          </div>
                          {s.activeCampaign && <span className="text-[10px] text-[color:var(--warning-foreground)] bg-[color:var(--warning)]/20 px-2 py-0.5 rounded-full">Has active campaign</span>}
                        </label>
                      ))}
                    </RadioGroup>
                  </div>
                </>
              )}

              {step === 1 && (
                <div className="grid gap-3 md:grid-cols-3">
                  {VOICES.map((v) => (
                    <button key={v.id} onClick={() => setData({ ...data, voice: v.id })}
                      className={`text-left rounded-lg border p-4 hover:bg-accent ${data.voice === v.id ? "border-primary bg-accent" : ""}`}>
                      <div className="size-10 rounded-full ai-gradient ai-border border grid place-items-center mb-2">
                        <Mic className="size-5 text-[color:var(--ai)]" />
                      </div>
                      <div className="font-display font-semibold">{v.name}</div>
                      <div className="text-xs text-muted-foreground">{v.language}</div>
                      <div className="mt-1 text-xs">{v.tone}</div>
                      <Button size="sm" variant="ghost" className="mt-2 h-7 px-2 text-xs">▶ Preview</Button>
                    </button>
                  ))}
                </div>
              )}

              {step === 2 && (
                <>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <div className="text-sm font-medium">Send WhatsApp follow-up</div>
                      <div className="text-xs text-muted-foreground">A WhatsApp message is sent after the call ends.</div>
                    </div>
                    <Switch checked={data.sendWhatsApp} onCheckedChange={(c) => setData({ ...data, sendWhatsApp: c })} />
                  </div>
                  <div>
                    <Label>WhatsApp template</Label>
                    <RadioGroup value={data.template} onValueChange={(v) => setData({ ...data, template: v })} className="mt-2 grid gap-2">
                      {["free_service_reminder_v3", "service_booking_confirmation", "insurance_renewal_v2"].map((t) => (
                        <label key={t} className={`flex items-center gap-3 border rounded-md p-3 cursor-pointer hover:bg-accent ${data.template === t ? "border-primary bg-accent" : ""}`}>
                          <RadioGroupItem value={t} />
                          <div className="flex-1 font-mono text-xs">{t}</div>
                          <span className="text-[10px] rounded-full bg-[color:var(--success)]/15 text-[color:var(--success)] px-2 py-0.5">Approved</span>
                        </label>
                      ))}
                    </RadioGroup>
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <div>
                    <Label>AI script (variables: {"{{first_name}}, {{vehicle_model}}, {{advisor}}"})</Label>
                    <Textarea rows={8} className="mt-1 font-mono text-sm" value={data.script} onChange={(e) => setData({ ...data, script: e.target.value })} />
                  </div>
                  <div className="rounded-md ai-gradient ai-border border p-3">
                    <div className="text-xs font-medium flex items-center gap-1.5"><Sparkles className="size-3.5 text-[color:var(--ai)]" /> AI suggestion</div>
                    <p className="text-xs text-muted-foreground mt-1">Add a clear next step — historically scripts with a single explicit CTA convert 23% better.</p>
                  </div>
                </>
              )}

              {step === 4 && (
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label>Start date</Label>
                    <Input type="date" className="mt-1" value={data.startDate} onChange={(e) => setData({ ...data, startDate: e.target.value })} />
                  </div>
                  <div>
                    <Label>Start time</Label>
                    <Input type="time" className="mt-1" value={data.startTime} onChange={(e) => setData({ ...data, startTime: e.target.value })} />
                  </div>
                  <div className="md:col-span-2 rounded-md border p-3 text-sm">
                    <div className="font-medium">Calling window</div>
                    <div className="text-xs text-muted-foreground mt-1">Per workspace business hours: 9:00 AM – 7:00 PM, Mon–Sat.</div>
                  </div>
                </div>
              )}

              {step === 5 && (
                <div className="space-y-3">
                  <ReviewRow label="Campaign" value={data.name} />
                  <ReviewRow label="Segment" value={segments.find(s => s.slug === data.segment)?.label ?? data.segment} />
                  <ReviewRow label="Voice" value={VOICES.find(v => v.id === data.voice)?.name + " (" + VOICES.find(v => v.id === data.voice)?.language + ")"} />
                  <ReviewRow label="WhatsApp" value={data.sendWhatsApp ? data.template : "Disabled"} />
                  <ReviewRow label="Schedule" value={`${data.startDate} at ${data.startTime}`} />
                  <div className="rounded-md ai-gradient ai-border border p-3">
                    <div className="text-sm font-medium flex items-center gap-1.5"><Sparkles className="size-4 text-[color:var(--ai)]" /> AI forecast</div>
                    <p className="text-xs mt-1">Estimated 168 connected • 92 booked • ₹4.8L revenue (90% confidence).</p>
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-2 border-t">
                <Button variant="ghost" onClick={prev} disabled={step === 0}>Back</Button>
                {step < STEPS.length - 1 ? (
                  <Button onClick={next}>Continue <ChevronRight className="size-4" /></Button>
                ) : (
                  <Button onClick={() => navigate({ to: "/campaigns" })}>Launch campaign</Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-3">
          <Card>
            <CardHeader><CardTitle className="text-sm font-display">Campaign summary</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              <SummaryRow k="Name" v={data.name} />
              <SummaryRow k="Segment" v={segments.find(s => s.slug === data.segment)?.label} />
              <SummaryRow k="Audience" v={`${segments.find(s => s.slug === data.segment)?.customers.toLocaleString()} customers`} />
              <SummaryRow k="Voice" v={VOICES.find(v => v.id === data.voice)?.name} />
              <SummaryRow k="WhatsApp" v={data.sendWhatsApp ? "Enabled" : "Off"} />
              <SummaryRow k="Start" v={`${data.startDate} ${data.startTime}`} />
            </CardContent>
          </Card>
          <Card className="ai-gradient ai-border">
            <CardContent className="pt-4 text-sm">
              <div className="flex items-center gap-1.5 font-medium"><Sparkles className="size-4 text-[color:var(--ai)]" /> Predicted impact</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <Pred k="Connected" v="~62%" />
                <Pred k="Booked" v="~28%" />
                <Pred k="Revenue" v="~₹4.8L" />
                <Pred k="Escalations" v="~3%" />
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}

function ReviewRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between border-b pb-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
function SummaryRow({ k, v }: { k: string; v?: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground text-xs">{k}</span>
      <span className="text-right text-xs font-medium truncate">{v}</span>
    </div>
  );
}
function Pred({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-md bg-card border p-2">
      <div className="text-[10px] text-muted-foreground uppercase">{k}</div>
      <div className="font-semibold font-display">{v}</div>
    </div>
  );
}

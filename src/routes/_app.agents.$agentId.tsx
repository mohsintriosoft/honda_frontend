import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/AppShell";
import { getAgent, WORKFLOW_LABEL, TEST_UTTERANCES } from "@/mocks/agents";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Save, Sparkles } from "lucide-react";
import { formatNumber } from "@/lib/format";

export const Route = createFileRoute("/_app/agents/$agentId")({
  loader: ({ params }) => {
    const agent = getAgent(params.agentId);
    if (!agent) throw notFound();
    return { agent };
  },
  head: ({ loaderData }) => {
    const name = loaderData?.agent.name ?? "Agent";
    return {
      meta: [
        { title: `${name} — Agent Training — Triosoft` },
        { name: "description", content: `Configure persona, conversation flow, knowledge and guardrails for ${name}.` },
        { property: "og:title", content: `${name} — Agent Training` },
        { property: "og:description", content: `Fine-tune ${name} for Om Honda Bhopal calling workflows.` },
      ],
    };
  },
  component: AgentDetail,
});

function AgentDetail() {
  const { agent } = Route.useLoaderData();
  const [tone, setTone] = useState(agent.tone);
  const [pace, setPace] = useState(agent.pace);
  const [persistence, setPersistence] = useState(agent.persistence);
  const [testInput, setTestInput] = useState("");

  return (
    <>
      <PageHeader
        title={agent.name}
        description={agent.description}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/agents"><ArrowLeft className="size-4" /> Back</Link>
            </Button>
            <Button size="sm"><Save className="size-4" /> Save changes</Button>
          </div>
        }
      />

      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline">{WORKFLOW_LABEL[agent.workflow]}</Badge>
          <Badge variant="outline">{agent.status}</Badge>
          <Badge variant="outline">{agent.language}</Badge>
          <Badge variant="outline">{agent.version}</Badge>
          <span className="text-muted-foreground">Trained {agent.lastTrained}</span>
          <Link to="/agents/recordings" className="text-primary font-medium hover:underline">
            Trained from 612 call recordings →
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { l: "Calls", v: formatNumber(agent.metrics.calls) },
            { l: "Connect rate", v: `${agent.metrics.connectRate}%` },
            { l: "Intent accuracy", v: `${agent.metrics.intentAccuracy}%` },
            { l: "Booking rate", v: `${agent.metrics.bookingRate}%` },
          ].map((m) => (
            <Card key={m.l}>
              <CardContent className="pt-6">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{m.l}</div>
                <div className="text-xl font-semibold font-display tabular-nums">{m.v}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="persona">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="persona">Persona & Voice</TabsTrigger>
            <TabsTrigger value="flow">Conversation Flow</TabsTrigger>
            <TabsTrigger value="knowledge">Knowledge</TabsTrigger>
            <TabsTrigger value="objections">Objections</TabsTrigger>
            <TabsTrigger value="intents">Intents</TabsTrigger>
            <TabsTrigger value="guardrails">Guardrails</TabsTrigger>
            <TabsTrigger value="test">Test console</TabsTrigger>
          </TabsList>

          <TabsContent value="persona" className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Identity</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Persona name</Label>
                  <Input defaultValue={agent.persona} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Voice</Label>
                    <Input defaultValue={agent.voice} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Gender</Label>
                    <Input defaultValue={agent.gender} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Opening line</Label>
                  <Textarea rows={3} defaultValue={agent.openingLine} />
                </div>
                <div className="space-y-1.5">
                  <Label>System prompt</Label>
                  <Textarea rows={7} defaultValue={agent.systemPrompt} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Behaviour</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                {[
                  { l: "Tone (formal → friendly)", v: tone, set: setTone },
                  { l: "Pace (slow → fast)", v: pace, set: setPace },
                  { l: "Persistence", v: persistence, set: setPersistence },
                ].map((s) => (
                  <div key={s.l} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <Label>{s.l}</Label>
                      <span className="tabular-nums text-muted-foreground">{s.v}</span>
                    </div>
                    <Slider value={[s.v]} max={100} step={1} onValueChange={(v) => s.set(v[0])} />
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="space-y-1.5">
                    <Label>Max turns</Label>
                    <Input defaultValue={agent.maxTurns} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Call window</Label>
                    <Input defaultValue={agent.callWindow} />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label>Retry policy</Label>
                    <Input defaultValue={agent.retryPolicy} />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <div className="text-sm font-medium">Interruptible</div>
                    <div className="text-xs text-muted-foreground">Customer can barge in mid-sentence</div>
                  </div>
                  <Switch defaultChecked={agent.interruptible} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="flow" className="mt-4 space-y-3">
            <div className="text-sm text-muted-foreground">Goal: {agent.goal}</div>
            {agent.flow.map((step, i) => (
              <Card key={step.id}>
                <CardContent className="pt-6 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="size-6 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-semibold">{i + 1}</span>
                    <span className="font-medium">{step.label}</span>
                    <span className="text-xs text-muted-foreground">— {step.goal}</span>
                  </div>
                  <div className="rounded-md bg-secondary p-3 text-sm">{step.say}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {step.branches.map((b) => (
                      <span key={b.on} className="rounded-full border px-2 py-0.5 text-[11px]">
                        {b.on} → {b.next}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="knowledge" className="mt-4 grid gap-3 md:grid-cols-2">
            {agent.knowledge.map((k) => (
              <Card key={k.id}>
                <CardContent className="pt-6 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm">{k.title}</span>
                    <Badge variant="outline">{k.status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {k.type} • {k.chunks} chunks • updated {k.updatedAt}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="objections" className="mt-4 space-y-3">
            {agent.objections.map((o) => (
              <Card key={o.id}>
                <CardContent className="pt-6 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-medium text-sm">{o.trigger}</div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground tabular-nums">{o.frequency}% of calls</span>
                      <Switch defaultChecked={o.enabled} />
                    </div>
                  </div>
                  <div className="rounded-md bg-secondary p-3 text-sm">{o.response}</div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="intents" className="mt-4 grid gap-3 md:grid-cols-2">
            {agent.intents.map((it) => (
              <Card key={it.id}>
                <CardContent className="pt-6 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{it.intent}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">{it.accuracy}%</span>
                  </div>
                  <Progress value={it.accuracy} className="h-1.5" />
                  <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                    {it.utterances.map((u) => <li key={u}>{u}</li>)}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="guardrails" className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Guardrails</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {agent.guardrails.map((g) => (
                  <div key={g.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
                    <div>
                      <div className="text-sm font-medium">{g.label}</div>
                      <div className="text-xs text-muted-foreground">{g.detail}</div>
                    </div>
                    <Switch defaultChecked={g.enabled} />
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Escalation rules</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {agent.escalation.map((e) => (
                  <div key={e.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
                    <div>
                      <div className="text-sm font-medium">{e.when}</div>
                      <div className="text-xs text-muted-foreground">{e.action}</div>
                    </div>
                    <Switch defaultChecked={e.enabled} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="test" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Test console</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-md bg-secondary p-3 text-sm">{agent.openingLine}</div>
                <div className="flex flex-wrap gap-1.5">
                  {TEST_UTTERANCES[agent.workflow].map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setTestInput(u)}
                      className="rounded-full border px-2.5 py-1 text-xs hover:bg-secondary"
                    >
                      {u}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={testInput}
                    onChange={(e) => setTestInput(e.target.value)}
                    placeholder="Type a customer utterance…"
                  />
                  <Button size="sm"><Sparkles className="size-4" /> Run</Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Simulation runs against {agent.version} with the current persona settings.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

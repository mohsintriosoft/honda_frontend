import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { PageHeader } from "@/components/layout/AppShell";
import { agents, WORKFLOW_LABEL } from "@/mocks/agents";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Upload, FileText, Plus, Trash2, Rocket, MessageSquareQuote,
  Brain, Mic, CheckCircle2, Link2,
} from "lucide-react";

export const Route = createFileRoute("/_app/agents/training")({
  head: () => ({
    meta: [
      { title: "Training Data Studio — Triosoft" },
      { name: "description", content: "Upload documents, add Q&A pairs, intent utterances and objection handling, then push training data to your AI calling agents." },
      { property: "og:title", content: "Training Data Studio — Triosoft" },
      { property: "og:description", content: "Feed knowledge, intents, objections and call samples into your Om Honda AI voice agents." },
    ],
  }),
  component: TrainingStudio,
});

type Doc = { id: string; name: string; size: string; type: string; status: "queued" | "indexed" };
type Pair = { id: string; a: string; b: string };
type Intent = { id: string; name: string; utterances: string[] };

const uid = () => Math.random().toString(36).slice(2, 9);

const seedDocs: Doc[] = [
  { id: "d1", name: "Om-Honda-Service-Price-List-2026.pdf", size: "412 KB", type: "pricing", status: "indexed" },
  { id: "d2", name: "AMC-Plans-Terms.docx", size: "88 KB", type: "policy", status: "indexed" },
  { id: "d3", name: "Activa-6G-Monsoon-Offer.pdf", size: "156 KB", type: "offer", status: "queued" },
];

const seedFaqs: Pair[] = [
  { id: "f1", a: "Activa 6G ka paid service kitne ka padta hai?", b: "Paid service ₹649 se shuru hoti hai, isme labour aur basic checkup shamil hai. Parts alag se lagte hain." },
  { id: "f2", a: "Pickup and drop milta hai kya?", b: "Ji haan, Bhopal city limits mein free pickup and drop available hai, ek din pehle booking karni hoti hai." },
];

const seedObjections: Pair[] = [
  { id: "o1", a: "Abhi time nahi hai", b: "Koi baat nahi ji, main aapke liye weekend ka slot rakh doon? Sirf 90 minute lagte hain." },
  { id: "o2", a: "Bahar sasta ho jata hai", b: "Bahar se sasta lag sakta hai, par genuine parts aur warranty sirf authorised service par milti hai." },
];

const seedIntents: Intent[] = [
  { id: "i1", name: "book_service", utterances: ["service karwani hai", "scooty ki servicing karani hai", "slot mil jayega kal ka"] },
  { id: "i2", name: "price_enquiry", utterances: ["kitna kharcha aayega", "service ka rate kya hai"] },
];

function TrainingStudio() {
  const [agentId, setAgentId] = useState(agents[0]!.id);
  const [docs, setDocs] = useState<Doc[]>(seedDocs);
  const [faqs, setFaqs] = useState<Pair[]>(seedFaqs);
  const [objections, setObjections] = useState<Pair[]>(seedObjections);
  const [intents, setIntents] = useState<Intent[]>(seedIntents);
  const [samples, setSamples] = useState<string[]>([
    "Customer: madam abhi busy hoon — Agent: bilkul ji, main shaam ko call karun?",
  ]);

  const [faqDraft, setFaqDraft] = useState({ a: "", b: "" });
  const [objDraft, setObjDraft] = useState({ a: "", b: "" });
  const [intentDraft, setIntentDraft] = useState({ name: "", utterances: "" });
  const [sampleDraft, setSampleDraft] = useState("");
  const [urlDraft, setUrlDraft] = useState("");

  const [progress, setProgress] = useState(0);
  const [pushing, setPushing] = useState(false);
  const [pushedAt, setPushedAt] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const agent = agents.find((a) => a.id === agentId)!;
  const totalItems = docs.length + faqs.length + objections.length + intents.length + samples.length;

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next: Doc[] = Array.from(list).map((f) => ({
      id: uid(),
      name: f.name,
      size: `${Math.max(1, Math.round(f.size / 1024))} KB`,
      type: "document",
      status: "queued",
    }));
    setDocs((d) => [...next, ...d]);
  };

  const push = () => {
    setPushing(true);
    setProgress(0);
    const timer = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(timer);
          setPushing(false);
          setDocs((ds) => ds.map((d) => ({ ...d, status: "indexed" })));
          setPushedAt(new Date().toLocaleTimeString());
          return 100;
        }
        return p + 10;
      });
    }, 180);
  };

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "AI Agents", to: "/agents" }, { label: "Training data" }]}
        title="Training Data Studio"
        description="Add knowledge, Q&A, intents, objections and real call samples — then push them to the agent for retraining."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/agents"><ArrowLeft className="size-4" /> Agents</Link>
            </Button>
            <Button size="sm" onClick={push} disabled={pushing}>
              <Rocket className="size-4" /> {pushing ? "Pushing…" : "Push & retrain"}
            </Button>
          </div>
        }
      />

      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        {/* Target agent + status */}
        <Card>
          <CardContent className="pt-6 grid gap-4 md:grid-cols-[minmax(0,320px)_1fr] md:items-center">
            <div className="space-y-1.5">
              <Label>Target agent</Label>
              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} — {WORKFLOW_LABEL[a.workflow]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {agent.persona} • {agent.language} • {agent.version}
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {totalItems} items staged for {agent.name}
                </span>
                {pushedAt && (
                  <span className="inline-flex items-center gap-1 text-[color:var(--success)]">
                    <CheckCircle2 className="size-3.5" /> Retrained at {pushedAt}
                  </span>
                )}
              </div>
              <Progress value={pushing || progress === 100 ? progress : 0} className="h-2" />
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                <Badge variant="secondary">{docs.length} documents</Badge>
                <Badge variant="secondary">{faqs.length} Q&A</Badge>
                <Badge variant="secondary">{objections.length} objections</Badge>
                <Badge variant="secondary">{intents.length} intents</Badge>
                <Badge variant="secondary">{samples.length} call samples</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="docs">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="docs"><FileText className="size-4" /> Documents</TabsTrigger>
            <TabsTrigger value="faq"><MessageSquareQuote className="size-4" /> Q&A pairs</TabsTrigger>
            <TabsTrigger value="objections"><Brain className="size-4" /> Objections</TabsTrigger>
            <TabsTrigger value="intents"><Brain className="size-4" /> Intents</TabsTrigger>
            <TabsTrigger value="samples"><Mic className="size-4" /> Call samples</TabsTrigger>
          </TabsList>

          {/* Documents */}
          <TabsContent value="docs" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Upload knowledge files</CardTitle>
                <CardDescription>Price lists, AMC terms, insurance policies, offer sheets, call scripts (PDF, DOCX, CSV, TXT).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
                  onClick={() => fileRef.current?.click()}
                  className="rounded-xl border border-dashed p-8 text-center cursor-pointer hover:bg-accent/40 transition-colors"
                >
                  <Upload className="size-6 mx-auto text-muted-foreground" />
                  <div className="mt-2 text-sm font-medium">Drop files here or click to browse</div>
                  <div className="text-xs text-muted-foreground">Max 20 MB per file</div>
                  <input
                    ref={fileRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
                  />
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    placeholder="…or paste a web page URL to crawl (offers, policy page)"
                    value={urlDraft}
                    onChange={(e) => setUrlDraft(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (!urlDraft.trim()) return;
                      setDocs((d) => [{ id: uid(), name: urlDraft.trim(), size: "web", type: "url", status: "queued" }, ...d]);
                      setUrlDraft("");
                    }}
                  >
                    <Link2 className="size-4" /> Add URL
                  </Button>
                </div>

                <div className="divide-y rounded-lg border">
                  {docs.map((d) => (
                    <div key={d.id} className="flex items-center gap-3 p-3">
                      <FileText className="size-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm truncate">{d.name}</div>
                        <div className="text-xs text-muted-foreground">{d.size} • {d.type}</div>
                      </div>
                      <Badge variant={d.status === "indexed" ? "secondary" : "outline"}>{d.status}</Badge>
                      <Button variant="ghost" size="icon" onClick={() => setDocs((ds) => ds.filter((x) => x.id !== d.id))}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                  {docs.length === 0 && (
                    <div className="p-6 text-center text-sm text-muted-foreground">No files yet.</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Q&A */}
          <TabsContent value="faq" className="mt-4">
            <PairEditor
              title="Question & answer pairs"
              description="Exactly how the agent should answer common customer questions, in Bhopali Hindi."
              aLabel="Customer question"
              bLabel="Agent answer"
              draft={faqDraft}
              setDraft={setFaqDraft}
              items={faqs}
              setItems={setFaqs}
            />
          </TabsContent>

          {/* Objections */}
          <TabsContent value="objections" className="mt-4">
            <PairEditor
              title="Objection handling"
              description="Trigger phrases and the rebuttal the agent should use on call."
              aLabel="Objection trigger"
              bLabel="Agent rebuttal"
              draft={objDraft}
              setDraft={setObjDraft}
              items={objections}
              setItems={setObjections}
            />
          </TabsContent>

          {/* Intents */}
          <TabsContent value="intents" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Add intent</CardTitle>
                <CardDescription>Give the intent a name and one example utterance per line.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 md:grid-cols-[minmax(0,240px)_1fr]">
                  <div className="space-y-1.5">
                    <Label>Intent name</Label>
                    <Input
                      placeholder="book_service"
                      value={intentDraft.name}
                      onChange={(e) => setIntentDraft({ ...intentDraft, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Training utterances</Label>
                    <Textarea
                      rows={3}
                      placeholder={"service karwani hai\nkal ka slot mil jayega"}
                      value={intentDraft.utterances}
                      onChange={(e) => setIntentDraft({ ...intentDraft, utterances: e.target.value })}
                    />
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    const utts = intentDraft.utterances.split("\n").map((s) => s.trim()).filter(Boolean);
                    if (!intentDraft.name.trim() || utts.length === 0) return;
                    setIntents((i) => [{ id: uid(), name: intentDraft.name.trim(), utterances: utts }, ...i]);
                    setIntentDraft({ name: "", utterances: "" });
                  }}
                >
                  <Plus className="size-4" /> Add intent
                </Button>
              </CardContent>
            </Card>

            <div className="grid gap-3 md:grid-cols-2">
              {intents.map((i) => (
                <Card key={i.id}>
                  <CardContent className="pt-6 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm">{i.name}</span>
                      <Button variant="ghost" size="icon" onClick={() => setIntents((s) => s.filter((x) => x.id !== i.id))}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {i.utterances.map((u, idx) => (
                        <li key={idx} className="rounded bg-muted/50 px-2 py-1">“{u}”</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Call samples */}
          <TabsContent value="samples" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Real call samples</CardTitle>
                <CardDescription>Paste transcript snippets from good calls so the agent can copy the tone.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  rows={4}
                  placeholder="Customer: … / Agent: …"
                  value={sampleDraft}
                  onChange={(e) => setSampleDraft(e.target.value)}
                />
                <Button
                  size="sm"
                  onClick={() => {
                    if (!sampleDraft.trim()) return;
                    setSamples((s) => [sampleDraft.trim(), ...s]);
                    setSampleDraft("");
                  }}
                >
                  <Plus className="size-4" /> Add sample
                </Button>
                <div className="space-y-2">
                  {samples.map((s, idx) => (
                    <div key={idx} className="flex items-start gap-2 rounded-lg border p-3">
                      <p className="flex-1 text-sm whitespace-pre-wrap">{s}</p>
                      <Button variant="ghost" size="icon" onClick={() => setSamples((all) => all.filter((_, i) => i !== idx))}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

function PairEditor({
  title, description, aLabel, bLabel, draft, setDraft, items, setItems,
}: {
  title: string;
  description: string;
  aLabel: string;
  bLabel: string;
  draft: { a: string; b: string };
  setDraft: (d: { a: string; b: string }) => void;
  items: Pair[];
  setItems: (fn: (p: Pair[]) => Pair[]) => void;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{aLabel}</Label>
              <Textarea rows={2} value={draft.a} onChange={(e) => setDraft({ ...draft, a: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{bLabel}</Label>
              <Textarea rows={2} value={draft.b} onChange={(e) => setDraft({ ...draft, b: e.target.value })} />
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => {
              if (!draft.a.trim() || !draft.b.trim()) return;
              setItems((p) => [{ id: uid(), a: draft.a.trim(), b: draft.b.trim() }, ...p]);
              setDraft({ a: "", b: "" });
            }}
          >
            <Plus className="size-4" /> Add
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {items.map((it) => (
          <Card key={it.id}>
            <CardContent className="pt-6 flex items-start gap-3">
              <div className="flex-1 space-y-1">
                <div className="text-sm font-medium">“{it.a}”</div>
                <div className="text-sm text-muted-foreground">{it.b}</div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setItems((p) => p.filter((x) => x.id !== it.id))}>
                <Trash2 className="size-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

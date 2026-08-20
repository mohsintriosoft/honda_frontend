import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/AppShell";
import { calls } from "@/mocks/data";
import { getCallScript } from "@/mocks/transcripts";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/data/StatusBadge";
import { Button } from "@/components/ui/button";
import { Headphones, PhoneCall, Languages } from "lucide-react";
import { formatRelative } from "@/lib/format";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_app/voice/")({
  head: () => ({ meta: [{ title: "AI Voice — Triosoft" }] }),
  component: VoicePage,
});

function VoicePage() {
  const live = calls.filter((c) => c.status === "ringing");
  const completed = calls.filter((c) => c.status === "completed");

  return (
    <>
      <PageHeader
        title="AI Voice Calls"
        description="Live monitor, recordings, transcripts, and dispositions for every AI conversation."
      />

      <div className="p-4 md:p-6 lg:p-8">
        <Tabs defaultValue="live">
          <TabsList>
            <TabsTrigger value="live" className="gap-2">
              <span className="size-1.5 rounded-full bg-[color:var(--success)] animate-pulse" />
              Live ({live.length})
            </TabsTrigger>
            <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
            <TabsTrigger value="recordings">Recordings</TabsTrigger>
          </TabsList>

          <TabsContent value="live" className="mt-4 space-y-2">
            {live.length === 0 && <p className="text-sm text-muted-foreground">No live calls right now.</p>}
            {live.map((c) => {
              const script = getCallScript(c.id);
              const aiLine = script.lines.find((l) => l.who === "ai");
              const userLine = script.lines.find((l) => l.who === "user");
              return (
                <Card key={c.id}>
                  <CardContent className="py-3 space-y-3">
                    <div className="flex items-center gap-4">
                      <div className="size-10 rounded-full bg-[color:var(--success)]/15 grid place-items-center">
                        <PhoneCall className="size-5 text-[color:var(--success)] animate-pulse" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium flex items-center gap-2">
                          {c.customerName}
                          <span className="inline-flex items-center gap-1 text-[10px] rounded-full bg-secondary px-1.5 py-0.5 text-muted-foreground">
                            <Languages className="size-3" /> Bhopali Hindi
                          </span>
                          <span className="text-[10px] rounded-full bg-secondary px-1.5 py-0.5 text-muted-foreground">
                            {script.agent} • {script.gender === "male" ? "♂ Male" : "♀ Female"}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">{script.intent}</div>
                      </div>
                      <div className="hidden md:flex items-center gap-0.5 h-8">
                        {Array.from({ length: 28 }).map((_, i) => (
                          <span key={i} className="w-0.5 bg-[color:var(--success)] rounded-full animate-pulse"
                            style={{ height: `${20 + Math.sin(i + Date.now()/300) * 40 + Math.random()*30}%`, animationDelay: `${i*40}ms` }} />
                        ))}
                      </div>
                      <StatusBadge status="ringing" />
                      <Button size="sm" variant="outline" asChild>
                        <Link to="/voice/$callId" params={{ callId: c.id }}>
                          <Headphones className="size-4" /> Listen
                        </Link>
                      </Button>
                    </div>
                    {(aiLine || userLine) && (
                      <div className="ml-14 grid gap-1.5 text-xs">
                        {aiLine && (
                          <div className="flex gap-2">
                            <span className="font-semibold text-[color:var(--ai)] shrink-0">AI</span>
                            <span className="text-muted-foreground">"{aiLine.text}"</span>
                          </div>
                        )}
                        {userLine && (
                          <div className="flex gap-2">
                            <span className="font-semibold shrink-0">{c.customerName.split(" ")[0]}</span>
                            <span className="text-muted-foreground">"{userLine.text}"</span>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="completed" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Intent</TableHead>
                      <TableHead>Disposition</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completed.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <Link to="/voice/$callId" params={{ callId: c.id }} className="font-medium text-sm hover:text-primary">{c.customerName}</Link>
                        </TableCell>
                        <TableCell className="text-sm">{c.intent}</TableCell>
                        <TableCell><StatusBadge status={c.disposition} /></TableCell>
                        <TableCell className="text-sm tabular-nums">{c.confidence}%</TableCell>
                        <TableCell className="text-xs tabular-nums">{Math.floor(c.durationSec/60)}m {c.durationSec%60}s</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatRelative(c.startedAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recordings" className="mt-4">
            <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Recordings library — searchable by customer, campaign, intent, or keyword.</CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

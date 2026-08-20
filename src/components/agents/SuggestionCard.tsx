import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, Pencil, X, Quote } from "lucide-react";
import { KIND_LABEL, MODULE_SOURCE_LABEL, getRecording, type MinedSuggestion } from "@/mocks/recordings";
import { WORKFLOW_LABEL } from "@/mocks/agents";
import { cn } from "@/lib/utils";

export function SuggestionCard({
  s, onApprove, onReject, onEdit,
}: {
  s: MinedSuggestion;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onEdit: (id: string, a: string, b: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [a, setA] = useState(s.a);
  const [b, setB] = useState(s.b);
  const src = getRecording(s.sourceRecordingId);

  return (
    <Card className={cn(s.status !== "pending" && "opacity-60")}>
      <CardContent className="pt-6 space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">{KIND_LABEL[s.kind]}</Badge>
          <Badge variant="secondary">{WORKFLOW_LABEL[s.module]}</Badge>
          <span className="text-[11px] text-muted-foreground">
            {s.occurrences} calls • {s.confidence}% confidence
          </span>
          {s.status !== "pending" && (
            <Badge
              className={cn(
                "ml-auto",
                s.status === "approved"
                  ? "bg-[color:var(--success)]/15 text-[color:var(--success)]"
                  : "bg-destructive/10 text-destructive",
              )}
            >
              {s.status}
            </Badge>
          )}
        </div>

        {editing ? (
          <div className="grid gap-2 md:grid-cols-2">
            <Textarea rows={2} value={a} onChange={(e) => setA(e.target.value)} />
            <Textarea rows={2} value={b} onChange={(e) => setB(e.target.value)} placeholder="Agent response" />
          </div>
        ) : (
          <div className="space-y-1">
            <div className="text-sm font-medium">{s.intent ? <span className="font-mono">{s.intent}</span> : null} “{a}”</div>
            {b && <div className="text-sm text-muted-foreground">{b}</div>}
          </div>
        )}

        <div className="flex items-start gap-2 rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
          <Quote className="size-3.5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div>{s.sourceSnippet} <span className="opacity-70">({s.sourceRecordingId})</span></div>
            {src && (
              <div className="opacity-80">
                Module determined by: {MODULE_SOURCE_LABEL[src.moduleSource]}
                {src.moduleSource === "ai" ? ` (${src.moduleConfidence}%)` : ""} — {src.moduleEvidence}
              </div>
            )}
          </div>
        </div>

        {s.status === "pending" && (
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => { if (editing) onEdit(s.id, a, b); onApprove(s.id); setEditing(false); }}>
              <Check className="size-4" /> Approve
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing((e) => !e)}>
              <Pencil className="size-4" /> {editing ? "Cancel edit" : "Edit"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onReject(s.id)}>
              <X className="size-4" /> Reject
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

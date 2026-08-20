import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { WORKFLOW_LABEL, type AgentWorkflow } from "@/mocks/agents";
import {
  MODULE_SOURCE_HELP, MODULE_SOURCE_LABEL, CONFIDENCE_THRESHOLD, type Recording,
} from "@/mocks/recordings";
import { ModuleBadge } from "./ModuleBadge";
import { AlertTriangle } from "lucide-react";

const MODULES: AgentWorkflow[] = ["sales", "service", "insurance", "amc", "winback", "feedback"];

export function ClassificationPanel({
  r, onOverride,
}: {
  r: Recording;
  onOverride: (id: string, module: AgentWorkflow) => void;
}) {
  const low = r.moduleSource === "unknown" || (r.moduleSource === "ai" && r.moduleConfidence < CONFIDENCE_THRESHOLD);

  return (
    <div className="rounded-lg border p-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Workflow classification</div>
          <div className="mt-1"><ModuleBadge r={r} /></div>
        </div>
        {low && (
          <Badge className="gap-1 bg-destructive/10 text-destructive">
            <AlertTriangle className="size-3" /> Needs review
          </Badge>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {MODULE_SOURCE_HELP[r.moduleSource]} <span className="block mt-0.5 opacity-80">{r.moduleEvidence}</span>
      </p>

      {r.moduleSignals.length > 0 && (
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Matched signals</div>
          <div className="flex flex-wrap gap-1.5">
            {r.moduleSignals.map((s) => (
              <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
            ))}
          </div>
        </div>
      )}

      {r.moduleAlternatives.length > 0 && (
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Other candidates</div>
          <div className="flex flex-wrap gap-1.5">
            {r.moduleAlternatives.map((a) => (
              <Badge key={a.module} variant="secondary" className="text-[10px]">
                {WORKFLOW_LABEL[a.module]} · {a.score}%
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs">Set module {r.moduleSource === "manual" ? "(human verified)" : "(overrides the detection)"}</Label>
        <Select
          value={r.moduleSource === "unknown" ? "" : r.module}
          onValueChange={(v) => onOverride(r.id, v as AgentWorkflow)}
        >
          <SelectTrigger className="h-9"><SelectValue placeholder="Pick a workflow…" /></SelectTrigger>
          <SelectContent>
            {MODULES.map((m) => (
              <SelectItem key={m} value={m}>{WORKFLOW_LABEL[m]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">
          Overriding marks the call {MODULE_SOURCE_LABEL.manual.toLowerCase()} and feeds it back as a labelled example.
        </p>
      </div>
    </div>
  );
}

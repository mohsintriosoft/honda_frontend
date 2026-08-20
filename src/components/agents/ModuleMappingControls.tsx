import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { WORKFLOW_LABEL, type AgentWorkflow } from "@/mocks/agents";
import { CAMPAIGN_MODULE_MAP } from "@/mocks/recordings";
import { ArrowRight } from "lucide-react";

const MODULES: AgentWorkflow[] = ["sales", "service", "insurance", "amc", "winback", "feedback"];

/** Shared fallback rule shown on every ingest tab. */
export function ModuleFallback({
  value, onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>If the module can't be determined</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="ai">AI-classify from the transcript</SelectItem>
          <SelectItem value="unclassified">Send to “Needs classification”</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

/** Bulk-upload tab: filename pattern vs. one forced module. */
export function UploadModuleMapping({
  mode, onMode, forced, onForced, sampleFiles,
}: {
  mode: string;
  onMode: (v: string) => void;
  forced: AgentWorkflow;
  onForced: (v: AgentWorkflow) => void;
  sampleFiles: { name: string; parsed: string | null }[];
}) {
  return (
    <div className="rounded-lg border p-3 space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>How is the module decided?</Label>
          <Select value={mode} onValueChange={onMode}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="filename">Detect from filename pattern</SelectItem>
              <SelectItem value="forced">All files are one module</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {mode === "forced" ? (
          <div className="space-y-1.5">
            <Label>Module for this batch</Label>
            <Select value={forced} onValueChange={(v) => onForced(v as AgentWorkflow)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MODULES.map((m) => (
                  <SelectItem key={m} value={m}>{WORKFLOW_LABEL[m]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label>Pattern</Label>
            <div className="h-9 flex items-center rounded-md border bg-muted/40 px-3 font-mono text-xs">
              OMH_&lt;MODULE&gt;_&lt;ID&gt;.mp3
            </div>
          </div>
        )}
      </div>

      {mode === "filename" && (
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Pattern preview</div>
          {sampleFiles.map((f) => (
            <div key={f.name} className="flex items-center gap-2 text-xs">
              <span className="font-mono truncate">{f.name}</span>
              <ArrowRight className="size-3 text-muted-foreground shrink-0" />
              {f.parsed ? (
                <Badge variant="secondary" className="text-[10px]">{f.parsed}</Badge>
              ) : (
                <Badge className="bg-destructive/10 text-destructive text-[10px]">no module in name</Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Dialer tab: campaign/queue → module mapping table. */
export function CampaignModuleMapping({
  map, onChange,
}: {
  map: { campaign: string; module: AgentWorkflow; calls: number }[];
  onChange: (campaign: string, module: AgentWorkflow) => void;
}) {
  return (
    <div className="rounded-lg border">
      <div className="border-b px-3 py-2 text-xs font-medium">
        Campaign → module mapping <span className="text-muted-foreground">({CAMPAIGN_MODULE_MAP.length} queues, saved)</span>
      </div>
      <div className="divide-y">
        {map.map((c) => (
          <div key={c.campaign} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <div className="text-sm">
              {c.campaign}
              <span className="ml-2 text-xs text-muted-foreground">{c.calls} calls</span>
            </div>
            <Select value={c.module} onValueChange={(v) => onChange(c.campaign, v as AgentWorkflow)}>
              <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MODULES.map((m) => (
                  <SelectItem key={m} value={m}>{WORKFLOW_LABEL[m]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    </div>
  );
}

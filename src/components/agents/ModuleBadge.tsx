import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { WORKFLOW_LABEL } from "@/mocks/agents";
import {
  MODULE_SOURCE_HELP, MODULE_SOURCE_LABEL, CONFIDENCE_THRESHOLD, type Recording,
} from "@/mocks/recordings";
import { cn } from "@/lib/utils";
import { AlertTriangle, BadgeCheck, Bot, Database, UserCheck } from "lucide-react";

const ICON = {
  metadata: BadgeCheck,
  crm: Database,
  ai: Bot,
  manual: UserCheck,
  unknown: AlertTriangle,
} as const;

const TONE = {
  metadata: "bg-[color:var(--success)]/12 text-[color:var(--success)]",
  crm: "bg-[color:var(--info)]/12 text-[color:var(--info)]",
  ai: "bg-[color:var(--ai)]/12 text-[color:var(--ai)]",
  manual: "bg-primary/10 text-primary",
  unknown: "bg-destructive/10 text-destructive",
} as const;

export function ModuleBadge({ r, className }: { r: Recording; className?: string }) {
  const Icon = ICON[r.moduleSource];
  const low = r.moduleSource === "ai" && r.moduleConfidence < CONFIDENCE_THRESHOLD;
  const unknown = r.moduleSource === "unknown";

  return (
    <div className={cn("flex flex-col items-start gap-1", className)}>
      <span className={cn("text-sm", unknown && "text-muted-foreground italic")}>
        {unknown ? "Unclassified" : WORKFLOW_LABEL[r.module]}
      </span>
      <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className={cn("gap-1 text-[10px] font-normal", TONE[r.moduleSource], low && "ring-1 ring-destructive/30")}>
            <Icon className="size-3" />
            {MODULE_SOURCE_LABEL[r.moduleSource]}
            {r.moduleSource === "ai" && <span className="tabular-nums">{r.moduleConfidence}%</span>}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-64">
          <p>{MODULE_SOURCE_HELP[r.moduleSource]}</p>
          <p className="mt-1 opacity-80">{r.moduleEvidence}</p>
        </TooltipContent>
      </Tooltip>
      </TooltipProvider>
    </div>
  );
}

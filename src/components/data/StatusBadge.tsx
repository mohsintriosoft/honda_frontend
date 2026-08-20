import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const map: Record<string, string> = {
  // campaign
  draft: "bg-muted text-muted-foreground border-border",
  scheduled: "bg-[color:var(--info)]/15 text-[color:var(--info)] border-[color:var(--info)]/30",
  live: "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30 [&_.dot]:bg-[color:var(--success)] [&_.dot]:animate-pulse",
  paused: "bg-[color:var(--warning)]/15 text-[color:var(--warning-foreground)] border-[color:var(--warning)]/30",
  completed: "bg-muted text-foreground border-border",
  // calls
  ringing: "bg-[color:var(--info)]/15 text-[color:var(--info)] [&_.dot]:bg-[color:var(--info)] [&_.dot]:animate-pulse",
  connected: "bg-[color:var(--success)]/15 text-[color:var(--success)]",
  failed: "bg-destructive/15 text-destructive",
  voicemail: "bg-muted text-muted-foreground",
  // appointments
  upcoming: "bg-[color:var(--info)]/15 text-[color:var(--info)]",
  missed: "bg-destructive/15 text-destructive",
  cancelled: "bg-muted text-muted-foreground line-through",
  rescheduled: "bg-[color:var(--warning)]/15 text-[color:var(--warning-foreground)]",
  // wa
  open: "bg-[color:var(--info)]/15 text-[color:var(--info)]",
  assigned: "bg-[color:var(--success)]/15 text-[color:var(--success)]",
  escalated: "bg-destructive/15 text-destructive",
  closed: "bg-muted text-muted-foreground",
  // dispositions
  interested: "bg-[color:var(--success)]/15 text-[color:var(--success)]",
  booked: "bg-primary/15 text-primary",
  callback: "bg-[color:var(--warning)]/15 text-[color:var(--warning-foreground)]",
  not_interested: "bg-muted text-muted-foreground",
  wrong_number: "bg-muted text-muted-foreground",
  no_answer: "bg-muted text-muted-foreground",
  // insurance/amc
  active: "bg-[color:var(--success)]/15 text-[color:var(--success)]",
  due: "bg-[color:var(--warning)]/15 text-[color:var(--warning-foreground)]",
  expired: "bg-destructive/15 text-destructive",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const label = status.replace(/_/g, " ");
  const dotted = ["live", "ringing"].includes(status);
  return (
    <Badge
      variant="outline"
      className={cn(
        "capitalize gap-1.5 border font-medium px-2 py-0.5 rounded-full text-[11px]",
        map[status] ?? "bg-muted text-muted-foreground",
        className
      )}
    >
      {dotted && <span className="dot size-1.5 rounded-full" />}
      {label}
    </Badge>
  );
}

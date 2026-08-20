import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";

export function KpiCard({
  label, value, delta, icon, hint, accent = false,
}: {
  label: string;
  value: ReactNode;
  delta?: number;
  icon?: ReactNode;
  hint?: string;
  accent?: boolean;
}) {
  const positive = (delta ?? 0) >= 0;
  return (
    <div className={cn(
      "rounded-xl border bg-card p-4 flex flex-col gap-2 transition-shadow hover:shadow-sm",
      accent && "ai-gradient ai-border"
    )}>
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</div>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </div>
      <div className="text-2xl font-display font-semibold tabular-nums">{value}</div>
      <div className="flex items-center justify-between text-xs">
        {delta !== undefined ? (
          <span className={cn(
            "inline-flex items-center gap-0.5 font-medium",
            positive ? "text-[color:var(--success)]" : "text-destructive"
          )}>
            {positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {Math.abs(delta)}%
          </span>
        ) : <span />}
        {hint && <span className="text-muted-foreground">{hint}</span>}
      </div>
    </div>
  );
}

export function MetricTile({
  label, value, tone = "default",
}: {
  label: string;
  value: ReactNode;
  tone?: "default" | "success" | "warning" | "destructive" | "info" | "ai";
}) {
  const tones: Record<string, string> = {
    default: "bg-card",
    success: "bg-[color:var(--success)]/10 text-[color:var(--success)]",
    warning: "bg-[color:var(--warning)]/15 text-[color:var(--warning-foreground)]",
    destructive: "bg-destructive/10 text-destructive",
    info: "bg-[color:var(--info)]/10 text-[color:var(--info)]",
    ai: "ai-gradient text-foreground",
  };
  return (
    <div className={cn("rounded-lg border p-3", tones[tone])}>
      <div className="text-[11px] uppercase tracking-wide opacity-80">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums font-display">{value}</div>
    </div>
  );
}

import { TRAIN_STEPS } from "@/mocks/recordings";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Loader2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export function TrainingRunProgress({ step, progress }: { step: number; progress: number }) {
  return (
    <div className="space-y-3">
      <Progress value={progress} className="h-2" />
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {TRAIN_STEPS.map((label, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <div
              key={label}
              className={cn(
                "flex items-center gap-2 rounded-md border p-2 text-xs",
                done && "border-[color:var(--success)]/40 text-[color:var(--success)]",
                active && "border-primary/50 text-primary",
                !done && !active && "text-muted-foreground",
              )}
            >
              {done ? <CheckCircle2 className="size-3.5" />
                : active ? <Loader2 className="size-3.5 animate-spin" />
                : <Circle className="size-3.5" />}
              {label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

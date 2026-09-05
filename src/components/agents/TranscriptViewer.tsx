import type { TranscriptTurn } from "@/mocks/recordings";
import { cn } from "@/lib/utils";

export function TranscriptViewer({ turns }: { turns: TranscriptTurn[] }) {
  return (
    <div className="space-y-2">
      {turns.map((t, i) => (
        <div key={i} className="flex flex-col gap-1">

          {t.speaker === "agent" && t.filler && (
            <div className="ml-1 text-[10px] italic text-muted-foreground">
              filler: {t.filler}
            </div>
          )}
          <div
            className={cn(
              "flex flex-col gap-0.5 rounded-lg border p-3 max-w-[92%]",
              t.speaker === "agent"
                ? "bg-primary/5 border-primary/20"
                : "ml-auto bg-muted/50",
            )}
          >
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
              <span>{t.speaker === "agent" ? "Agent" : "Customer"}</span>
              <span className="tabular-nums">{t.at}</span>
            </div>
            <p className="text-sm">{t.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function SentimentStrip({ points }: { points: number[] }) {
  return (
    <div className="flex items-end gap-1 h-12">
      {points.map((p, i) => {
        const h = Math.max(8, Math.min(100, (p + 100) / 2));
        const tone =
          p > 25 ? "bg-[color:var(--success)]" : p < -15 ? "bg-destructive" : "bg-muted-foreground/40";
        return <div key={i} className={cn("flex-1 rounded-sm", tone)} style={{ height: `${h}%` }} />;
      })}
    </div>
  );
}
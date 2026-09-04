import { Link } from "react-router-dom";
import { PageHeader } from "@/components/layout/AppShell";
import { segments } from "@/mocks/data";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight, Users } from "lucide-react";
import { formatNumber } from "@/lib/format";

export default function SegmentsPage() {
  return (
    <>
      <PageHeader
        title="Customer Segments"
        description="Dynamic segments auto-update from your DMS. Click any segment to view customers and launch a campaign."
      />

      <div className="p-4 md:p-6 lg:p-8">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {segments.map((s) => (
            <Link key={s.slug} to={`/segments/${s.slug}`}>
              <Card className="p-5 h-full hover:shadow-md hover:border-primary/40 transition-all group">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="font-display font-semibold">{s.label}</div>

                    <div className="text-xs text-muted-foreground mt-0.5">{s.description}</div>
                  </div>

                  <div className="size-9 rounded-lg bg-primary/10 text-primary grid place-items-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Users className="size-4" />
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-3">
                  <div>
                    <div className="text-[11px] uppercase text-muted-foreground tracking-wide">
                      Customers
                    </div>

                    <div className="text-xl font-semibold font-display tabular-nums">
                      {formatNumber(s.customers)}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] uppercase text-muted-foreground tracking-wide">
                      Due today
                    </div>

                    <div className="text-xl font-semibold font-display tabular-nums">
                      {s.dueToday}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] uppercase text-muted-foreground tracking-wide">
                      Conversion
                    </div>

                    <div className="text-xl font-semibold font-display tabular-nums text-[color:var(--success)]">
                      {s.conversion}%
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {s.activeCampaign ? (
                      <>
                        Active:{" "}
                        <span className="font-medium text-foreground">{s.activeCampaign}</span>
                      </>
                    ) : (
                      "No active campaign"
                    )}
                  </span>

                  <span className="flex items-center gap-1 text-primary font-medium">
                    Open
                    <ArrowRight className="size-3" />
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}

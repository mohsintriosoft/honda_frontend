import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCcw, ArrowRight, Users } from "lucide-react";
import { formatNumber } from "@/lib/format";

import { get_segments, server_get_data } from "@/components/ServiceConnection/serviceconnection";

/* -------------------------------------------------------------------------- */
/* Types — mirrors views_admin.segments()/_serialize_segment                 */
/* -------------------------------------------------------------------------- */

interface ApiSegment {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  customers: number;
  due_today: number;
  conversion: number | null;
  active_campaign: string | null;
  campaign_status: "live" | "paused" | "draft" | null;
}

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export default function SegmentsPage() {
  const [segments, setSegments] = useState<ApiSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSegments = () => {
    setLoading(true);
    setError(null);

    server_get_data(get_segments)
      .then((res) => setSegments(res?.segments ?? []))
      .catch(() => setError("Couldn't load segments. Pull to refresh or try again."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSegments();
  }, []);

  return (
    <>
      <PageHeader
        title="Customer Segments"
        description="Dynamic segments auto-update from your DMS. Click any segment to view customers and launch a campaign."
        actions={
          <Button size="sm" variant="outline" onClick={loadSegments} disabled={loading}>
            <RefreshCcw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      <div className="p-4 md:p-6 lg:p-8">
        {error && (
          <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading && !segments.length && !error && (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading segments…</div>
        )}

        {!loading && !error && !segments.length && (
          <div className="text-sm text-muted-foreground py-8 text-center">
            No segments configured yet.
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {segments.map((s) => (
            <Link key={s.id} to={`/segments/${s.id}`}>
              <Card className="p-5 h-full hover:shadow-md hover:border-primary/40 transition-all group">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="font-display font-semibold">{s.name}</div>

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
                      {formatNumber(s.customers ?? 0)}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] uppercase text-muted-foreground tracking-wide">
                      Due today
                    </div>

                    <div className="text-xl font-semibold font-display tabular-nums">
                      {formatNumber(s.due_today ?? 0)}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] uppercase text-muted-foreground tracking-wide">
                      Conversion
                    </div>

                    <div className="text-xl font-semibold font-display tabular-nums text-[color:var(--success)]">
                      {s.conversion != null ? `${s.conversion}%` : "—"}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {s.active_campaign ? (
                      <>
                        Active:{" "}
                        <span className="font-medium text-foreground">{s.active_campaign}</span>
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
import { Link } from "react-router-dom";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { SuggestionCard } from "@/components/agents/SuggestionCard";
import { EmptyState } from "@/components/data/EmptyState";

import {
  minedSuggestions,
  KIND_LABEL,
  type MinedSuggestion,
  type SuggestionKind,
} from "@/mocks/recordings";

import { WORKFLOW_LABEL, agents, type AgentWorkflow } from "@/mocks/agents";

import { ArrowLeft, CheckCheck, ClipboardCheck, Rocket } from "lucide-react";

const KINDS: SuggestionKind[] = ["intent", "objection", "faq", "opening", "escalation"];

const MODULES: AgentWorkflow[] = ["sales", "service", "insurance", "amc", "winback", "feedback"];

export default function ReviewQueue() {
  const [items, setItems] = useState<MinedSuggestion[]>(minedSuggestions);

  const [moduleFilter, setModuleFilter] = useState("all");

  const [minConfidence, setMinConfidence] = useState(70);

  const [tab, setTab] = useState<"all" | SuggestionKind>("all");

  const visible = useMemo(
    () =>
      items.filter(
        (s) =>
          (tab === "all" || s.kind === tab) &&
          (moduleFilter === "all" || s.module === moduleFilter) &&
          s.confidence >= minConfidence,
      ),
    [items, tab, moduleFilter, minConfidence],
  );

  const pending = items.filter((s) => s.status === "pending");

  const approved = items.filter((s) => s.status === "approved");

  const setStatus = (id: string, status: MinedSuggestion["status"]) => {
    setItems((all) => all.map((s) => (s.id === id ? { ...s, status } : s)));
  };

  const bulkApprove = () => {
    setItems((all) =>
      all.map((s) =>
        s.status === "pending" &&
        s.confidence >= minConfidence &&
        (moduleFilter === "all" || s.module === moduleFilter)
          ? {
              ...s,
              status: "approved",
            }
          : s,
      ),
    );
  };

  return (
    <>
      <PageHeader
        breadcrumbs={[
          {
            label: "AI Agents",
            to: "/agents",
          },
          {
            label: "Call recordings",
            to: "/agents/recordings",
          },
          {
            label: "Review queue",
          },
        ]}
        title="Extraction review queue"
        description="Every line mined from your recordings needs a human yes before it reaches a live calling agent."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/agents/recordings">
                <ArrowLeft className="size-4" />
                Recordings
              </Link>
            </Button>

            <Button size="sm" asChild disabled={approved.length === 0}>
              <Link to="/agents/training">
                <Rocket className="size-4" />
                Stage {approved.length} approved
              </Link>
            </Button>
          </div>
        }
      />

      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        {/* Filters */}
        <Card>
          <CardContent className="pt-6 grid gap-4 md:grid-cols-[minmax(0,220px)_minmax(0,280px)_1fr] md:items-center">
            <div className="space-y-1.5">
              <Label>Module</Label>

              <Select value={moduleFilter} onValueChange={setModuleFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="all">All modules</SelectItem>

                  {MODULES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {WORKFLOW_LABEL[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Minimum confidence — {minConfidence}%</Label>

              <Slider
                value={[minConfidence]}
                min={50}
                max={99}
                step={1}
                onValueChange={(v) => setMinConfidence(v[0] ?? 70)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 md:justify-end">
              <Badge variant="secondary">{pending.length} pending</Badge>

              <Badge className="bg-[color:var(--success)]/15 text-[color:var(--success)]">
                {approved.length} approved
              </Badge>

              <Button size="sm" variant="outline" onClick={bulkApprove}>
                <CheckCheck className="size-4" />
                Approve all above {minConfidence}%
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Suggestions */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="all">All ({items.length})</TabsTrigger>

            {KINDS.map((k) => (
              <TabsTrigger key={k} value={k}>
                {KIND_LABEL[k]} ({items.filter((s) => s.kind === k).length})
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={tab} className="mt-4 space-y-3">
            {visible.length === 0 ? (
              <EmptyState
                icon={<ClipboardCheck className="size-6" />}
                title="Nothing to review here"
                description="Lower the confidence threshold or pick another module to see more mined suggestions."
              />
            ) : (
              visible.map((s) => (
                <SuggestionCard
                  key={s.id}
                  s={s}
                  onApprove={(id) => setStatus(id, "approved")}
                  onReject={(id) => setStatus(id, "rejected")}
                  onEdit={(id, a, b) =>
                    setItems((all) =>
                      all.map((x) =>
                        x.id === id
                          ? {
                              ...x,
                              a,
                              b,
                            }
                          : x,
                      ),
                    )
                  }
                />
              ))
            )}
          </TabsContent>
        </Tabs>

        {/* Training status */}
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Approved items are staged for{" "}
            {[
              ...new Set(
                approved
                  .map((s) => agents.find((a) => a.id === s.targetAgentId)?.name)
                  .filter(Boolean),
              ),
            ].join(", ") || "no agent yet"}{" "}
            — continue in the Training Data Studio to push and retrain.
          </CardContent>
        </Card>
      </div>
    </>
  );
}

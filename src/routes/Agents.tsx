import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Loader from "@/components/layout/Loader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, ArrowRight, BookOpen, Layers, Mic } from "lucide-react";
import {
  server_get_data,
  get_segments,
  get_llm_settings,
  get_agent_knowledge,
} from "@/components/ServiceConnection/serviceconnection";
import { handleError } from "@/components/CommonJquery/CommonJquery";

const TOTAL_MODULES = 3;

interface SegmentCard {
  id: string;
  name: string;
  description: string | null;
  matchServiceType: string | null;
  daysBefore?: number;
  daysAfter?: number;
  module: string | null;
  settingId: number | null;
  persona: string | null;
  voiceName: string | null;
  voiceGender: string | null;
}

const AgentsPage = () => {
  const [ShowLoaderAdmin, setShowLoaderAdmin] = useState(true);
  const [segments, setSegments] = useState<SegmentCard[]>([]);
  const [knowledgeTotal, setKnowledgeTotal] = useState(0);
  const [modulesConfigured, setModulesConfigured] = useState(0);
  const [voicesAssigned, setVoicesAssigned] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const master_data_get = async () => {
    setShowLoaderAdmin(true);
    setErrorMsg(null);

    try {
      const [segmentsRes, settingsRes] = await Promise.all([
        server_get_data(get_segments),
        server_get_data(get_llm_settings),
      ]);

      if (!segmentsRes?.segments) {
        handleError("Failed to load segments");
        setErrorMsg("Failed to load segments");
        return;
      }

      const allSegments = segmentsRes.segments;
      const settings = settingsRes?.settings ?? [];

      const settingBySegmentId = new Map<number, any>();
      settings.forEach((setting: any) => {
        (setting.segments ?? []).forEach((seg: any) => {
          settingBySegmentId.set(seg.id, setting);
        });
      });

      const mappedSegments: SegmentCard[] = allSegments.map((segment: any) => {
        const setting = settingBySegmentId.get(segment.id);
        return {
          id: String(segment.id),
          name: segment.name,
          description: segment.description,
          matchServiceType: segment.match_service_type ?? null,
          daysBefore: segment.days_before,
          daysAfter: segment.days_after,
          module: setting?.module ?? null,
          settingId: setting?.id ?? null,
          persona: setting?.persona_name ?? null,
          voiceName: setting?.voice?.voice_name ?? null,
          voiceGender: setting?.voice?.gender ?? null,
        };
      });

      setSegments(mappedSegments);
      setModulesConfigured(new Set(settings.map((s: any) => s.module)).size);
      setVoicesAssigned(
        new Set(settings.map((s: any) => s.voice?.voice_name).filter(Boolean)).size,
      );

      // Global / shared docs come back for every agent -- dedupe by doc id.
      const docLists = await Promise.all(
        settings.map(async (setting: any) => {
          try {
            const res = await server_get_data(get_agent_knowledge(setting.id));
            return Array.isArray(res?.documents) ? res.documents : [];
          } catch {
            return [];
          }
        }),
      );
      const uniqueDocIds = new Set<string>();
      docLists.flat().forEach((doc: any) => {
        const key = doc?.doc_id ?? doc?.id;
        if (key != null) uniqueDocIds.add(String(key));
      });
      setKnowledgeTotal(uniqueDocIds.size);
    } catch (error: any) {
      if (error?.response?.status === 403) {
        setErrorMsg("Your role does not have permission to view AI agents");
      } else {
        handleError("network");
        setErrorMsg("Failed to load AI agents");
      }
    } finally {
      setShowLoaderAdmin(false);
    }
  };

  useEffect(() => {
    master_data_get();
  }, []);

  return (
    <>
      {ShowLoaderAdmin && <Loader />}

      <div className="Over_flow_height">
        {!ShowLoaderAdmin && errorMsg && (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="text-sm font-medium text-destructive">Failed to load AI agents</div>
              <p className="mt-2 text-xs text-muted-foreground">{errorMsg}</p>
              <Button className="mt-4" variant="outline" onClick={() => master_data_get()}>
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {!ShowLoaderAdmin && !errorMsg && (
          <div className="p-4 md:p-6 lg:p-8 space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Segments", value: String(segments.length), icon: Layers },
                {
                  label: "Modules configured",
                  value: `${modulesConfigured} / ${TOTAL_MODULES}`,
                  icon: Bot,
                },
                { label: "Knowledge sources", value: String(knowledgeTotal), icon: BookOpen },
                { label: "Voices assigned", value: String(voicesAssigned), icon: Mic },
              ].map((item) => (
                <Card key={item.label}>
                  <CardContent className="pt-6 flex items-center gap-3">
                    <div className="size-9 rounded-lg bg-primary/10 text-primary grid place-items-center">
                      <item.icon className="size-4" />
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {item.label}
                      </div>
                      <div className="text-xl font-semibold font-display tabular-nums">
                        {item.value}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {segments.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <Bot className="mx-auto size-8 text-muted-foreground" />
                  <h3 className="mt-4 text-base font-semibold">No segments found</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Segments show up here as soon as they exist — AI agents are configured per
                    module (Service, Insurance, AMC) and apply to every segment in it.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {segments.map((segment) => (
                  <Link key={segment.id} to={`/agents/${segment.id}`} className="block">
                    <Card className="h-full hover:shadow-md hover:border-primary/40 transition-all group">
                      <CardContent className="pt-6 space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-display font-semibold">{segment.name}</span>
                              {segment.module ? (
                                <Badge variant="outline" className="capitalize">
                                  {segment.module}
                                </Badge>
                              ) : (
                                <Badge variant="secondary">No agent yet</Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {segment.description}
                            </div>
                          </div>
                          <div className="size-9 shrink-0 rounded-lg bg-primary/10 text-primary grid place-items-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                            <Bot className="size-4" />
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5 text-[10px]">
                          {segment.persona && (
                            <span className="rounded-full bg-secondary px-2 py-0.5">
                              {segment.persona}
                            </span>
                          )}
                          {segment.voiceName && (
                            <span className="rounded-full bg-secondary px-2 py-0.5">
                              {segment.voiceGender === "male" ? "♂" : "♀"} {segment.voiceName}
                            </span>
                          )}
                          {segment.matchServiceType && (
                            <span className="rounded-full bg-secondary px-2 py-0.5">
                              {segment.matchServiceType}
                            </span>
                          )}
                          {(segment.daysBefore != null || segment.daysAfter != null) && (
                            <span className="rounded-full bg-secondary px-2 py-0.5">
                              {segment.daysBefore ?? 0}d before / {segment.daysAfter ?? 0}d after
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            {segment.module ? "Agent configured" : "Needs setup"}
                          </span>
                          <span className="flex items-center gap-1 text-primary font-medium">
                            Configure
                            <ArrowRight className="size-3" />
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default AgentsPage;

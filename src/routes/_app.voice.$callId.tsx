import { Link, useParams } from "react-router-dom";
import { useRef, useState } from "react";

import { PageHeader } from "@/components/layout/AppShell";
import { calls, customers } from "@/mocks/data";
import { getCallScript, type TranscriptLine, type CallScript } from "@/mocks/transcripts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/data/StatusBadge";

import {
  Play,
  Pause,
  Sparkles,
  AlertTriangle,
  User,
  Languages,
  Volume2,
  Loader2,
} from "lucide-react";

import { formatDateTime } from "@/lib/format";

interface TtsOpts {
  voice?: string;
  gender?: "female" | "male";
  agent?: string;
}

/* -------------------------------------------------------------------------- */
/* TTS                                                                        */
/* -------------------------------------------------------------------------- */

function playTts(audio: HTMLAudioElement, text: string, opts: TtsOpts = {}, signal?: AbortSignal) {
  return fetch("/api/tts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      ...opts,
    }),
    signal,
  }).then(async (res) => {
    if (!res.ok) {
      throw new Error(await res.text().catch(() => "TTS failed"));
    }

    const blob = await res.blob();

    const objectUrl = URL.createObjectURL(blob);

    audio.src = objectUrl;

    return audio.play();
  });
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function CallDetailPage() {
  const { callId } = useParams();

  const call = calls.find((c) => c.id === callId);

  /* ------------------------------------------------------------------------ */
  /* Not Found                                                                */
  /* ------------------------------------------------------------------------ */

  if (!call) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Call not found</h1>

          <p className="mt-2 text-sm text-muted-foreground">
            The call you're looking for doesn't exist or has been removed.
          </p>

          <Button className="mt-5" asChild>
            <Link to="/voice">Back to AI Voice Calls</Link>
          </Button>
        </div>
      </div>
    );
  }

  const customer = customers.find((c) => c.id === call.customerId);

  const script = getCallScript(call.id);

  return <CallDetailContent call={call} customer={customer} script={script} />;
}

/* -------------------------------------------------------------------------- */
/* Call Detail Content                                                        */
/* -------------------------------------------------------------------------- */

function CallDetailContent({
  call,
  customer,
  script,
}: {
  call: (typeof calls)[number];
  customer: (typeof customers)[number] | undefined;
  script: CallScript;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [playingIdx, setPlayingIdx] = useState<number | null>(null);

  const [loadingIdx, setLoadingIdx] = useState<number | null>(null);

  const [fullPlaying, setFullPlaying] = useState(false);

  const [fullLoading, setFullLoading] = useState(false);

  /* ------------------------------------------------------------------------ */
  /* Audio                                                                     */
  /* ------------------------------------------------------------------------ */

  function ensureAudio() {
    if (!audioRef.current) {
      const audio = new Audio();

      audio.onended = () => {
        setPlayingIdx(null);
        setFullPlaying(false);
      };

      audio.onpause = () => {
        setPlayingIdx(null);
        setFullPlaying(false);
      };

      audioRef.current = audio;
    }

    return audioRef.current;
  }

  /* ------------------------------------------------------------------------ */
  /* Play individual AI line                                                  */
  /* ------------------------------------------------------------------------ */

  function handleLineClick(idx: number, line: TranscriptLine) {
    const audio = ensureAudio();

    // Stop current audio if same line is clicked
    if (playingIdx === idx) {
      audio.pause();
      return;
    }

    audio.pause();

    setLoadingIdx(idx);

    playTts(audio, line.text, {
      voice: script.voice,
      gender: script.gender,
      agent: script.agent,
    })
      .then(() => {
        setPlayingIdx(idx);
      })
      .catch((error) => {
        console.error("TTS error:", error);
      })
      .finally(() => {
        setLoadingIdx(null);
      });
  }

  /* ------------------------------------------------------------------------ */
  /* Play complete AI conversation                                             */
  /* ------------------------------------------------------------------------ */

  function handlePlayFull() {
    const audio = ensureAudio();

    if (fullPlaying) {
      audio.pause();
      setFullPlaying(false);
      return;
    }

    const aiLines = script.lines
      .filter((line) => line.who === "ai")
      .map((line) => line.text)
      .join(" ");

    if (!aiLines.trim()) {
      return;
    }

    setFullLoading(true);

    playTts(audio, aiLines, {
      voice: script.voice,
      gender: script.gender,
      agent: script.agent,
    })
      .then(() => {
        setFullPlaying(true);
      })
      .catch((error) => {
        console.error("Full TTS error:", error);
      })
      .finally(() => {
        setFullLoading(false);
      });
  }

  /* ------------------------------------------------------------------------ */
  /* Render                                                                   */
  /* ------------------------------------------------------------------------ */

  return (
    <>
      <PageHeader
        title="Call detail"
        breadcrumbs={[
          {
            label: "AI Voice Calls",
            to: "/voice",
          },
          {
            label: call.id,
          },
        ]}
        actions={
          <>
            <Button variant="outline" size="sm">
              <AlertTriangle className="size-4" />
              Escalate
            </Button>

            <Button variant="outline" size="sm" asChild>
              <Link to={`/customers/${call.customerId}`}>
                <User className="size-4" />
                View customer
              </Link>
            </Button>
          </>
        }
      />

      <div className="p-4 md:p-6 lg:p-8 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4 min-w-0">
          {/* ---------------------------------------------------------------- */}
          {/* Audio Player                                                      */}
          {/* ---------------------------------------------------------------- */}

          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <Button
                  size="icon"
                  className="rounded-full size-12"
                  onClick={handlePlayFull}
                  disabled={fullLoading}
                >
                  {fullLoading ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : fullPlaying ? (
                    <Pause className="size-5" />
                  ) : (
                    <Play className="size-5" />
                  )}
                </Button>

                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {call.customerName}
                    {customer?.vehicle?.model ? ` • ${customer.vehicle.model}` : ""}
                  </div>

                  <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                    <span>
                      {formatDateTime(call.startedAt)} • {Math.floor(call.durationSec / 60)}m{" "}
                      {call.durationSec % 60}s
                    </span>

                    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5">
                      <Languages className="size-3" />
                      Bhopali Hindi
                    </span>

                    <span className="text-[11px]">
                      Tap "Play" for AI voice • tap any AI line to hear it
                    </span>
                  </div>

                  <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{
                        width: fullPlaying ? "62%" : "32%",
                      }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ---------------------------------------------------------------- */}
          {/* Transcript                                                        */}
          {/* ---------------------------------------------------------------- */}

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-display flex items-center justify-between gap-3">
                <span>Transcript</span>

                <span className="text-[11px] font-normal text-muted-foreground">
                  {script.agent} ({script.gender === "male" ? "Male AI" : "Female AI"}) ↔{" "}
                  {call.customerName}
                </span>
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-3 max-h-[60vh] overflow-y-auto">
              {script.lines.map((t: TranscriptLine, i: number) => {
                const isAi = t.who === "ai";

                const isPlaying = playingIdx === i;

                const isLoading = loadingIdx === i;

                return (
                  <div key={i} className={`flex gap-3 ${isAi ? "" : "justify-end"}`}>
                    {/* AI Avatar */}
                    {isAi && (
                      <div className="size-8 shrink-0 rounded-full ai-gradient ai-border border grid place-items-center text-xs font-bold text-[color:var(--ai)]">
                        AI
                      </div>
                    )}

                    {/* Message */}
                    <div
                      className={`
                          group
                          max-w-[75%]
                          rounded-2xl
                          px-3
                          py-2
                          text-sm
                          ${isAi ? "bg-muted" : "bg-primary text-primary-foreground"}
                          ${isAi ? "cursor-pointer hover:bg-muted/80" : ""}
                          ${isPlaying ? "ring-2 ring-[color:var(--ai)]" : ""}
                        `}
                      onClick={isAi ? () => handleLineClick(i, t) : undefined}
                      role={isAi ? "button" : undefined}
                      tabIndex={isAi ? 0 : undefined}
                      onKeyDown={
                        isAi
                          ? (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();

                                handleLineClick(i, t);
                              }
                            }
                          : undefined
                      }
                    >
                      <div className="flex items-start gap-2">
                        <span className="flex-1">{t.text}</span>

                        {isAi && (
                          <span className="mt-0.5 text-[color:var(--ai)] shrink-0">
                            {isLoading ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : isPlaying ? (
                              <Volume2 className="size-3.5 animate-pulse" />
                            ) : (
                              <Play className="size-3.5 opacity-40 group-hover:opacity-100" />
                            )}
                          </span>
                        )}
                      </div>

                      {t.t && (
                        <div
                          className={`
                              text-[10px]
                              mt-0.5
                              tabular-nums
                              ${isAi ? "text-muted-foreground" : "text-primary-foreground/70"}
                            `}
                        >
                          {t.t}
                        </div>
                      )}
                    </div>

                    {/* Customer Avatar */}
                    {!isAi && (
                      <div className="size-8 shrink-0 rounded-full bg-secondary grid place-items-center text-xs font-bold">
                        {call.customerName
                          .split(" ")
                          .map((p: string) => p[0])
                          .join("")
                          .slice(0, 2)}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Right Sidebar                                                       */}
        {/* ------------------------------------------------------------------ */}

        <aside className="space-y-3">
          {/* AI Summary */}
          <Card className="ai-gradient ai-border">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-1.5 font-display">
                <Sparkles className="size-4 text-[color:var(--ai)]" />
                AI summary
              </CardTitle>
            </CardHeader>

            <CardContent className="text-sm">{script.summary}</CardContent>
          </Card>

          {/* Disposition */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-display">Disposition</CardTitle>
            </CardHeader>

            <CardContent className="space-y-2 text-sm">
              <Row k="Status" v={<StatusBadge status={call.disposition} />} />

              <Row k="Intent" v={script.intent} />

              <Row k="Language" v="Hindi (Bhopali)" />

              <Row k="Confidence" v={`${call.confidence}%`} />

              <Row k="Outcome" v="Appointment booked" />

              <Row k="Next action" v="WhatsApp confirmation sent" />
            </CardContent>
          </Card>

          {/* Tags */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-display">Tags</CardTitle>
            </CardHeader>

            <CardContent className="flex flex-wrap gap-1.5">
              {script.tags.map((tag: string) => (
                <span key={tag} className="text-[11px] rounded-full bg-secondary px-2 py-0.5">
                  {tag}
                </span>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Row                                                                        */
/* -------------------------------------------------------------------------- */

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center gap-3">
      <span className="text-muted-foreground text-xs">{k}</span>

      <span className="text-sm text-right">{v}</span>
    </div>
  );
}

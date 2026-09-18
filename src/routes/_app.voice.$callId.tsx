import { Link, useParams } from "react-router-dom";
import { useEffect, useRef, useState } from "react";

import { PageHeader } from "@/components/layout/AppShell";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/data/StatusBadge";

import {
  Play,
  Pause,
  Sparkles,
  AlertTriangle,
  User,
  Languages,
  ShieldAlert,
  Loader2,
} from "lucide-react";

import { formatDateTime } from "@/lib/format";

import {
  get_recording_detail,
  server_get_data,
  APL_LINK,
} from "@/components/ServiceConnection/serviceconnection";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function joinUrl(...parts: string[]): string {
  return parts
    .map((p, i) => (i === 0 ? p.replace(/\/+$/, "") : p.replace(/^\/+/, "").replace(/\/+$/, "")))
    .filter(Boolean)
    .join("/");
}

// Same approach as the recordings library page's getAudioSrc: we don't care
// about the raw file path on disk, we always stream through recording_audio
// by numeric id. Empty string (rather than a broken URL) when there's
// nothing to play, e.g. a call that never got a mixed/stereo file.
function getAudioSrc(session: any): string {
  if (!session || (!session.recording_mixed && !session.recording_stereo)) {
    return "";
  }
  return joinUrl(APL_LINK, `/api/recordings/${session.id}/audio/`);
}

interface TranscriptTurn {
  who: "ai" | "customer";
  text: string;
  t: string;
  filler?: string;
}

// CallSession.transcript is a JSON mirror of ConversationTurn — speaker is
// 'bot' | 'customer'. Mapped the exact same way the recordings library page
// (_app_agents_recordings_index.tsx / mapRecordingApiToRecording) does it,
// since that's the one place this shape has already been confirmed against
// the real backend response.
function mapTranscript(raw: any): TranscriptTurn[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((t: any) => ({
    who: t.speaker === "bot" ? "ai" : "customer",
    text: t.text ?? "",
    t: t.at ?? t.timestamp ?? "",
    filler: t.filler ?? "",
  }));
}

function detectedIntents(session: any): string[] {
  if (!Array.isArray(session?.intent_history)) return [];
  return Array.from(
    new Set(
      session.intent_history
        .map((h: any) => h?.intent)
        .filter((v: unknown): v is string => typeof v === "string" && v.length > 0)
    )
  );
}

function formatClockTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function CallDetailPage() {
  const { callId } = useParams();

  // callId here is the CallSession numeric `id` (recording_detail /
  // recording_audio both key on pk, NOT the session_id UUID) — see the
  // fixed links on the Voice index page.
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!callId) return;

    let cancelled = false;

    async function fetchDetail() {
      setLoading(true);
      setError(null);

      try {
        const data = await server_get_data(get_recording_detail(callId));
        if (!cancelled) setSession(data);
      } catch (err) {
        console.error("Failed to load call detail:", err);
        if (!cancelled) setError("Couldn't load this call.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchDetail();

    return () => {
      cancelled = true;
    };
  }, [callId]);

  /* ------------------------------------------------------------------------ */
  /* Loading / Not Found                                                      */
  /* ------------------------------------------------------------------------ */

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Call not found</h1>

          <p className="mt-2 text-sm text-muted-foreground">
            {error || "The call you're looking for doesn't exist or has been removed."}
          </p>

          <Button className="mt-5" asChild>
            <Link to="/voice">Back to AI Voice Calls</Link>
          </Button>
        </div>
      </div>
    );
  }

  return <CallDetailContent session={session} />;
}

/* -------------------------------------------------------------------------- */
/* Call Detail Content                                                        */
/* -------------------------------------------------------------------------- */

function CallDetailContent({ session }: { session: any }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);

  // No `src` on the <audio> tag until Play is actually clicked once — same
  // lazy-load pattern as the recordings library page, so just opening this
  // page never silently pulls the audio file.
  const [audioReady, setAudioReady] = useState(false);

  const audioSrc = getAudioSrc(session);
  const transcript = mapTranscript(session.transcript);
  const intents = detectedIntents(session);

  const customerName = session.customer?.name || session.customer?.phone_number || "Unknown";

  // Reset playback state if this ever mounts against a different session
  // (e.g. navigating call-to-call without unmounting).
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setAudioDuration(0);
    setAudioError(null);
    setAudioReady(false);

    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  }, [session.id]);

  function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      return;
    }

    if (!audioReady) {
      // First tap on Play — this is the moment the audio file is actually
      // requested. The effect below fires playback once the <audio>
      // element has picked up the new src.
      setAudioReady(true);
      return;
    }

    void audio.play().catch(() => {
      setAudioError("Couldn't play this recording — the file may be unavailable.");
    });
  }

  useEffect(() => {
    if (!audioReady) return;

    const audio = audioRef.current;
    if (!audio) return;

    void audio.play().catch(() => {
      setAudioError("Couldn't play this recording — the file may be unavailable.");
    });
  }, [audioReady]);

  function seekTo(ratio: number) {
    const audio = audioRef.current;
    if (!audio || !audioDuration) return;

    const clamped = Math.min(1, Math.max(0, ratio));
    audio.currentTime = clamped * audioDuration;
    setCurrentTime(audio.currentTime);
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
            label: `Session #${session.id}`,
          },
        ]}
        actions={
          <>
            {/* No escalation endpoint exists on the backend yet — this stays
                UI-only until one is built. */}
            <Button variant="outline" size="sm">
              <AlertTriangle className="size-4" />
              Escalate
            </Button>

            {session.customer?.id && (
              <Button variant="outline" size="sm" asChild>
                <Link to={`/customers/${session.customer.id}`}>
                  <User className="size-4" />
                  View customer
                </Link>
              </Button>
            )}
          </>
        }
      />

      <div className="p-4 md:p-6 lg:p-8 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4 min-w-0">
          {/* ---------------------------------------------------------------- */}
          {/* Audio Player                                                      */}
          {/* ---------------------------------------------------------------- */}

          <Card>
            <CardContent className="py-4 space-y-2">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <audio
                  ref={audioRef}
                  src={audioReady ? audioSrc : undefined}
                  preload="none"
                  onLoadedMetadata={(e) => setAudioDuration(e.currentTarget.duration || 0)}
                  onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                  onError={() =>
                    setAudioError("Couldn't load this recording — the file may be unavailable.")
                  }
                />

                <Button
                  size="icon"
                  className="rounded-full size-12"
                  onClick={togglePlayback}
                  disabled={!audioSrc}
                >
                  {isPlaying ? <Pause className="size-5" /> : <Play className="size-5" />}
                </Button>

                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{customerName}</div>

                  <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                    <span>
                      {session.started_at_ist ? formatDateTime(session.started_at_ist) : "—"} •{" "}
                      {session.duration_seconds != null
                        ? `${Math.floor(session.duration_seconds / 60)}m ${session.duration_seconds % 60}s`
                        : "—"}
                    </span>

                    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5">
                      <Languages className="size-3" />
                      {session.language || "Hindi"}
                    </span>
                  </div>

                  <div
                    className="mt-2 cursor-pointer"
                    onClick={(e) => {
                      if (!audioSrc) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const ratio = (e.clientX - rect.left) / rect.width;
                      seekTo(ratio);
                    }}
                  >
                    <Progress
                      value={audioDuration ? (currentTime / audioDuration) * 100 : 0}
                      className="h-1.5"
                    />
                  </div>
                </div>

                <span className="text-xs tabular-nums text-muted-foreground">
                  {formatClockTime(Math.floor(currentTime))} /{" "}
                  {formatClockTime(Math.floor(audioDuration || session.duration_seconds || 0))}
                </span>
              </div>

              {!audioSrc && (
                <p className="text-xs text-muted-foreground">
                  No recording is available for this call.
                </p>
              )}

              {audioError && (
                <div className="flex items-center gap-2 text-xs text-destructive">
                  <ShieldAlert className="size-3.5 shrink-0" />
                  <span>{audioError}</span>
                </div>
              )}
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
                  {session.agent?.persona_name || session.agent?.agent_name || "AI agent"} ↔{" "}
                  {customerName}
                </span>
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-3 max-h-[60vh] overflow-y-auto">
              {transcript.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No transcript recorded for this call.
                </p>
              )}

              {transcript.map((t, i) => {
                const isAi = t.who === "ai";

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
                          max-w-[75%]
                          rounded-2xl
                          px-3
                          py-2
                          text-sm
                          ${isAi ? "bg-muted" : "bg-primary text-primary-foreground"}
                        `}
                    >
                      <span>{t.text}</span>

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
                        {customerName
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
          {session.call_summary && (
            <Card className="ai-gradient ai-border">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-1.5 font-display">
                  <Sparkles className="size-4 text-[color:var(--ai)]" />
                  AI summary
                </CardTitle>
              </CardHeader>

              <CardContent className="text-sm">{session.call_summary}</CardContent>
            </Card>
          )}

          {/* Disposition */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-display">Disposition</CardTitle>
            </CardHeader>

            <CardContent className="space-y-2 text-sm">
              <Row k="Status" v={<StatusBadge status={session.status} />} />

              <Row
                k="Outcome"
                v={
                  session.final_intent_code ? (
                    <StatusBadge status={session.final_intent_code} />
                  ) : (
                    "—"
                  )
                }
              />

              <Row k="Language" v={session.language || "—"} />

              <Row
                k="Quality"
                v={session.quality_pct != null ? `${session.quality_pct}%` : "—"}
              />

              <Row
                k="Cost"
                v={
                  typeof session.total_cost === "number"
                    ? `₹${session.total_cost.toFixed(2)}`
                    : "—"
                }
              />
            </CardContent>
          </Card>

          {/* Detected intents (no free-form "tags" field on the backend —
              this is the closest real equivalent, derived from
              intent_history the same way the recordings library page
              derives it). */}
          {intents.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-display">Detected intents</CardTitle>
              </CardHeader>

              <CardContent className="flex flex-wrap gap-1.5">
                {intents.map((tag) => (
                  <span key={tag} className="text-[11px] rounded-full bg-secondary px-2 py-0.5">
                    {tag}
                  </span>
                ))}
              </CardContent>
            </Card>
          )}
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
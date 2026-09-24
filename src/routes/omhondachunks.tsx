import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { PhoneOff, Phone, Mic, Volume2, Loader2 } from "lucide-react";

import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WS_URL } from "@/components/ServiceConnection/serviceconnection";

// ============================================================
// PROTOCOL — must stay in lockstep with voice_bot/consumers.py
// (VoiceChatConsumer). See docstrings there before touching this.
//
// Outgoing (client → server):
//   - raw Int16 PCM16 mono @16kHz binary frames (mic audio, sent
//     continuously — server discards/uses them depending on state)
//   - {"type": "playback_start"}  — we started playing bot audio
//   - {"type": "playback_end"}    — we finished playing bot audio
//
// Incoming (server → client):
//   - binary ArrayBuffer / Blob      → raw PCM16 @24kHz bot audio,
//                                       forwarded straight to the
//                                       AudioWorklet (pcm-processor.js)
//   - {"type": "pcm_start"}          → bot has started streaming audio
//   - {"type": "pcm_end"}            → server done SENDING (not done
//                                       playing — wait for the worklet's
//                                       "ended" message before telling
//                                       the server playback_end)
//   - {"type": "filler"|"ai_response", audio_b64?, audio_url?, back_flag?}
//   - {"type": "transcript", text}
//   - {"type": "interrupt"|"bot_interrupted"}  → barge-in, stop audio now
//   - {"type": "no_speech" | "timeout" | "done" | "error", message?}
// ============================================================

const MIC_SAMPLE_RATE_TARGET = 16000;
const BOT_SAMPLE_RATE = 24000;

type CallStatus = "idle" | "connecting" | "listening" | "speaking" | "ended";

function float32ToInt16(float32: Float32Array): Int16Array {
  const out = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

function downsample(float32: Float32Array, fromRate: number, toRate = MIC_SAMPLE_RATE_TARGET): Float32Array {
  if (fromRate === toRate) return float32;
  const ratio = fromRate / toRate;
  const newLength = Math.floor(float32.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(Math.floor((i + 1) * ratio), float32.length);
    let sum = 0;
    for (let j = start; j < end; j++) sum += float32[j];
    result[i] = sum / (end - start || 1);
  }
  return result;
}

export default function OmHondaChunks() {
  // Standalone temporary test-call page, mounted at /omhondachunks
  // present (e.g. /voice/:callId reusing this same component) it's the
  // phone number to dial, otherwise falls back to consumers.py's
  // no-phone / random-seeded-customer path.
  const { callId } = useParams<{ callId: string }>();

  const [status, setStatus] = useState<CallStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micContextRef = useRef<AudioContext | null>(null);
  const micProcessorRef = useRef<ScriptProcessorNode | null>(null);

  const playCtxRef = useRef<AudioContext | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const waitingAnswerRef = useRef(false);
  const closedRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const sendControl = useCallback((type: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type }));
    }
  }, []);

  // ---------------- bot audio playback (AudioWorklet, 24kHz PCM) ----------------
  const initWorklet = useCallback(async () => {
    if (workletRef.current && playCtxRef.current) return true;
    try {
      const ctx = new AudioContext({ sampleRate: BOT_SAMPLE_RATE });
      if (!ctx.audioWorklet) return false;
      await ctx.audioWorklet.addModule("/pcm-processor.js");
      const node = new AudioWorkletNode(ctx, "pcm-processor");
      node.connect(ctx.destination);
      node.port.onmessage = (e) => {
        if (e.data?.type === "ended") {
          setStatus("listening");
          sendControl("playback_end");
        }
      };
      playCtxRef.current = ctx;
      workletRef.current = node;
      return true;
    } catch (err) {
      console.error("[AudioWorklet] init failed:", err);
      return false;
    }
  }, [sendControl]);

  const stopBotAudio = useCallback(() => {
    if (workletRef.current) {
      try {
        workletRef.current.port.postMessage({ type: "clear" });
      } catch {
        /* noop */
      }
    }
    setStatus("listening");
  }, []);

  const playBase64Pcm = useCallback((b64: string) => {
    // Base64 (filler / ai_response) frames come as MP3, not raw PCM — play
    // them through a plain <audio> element instead of the worklet.
    const audio = new Audio(`data:audio/mpeg;base64,${b64}`);
    audio.play().catch((err) => console.error("[audio] play failed:", err));
    return audio;
  }, []);

  // ---------------- mic capture (continuous, raw PCM16 @16kHz) ----------------
  const startMic = useCallback(async () => {
    if (micProcessorRef.current) return true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        const down = downsample(input, ctx.sampleRate);
        const pcm16 = float32ToInt16(down);
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(pcm16.buffer);
        }
      };

      source.connect(processor);
      processor.connect(ctx.destination);

      micStreamRef.current = stream;
      micContextRef.current = ctx;
      micProcessorRef.current = processor;
      return true;
    } catch (err) {
      console.error("[mic] capture failed:", err);
      setError("Microphone access failed — check browser permissions.");
      return false;
    }
  }, []);

  const stopMic = useCallback(() => {
    micProcessorRef.current?.disconnect();
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micContextRef.current?.close().catch(() => {});
    micProcessorRef.current = null;
    micStreamRef.current = null;
    micContextRef.current = null;
  }, []);

  // ---------------- websocket message handling ----------------
  const handleMessage = useCallback(
    async (event: MessageEvent) => {
      if (event.data instanceof Blob) {
        const buf = await event.data.arrayBuffer();
        workletRef.current?.port.postMessage(buf);
        return;
      }
      if (event.data instanceof ArrayBuffer) {
        workletRef.current?.port.postMessage(event.data);
        return;
      }

      let data: any;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }

      switch (data.type) {
        case "pcm_start":
          setStatus("speaking");
          initWorklet();
          break;
        case "pcm_end":
          if (workletRef.current) {
            workletRef.current.port.postMessage({ type: "end" });
          } else {
            setStatus("listening");
            sendControl("playback_end");
          }
          break;
        case "transcript":
          setTranscript(data.text || "");
          break;
        case "interrupt":
        case "bot_interrupted":
          stopBotAudio();
          waitingAnswerRef.current = false;
          break;
        case "filler":
          if (data.audio_b64) {
            waitingAnswerRef.current = true;
            sendControl("playback_start");
            setStatus("speaking");
            playBase64Pcm(data.audio_b64);
          }
          break;
        case "ai_response":
          setTranscript("");
          waitingAnswerRef.current = false;
          if (data.audio_b64) {
            sendControl("playback_start");
            setStatus("speaking");
            playBase64Pcm(data.audio_b64);
          } else if (data.back_flag === 150 || data.back_flag === "150") {
            setStatus("ended");
          }
          break;
        case "no_speech":
          break;
        case "timeout":
          setStatus("ended");
          break;
        case "error":
          console.error("[WS] server error:", data.message);
          waitingAnswerRef.current = false;
          setStatus("listening");
          sendControl("playback_end");
          break;
        case "done":
          break;
        default:
          break;
      }
    },
    [initWorklet, playBase64Pcm, sendControl, stopBotAudio],
  );

  // ---------------- connect / teardown ----------------
  const endCall = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    stopMic();
    wsRef.current?.close();
    wsRef.current = null;
    if (workletRef.current) {
      workletRef.current.disconnect();
      workletRef.current = null;
    }
    playCtxRef.current?.close().catch(() => {});
    playCtxRef.current = null;
    if (timerRef.current) window.clearInterval(timerRef.current);
    setStatus("ended");
  }, [stopMic]);

  const connectCall = useCallback(() => {
    if (wsRef.current) return; // already connecting/connected
    closedRef.current = false;
    setError(null);
    setSeconds(0);
    setStatus("connecting");

    const phone = callId && callId !== "demo" ? callId : "";
    const url = phone ? `${WS_URL}?phone=${encodeURIComponent(phone)}` : WS_URL;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      startMic();
    };
    ws.onmessage = handleMessage;
    ws.onerror = (e) => {
      console.error("[WS] error:", e);
      setError("Connection to the voice server failed.");
    };
    ws.onclose = () => {
      if (!closedRef.current) setStatus("ended");
    };

    timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
  }, [callId, handleMessage, startMic]);

  // Cleanup only — connection is user-initiated via the Connect button,
  // not started automatically on mount.
  useEffect(() => {
    return () => {
      closedRef.current = true;
      stopMic();
      wsRef.current?.close();
      wsRef.current = null;
      if (workletRef.current) workletRef.current.disconnect();
      playCtxRef.current?.close().catch(() => {});
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [stopMic]);

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  const statusMeta: Record<CallStatus, { label: string; tone: string }> = {
    idle: { label: "NOT CONNECTED", tone: "secondary" },
    connecting: { label: "CONNECTING", tone: "secondary" },
    listening: { label: "LISTENING", tone: "default" },
    speaking: { label: "AGENT SPEAKING", tone: "default" },
    ended: { label: "CALL ENDED", tone: "destructive" },
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)]">
      <PageHeader
        title="Live test call"
        description={callId && callId !== "demo" ? `Dialing ${callId}` : "Random seeded customer (no phone specified)"}
        breadcrumbs={[{ label: "AI Voice Calls" }, { label: "Test call" }]}
        actions={
          <Badge variant={statusMeta[status].tone as any} className="uppercase tracking-wide">
            {mmss} · {statusMeta[status].label}
          </Badge>
        }
      />

      <div className="flex-1 grid place-items-center p-6">
        <div className="w-full max-w-md rounded-xl border bg-card p-6 text-center space-y-6">
          <div className="mx-auto size-20 rounded-full bg-primary/10 grid place-items-center">
            {status === "speaking" ? (
              <Volume2 className="size-9 text-primary animate-pulse" />
            ) : status === "connecting" ? (
              <Loader2 className="size-9 text-primary animate-spin" />
            ) : status === "listening" ? (
              <Mic className="size-9 text-primary" />
            ) : (
              <Phone className="size-9 text-muted-foreground" />
            )}
          </div>

          <div>
            <div className="text-lg font-display font-semibold">
              {customerName || (callId && callId !== "demo" ? callId : "Demo customer")}
            </div>
            <div className="text-sm text-muted-foreground mt-1">Om Honda · AI Voice Agent</div>
          </div>

          <div className="rounded-md border bg-muted/40 px-4 py-3 min-h-16 text-sm text-muted-foreground">
            {transcript || (status === "connecting" ? "Connecting…" : status === "idle" ? "Not connected" : "\u2026")}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex items-center justify-center gap-3">
            {status === "idle" || status === "ended" ? (
              <Button size="lg" className="rounded-full gap-2" onClick={connectCall}>
                <Phone className="size-4" />
                {status === "ended" ? "Call again" : "Connect"}
              </Button>
            ) : (
              <Button
                variant="destructive"
                size="lg"
                className="rounded-full gap-2"
                onClick={endCall}
              >
                <PhoneOff className="size-4" />
                End call
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
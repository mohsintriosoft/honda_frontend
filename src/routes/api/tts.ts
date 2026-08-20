import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) {
          return new Response("LOVABLE_API_KEY not configured", { status: 500 });
        }
        const { text, voice, gender, agent } = (await request.json()) as {
          text: string;
          voice?: string;
          gender?: "female" | "male";
          agent?: string;
        };
        if (!text) return new Response("Missing text", { status: 400 });

        const isMale = gender === "male";
        const chosenVoice = voice ?? (isMale ? "ash" : "coral");
        const agentName = agent ?? (isMale ? "Rohan" : "Aarohi");

        const instructions = isMale
          ? `You are ${agentName}, a polite young MALE customer-care agent (age around 28) at Om Honda Bhopal — a Honda TWO-WHEELER dealership (bikes and scooters only, NEVER cars). Speak natural conversational Hindi with a soft Bhopali / Madhya Pradesh tongue. Voice: clearly masculine, warm, confident, friendly — like a helpful young man from Bhopal. Medium pace, polite, never robotic, never sing-song. Context is always two-wheelers (Activa, Shine, SP 125, Unicorn, Dio, Hornet, CB350).`
          : `You are ${agentName}, a polite young FEMALE customer-care agent (age around 25) at Om Honda Bhopal — a Honda TWO-WHEELER dealership (bikes and scooters only, NEVER cars). Speak natural conversational Hindi with a soft Bhopali / Madhya Pradesh tongue. Voice: clearly feminine, warm, gentle, friendly — like a normal young girl from Bhopal who works in customer service. Medium pace, polite, never robotic, never overly dramatic, no breathy or theatrical tone. Context is always two-wheelers (Activa, Shine, SP 125, Unicorn, Dio, Hornet, CB350).`;

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "openai/gpt-4o-mini-tts",
            input: text,
            voice: chosenVoice,
            response_format: "mp3",
            instructions,
          }),
        });

        if (!upstream.ok) {
          const msg = await upstream.text().catch(() => "");
          return new Response(msg || "TTS failed", { status: upstream.status });
        }

        return new Response(upstream.body, {
          headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
        });
      },
    },
  },
});

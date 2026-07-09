/**
 * POST /api/tts
 * Legacy TTS path: text -> wav audio response. Used when Voice Live is off.
 * Audio is returned as audio/wav so the client can play it directly.
 */
import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { route } from "@/lib/api";
import { sanitizeText, jsonError, audit } from "@/lib/security";

const ALLOWED_VOICES = ["tongtong", "chuichui", "xiaochen", "jam", "kazi", "douji", "luodo"];

interface TtsBody {
  text?: string;
  voice?: string;
  speed?: number;
}

export const POST = route({ scope: "tts", method: "POST" }, async (ctx) => {
  const body = ctx.body as TtsBody;
  const text = sanitizeText(body.text, 1000); // TTS API cap is 1024
  if (!text) return jsonError("Text is required", 400);

  const voice = ALLOWED_VOICES.includes(body.voice || "") ? body.voice! : "tongtong";
  const speed = Math.min(2, Math.max(0.5, Number(body.speed) || 1));

  try {
    const zai = await ZAI.create();
    const response = await zai.audio.tts.create({
      input: text,
      voice: voice as typeof body.voice & string,
      speed,
      response_format: "wav",
      stream: false,
    });
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(new Uint8Array(arrayBuffer));

    void audit({
      userId: ctx.userId,
      action: "tts:generate",
      ip: ctx.ip,
      detail: `len=${text.length} voice=${voice}`,
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const msg = (err as Error)?.message || "TTS failed";
    void audit({ userId: ctx.userId, action: "tts:error", ip: ctx.ip, status: "error", detail: msg });
    return jsonError("TTS synthesis failed: " + msg.slice(0, 120), 502);
  }
});

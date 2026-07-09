/**
 * POST /api/asr
 * Receives base64-encoded audio (webm/wav from the browser MediaRecorder)
 * and returns a transcript using the z-ai-web-dev-sdk ASR capability.
 */
import { NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { route } from "@/lib/api";
import { sanitizeText, jsonError, jsonOk, audit } from "@/lib/security";

interface AsrBody {
  audio?: string; // base64 (without data: prefix) or data URL
  format?: string; // webm | wav | mp3
}

export const POST = route({ scope: "asr", method: "POST" }, async (ctx) => {
  const body = ctx.body as AsrBody;
  if (!body.audio || typeof body.audio !== "string") {
    return jsonError("Missing audio payload", 400);
  }

  // Accept either a raw base64 or a data URL
  let base64 = body.audio;
  const m = /^data:[^;]+;base64,(.+)$/.exec(base64);
  if (m) base64 = m[1];
  // Validate it looks like base64
  if (!/^[A-Za-z0-9+/=]+$/.test(base64) || base64.length < 16) {
    return jsonError("Invalid audio payload", 400);
  }

  try {
    const zai = await ZAI.create();
    // The SDK exposes ASR through audio.transcriptions.create
    const buf = Buffer.from(base64, "base64");
    const result = await (zai as unknown as {
      audio: {
        transcriptions: {
          create: (args: { file: { buffer: Buffer; filename: string }; model?: string }) => Promise<{ text?: string }>;
        };
      };
    }).audio.transcriptions.create({
      file: { buffer: buf, filename: `recording.${body.format || "webm"}` },
    });
    const text = sanitizeText(result?.text || "", 4000);

    void audit({ userId: ctx.userId, action: "asr:transcribe", ip: ctx.ip, detail: `len=${base64.length} out=${text.length}` });

    return jsonOk({ text });
  } catch (err) {
    const msg = (err as Error)?.message || "ASR failed";
    void audit({ userId: ctx.userId, action: "asr:error", ip: ctx.ip, status: "error", detail: msg });
    // Graceful fallback so the UI keeps working even if ASR is unavailable
    return jsonOk({ text: "", warning: "Speech recognition unavailable in this environment.", error: msg.slice(0, 120) });
  }
});

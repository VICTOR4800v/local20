/**
 * /api/voice-live
 * GET  -> returns whether voice-live is the default (read from settings)
 * POST -> toggle default voice-live mode + record usage stats
 */
import { route } from "@/lib/api";
import { sanitizeText, jsonOk, jsonError, encryptValue, decryptValue, audit } from "@/lib/security";
import { db } from "@/lib/db";

interface VLBody {
  enabled?: boolean;
  mode?: "live" | "legacy";
  tokensIn?: number;
  tokensOut?: number;
  durationMs?: number;
}

const KEY = "voiceLiveDefault";

export const GET = route({ scope: "generic" }, async (ctx) => {
  const row = await db.setting.findUnique({
    where: { userId_key: { userId: ctx.userId, key: KEY } },
  });
  let enabled = true; // Voice Live is the new default
  if (row) {
    try {
      enabled = (await decryptValue(row.valueEnc)) === "true";
    } catch {
      enabled = row.valueEnc === "true";
    }
  }
  // stats
  const stats = await db.voiceUsage.groupBy({
    by: ["mode"],
    _count: true,
    where: { createdAt: { gt: new Date(Date.now() - 7 * 86400_000) } },
  });
  return jsonOk({
    enabled,
    stats: stats.map((s) => ({ mode: s.mode, count: s._count })),
  });
});

export const POST = route({ scope: "generic", method: "POST" }, async (ctx) => {
  const body = ctx.body as VLBody;

  if (body.enabled !== undefined) {
    const enc = await encryptValue(body.enabled ? "true" : "false");
    await db.setting.upsert({
      where: { userId_key: { userId: ctx.userId, key: KEY } },
      create: { userId: ctx.userId, key: KEY, valueEnc: enc },
      update: { valueEnc: enc },
    });
    void audit({ userId: ctx.userId, action: "voicelive:set", ip: ctx.ip, detail: String(body.enabled) });
    return jsonOk({ enabled: body.enabled });
  }

  // record usage
  if (body.mode) {
    await db.voiceUsage.create({
      data: {
        mode: sanitizeText(body.mode, 10) as "live" | "legacy",
        tokensIn: Math.max(0, Math.min(1_000_000, Number(body.tokensIn) || 0)),
        tokensOut: Math.max(0, Math.min(1_000_000, Number(body.tokensOut) || 0)),
        durationMs: Math.max(0, Math.min(3_600_000, Number(body.durationMs) || 0)),
      },
    });
    return jsonOk({ recorded: true });
  }

  return jsonError("Nothing to do", 400);
});

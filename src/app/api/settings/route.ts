/**
 * /api/settings
 * GET -> all settings (decrypted) for the operator
 * POST -> upsert setting { key, value }
 *
 * Settings store things like voiceLive default, news topic, calendar provider
 * config, etc. Values are encrypted at rest with AES-256-GCM.
 */
import { route } from "@/lib/api";
import { sanitizeText, jsonOk, jsonError, encryptValue, decryptValue, audit } from "@/lib/security";
import { db } from "@/lib/db";

interface SettingsBody {
  key?: string;
  value?: string;
}

export const GET = route({ scope: "generic" }, async (ctx) => {
  const rows = await db.setting.findMany({ where: { userId: ctx.userId } });
  const out: Record<string, string> = {};
  for (const r of rows) {
    try {
      out[r.key] = await decryptValue(r.valueEnc);
    } catch {
      // value might be plain JSON for non-sensitive dev defaults
      out[r.key] = r.valueEnc;
    }
  }
  return jsonOk({ settings: out });
});

export const POST = route({ scope: "generic", method: "POST" }, async (ctx) => {
  const body = ctx.body as SettingsBody;
  const key = sanitizeText(body.key, 60);
  if (!key) return jsonError("key required", 400);
  const value = sanitizeText(body.value, 4000);
  const enc = await encryptValue(value);

  await db.setting.upsert({
    where: { userId_key: { userId: ctx.userId, key } },
    create: { userId: ctx.userId, key, valueEnc: enc },
    update: { valueEnc: enc },
  });

  void audit({ userId: ctx.userId, action: "settings:set", ip: ctx.ip, detail: key });

  return jsonOk({ ok: true, key });
});

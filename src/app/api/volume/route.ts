/**
 * POST /api/volume
 * System volume control bridge.
 *
 * In the real Windows JARVIS build this would shell out to a PowerShell
 * one-liner (nircmd / Set-AudioDevice). In the web sandbox we:
 *  - persist the desired level + mute state in the DB (encrypted settings)
 *  - return the command the Operator should run on the host
 *  - the client also drives a Web Audio gain node so the local audio
 *    feedback actually changes volume in-browser.
 *
 * Actions: up | down | mute | unmute | set
 */
import { route } from "@/lib/api";
import { sanitizeText, clampNumber, jsonOk, jsonError, encryptValue } from "@/lib/security";
import { db } from "@/lib/db";

interface VolumeBody {
  action?: "up" | "down" | "mute" | "unmute" | "set";
  level?: number; // 0-100
}

function buildWindowsCommand(level: number, muted: boolean): string {
  if (muted) return `powershell -Command "Set-AudioDevice -MuteState On"`;
  return `powershell -Command "Set-AudioDevice -Volume ${level}"`;
}

export const POST = route({ scope: "generic", method: "POST" }, async (ctx) => {
  const body = ctx.body as VolumeBody;
  const action = sanitizeText(body.action, 20) as VolumeBody["action"] || "set";

  // Read current persisted level
  let setting = await db.setting.findUnique({
    where: { userId_key: { userId: ctx.userId, key: "volume" } },
  });
  let level = 50;
  let muted = false;
  if (setting) {
    try {
      const parsed = JSON.parse(setting.valueEnc);
      level = typeof parsed.level === "number" ? parsed.level : 50;
      muted = !!parsed.muted;
    } catch {
      // valueEnc is encrypted in real use; fall back to defaults
    }
  }

  switch (action) {
    case "up":
      level = Math.min(100, level + 10);
      muted = false;
      break;
    case "down":
      level = Math.max(0, level - 10);
      muted = false;
      break;
    case "mute":
      muted = true;
      break;
    case "unmute":
      muted = false;
      break;
    case "set":
      level = clampNumber(body.level, 0, 100, level);
      muted = false;
      break;
    default:
      return jsonError("Invalid action", 400);
  }

  const value = JSON.stringify({ level, muted, updatedAt: Date.now() });
  const enc = await encryptValue(value);
  await db.setting.upsert({
    where: { userId_key: { userId: ctx.userId, key: "volume" } },
    create: { userId: ctx.userId, key: "volume", valueEnc: enc },
    update: { valueEnc: enc },
  });

  const hostCommand = buildWindowsCommand(level, muted);

  return jsonOk({
    level,
    muted,
    hostCommand,
    note: muted
      ? "Host muted. Run the command on Windows to apply."
      : `Host volume set to ${level}%. Run the command on Windows to apply.`,
  });
});

export const GET = route({ scope: "generic" }, async (ctx) => {
  const setting = await db.setting.findUnique({
    where: { userId_key: { userId: ctx.userId, key: "volume" } },
  });
  let level = 50;
  let muted = false;
  if (setting) {
    try {
      const parsed = JSON.parse(setting.valueEnc);
      level = typeof parsed.level === "number" ? parsed.level : 50;
      muted = !!parsed.muted;
    } catch {}
  }
  return jsonOk({ level, muted, hostCommand: buildWindowsCommand(level, muted) });
});

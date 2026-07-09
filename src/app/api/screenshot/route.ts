/**
 * POST /api/screenshot
 *
 * The actual screen capture happens client-side via getDisplayMedia (the
 * browser prompt). This endpoint receives the captured PNG (base64 data
 * URL or multipart blob), validates it, saves it to /home/z/my-project/download
 * (a persisted local folder), logs it, and returns the saved path + URL.
 *
 * Security:
 *  - max 1 screenshot per 2 seconds (rate limit handled by route scope)
 *  - image size cap 8 MB
 *  - filename sanitised, no path traversal
 *  - only PNG/JPEG accepted (magic byte check)
 */
import { NextRequest } from "next/server";
import { route } from "@/lib/api";
import { sanitizeText, jsonOk, jsonError, audit } from "@/lib/security";
import { db } from "@/lib/db";
import fs from "fs/promises";
import path from "path";

const SAVE_DIR = "/home/z/my-project/download";
const MAX_BYTES = 8 * 1024 * 1024;

interface ShotBody {
  dataUrl?: string;
  filename?: string;
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const JPG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);

function safeFilename(name: string): string {
  const base = sanitizeText(name, 80).replace(/[^a-zA-Z0-9-_]/g, "_");
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `jarvis-shot-${ts}-${base.slice(0, 40) || "screen"}.png`;
}

export const POST = route({ scope: "generic", method: "POST" }, async (ctx) => {
  const body = ctx.body as ShotBody;
  if (!body.dataUrl || typeof body.dataUrl !== "string") {
    return jsonError("Missing screenshot data", 400);
  }

  // dataUrl format: data:image/png;base64,XXXX
  const m = /^data:image\/(png|jpeg|jpg);base64,([A-Za-z0-9+/=]+)$/.exec(body.dataUrl);
  if (!m) return jsonError("Invalid image data URL", 400);

  const buf = Buffer.from(m[2], "base64");
  if (buf.length === 0 || buf.length > MAX_BYTES) {
    return jsonError("Image too large or empty", 400);
  }

  // Magic-byte validation (defence in depth, even though regex checked mime)
  const isPng = buf.subarray(0, 4).equals(PNG_MAGIC);
  const isJpg = buf.subarray(0, 3).equals(JPG_MAGIC);
  if (!isPng && !isJpg) return jsonError("Unrecognised image format", 400);

  await fs.mkdir(SAVE_DIR, { recursive: true });
  const filename = safeFilename(body.filename || "screen");
  const fullPath = path.join(SAVE_DIR, filename);
  await fs.writeFile(fullPath, buf);

  await db.screenshotLog.create({
    data: {
      userId: ctx.userId,
      filename,
      path: fullPath,
      size: buf.length,
    },
  });

  void audit({
    userId: ctx.userId,
    action: "screenshot:saved",
    ip: ctx.ip,
    detail: `${filename} (${buf.length}b)`,
  });

  return jsonOk({
    filename,
    path: fullPath,
    size: buf.length,
    url: `/download/${filename}`,
    savedAt: new Date().toISOString(),
  });
});

export const GET = route({ scope: "generic" }, async (ctx) => {
  const recent = await db.screenshotLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 12,
  });
  return jsonOk({ items: recent });
});

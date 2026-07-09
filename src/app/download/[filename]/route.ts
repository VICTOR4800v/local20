/**
 * GET /download/[filename]
 * Serves screenshot files saved in /home/z/my-project/download.
 * Security:
 *  - filename validated (no path separators, no .. )
 *  - only the download directory is served
 *  - content-type sniffed from extension
 */
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { sanitizeText } from "@/lib/security";

const SAVE_DIR = "/home/z/my-project/download";

const EXT_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;
  const safe = sanitizeText(filename, 120).replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!safe || safe.includes("..") || safe.includes("/")) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }
  const fullPath = path.join(SAVE_DIR, safe);
  // ensure resolved path still inside SAVE_DIR
  if (!fullPath.startsWith(SAVE_DIR + path.sep)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const buf = await fs.readFile(fullPath);
    const ext = path.extname(safe).slice(1).toLowerCase();
    const mime = EXT_MIME[ext] || "application/octet-stream";
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Content-Length": String(buf.length),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

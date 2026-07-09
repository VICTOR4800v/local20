/**
 * /api/notes
 * GET  -> list notes (pinned first, then by updatedAt)
 * POST -> { action: "create" | "update" | "delete" | "pin", ... }
 */
import { route } from "@/lib/api";
import { sanitizeText, jsonOk, jsonError, audit } from "@/lib/security";
import { db } from "@/lib/db";

interface NoteBody {
  action?: "create" | "update" | "delete" | "pin";
  id?: string;
  title?: string;
  body?: string;
  color?: string;
  pinned?: boolean;
}

const COLORS = ["cyan", "amber", "emerald", "violet", "rose"];

export const GET = route({ scope: "generic" }, async (ctx) => {
  const notes = await db.note.findMany({
    where: { userId: ctx.userId },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    take: 50,
  });
  return jsonOk({
    notes: notes.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      pinned: n.pinned,
      color: n.color,
      updatedAt: n.updatedAt.toISOString(),
      createdAt: n.createdAt.toISOString(),
    })),
  });
});

export const POST = route({ scope: "generic", method: "POST" }, async (ctx) => {
  const body = ctx.body as NoteBody;
  const action = sanitizeText(body.action, 20) as NoteBody["action"] || "create";

  if (action === "create") {
    const title = sanitizeText(body.title, 120) || "Untitled";
    const noteBody = sanitizeText(body.body, 4000);
    const color = COLORS.includes(body.color || "") ? body.color! : "cyan";
    const n = await db.note.create({
      data: { userId: ctx.userId, title, body: noteBody, color },
    });
    void audit({ userId: ctx.userId, action: "note:create", ip: ctx.ip, detail: title });
    return jsonOk({ note: n });
  }

  if (action === "update") {
    const id = sanitizeText(body.id, 40);
    if (!id) return jsonError("id required", 400);
    const n = await db.note.updateMany({
      where: { id },
      data: {
        title: body.title !== undefined ? sanitizeText(body.title, 120) : undefined,
        body: body.body !== undefined ? sanitizeText(body.body, 4000) : undefined,
        color: body.color && COLORS.includes(body.color) ? body.color : undefined,
      },
    });
    return jsonOk({ updated: n.count });
  }

  if (action === "pin") {
    const id = sanitizeText(body.id, 40);
    if (!id) return jsonError("id required", 400);
    const existing = await db.note.findFirst({ where: { id, userId: ctx.userId } });
    if (!existing) return jsonError("Not found", 404);
    const n = await db.note.update({ where: { id }, data: { pinned: !existing.pinned } });
    return jsonOk({ pinned: n.pinned });
  }

  if (action === "delete") {
    const id = sanitizeText(body.id, 40);
    if (!id) return jsonError("id required", 400);
    await db.note.deleteMany({ where: { id, userId: ctx.userId } });
    void audit({ userId: ctx.userId, action: "note:delete", ip: ctx.ip, detail: id });
    return jsonOk({ deleted: true });
  }

  return jsonError("Unknown action", 400);
});

/**
 * /api/schedules
 * GET -> list schedules
 * POST -> { action: "create" | "complete" | "delete", ... }
 */
import { route } from "@/lib/api";
import { sanitizeText, isValidCron, jsonOk, jsonError, audit } from "@/lib/security";
import { db } from "@/lib/db";

interface SchedBody {
  action?: "create" | "complete" | "delete";
  id?: string;
  title?: string;
  content?: string;
  cron?: string;
  at?: string; // ISO one-shot
}

export const GET = route({ scope: "generic" }, async (ctx) => {
  const schedules = await db.schedule.findMany({
    where: { userId: ctx.userId },
    orderBy: { createdAt: "asc" },
  });
  return jsonOk({
    schedules: schedules.map((s) => ({
      id: s.id,
      title: s.title,
      content: s.content,
      cron: s.cron,
      at: s.at?.toISOString(),
      done: s.done,
      createdAt: s.createdAt.toISOString(),
    })),
  });
});

export const POST = route({ scope: "generic", method: "POST" }, async (ctx) => {
  const body = ctx.body as SchedBody;
  const action = sanitizeText(body.action, 20) as SchedBody["action"] || "create";

  if (action === "create") {
    const title = sanitizeText(body.title, 120);
    if (!title) return jsonError("Title required", 400);
    const cron = body.cron ? sanitizeText(body.cron, 60) : null;
    if (cron && !isValidCron(cron)) return jsonError("Invalid cron expression", 400);
    const at = body.at ? new Date(body.at) : null;
    if (body.at && isNaN(at!.getTime())) return jsonError("Invalid 'at' date", 400);

    const s = await db.schedule.create({
      data: {
        userId: ctx.userId,
        title,
        content: sanitizeText(body.content, 1000),
        cron,
        at,
      },
    });
    void audit({ userId: ctx.userId, action: "schedule:create", ip: ctx.ip, detail: title });
    return jsonOk({ schedule: s });
  }

  if (action === "complete") {
    const id = sanitizeText(body.id, 40);
    if (!id) return jsonError("id required", 400);
    const s = await db.schedule.updateMany({
      where: { id, userId: ctx.userId },
      data: { done: true },
    });
    return jsonOk({ updated: s.count });
  }

  if (action === "delete") {
    const id = sanitizeText(body.id, 40);
    if (!id) return jsonError("id required", 400);
    await db.schedule.deleteMany({ where: { id, userId: ctx.userId } });
    void audit({ userId: ctx.userId, action: "schedule:delete", ip: ctx.ip, detail: id });
    return jsonOk({ deleted: true });
  }

  return jsonError("Unknown action", 400);
});

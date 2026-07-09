/**
 * /api/habits
 * GET -> list habits for operator
 * POST -> { action: "create" | "complete" | "delete" | "update", ... }
 */
import { route } from "@/lib/api";
import { sanitizeText, jsonOk, jsonError, audit } from "@/lib/security";
import { db } from "@/lib/db";

interface HabitBody {
  action?: "create" | "complete" | "delete" | "update";
  id?: string;
  title?: string;
  description?: string;
  cadence?: string;
  time?: string;
}

export const GET = route({ scope: "generic" }, async (ctx) => {
  const habits = await db.habit.findMany({
    where: { userId: ctx.userId },
    orderBy: { createdAt: "asc" },
  });
  return jsonOk({
    habits: habits.map((h) => ({
      id: h.id,
      title: h.title,
      description: h.description,
      cadence: h.cadence,
      time: h.time,
      streak: h.streak,
      completed: h.completed,
      lastDoneAt: h.lastDoneAt?.toISOString(),
    })),
  });
});

export const POST = route({ scope: "generic", method: "POST" }, async (ctx) => {
  const body = ctx.body as HabitBody;
  const action = sanitizeText(body.action, 20) as HabitBody["action"] || "create";

  if (action === "create") {
    const title = sanitizeText(body.title, 120);
    if (!title) return jsonError("Title required", 400);
    const h = await db.habit.create({
      data: {
        userId: ctx.userId,
        title,
        description: sanitizeText(body.description, 500),
        cadence: sanitizeText(body.cadence, 20) || "daily",
        time: sanitizeText(body.time, 8),
      },
    });
    void audit({ userId: ctx.userId, action: "habit:create", ip: ctx.ip, detail: title });
    return jsonOk({ habit: h });
  }

  if (action === "complete") {
    const id = sanitizeText(body.id, 40);
    if (!id) return jsonError("id required", 400);
    const existing = await db.habit.findFirst({ where: { id, userId: ctx.userId } });
    if (!existing) return jsonError("Not found", 404);
    const completed = !existing.completed;
    const streak = completed ? existing.streak + 1 : Math.max(0, existing.streak - 1);
    const h = await db.habit.update({
      where: { id },
      data: {
        completed,
        streak,
        lastDoneAt: completed ? new Date() : existing.lastDoneAt,
      },
    });
    void audit({ userId: ctx.userId, action: "habit:toggle", ip: ctx.ip, detail: `${existing.title}=${completed}` });
    return jsonOk({ habit: h });
  }

  if (action === "delete") {
    const id = sanitizeText(body.id, 40);
    if (!id) return jsonError("id required", 400);
    await db.habit.deleteMany({ where: { id, userId: ctx.userId } });
    void audit({ userId: ctx.userId, action: "habit:delete", ip: ctx.ip, detail: id });
    return jsonOk({ deleted: true });
  }

  if (action === "update") {
    const id = sanitizeText(body.id, 40);
    if (!id) return jsonError("id required", 400);
    const h = await db.habit.update({
      where: { id },
      data: {
        title: body.title ? sanitizeText(body.title, 120) : undefined,
        description: body.description !== undefined ? sanitizeText(body.description, 500) : undefined,
        cadence: body.cadence ? sanitizeText(body.cadence, 20) : undefined,
        time: body.time !== undefined ? sanitizeText(body.time, 8) : undefined,
      },
    });
    return jsonOk({ habit: h });
  }

  return jsonError("Unknown action", 400);
});

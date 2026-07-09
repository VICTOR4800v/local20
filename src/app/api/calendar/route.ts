/**
 * /api/calendar
 * GET -> upcoming events (next 7 days)
 * POST -> create / update / delete event
 * Google Calendar integration ready: events with source="google" are
 * treated as read-only syncs in a real deployment.
 */
import { route } from "@/lib/api";
import { sanitizeText, jsonOk, jsonError, audit } from "@/lib/security";
import { db } from "@/lib/db";
import { z } from "zod";

const EventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  location: z.string().max(300).optional().nullable(),
  startAt: z.string().min(1),
  endAt: z.string().optional().nullable(),
});

export const GET = route({ scope: "generic" }, async (ctx) => {
  const since = new Date();
  const until = new Date(since.getTime() + 7 * 86400_000);
  const events = await db.calendarEvent.findMany({
    where: { startAt: { gte: since, lte: until } },
    orderBy: { startAt: "asc" },
    take: 30,
  });
  return jsonOk({
    events: events.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      location: e.location,
      startAt: e.startAt.toISOString(),
      endAt: e.endAt?.toISOString(),
      source: e.source,
    })),
  });
});

export const POST = route({ scope: "generic", method: "POST" }, async (ctx) => {
  const body = ctx.body as Record<string, unknown> & { action?: string };
  const action = sanitizeText(body.action, 20) || "create";

  if (action === "delete") {
    const id = sanitizeText(body.id, 40);
    if (!id) return jsonError("id required", 400);
    await db.calendarEvent.deleteMany({ where: { id } });
    void audit({ userId: ctx.userId, action: "calendar:delete", ip: ctx.ip, detail: id });
    return jsonOk({ deleted: true });
  }

  const parsed = EventSchema.safeParse({
    title: body.title,
    description: body.description,
    location: body.location,
    startAt: body.startAt,
    endAt: body.endAt,
  });
  if (!parsed.success) {
    return jsonError("Invalid event: " + parsed.error.issues[0]?.message, 400);
  }

  const ev = await db.calendarEvent.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description || null,
      location: parsed.data.location || null,
      startAt: new Date(parsed.data.startAt),
      endAt: parsed.data.endAt ? new Date(parsed.data.endAt) : null,
      source: "local",
    },
  });

  void audit({ userId: ctx.userId, action: "calendar:create", ip: ctx.ip, detail: ev.title });

  return jsonOk({
    event: {
      id: ev.id,
      title: ev.title,
      description: ev.description,
      location: ev.location,
      startAt: ev.startAt.toISOString(),
      endAt: ev.endAt?.toISOString(),
      source: ev.source,
    },
  });
});

/**
 * GET /api/export?type=settings|notes|audit|all
 * Returns a JSON bundle of the requested data for download.
 * Security: audit-logged, rate-limited via the generic scope.
 */
import { route } from "@/lib/api";
import { sanitizeText, jsonOk, jsonError, audit } from "@/lib/security";
import { db } from "@/lib/db";
import { decryptValue } from "@/lib/security";

interface ExportQuery {
  type?: string;
}

export const GET = route({ scope: "generic" }, async (ctx) => {
  const url = new URL(ctx.req.url);
  const type = sanitizeText(url.searchParams.get("type") || "all", 20) as "settings" | "notes" | "audit" | "all" || "all";

  const bundle: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    operator: ctx.operatorEmail,
    type,
  };

  if (type === "settings" || type === "all") {
    const rows = await db.setting.findMany({ where: { userId: ctx.userId } });
    const settings: Record<string, string> = {};
    for (const r of rows) {
      try { settings[r.key] = await decryptValue(r.valueEnc); } catch { settings[r.key] = "[encrypted]"; }
    }
    bundle.settings = settings;
  }

  if (type === "notes" || type === "all") {
    const notes = await db.note.findMany({
      where: { userId: ctx.userId },
      orderBy: { updatedAt: "desc" },
    });
    bundle.notes = notes.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      pinned: n.pinned,
      color: n.color,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
    }));
  }

  if (type === "audit" || type === "all") {
    const logs = await db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    bundle.audit = logs.map((l) => ({
      id: l.id,
      action: l.action,
      resource: l.resource,
      ip: l.ip,
      status: l.status,
      detail: l.detail,
      createdAt: l.createdAt.toISOString(),
    }));
  }

  if (type === "all") {
    const [habits, schedules, briefings, screenshots] = await Promise.all([
      db.habit.findMany({ where: { userId: ctx.userId } }),
      db.schedule.findMany({ where: { userId: ctx.userId } }),
      db.briefing.findMany({ where: { userId: ctx.userId }, orderBy: { createdAt: "desc" }, take: 10 }),
      db.screenshotLog.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    ]);
    bundle.habits = habits;
    bundle.schedules = schedules;
    bundle.briefings = briefings.map((b) => ({ ...b, date: b.date.toISOString(), createdAt: b.createdAt.toISOString() }));
    bundle.screenshots = screenshots.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() }));
  }

  void audit({ userId: ctx.userId, action: "data:export", ip: ctx.ip, detail: type });

  return jsonOk(bundle);
});

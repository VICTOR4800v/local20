/**
 * GET /api/audit
 * Returns recent audit log entries for the security panel.
 * Supports ?limit=N (max 100, default 50).
 */
import { NextRequest } from "next/server";
import { route } from "@/lib/api";
import { clampNumber, jsonOk } from "@/lib/security";
import { db } from "@/lib/db";

export const GET = route({ scope: "generic" }, async (ctx) => {
  const url = new URL(ctx.req.url);
  const limit = clampNumber(url.searchParams.get("limit"), 10, 100, 50);
  const logs = await db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  // Aggregate action counts for the summary
  const agg = await db.auditLog.groupBy({
    by: ["action"],
    _count: true,
    where: { createdAt: { gt: new Date(Date.now() - 24 * 3600_000) } },
  });

  const denied = await db.auditLog.count({
    where: { status: "denied", createdAt: { gt: new Date(Date.now() - 24 * 3600_000) } },
  });
  const errors = await db.auditLog.count({
    where: { status: "error", createdAt: { gt: new Date(Date.now() - 24 * 3600_000) } },
  });
  const total24h = await db.auditLog.count({
    where: { createdAt: { gt: new Date(Date.now() - 24 * 3600_000) } },
  });

  return jsonOk({
    logs: logs.map((l) => ({
      id: l.id,
      action: l.action,
      resource: l.resource,
      ip: l.ip,
      status: l.status,
      detail: l.detail,
      createdAt: l.createdAt.toISOString(),
    })),
    summary: {
      total24h,
      denied,
      errors,
      topActions: agg.slice(0, 8).map((a) => ({ action: a.action, count: a._count })),
    },
  });
});

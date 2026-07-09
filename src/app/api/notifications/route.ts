/**
 * GET /api/notifications
 * Aggregates a live event feed for the Alerts Center:
 *  - System alerts: derived from current metric thresholds (CPU/GPU temp,
 *    high load) + low battery.
 *  - Security alerts: recent denied/error audit events.
 *  - Calendar reminders: events starting within the next 60 minutes.
 *  - Email: unread count as a soft reminder.
 *
 * Each notification has: id, severity (info|warn|critical), category
 * (system|security|calendar|email), title, detail, ts, icon hint.
 */
import { route } from "@/lib/api";
import { jsonOk } from "@/lib/security";
import { db } from "@/lib/db";

interface Notification {
  id: string;
  severity: "info" | "warn" | "critical";
  category: "system" | "security" | "calendar" | "email";
  title: string;
  detail: string;
  ts: string;
}

// Simulated current sensor snapshot (mirrors /api/system drift logic).
let drift = 0;
function readSensors() {
  drift += 0.05;
  return {
    cpuTemp: 48 + Math.round(Math.sin(drift) * 4 + Math.random() * 2),
    gpuTemp: 62 + Math.round(Math.cos(drift * 0.7) * 6 + Math.random() * 3),
    cpuLoad: Math.max(2, Math.min(98, Math.round(20 + Math.sin(drift * 1.3) * 15 + Math.random() * 8))),
    memLoad: Math.max(20, Math.min(95, Math.round(55 + Math.cos(drift * 0.5) * 10 + Math.random() * 5))),
    battery: Math.max(40, Math.min(100, Math.round(82 + Math.sin(drift * 0.3) * 6))),
    charging: Math.sin(drift * 0.2) > 0.5,
  };
}

export const GET = route({ scope: "generic" }, async (ctx) => {
  const notes: Notification[] = [];
  const s = readSensors();

  // System alerts
  if (s.cpuTemp >= 85) {
    notes.push({ id: "sys-cpu-crit", severity: "critical", category: "system", title: "CPU temperature critical", detail: `CPU at ${s.cpuTemp}°C — threshold 85°C exceeded. Throttle or check cooling.`, ts: new Date().toISOString() });
  } else if (s.cpuTemp >= 70) {
    notes.push({ id: "sys-cpu-warn", severity: "warn", category: "system", title: "CPU temperature elevated", detail: `CPU at ${s.cpuTemp}°C. Monitoring.`, ts: new Date().toISOString() });
  }
  if (s.gpuTemp >= 90) {
    notes.push({ id: "sys-gpu-crit", severity: "critical", category: "system", title: "GPU temperature critical", detail: `GPU at ${s.gpuTemp}°C — threshold 90°C exceeded.`, ts: new Date().toISOString() });
  } else if (s.gpuTemp >= 75) {
    notes.push({ id: "sys-gpu-warn", severity: "warn", category: "system", title: "GPU temperature elevated", detail: `GPU at ${s.gpuTemp}°C.`, ts: new Date().toISOString() });
  }
  if (s.cpuLoad >= 95) {
    notes.push({ id: "sys-load-crit", severity: "critical", category: "system", title: "CPU load saturated", detail: `CPU load at ${s.cpuLoad}%.`, ts: new Date().toISOString() });
  } else if (s.cpuLoad >= 80) {
    notes.push({ id: "sys-load-warn", severity: "warn", category: "system", title: "CPU load high", detail: `CPU load at ${s.cpuLoad}%.`, ts: new Date().toISOString() });
  }
  if (!s.charging && s.battery < 50) {
    notes.push({ id: "sys-batt-warn", severity: "warn", category: "system", title: "Battery low", detail: `Battery at ${s.battery}%. Connect power source.`, ts: new Date().toISOString() });
  }

  // Security alerts (denied/error in last hour)
  const recentSec = await db.auditLog.findMany({
    where: {
      status: { in: ["denied", "error"] },
      createdAt: { gt: new Date(Date.now() - 60 * 60_000) },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  for (const a of recentSec) {
    notes.push({
      id: `sec-${a.id}`,
      severity: a.status === "denied" ? "warn" : "critical",
      category: "security",
      title: a.status === "denied" ? "Request denied" : "Request error",
      detail: `${a.action}${a.detail ? ` — ${a.detail}` : ""}${a.ip ? ` (from ${a.ip})` : ""}`,
      ts: a.createdAt.toISOString(),
    });
  }

  // Calendar reminders (events in the next 60 min)
  const now = new Date();
  const soon = new Date(now.getTime() + 60 * 60_000);
  const upcoming = await db.calendarEvent.findMany({
    where: { startAt: { gte: now, lte: soon } },
    orderBy: { startAt: "asc" },
    take: 5,
  });
  for (const e of upcoming) {
    const minsAway = Math.round((e.startAt.getTime() - now.getTime()) / 60000);
    notes.push({
      id: `cal-${e.id}`,
      severity: minsAway <= 15 ? "warn" : "info",
      category: "calendar",
      title: `Upcoming: ${e.title}`,
      detail: `Starts in ${minsAway} min${e.location ? ` · ${e.location}` : ""}`,
      ts: e.startAt.toISOString(),
    });
  }

  // Email unread reminder
  const unread = await db.emailMessage.count({ where: { read: false } });
  if (unread > 0) {
    notes.push({
      id: "email-unread",
      severity: unread > 5 ? "warn" : "info",
      category: "email",
      title: `${unread} unread email${unread === 1 ? "" : "s"}`,
      detail: unread > 5 ? "Inbox requires triage." : "Inbox has unread messages.",
      ts: new Date().toISOString(),
    });
  }

  // Sort: critical first, then warn, then info; within each by ts desc
  const order = { critical: 0, warn: 1, info: 2 };
  notes.sort((a, b) => order[a.severity] - order[b.severity] || new Date(b.ts).getTime() - new Date(a.ts).getTime());

  return jsonOk({
    notifications: notes,
    counts: {
      total: notes.length,
      critical: notes.filter((n) => n.severity === "critical").length,
      warn: notes.filter((n) => n.severity === "warn").length,
      info: notes.filter((n) => n.severity === "info").length,
    },
  });
});

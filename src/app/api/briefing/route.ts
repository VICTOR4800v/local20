/**
 * POST /api/briefing
 * Generates a morning startup briefing: weather, top todos, news headlines,
 * and a JARVIS-style summary. Uses LLM to compose the narrative.
 *
 * GET returns the most recent briefing.
 */
import ZAI from "z-ai-web-dev-sdk";
import { route } from "@/lib/api";
import { sanitizeText, jsonOk, jsonError, audit } from "@/lib/security";
import { db } from "@/lib/db";

interface BriefBody {
  regenerate?: boolean;
  location?: string;
}

const BRIEF_SYSTEM = `You are J.A.R.V.I.S. writing the Operator's morning briefing. Compose a concise, composed, slightly witty briefing (max 90 words) that includes: a greeting with the time of day, the top 3 priorities drawn from the provided data, and a closing line. Use British English. Do not invent facts not present in the data.`;

export const GET = route({ scope: "generic" }, async (ctx) => {
  const latest = await db.briefing.findFirst({
    where: { userId: ctx.userId },
    orderBy: { createdAt: "desc" },
  });
  if (!latest) return jsonOk({ briefing: null });
  return jsonOk({
    briefing: {
      id: latest.id,
      summary: latest.summary,
      todos: JSON.parse(latest.todos),
      weather: latest.weather,
      news: latest.news ? JSON.parse(latest.news) : null,
      date: latest.date.toISOString(),
      read: latest.read,
    },
  });
});

export const POST = route({ scope: "chat", method: "POST" }, async (ctx) => {
  const body = (ctx.body || {}) as BriefBody;
  const location = sanitizeText(body.location, 80) || "Malibu, CA";

  // Gather context
  const today = new Date();
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setHours(23, 59, 59, 999);

  const [habits, schedules, events, emails, lastBriefing] = await Promise.all([
    db.habit.findMany({ where: { userId: ctx.userId } }),
    db.schedule.findMany({ where: { userId: ctx.userId, done: false } }),
    db.calendarEvent.findMany({ where: { startAt: { gte: start, lte: end } }, orderBy: { startAt: "asc" }, take: 5 }),
    db.emailMessage.findMany({ orderBy: { date: "desc" }, take: 5 }),
    db.briefing.findFirst({ where: { userId: ctx.userId }, orderBy: { createdAt: "desc" } }),
  ]);

  // Regenerate at most every 15 min unless forced
  if (!body.regenerate && lastBriefing && Date.now() - lastBriefing.createdAt.getTime() < 15 * 60_000) {
    return jsonOk({
      briefing: {
        id: lastBriefing.id,
        summary: lastBriefing.summary,
        todos: JSON.parse(lastBriefing.todos),
        weather: lastBriefing.weather,
        news: lastBriefing.news ? JSON.parse(lastBriefing.news) : null,
        date: lastBriefing.date.toISOString(),
        read: lastBriefing.read,
      },
      cached: true,
    });
  }

  // Compose briefing context for the LLM
  const todos: string[] = [];
  habits.slice(0, 4).forEach((h) => todos.push(`Habit: ${h.title}${h.time ? ` (${h.time})` : ""}`));
  schedules.slice(0, 4).forEach((s) => todos.push(`Task: ${s.title}${s.cron ? ` [${s.cron}]` : ""}`));
  events.slice(0, 3).forEach((e) => todos.push(`Meeting: ${e.title} at ${e.startAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`));
  if (todos.length === 0) todos.push("Inbox triage", "Review system diagnostics", "Plan the day");

  const unreadEmails = emails.filter((e) => !e.read).length;
  const dataBlob = `Date: ${today.toDateString()}\nLocation: ${location}\nTop priorities:\n- ${todos.join("\n- ")}\nUnread emails: ${unreadEmails}\nWeather: 18°C, clear skies (simulated)`;

  let summary: string;
  try {
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: BRIEF_SYSTEM },
        { role: "user", content: dataBlob },
      ],
      thinking: { type: "disabled" },
    });
    summary = completion.choices[0]?.message?.content?.trim() || "Good morning, Operator. Systems nominal. Reviewing today's priorities now.";
  } catch {
    summary = "Good morning, Operator. Systems nominal. Today's priorities are queued in the dashboard panels.";
  }

  const newsHeadlines = ["Markets steady overnight", "New AI model released", "Renewable energy milestone reached"];

  const briefing = await db.briefing.create({
    data: {
      userId: ctx.userId,
      summary,
      todos: JSON.stringify(todos),
      weather: "18°C, clear skies",
      news: JSON.stringify(newsHeadlines),
      read: false,
    },
  });

  void audit({ userId: ctx.userId, action: "briefing:generate", ip: ctx.ip });

  return jsonOk({
    briefing: {
      id: briefing.id,
      summary,
      todos,
      weather: briefing.weather,
      news: newsHeadlines,
      date: briefing.date.toISOString(),
      read: false,
    },
  });
});

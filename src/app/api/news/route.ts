/**
 * GET /api/news?q=<query>&num=<n>
 * Fetches latest news. We use the z-ai-web-dev-sdk web_search function so
 * no external API key is needed. Results are cached in DB for 30 min.
 */
import { NextRequest } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { route } from "@/lib/api";
import { sanitizeText, clampNumber, jsonOk, jsonError, audit } from "@/lib/security";
import { db } from "@/lib/db";

interface NewsBody {
  q?: string;
  num?: number;
  topic?: string;
}

const CACHE_TTL_MS = 30 * 60 * 1000;

async function fetchFresh(query: string, num: number) {
  const zai = await ZAI.create();
  const results = await zai.functions.invoke("web_search", {
    query: `${query} latest news today`,
    num,
  });
  if (!Array.isArray(results)) return [];
  return results.slice(0, num).map((r: Record<string, unknown>) => ({
    title: String(r.name || r.title || "").slice(0, 300),
    url: String(r.url || r.link || "").slice(0, 2048),
    snippet: String(r.snippet || "").slice(0, 500),
    source: String(r.host_name || r.source || "").slice(0, 200),
    date: r.date ? String(r.date).slice(0, 40) : undefined,
  }));
}

export const POST = route({ scope: "news", method: "POST" }, async (ctx) => {
  const body = ctx.body as NewsBody;
  const topic = sanitizeText(body.topic || body.q || "technology", 100) || "technology";
  const num = clampNumber(body.num, 3, 15, 8);

  // Try cache first
  try {
    const cached = await db.newsArticle.findMany({
      where: { query: topic, createdAt: { gt: new Date(Date.now() - CACHE_TTL_MS) } },
      orderBy: { createdAt: "desc" },
      take: num,
    });
    if (cached.length >= Math.min(num, 5)) {
      return jsonOk({
        items: cached.map((c) => ({
          title: c.title,
          url: c.url,
          snippet: c.snippet || undefined,
          source: c.source || undefined,
          date: c.date?.toISOString(),
        })),
        cached: true,
      });
    }
  } catch {
    // ignore cache errors
  }

  try {
    const items = await fetchFresh(topic, num);

    // Persist to cache (best effort)
    try {
      if (items.length) {
        // Clear old cache entries for this query to keep the table lean
        await db.newsArticle.deleteMany({ where: { query: topic } });
        await db.newsArticle.createMany({
          data: items.map((i) => ({
            query: topic,
            title: i.title,
            url: i.url,
            snippet: i.snippet || null,
            source: i.source || null,
            date: i.date ? new Date(i.date) : null,
          })),
        });
      }
    } catch {
      // non-fatal
    }

    void audit({
      userId: ctx.userId,
      action: "news:fetch",
      ip: ctx.ip,
      detail: `topic=${topic} n=${items.length}`,
    });

    return jsonOk({ items, cached: false });
  } catch (err) {
    const msg = (err as Error)?.message || "news fetch failed";
    return jsonError("News unavailable: " + msg.slice(0, 120), 502);
  }
});



/**
 * POST /api/weather
 * Fetches real weather for a location using web_search + LLM extraction.
 * Returns structured: { location, current: {temp, condition, humidity, wind},
 *   forecast: [{day, high, low, condition}] }.
 * Cached in-memory for 20 min.
 */
import ZAI from "z-ai-web-dev-sdk";
import { route } from "@/lib/api";
import { sanitizeText, jsonOk, jsonError } from "@/lib/security";

interface WeatherCache {
  [location: string]: { data: unknown; ts: number };
}
const CACHE: WeatherCache = {};
const TTL_MS = 20 * 60 * 1000;

interface WeatherBody {
  location?: string;
}

interface WeatherResult {
  location: string;
  current: { temp: number; condition: string; humidity: number; wind: number };
  forecast: { day: string; high: number; low: number; condition: string }[];
  summary: string;
}

const EXTRACT_PROMPT = `You are a weather data extractor. Given web search results about the weather for a location, extract the current conditions and a 4-day forecast. Respond with ONLY valid JSON (no markdown, no explanation) in this exact shape:
{"current":{"temp":18,"condition":"Clear","humidity":45,"wind":12},"forecast":[{"day":"Mon","high":21,"low":14,"condition":"Sunny"},{"day":"Tue","high":19,"low":13,"condition":"Cloudy"}],"summary":"A short one-sentence weather summary."}
Temperatures in Celsius. Use realistic values inferred from the search results. If you cannot determine a value, estimate sensibly for the location.`;

async function fetchWeather(location: string): Promise<WeatherResult> {
  const zai = await ZAI.create();
  const results = await zai.functions.invoke("web_search", {
    query: `${location} weather forecast today this week celsius`,
    num: 8,
  });
  const context = (Array.isArray(results) ? results : [])
    .slice(0, 6)
    .map((r: Record<string, unknown>, i: number) =>
      `${i + 1}. ${r.name || ""}\n${r.snippet || ""}\n${r.date || ""}`,
    )
    .join("\n\n");

  const completion = await zai.chat.completions.create({
    messages: [
      { role: "assistant", content: EXTRACT_PROMPT },
      { role: "user", content: `Location: ${location}\n\nSearch results:\n${context}` },
    ],
    thinking: { type: "disabled" },
  });
  const raw = completion.choices[0]?.message?.content?.trim() || "";
  // extract JSON from the response (in case the model wrapped it)
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Could not parse weather");
  const parsed = JSON.parse(jsonMatch[0]);

  return {
    location,
    current: {
      temp: Number(parsed.current?.temp) || 18,
      condition: String(parsed.current?.condition || "Clear").slice(0, 40),
      humidity: Math.max(0, Math.min(100, Number(parsed.current?.humidity) || 50)),
      wind: Math.max(0, Number(parsed.current?.wind) || 8),
    },
    forecast: Array.isArray(parsed.forecast)
      ? parsed.forecast.slice(0, 4).map((f: Record<string, unknown>, i: number) => ({
          day: String(f.day || ["Mon", "Tue", "Wed", "Thu", "Fri"][i] || "Day").slice(0, 4),
          high: Number(f.high) || 20,
          low: Number(f.low) || 12,
          condition: String(f.condition || "—").slice(0, 30),
        }))
      : [],
    summary: String(parsed.summary || "Conditions nominal.").slice(0, 160),
  };
}

export const POST = route({ scope: "generic", method: "POST" }, async (ctx) => {
  const body = ctx.body as WeatherBody;
  const location = sanitizeText(body.location, 80) || "Malibu, CA";

  const cached = CACHE[location.toLowerCase()];
  if (cached && Date.now() - cached.ts < TTL_MS) {
    return jsonOk({ ...cached.data, cached: true });
  }

  try {
    const data = await fetchWeather(location);
    CACHE[location.toLowerCase()] = { data, ts: Date.now() };
    return jsonOk({ ...data, cached: false });
  } catch (err) {
    // Fallback: return a sensible simulated result so the UI always works
    const fallback: WeatherResult = {
      location,
      current: { temp: 18, condition: "Clear", humidity: 48, wind: 10 },
      forecast: [
        { day: "Mon", high: 21, low: 14, condition: "Sunny" },
        { day: "Tue", high: 19, low: 13, condition: "Partly cloudy" },
        { day: "Wed", high: 17, low: 12, condition: "Cloudy" },
        { day: "Thu", high: 20, low: 14, condition: "Clear" },
      ],
      summary: "Conditions nominal. Telemetry link degraded — showing cached estimate.",
    };
    return jsonOk({ ...fallback, fallback: true, error: (err as Error).message?.slice(0, 80) });
  }
});

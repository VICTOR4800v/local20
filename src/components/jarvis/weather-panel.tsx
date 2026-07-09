"use client";

import { useCallback, useEffect, useState } from "react";
import { CloudSun, RefreshCw, Droplets, Wind, MapPin, Sun, Cloud, CloudRain, CloudSnow } from "lucide-react";
import { HoloPanel } from "./holo-panel";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Forecast { day: string; high: number; low: number; condition: string; }
interface WeatherData {
  location: string;
  current: { temp: number; condition: string; humidity: number; wind: number };
  forecast: Forecast[];
  summary: string;
  cached?: boolean;
  fallback?: boolean;
}

const conditionIcon = (c: string) => {
  const s = c.toLowerCase();
  if (/rain|shower|drizzle/.test(s)) return <CloudRain className="w-4 h-4 text-cyan-300" />;
  if (/snow|sleet/.test(s)) return <CloudSnow className="w-4 h-4 text-cyan-200" />;
  if (/cloud|overcast/.test(s)) return <Cloud className="w-4 h-4 text-zinc-400" />;
  if (/sun|clear|hot/.test(s)) return <Sun className="w-4 h-4 text-amber-300" />;
  return <CloudSun className="w-4 h-4 text-cyan-200" />;
};

export function WeatherPanel() {
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [loc, setLoc] = useState("Malibu, CA");

  const refresh = useCallback(async (location?: string) => {
    setLoading(true);
    try {
      const res = await api<{ data: WeatherData }>("/api/weather", {
        method: "POST", json: { location: location || loc },
      });
      setData(res.data);
      if (res.data.fallback) toast.info("Weather service degraded — showing estimate");
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }, [loc]);

  useEffect(() => { refresh(); }, []);

  const saveLoc = useCallback(() => {
    setEditing(false);
    if (loc.trim()) refresh(loc.trim());
  }, [loc, refresh]);

  return (
    <HoloPanel
      title="WEATHER"
      icon={<CloudSun className="w-4 h-4" />}
      accent="emerald"
      right={
        <Button size="sm" variant="ghost" onClick={() => refresh()} className="h-6 w-6 p-0 text-cyan-300/60 hover:text-cyan-200">
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
        </Button>
      }
    >
      {editing ? (
        <div className="flex gap-2 mb-2">
          <Input value={loc} onChange={(e) => setLoc(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveLoc()} placeholder="City…" className="h-8 bg-cyan-400/5 border-cyan-400/25 text-cyan-100 font-mono text-xs" autoFocus />
          <Button size="sm" onClick={saveLoc} className="h-8 px-3 bg-cyan-400/20 border border-cyan-400/40 text-cyan-100 font-mono text-[10px]">SET</Button>
        </div>
      ) : (
        <button onClick={() => setEditing(true)} className="flex items-center gap-1 mb-2 group">
          <MapPin className="w-3 h-3 text-emerald-300/70 group-hover:text-emerald-200" />
          <span className="font-mono text-[11px] text-emerald-200/90 group-hover:text-emerald-100">{data?.location || "—"}</span>
          {data?.cached && <span className="font-mono text-[8px] text-cyan-300/40 ml-1">CACHED</span>}
        </button>
      )}

      {loading && !data ? (
        <div className="font-mono text-[10px] text-cyan-300/40 text-center py-3">acquiring atmospheric data…</div>
      ) : data ? (
        <>
          {/* Current */}
          <div className="flex items-center gap-3 p-2.5 rounded border border-emerald-400/20 bg-emerald-400/5 mb-2.5">
            <div className="text-emerald-300">{conditionIcon(data.current.condition)}</div>
            <div className="flex-1">
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-2xl font-bold text-emerald-glow tabular-nums">{data.current.temp}°</span>
                <span className="font-mono text-[10px] text-cyan-200/70">{data.current.condition}</span>
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="font-mono text-[9px] text-cyan-300/60 flex items-center gap-1"><Droplets className="w-2.5 h-2.5" />{data.current.humidity}%</span>
                <span className="font-mono text-[9px] text-cyan-300/60 flex items-center gap-1"><Wind className="w-2.5 h-2.5" />{data.current.wind} km/h</span>
              </div>
            </div>
          </div>

          {/* Summary */}
          <p className="font-mono text-[10px] text-cyan-200/70 leading-relaxed mb-2.5">{data.summary}</p>

          {/* Forecast */}
          <div className="grid grid-cols-4 gap-1.5">
            {data.forecast.map((f, i) => (
              <div key={i} className="rounded border border-cyan-400/15 bg-cyan-400/5 p-1.5 text-center">
                <div className="font-mono text-[9px] text-cyan-300/60 mb-0.5">{f.day}</div>
                <div className="flex justify-center mb-0.5">{conditionIcon(f.condition)}</div>
                <div className="font-mono text-[11px] text-cyan-100 font-semibold tabular-nums">{f.high}°</div>
                <div className="font-mono text-[9px] text-cyan-300/50 tabular-nums">{f.low}°</div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="font-mono text-[10px] text-rose-300/60 text-center py-3">Weather unavailable</div>
      )}
    </HoloPanel>
  );
}

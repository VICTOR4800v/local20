"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, AlertTriangle, ShieldAlert, CalendarClock, Mail, Activity, RefreshCw, X } from "lucide-react";
import { HoloPanel } from "./holo-panel";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Notification {
  id: string;
  severity: "info" | "warn" | "critical";
  category: "system" | "security" | "calendar" | "email";
  title: string;
  detail: string;
  ts: string;
}
interface NotifData {
  notifications: Notification[];
  counts: { total: number; critical: number; warn: number; info: number };
}

const SEV_STYLE = {
  critical: { dot: "bg-rose-400", text: "text-rose-300", border: "border-rose-400/30", bg: "bg-rose-400/5", icon: <AlertTriangle className="w-3 h-3" /> },
  warn: { dot: "bg-amber-400", text: "text-amber-300", border: "border-amber-400/30", bg: "bg-amber-400/5", icon: <AlertTriangle className="w-3 h-3" /> },
  info: { dot: "bg-cyan-400", text: "text-cyan-300", border: "border-cyan-400/20", bg: "bg-cyan-400/5", icon: <Activity className="w-3 h-3" /> },
};

const CAT_ICON = {
  system: <Activity className="w-3 h-3" />,
  security: <ShieldAlert className="w-3 h-3" />,
  calendar: <CalendarClock className="w-3 h-3" />,
  email: <Mail className="w-3 h-3" />,
};

const fmtAgo = (ts: string) => {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
};

export function AlertsPanel() {
  const [data, setData] = useState<NotifData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"all" | "system" | "security" | "calendar" | "email">("all");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ data: NotifData }>("/api/notifications", {});
      setData(res.data);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15000); // refresh every 15s
    return () => clearInterval(t);
  }, [refresh]);

  const visible = (data?.notifications || [])
    .filter((n) => !dismissed.has(n.id))
    .filter((n) => filter === "all" || n.category === filter);
  const counts = data?.counts;

  const dismiss = (id: string) => {
    setDismissed((s) => new Set(s).add(id));
  };

  const acknowledgeAll = () => {
    if (!data) return;
    const all = new Set(data.notifications.map((n) => n.id));
    setDismissed(all);
  };

  // category counts for filter chips
  const catCounts = (data?.notifications || []).reduce<Record<string, number>>((acc, n) => {
    if (!dismissed.has(n.id)) acc[n.category] = (acc[n.category] || 0) + 1;
    return acc;
  }, {});

  const FILTERS: { id: typeof filter; label: string }[] = [
    { id: "all", label: "ALL" },
    { id: "system", label: "SYS" },
    { id: "security", label: "SEC" },
    { id: "calendar", label: "CAL" },
    { id: "email", label: "MAIL" },
  ];

  return (
    <HoloPanel
      title="ALERTS CENTER"
      icon={<Bell className="w-4 h-4" />}
      accent={counts?.critical ? "rose" : counts?.warn ? "amber" : "cyan"}
      right={
        <div className="flex items-center gap-1.5">
          {counts && (
            <div className="flex items-center gap-1 font-mono text-[9px]">
              {counts.critical > 0 && <span className="px-1.5 py-0.5 rounded-full bg-rose-400/20 text-rose-300 border border-rose-400/40">{counts.critical}</span>}
              {counts.warn > 0 && <span className="px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40">{counts.warn}</span>}
              {counts.info > 0 && <span className="px-1.5 py-0.5 rounded-full bg-cyan-400/15 text-cyan-300/70 border border-cyan-400/25">{counts.info}</span>}
            </div>
          )}
          <Button size="sm" variant="ghost" onClick={refresh} className="h-6 w-6 p-0 text-cyan-300/60 hover:text-cyan-200">
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      }
    >
      {/* Filter chips + acknowledge all */}
      {data && data.notifications.length > 0 && (
        <div className="flex items-center gap-1 mb-2.5 pb-2 border-b border-cyan-400/10">
          {FILTERS.map((f) => {
            const c = f.id === "all" ? visible.length : (catCounts[f.id] || 0);
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-1.5 py-0.5 rounded font-mono text-[8px] tracking-wider transition flex items-center gap-1 ${active ? "bg-cyan-400/20 text-cyan-100 border border-cyan-400/40" : "text-cyan-300/50 border border-transparent hover:text-cyan-200"}`}
              >
                {f.label}
                {c > 0 && <span className="opacity-60">{c}</span>}
              </button>
            );
          })}
          <div className="flex-1" />
          {visible.length > 0 && (
            <button
              onClick={acknowledgeAll}
              className="px-1.5 py-0.5 rounded font-mono text-[8px] text-amber-300/70 hover:text-amber-200 hover:bg-amber-400/10 border border-transparent hover:border-amber-400/30 transition"
              title="Dismiss all visible alerts"
            >
              ACK ALL
            </button>
          )}
        </div>
      )}
      <ScrollArea className="h-40 jarvis-scroll">
        <div className="space-y-1.5 pr-2">
          {loading && !data && <div className="font-mono text-[10px] text-cyan-300/40 text-center py-3">scanning event feed…</div>}
          {!loading && visible.length === 0 && (
            <div className="font-mono text-[10px] text-emerald-300/60 text-center py-4 flex flex-col items-center gap-1.5">
              <ShieldAlert className="w-5 h-5 text-emerald-300/40" />
              {dismissed.size > 0 ? "ALL ACKNOWLEDGED" : "ALL SYSTEMS NOMINAL"}
            </div>
          )}
          {visible.map((n) => {
            const s = SEV_STYLE[n.severity];
            return (
              <div key={n.id} className={`p-2 rounded border ${s.border} ${s.bg} group relative`}>
                <div className="flex items-start gap-2">
                  <span className={`mt-0.5 ${s.text}`}>{CAT_ICON[n.category]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${s.dot} ${n.severity === "critical" ? "status-dot" : ""}`} style={{ color: n.severity === "critical" ? "#fb7185" : n.severity === "warn" ? "#fbbf24" : "#22d3ee" }} />
                      <span className={`font-mono text-[11px] font-semibold ${s.text} truncate`}>{n.title}</span>
                      <span className="font-mono text-[8px] text-cyan-300/40 uppercase tracking-wider ml-auto">{n.category}</span>
                    </div>
                    <p className="font-mono text-[9px] text-cyan-200/60 leading-relaxed">{n.detail}</p>
                    <span className="font-mono text-[8px] text-cyan-300/30">{fmtAgo(n.ts)}</span>
                  </div>
                  <button onClick={() => dismiss(n.id)} className="opacity-0 group-hover:opacity-100 text-cyan-300/40 hover:text-cyan-200 transition">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </HoloPanel>
  );
}

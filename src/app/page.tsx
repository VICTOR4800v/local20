"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Activity, Mic, MicOff, Volume2, VolumeX, Volume1, Camera, Mail, Calendar as CalIcon,
  Newspaper, Thermometer, Cpu, MemoryStick, HardDrive, Send, Trash2, Plus, Check,
  RefreshCw, Radio, Power, Sparkles, Clock, Star, ChevronRight, X, Settings2, Search,
  Droplets, Sunrise, ListChecks, ShieldCheck, Zap, Wifi, Battery, BatteryCharging,
  Gauge, Server, Bell, Keyboard, Sun, Moon, Download,
} from "lucide-react";
import { Hologram } from "@/components/jarvis/hologram";
import { HoloPanel, AnimatedReadout } from "@/components/jarvis/holo-panel";
import { NotesPanel } from "@/components/jarvis/notes-panel";
import { SettingsDrawer } from "@/components/jarvis/settings-drawer";
import { Sparkline } from "@/components/jarvis/sparkline";
import { WeatherPanel } from "@/components/jarvis/weather-panel";
import { CommandPalette } from "@/components/jarvis/command-palette";
import { WorldClock } from "@/components/jarvis/world-clock";
import { AlertsPanel } from "@/components/jarvis/alerts-panel";
import { ResourceGauges } from "@/components/jarvis/gauge-ring";
import { MetricChartModal } from "@/components/jarvis/metric-chart-modal";
import { TerminalPanel } from "@/components/jarvis/terminal-panel";
import { ShortcutsOverlay } from "@/components/jarvis/shortcuts-overlay";
import { HealthScore } from "@/components/jarvis/health-score";
import { QuickStatsBar } from "@/components/jarvis/quick-stats-bar";
import { ExportPanel } from "@/components/jarvis/export-panel";
import { useJarvis } from "@/lib/store";
import { useVoice } from "@/hooks/use-voice";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

/* ----------------------------- small helpers ----------------------------- */
const fmtTime = (d: string | number | Date) =>
  new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const fmtDate = (d: string | number | Date) =>
  new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" });

/* ----------------------------- types ----------------------------- */
interface SysMetric { id: string; label: string; value: number; unit: string; temp: boolean; critical?: boolean; warn?: boolean; }
interface NewsItem { title: string; url: string; snippet?: string; source?: string; date?: string; }
interface EmailMsg { id: string; from: string; subject: string; preview: string; body?: string; read: boolean; starred: boolean; date: string; }
interface CalEvent { id: string; title: string; startAt: string; endAt?: string; location?: string | null; source: string; }
interface Habit { id: string; title: string; description?: string | null; cadence: string; time?: string | null; streak: number; completed: boolean; }
interface Sched { id: string; title: string; content?: string | null; cron?: string | null; done: boolean; }
interface Briefing { summary: string; todos: string[]; weather?: string | null; news?: string[] | null; date: string; }

/* =================================================================== */
/*  Page                                                               */
/* =================================================================== */
export default function Home() {
  const store = useJarvis();
  const voice = useVoice();

  // clock
  const [now, setNow] = useState<Date>(new Date());
  // notification badge counts for the bell icon
  const [notifCount, setNotifCount] = useState(0);
  const [hasCritical, setHasCritical] = useState(false);
  const [hasWarn, setHasWarn] = useState(false);
  // metric chart modal
  const [chartMetric, setChartMetric] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ---- system metrics poll ----
  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const res = await api<{ data: { metrics: SysMetric[]; summary: string; processes: { id: string; name: string; cpu: number; mem: number; status: string }[]; network: { down: number; up: number; unit: string }; power: { battery: number; charging: boolean }; diskSpace: { total: number; used: number; unit: string }; uptimeSec: number; hostname: string; activeConnections: number } }>("/api/system", {});
        if (active) {
          store.pushMetrics(res.data.metrics);
          store.setSystemExtras({ processes: res.data.processes, network: res.data.network, power: res.data.power, diskSpace: res.data.diskSpace, uptimeSec: res.data.uptimeSec, hostname: res.data.hostname, activeConnections: res.data.activeConnections });
        }
      } catch {}
    };
    poll();
    const t = setInterval(poll, 3000);
    return () => { active = false; clearInterval(t); };
  }, []);

  // ---- notification badge poll (for the bell icon count) ----
  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const res = await api<{ data: { counts: { total: number; critical: number; warn: number } } }>("/api/notifications", {});
        if (active) {
          setNotifCount(res.data.counts.total);
          setHasCritical(res.data.counts.critical > 0);
          setHasWarn(res.data.counts.warn > 0);
        }
      } catch {}
    };
    poll();
    const t = setInterval(poll, 15000);
    return () => { active = false; clearInterval(t); };
  }, []);

  // ---- load persisted accent + voiceLive + holoMode + theme on mount ----
  useEffect(() => {
    (async () => {
      try {
        const res = await api<{ data: { settings: Record<string, string> } }>("/api/settings", {});
        if (res.data.settings.accent) store.setAccent(res.data.settings.accent);
        if (res.data.settings.voiceLiveDefault !== undefined) store.setVoiceLive(res.data.settings.voiceLiveDefault === "true");
        if (res.data.settings.holoMode) store.setHoloMode(res.data.settings.holoMode as "reactor" | "spectrum" | "waveform" | "radar");
        if (res.data.settings.theme === "light") store.setTheme("light");
      } catch {}
    })();
  }, []);

  // ---- startup briefing ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api<{ data: { briefing: Briefing | null } }>("/api/briefing", {});
        if (cancelled) return;
        if (res.data.briefing) {
          store.setBriefing(res.data.briefing);
          return;
        }
        const gen = await api<{ data: { briefing: Briefing } }>("/api/briefing", {
          method: "POST", json: { regenerate: true },
        });
        if (!cancelled) store.setBriefing(gen.data.briefing);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  // reflect voice state into assistant status
  useEffect(() => {
    if (voice.listening) store.setStatus("listening");
    else if (voice.speaking) store.setStatus("speaking");
    else if (store.status === "listening" || store.status === "speaking") store.setStatus("idle");
  }, [voice.listening, voice.speaking]);

  // apply accent theme via CSS variable
  useEffect(() => {
    const map: Record<string, string> = {
      cyan: "#22d3ee", amber: "#fbbf24", emerald: "#34d399", violet: "#a78bfa", rose: "#fb7185",
    };
    document.documentElement.style.setProperty("--jarvis-accent", map[store.accent] || map.cyan);
  }, [store.accent]);

  // apply light/dark theme class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (store.theme === "light") root.classList.add("theme-light");
    else root.classList.remove("theme-light");
  }, [store.theme]);

  const toggleTheme = () => {
    const next = store.theme === "dark" ? "light" : "dark";
    store.setTheme(next);
    api("/api/settings", { method: "POST", json: { key: "theme", value: next } }).catch(() => {});
  };

  // Ctrl+K / Cmd+K opens the command palette; ? opens shortcuts overlay
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        store.setPaletteOpen(!store.paletteOpen);
      }
      // ? (Shift+/) toggles shortcuts — only when not typing in an input
      if (e.key === "?" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        store.setShortcutsOpen(!store.shortcutsOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store]);

  const statusLabel =
    store.active === "disabled" ? "DISABLED" :
    voice.listening ? "LISTENING" :
    voice.speaking ? "SPEAKING" :
    store.status === "thinking" ? "THINKING" : "IDLE";

  return (
    <div className="min-h-screen flex flex-col jarvis-bg jarvis-grid-bg viewport-scan text-foreground">
      {/* ===================== TOP BAR ===================== */}
      <header className="sticky top-0 z-30 border-b border-cyan-400/20 bg-[oklch(0.1_0.02_220/85%)] backdrop-blur-md">
        <div className="max-w-[1600px] mx-auto px-3 sm:px-5 py-2.5 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="relative w-8 h-8 rounded-full border border-cyan-400/50 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-cyan-400 status-dot" style={{ color: "#22d3ee" }} />
            </div>
            <div className="leading-tight">
              <div className="font-mono text-sm sm:text-base tracking-[0.3em] text-cyan-glow font-semibold">
                J.A.R.V.I.S.
              </div>
              <div className="font-mono text-[10px] text-cyan-300/50 tracking-widest">
                JUST A RATHER VERY INTELLIGENT SYSTEM
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 ml-2 px-3 py-1 rounded-full border border-cyan-400/20 bg-cyan-400/5">
            <Clock className="w-3.5 h-3.5 text-cyan-300/70" />
            <span className="font-mono text-xs text-cyan-200/80">{fmtDate(now)}</span>
            <span className="font-mono text-sm text-cyan-glow tabular-nums">{fmtTime(now)}</span>
          </div>

          <WorldClock />

          <div className="flex-1" />

          {/* Active / Disable toggle (replaces old bottom-left J.A.R.V.I.S. \CORE label) */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-400/25 bg-cyan-400/5">
            <Power className={`w-3.5 h-3.5 ${store.active === "active" ? "text-emerald-300" : "text-zinc-400"}`} />
            <span className="font-mono text-[11px] text-cyan-200/70">STATE</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => store.setActive("active")}
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold transition ${store.active === "active" ? "bg-emerald-400/20 text-emerald-300 border border-emerald-400/40" : "text-zinc-500 border border-transparent"}`}
                aria-pressed={store.active === "active"}
              >ACTIVE</button>
              <button
                onClick={() => store.setActive("disabled")}
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold transition ${store.active === "disabled" ? "bg-rose-400/20 text-rose-300 border border-rose-400/40" : "text-zinc-500 border border-transparent"}`}
                aria-pressed={store.active === "disabled"}
              >DISABLE</button>
            </div>
          </div>

          {/* Speaking / Idle status (next to it) */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-400/25 bg-cyan-400/5">
            <Radio className={`w-3.5 h-3.5 ${voice.listening ? "text-emerald-300" : voice.speaking ? "text-amber-300" : "text-cyan-300/60"} ${voice.listening || voice.speaking ? "status-dot" : ""}`} style={{ color: voice.listening ? "#34d399" : voice.speaking ? "#fbbf24" : "#67e8f9" }} />
            <span className="font-mono text-[11px] text-cyan-200/70">VOICE</span>
            <span className={`font-mono text-[10px] font-semibold ${voice.listening ? "text-emerald-300" : voice.speaking ? "text-amber-300" : "text-cyan-300/70"}`}>{statusLabel}</span>
          </div>

          {/* Voice Live toggle (default ON) */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-400/25 bg-cyan-400/5">
            <Zap className={`w-3.5 h-3.5 ${store.voiceLive ? "text-amber-300" : "text-zinc-500"}`} />
            <span className="font-mono text-[11px] text-cyan-200/70">VOICE&nbsp;LIVE</span>
            <Switch checked={store.voiceLive} onCheckedChange={store.setVoiceLive} aria-label="Toggle Voice Live mode" />
          </div>

          <Button
            size="sm"
            variant="outline"
            className="border-cyan-400/30 bg-cyan-400/5 text-cyan-200 hover:bg-cyan-400/15 hover:text-cyan-100 font-mono text-[11px]"
            onClick={() => store.setNewsOpen(true)}
          >
            <Newspaper className="w-3.5 h-3.5 mr-1.5" />
            NEWS
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="border-cyan-400/30 bg-cyan-400/5 text-cyan-200 hover:bg-cyan-400/15 hover:text-cyan-100 font-mono text-[11px]"
            onClick={() => store.setSettingsOpen(true)}
            aria-label="Command Center"
          >
            <Settings2 className="w-3.5 h-3.5 mr-1.5" />
            <span className="hidden sm:inline">CMD</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="border-cyan-400/30 bg-cyan-400/5 text-cyan-200 hover:bg-cyan-400/15 hover:text-cyan-100 font-mono text-[11px]"
            onClick={() => store.setPaletteOpen(true)}
            aria-label="Command Palette"
            title="Command Palette (Ctrl+K)"
          >
            <Search className="w-3.5 h-3.5 mr-1.5" />
            <kbd className="hidden sm:inline text-[9px] opacity-60">⌘K</kbd>
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="relative border-cyan-400/30 bg-cyan-400/5 text-cyan-200 hover:bg-cyan-400/15 hover:text-cyan-100 font-mono text-[11px]"
            onClick={() => document.getElementById("alerts-panel")?.scrollIntoView({ behavior: "smooth", block: "center" })}
            aria-label="Alerts"
            title="Alerts Center"
          >
            <Bell className="w-3.5 h-3.5" />
            {notifCount > 0 && (
              <span className={`absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full text-[8px] font-mono font-bold flex items-center justify-center ${notifCount > 0 && hasCritical ? "bg-rose-400 text-rose-950" : notifCount > 0 && hasWarn ? "bg-amber-400 text-amber-950" : "bg-cyan-400 text-cyan-950"}`}>
                {notifCount > 9 ? "9+" : notifCount}
              </span>
            )}
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="border-cyan-400/30 bg-cyan-400/5 text-cyan-200 hover:bg-cyan-400/15 hover:text-cyan-100 font-mono text-[11px]"
            onClick={() => store.setShortcutsOpen(true)}
            aria-label="Keyboard Shortcuts"
            title="Keyboard Shortcuts (?)"
          >
            <Keyboard className="w-3.5 h-3.5" />
            <kbd className="hidden sm:inline text-[9px] opacity-60">?</kbd>
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="border-cyan-400/30 bg-cyan-400/5 text-cyan-200 hover:bg-cyan-400/15 hover:text-cyan-100 font-mono text-[11px]"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title={`Switch to ${store.theme === "dark" ? "light" : "dark"} HUD`}
          >
            {store.theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </header>

      {/* ===================== SYSTEM STATS STRIP ===================== */}
      <SystemStatsStrip />

      {/* ===================== QUICK STATS BAR (KPI chips) ===================== */}
      <div className="max-w-[1600px] w-full mx-auto px-3 sm:px-5 pt-3">
        <QuickStatsBar />
      </div>

      {/* ===================== MAIN GRID ===================== */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-3 sm:px-5 py-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LEFT COLUMN: System + Alerts + Processes + Weather + Volume + Screenshot */}
        <section className="lg:col-span-3 flex flex-col gap-4">
          <SystemPanel metrics={store.metrics} onMetricClick={setChartMetric} />
          <div id="alerts-panel">
            <AlertsPanel />
          </div>
          <ProcessesPanel />
          <WeatherPanel />
          <VolumePanel />
          <ScreenshotPanel />
        </section>

        {/* CENTER COLUMN: Hologram + Briefing + Chat + Terminal */}
        <section className="lg:col-span-6 flex flex-col gap-4">
          <HologramPanel statusLabel={statusLabel} />
          {store.briefing && <BriefingPanel briefing={store.briefing} onSpeak={() => voice.speak(store.briefing!.summary, store.voiceLive)} />}
          <ChatPanel voice={voice} />
          <TerminalPanel />
        </section>

        {/* RIGHT COLUMN: Email + Calendar + Habits + Schedules + Notes */}
        <section className="lg:col-span-3 flex flex-col gap-4">
          <EmailPanel />
          <CalendarPanel />
          <HabitsPanel />
          <SchedulesPanel />
          <NotesPanel />
          <ExportPanel />
        </section>
      </main>

      {/* ===================== STATUS TICKER STRIP ===================== */}
      <StatusTicker />

      {/* ===================== STICKY FOOTER ===================== */}
      <footer className="mt-auto border-t border-cyan-400/20 bg-[oklch(0.1_0.02_220/90%)] backdrop-blur-md">
        <div className="max-w-[1600px] mx-auto px-3 sm:px-5 py-2 flex items-center gap-3 flex-wrap text-[11px] font-mono">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-300/80" />
          <span className="text-emerald-300/80">SECURE</span>
          <span className="text-cyan-300/40 hidden sm:inline">|</span>
          <Activity className="w-3.5 h-3.5 text-cyan-300/70" />
          <span className="text-cyan-200/70">{store.metrics.length ? `${store.metrics[0].value}${store.metrics[0].unit} CPU · ${store.metrics[1]?.value}${store.metrics[1]?.unit} GPU` : "initialising telemetry…"}</span>
          <span className="text-cyan-300/40 hidden sm:inline">|</span>
          <Wifi className="w-3.5 h-3.5 text-cyan-300/70" />
          <span className="text-cyan-200/70">{store.network.down.toFixed(1)}↓ {store.network.up.toFixed(1)}↑ MB/s</span>
          <span className="text-cyan-300/40 hidden sm:inline">|</span>
          <Droplets className="w-3.5 h-3.5 text-cyan-300/70" />
          <span className="text-cyan-200/70 hidden sm:inline">{store.briefing?.weather || "18°C clear"}</span>
          <div className="flex-1" />
          {store.power.charging ? <BatteryCharging className="w-3.5 h-3.5 text-emerald-300" /> : <Battery className={`w-3.5 h-3.5 ${store.power.battery < 50 ? "text-amber-300" : "text-cyan-300/70"}`} />}
          <span className="text-cyan-200/70">{store.power.battery}%</span>
          <span className="text-cyan-300/40 hidden sm:inline">|</span>
          <span className="text-cyan-300/40 hidden sm:inline">SESSION</span>
          <span className="text-cyan-200/70 hidden sm:inline">web-{store.active}</span>
          <span className="text-cyan-300/40 hidden sm:inline">|</span>
          <span className="text-cyan-200/50">v2.1 · z.ai</span>
        </div>
      </footer>

      {/* ===================== SETTINGS DRAWER ===================== */}
      <SettingsDrawer
        open={store.settingsOpen}
        onClose={() => store.setSettingsOpen(false)}
        accent={store.accent}
        onAccentChange={store.setAccent}
      />

      {/* ===================== COMMAND PALETTE (Ctrl+K) ===================== */}
      <CommandPalette
        open={store.paletteOpen}
        onClose={() => store.setPaletteOpen(false)}
        ctx={{
          store: useJarvis.getState(),
          voiceToggle: () => store.setVoiceLive(!store.voiceLive),
          voiceSpeak: (text: string) => voice.speak(text, store.voiceLive),
          captureScreenshot: () => window.dispatchEvent(new CustomEvent("jarvis:capture-screenshot")),
          refreshAll: () => window.dispatchEvent(new CustomEvent("jarvis:refresh-all")),
        }}
      />

      {/* ===================== METRIC CHART MODAL ===================== */}
      <MetricChartModal
        open={chartMetric !== null}
        metricId={chartMetric}
        onClose={() => setChartMetric(null)}
      />

      {/* ===================== SHORTCUTS OVERLAY ===================== */}
      <ShortcutsOverlay
        open={store.shortcutsOpen}
        onClose={() => store.setShortcutsOpen(false)}
      />

      {/* ===================== NEWS DRAWER ===================== */}
      <NewsDrawer />
    </div>
  );
}

/* =================================================================== */
/*  System panel (temps + loads + sparklines)                           */
/* =================================================================== */
function SystemPanel({ metrics, onMetricClick }: { metrics: SysMetric[]; onMetricClick: (id: string) => void }) {
  const history = useJarvis((s) => s.metricHistory);
  const temps = metrics.filter((m) => m.temp);
  const loads = metrics.filter((m) => !m.temp);
  return (
    <HoloPanel title="SYSTEM TELEMETRY" icon={<Thermometer className="w-4 h-4" />} accent="cyan">
      {/* Health score */}
      <div className="mb-3">
        <HealthScore />
      </div>
      {/* Top 2 temperatures (per Operator request) */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {temps.length === 0 && (
          <>
            <TempTile label="CPU TEMP" value="--" />
            <TempTile label="GPU TEMP" value="--" />
          </>
        )}
        {temps.map((t) => (
          <TempTile
            key={t.id}
            label={t.label}
            value={t.value}
            unit={t.unit}
            critical={t.critical}
            warn={t.warn}
            spark={history[t.id] || []}
            onClick={() => onMetricClick(t.id)}
          />
        ))}
      </div>
      {/* Circular resource gauges (visual centerpiece) */}
      {loads.length > 0 && (
        <div className="mb-3 py-2 border-y border-cyan-400/10">
          <ResourceGauges metrics={metrics} onMetricClick={onMetricClick} />
        </div>
      )}
      {/* Loads */}
      <div className="space-y-2.5">
        {loads.map((m) => (
          <div key={m.id}>
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-[10px] text-cyan-200/70 flex items-center gap-1.5">
                {m.id === "cpu-load" && <Cpu className="w-3 h-3" />}
                {m.id === "mem-load" && <MemoryStick className="w-3 h-3" />}
                {m.id === "disk-load" && <HardDrive className="w-3 h-3" />}
                {m.label}
              </span>
              <div className="flex items-center gap-2">
                <Sparkline
                  data={history[m.id] || []}
                  width={70}
                  height={16}
                  color={m.critical ? "#fb7185" : m.warn ? "#fbbf24" : "#22d3ee"}
                  warnThreshold={m.warn ? 80 : undefined}
                  criticalThreshold={m.critical ? 95 : undefined}
                  unit={m.unit}
                  label={m.label}
                />
                <AnimatedReadout
                  value={m.value}
                  format={(n) => `${Math.round(n)}${m.unit}`}
                  className={`font-mono text-[10px] tabular-nums w-10 text-right ${m.critical ? "text-rose-300" : m.warn ? "text-amber-300" : "text-cyan-200/80"}`}
                />
              </div>
            </div>
            <Progress value={m.value} className="h-1.5 bg-cyan-400/10" />
          </div>
        ))}
        {loads.length === 0 && <div className="text-[10px] font-mono text-cyan-300/40">initialising loads…</div>}
      </div>
      {/* Disk space widget */}
      <DiskSpaceWidget />
    </HoloPanel>
  );
}

function DiskSpaceWidget() {
  const disk = useJarvis((s) => s.diskSpace);
  const pct = disk.total > 0 ? Math.round((disk.used / disk.total) * 100) : 0;
  const free = disk.total - disk.used;
  const color = pct >= 90 ? "#fb7185" : pct >= 75 ? "#fbbf24" : "#22d3ee";
  return (
    <div className="mt-3 pt-2 border-t border-cyan-400/10">
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-mono text-[10px] text-cyan-200/70 flex items-center gap-1.5">
          <HardDrive className="w-3 h-3" />
          STORAGE
        </span>
        <span className="font-mono text-[10px] tabular-nums" style={{ color }}>
          {disk.used}{disk.unit} / {disk.total}{disk.unit}
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-cyan-400/10 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color, boxShadow: `0 0 6px ${color}80` }}
        />
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="font-mono text-[9px] text-cyan-300/50">{pct}% used</span>
        <span className="font-mono text-[9px] text-cyan-300/50">{free}{disk.unit} free</span>
      </div>
    </div>
  );
}

/* =================================================================== */
/*  Status ticker — scrolling strip of live stats + headlines          */
/* =================================================================== */
function StatusTicker() {
  const metrics = useJarvis((s) => s.metrics);
  const network = useJarvis((s) => s.network);
  const power = useJarvis((s) => s.power);
  const disk = useJarvis((s) => s.diskSpace);
  const briefing = useJarvis((s) => s.briefing);
  const active = useJarvis((s) => s.active);

  const items: string[] = [];
  if (metrics.length >= 2) {
    items.push(`CPU ${metrics[0].value}${metrics[0].unit}`);
    items.push(`GPU ${metrics[1].value}${metrics[1].unit}`);
    if (metrics[2]) items.push(`LOAD ${metrics[2].value}${metrics[2].unit}`);
    if (metrics[3]) items.push(`MEM ${metrics[3].value}${metrics[3].unit}`);
  }
  items.push(`NET ${network.down.toFixed(1)}↓/${network.up.toFixed(1)}↑ MB/s`);
  items.push(`PWR ${power.battery}%${power.charging ? "⚡" : ""}`);
  items.push(`DISK ${disk.used}/${disk.total} ${disk.unit}`);
  items.push(`STATE ${active.toUpperCase()}`);
  if (briefing?.weather) items.push(`WX ${briefing.weather}`);
  if (briefing?.todos?.length) items.push(`${briefing.todos.length} TASKS QUEUED`);

  // duplicate the list so the marquee loops seamlessly
  const loop = [...items, ...items];

  return (
    <div className="border-t border-b border-cyan-400/15 bg-[oklch(0.08_0.02_220/80%)] overflow-hidden group">
      <div className="ticker-track py-1 group-hover:[animation-play-state:paused]">
        {loop.map((item, i) => (
          <span key={i} className="font-mono text-[10px] text-cyan-300/60 mx-4 flex items-center gap-2 hover:text-cyan-100 transition cursor-default">
            <span className="w-1 h-1 rounded-full bg-cyan-400/50" />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

/* =================================================================== */
/*  System stats strip — uptime, hostname, connections                 */
/* =================================================================== */
function SystemStatsStrip() {
  const uptimeSec = useJarvis((s) => s.uptimeSec);
  const hostname = useJarvis((s) => s.hostname);
  const connections = useJarvis((s) => s.activeConnections);
  const metrics = useJarvis((s) => s.metrics);
  const processes = useJarvis((s) => s.processes);

  const fmtUptime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    if (h > 0) return `${h}h ${m}m ${sec}s`;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec}s`;
  };

  const cpuTemp = metrics.find((m) => m.id === "cpu-temp")?.value;
  const cpuLoad = metrics.find((m) => m.id === "cpu-load")?.value;

  const stats = [
    { label: "HOST", value: hostname, icon: <Server className="w-3 h-3" /> },
    { label: "UPTIME", value: fmtUptime(uptimeSec), icon: <Clock className="w-3 h-3" /> },
    { label: "CONN", value: String(connections), icon: <Wifi className="w-3 h-3" /> },
    { label: "PROC", value: String(processes.length), icon: <Activity className="w-3 h-3" /> },
    { label: "CPU", value: cpuTemp !== undefined ? `${cpuTemp}°C` : "—", icon: <Thermometer className="w-3 h-3" /> },
    { label: "LOAD", value: cpuLoad !== undefined ? `${cpuLoad}%` : "—", icon: <Gauge className="w-3 h-3" /> },
  ];

  return (
    <div className="border-b border-cyan-400/15 bg-[oklch(0.1_0.02_220/60%)] backdrop-blur-sm">
      <div className="max-w-[1600px] mx-auto px-3 sm:px-5 py-1.5 flex items-center gap-4 flex-wrap">
        {stats.map((s, i) => (
          <div key={s.label} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-cyan-400/20 mr-1">·</span>}
            <span className="text-cyan-300/50">{s.icon}</span>
            <span className="font-mono text-[9px] tracking-widest text-cyan-300/50">{s.label}</span>
            <span className="font-mono text-[11px] text-cyan-glow tabular-nums">{s.value}</span>
          </div>
        ))}
        <div className="flex-1" />
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 status-dot" style={{ color: "#34d399" }} />
          <span className="font-mono text-[9px] tracking-widest text-emerald-300/70">ALL SYSTEMS NOMINAL</span>
        </div>
      </div>
    </div>
  );
}

function TempTile({ label, value, unit, critical, warn, spark, onClick }: { label: string; value: number | string; unit?: string; critical?: boolean; warn?: boolean; spark?: number[]; onClick?: () => void }) {
  const color = critical ? "text-rose-300 border-rose-400/40 bg-rose-400/5" : warn ? "text-amber-300 border-amber-400/40 bg-amber-400/5" : "text-cyan-200 border-cyan-400/30 bg-cyan-400/5";
  const lineColor = critical ? "#fb7185" : warn ? "#fbbf24" : "#22d3ee";
  return (
    <button onClick={onClick} className={`rounded-md border p-2.5 ${color} relative overflow-hidden text-left transition hover:brightness-110 cursor-pointer group w-full`} title="Click for history chart">
      <div className="font-mono text-[9px] tracking-widest opacity-70 flex items-center justify-between">
        <span>{label}</span>
        <span className="opacity-0 group-hover:opacity-60 transition">▾</span>
      </div>
      {typeof value === "number" ? (
        <AnimatedReadout value={value} format={(n) => `${Math.round(n)}${unit || ""}`} className="font-mono text-lg font-semibold tabular-nums" />
      ) : (
        <div className="font-mono text-lg font-semibold tabular-nums">{value}</div>
      )}
      {spark && spark.length > 1 && (
        <div className="mt-1">
          <Sparkline data={spark} width={90} height={18} color={lineColor} unit={unit} label={label} />
        </div>
      )}
    </button>
  );
}

/* =================================================================== */
/*  Processes + Network panel                                           */
/* =================================================================== */
function ProcessesPanel() {
  const processes = useJarvis((s) => s.processes);
  const network = useJarvis((s) => s.network);
  return (
    <HoloPanel title="PROCESSES" icon={<Server className="w-4 h-4" />} accent="violet"
      right={
        <div className="flex items-center gap-2 font-mono text-[9px]">
          <span className="flex items-center gap-1 text-cyan-300/60"><Wifi className="w-3 h-3" />{network.down.toFixed(1)}↓</span>
          <span className="flex items-center gap-1 text-cyan-300/60">{network.up.toFixed(1)}↑</span>
        </div>
      }
    >
      <div className="space-y-1">
        {processes.length === 0 && <div className="font-mono text-[10px] text-cyan-300/40 text-center py-2">scanning processes…</div>}
        {processes.map((p) => (
          <div key={p.id} className="flex items-center gap-2 py-1 px-1.5 rounded hover:bg-cyan-400/5 transition">
            <span className={`w-1.5 h-1.5 rounded-full ${p.status === "hot" ? "bg-rose-400 status-dot" : p.status === "active" ? "bg-cyan-400" : "bg-zinc-600"}`} style={{ color: p.status === "hot" ? "#fb7185" : "#22d3ee" }} />
            <span className="font-mono text-[10px] text-cyan-100/90 truncate flex-1">{p.name}</span>
            <span className={`font-mono text-[9px] tabular-nums ${p.cpu > 20 ? "text-rose-300" : p.cpu > 8 ? "text-amber-300" : "text-cyan-300/60"}`}>{p.cpu.toFixed(1)}%</span>
            <span className="font-mono text-[9px] tabular-nums text-cyan-300/50 w-12 text-right">{Math.round(p.mem)}MB</span>
          </div>
        ))}
      </div>
    </HoloPanel>
  );
}

/* =================================================================== */
/*  Volume panel                                                       */
/* =================================================================== */
function VolumePanel() {
  const [level, setLevel] = useState(50);
  const [muted, setMuted] = useState(false);
  const [busy, setBusy] = useState(false);

  const apply = useCallback(async (action: "up" | "down" | "mute" | "unmute" | "set", lvl?: number) => {
    setBusy(true);
    try {
      const res = await api<{ data: { level: number; muted: boolean; hostCommand: string } }>("/api/volume", {
        method: "POST", json: { action, level: lvl },
      });
      setLevel(res.data.level);
      setMuted(res.data.muted);
      toast.success(`Volume ${res.data.muted ? "muted" : res.data.level + "%"}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  }, []);

  useEffect(() => {
    api<{ data: { level: number; muted: boolean } }>("/api/volume", {}).then((r) => {
      setLevel(r.data.level); setMuted(r.data.muted);
    }).catch(() => {});
  }, []);

  const Icon = muted ? VolumeX : level === 0 ? VolumeX : level < 35 ? Volume1 : Volume2;

  return (
    <div className="holo-panel rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-cyan-300" />
        <h3 className="font-mono text-xs tracking-widest text-cyan-glow">VOLUME CONTROL</h3>
      </div>
      <div className="flex items-center gap-2 mb-3">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => apply("down")}
          className="h-8 w-8 p-0 border-cyan-400/30 bg-cyan-400/5 text-cyan-200 hover:bg-cyan-400/15">
          <Volume1 className="w-3.5 h-3.5" />
        </Button>
        <div className="flex-1">
          <Progress value={muted ? 0 : level} className="h-2 bg-cyan-400/10" />
        </div>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => apply("up")}
          className="h-8 w-8 p-0 border-cyan-400/30 bg-cyan-400/5 text-cyan-200 hover:bg-cyan-400/15">
          <Volume2 className="w-3.5 h-3.5" />
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => apply(muted ? "unmute" : "mute")}
          className={`h-8 w-8 p-0 ${muted ? "border-rose-400/40 bg-rose-400/10 text-rose-300" : "border-cyan-400/30 bg-cyan-400/5 text-cyan-200 hover:bg-cyan-400/15"}`}>
          {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        </Button>
      </div>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] text-cyan-200/60">{muted ? "MUTED" : `${level}%`}</span>
        <span className="font-mono text-[9px] text-cyan-300/40">Windows host bridge ready</span>
      </div>
    </div>
  );
}

/* =================================================================== */
/*  Screenshot panel                                                   */
/* =================================================================== */
function ScreenshotPanel() {
  const [shots, setShots] = useState<{ id: string; filename: string; url: string; createdAt: string }[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await api<{ data: { items: { id: string; filename: string; path: string; createdAt: string }[] } }>("/api/screenshot", {});
      setShots(res.data.items.map((s) => ({ id: s.id, filename: s.filename, url: `/download/${s.filename}`, createdAt: s.createdAt })));
    } catch {}
  }, []);
   
  useEffect(() => { refresh(); }, [refresh]);

  const capture = useCallback(async () => {
    setBusy(true);
    try {
      // getDisplayMedia for screen, capture to canvas, export PNG, POST
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const track = stream.getVideoTracks()[0];
      // @ts-expect-error ImageCapture is non-standard but widely supported
      const captcha = typeof ImageCapture !== "undefined" ? new ImageCapture(track) : null;
      const video = document.createElement("video");
      video.srcObject = stream;
      await video.play();
      // wait a tick for a frame
      await new Promise((r) => setTimeout(r, 250));
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(video, 0, 0);
      track.stop();
      stream.getTracks().forEach((t) => t.stop());
      const dataUrl = canvas.toDataURL("image/png");
      const res = await api<{ data: { filename: string; url: string } }>("/api/screenshot", {
        method: "POST", json: { dataUrl, filename: "screen" },
      });
      toast.success("Screenshot captured");
      setShots((s) => [{ id: Date.now().toString(), filename: res.data.filename, url: res.data.url, createdAt: new Date().toISOString() }, ...s]);
    } catch (e) {
      const msg = (e as Error).message || "capture failed";
      if (/permission|denied|dismiss/i.test(msg)) toast.error("Screen capture permission denied");
      else toast.error("Screenshot failed: " + msg.slice(0, 80));
    } finally { setBusy(false); }
  }, []);

  // listen for command-palette capture trigger
  useEffect(() => {
    const handler = () => { capture(); };
    window.addEventListener("jarvis:capture-screenshot", handler);
    return () => window.removeEventListener("jarvis:capture-screenshot", handler);
  }, [capture]);

  return (
    <div className="holo-panel rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Camera className="w-4 h-4 text-cyan-300" />
        <h3 className="font-mono text-xs tracking-widest text-cyan-glow">SCREENSHOT</h3>
        <Button size="sm" variant="ghost" onClick={refresh} className="ml-auto h-6 w-6 p-0 text-cyan-300/60 hover:text-cyan-200">
          <RefreshCw className="w-3 h-3" />
        </Button>
      </div>
      <Button onClick={capture} disabled={busy} className="w-full mb-3 bg-cyan-400/15 border border-cyan-400/40 text-cyan-100 hover:bg-cyan-400/25 font-mono text-[11px]">
        <Camera className="w-3.5 h-3.5 mr-2" />{busy ? "CAPTURING…" : "CAPTURE SCREEN"}
      </Button>
      <ScrollArea className="h-32 jarvis-scroll">
        <div className="space-y-1.5 pr-2">
          {shots.length === 0 && <div className="font-mono text-[10px] text-cyan-300/40">No screenshots yet.</div>}
          {shots.map((s) => (
            <a key={s.id} href={s.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-1.5 rounded border border-cyan-400/15 bg-cyan-400/5 hover:bg-cyan-400/10 transition group">
              <Camera className="w-3 h-3 text-cyan-300/60 group-hover:text-cyan-200" />
              <span className="font-mono text-[10px] text-cyan-200/70 truncate flex-1">{s.filename}</span>
              <span className="font-mono text-[9px] text-cyan-300/40">{fmtTime(s.createdAt)}</span>
            </a>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

/* =================================================================== */
/*  Hologram panel                                                     */
/* =================================================================== */
function HologramPanel({ statusLabel }: { statusLabel: string }) {
  const { status, active, holoMode, setHoloMode } = useJarvis();
  const modeLabel = holoMode === "reactor" ? "ARC REACTOR" : holoMode === "spectrum" ? "SPECTRUM" : holoMode === "waveform" ? "WAVEFORM" : "RADAR";
  const modes: { id: "reactor" | "spectrum" | "waveform" | "radar"; label: string }[] = [
    { id: "reactor", label: "R" },
    { id: "spectrum", label: "S" },
    { id: "waveform", label: "W" },
    { id: "radar", label: "@" },
  ];
  const switchMode = (m: "reactor" | "spectrum" | "waveform" | "radar") => {
    setHoloMode(m);
    // persist to settings
    api("/api/settings", { method: "POST", json: { key: "holoMode", value: m } }).catch(() => {});
  };
  return (
    <div className="holo-panel rounded-lg p-4 relative overflow-hidden">
      <div className="absolute top-3 left-4 font-mono text-[10px] tracking-widest text-cyan-300/50">CORE // {modeLabel}</div>
      <div className="absolute top-3 right-4 font-mono text-[10px] tracking-widest text-cyan-300/50">{statusLabel}</div>
      {/* HUD corner brackets */}
      <span className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-400/60 rounded-tl" />
      <span className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyan-400/60 rounded-tr" />
      <span className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyan-400/60 rounded-bl" />
      <span className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-400/60 rounded-br" />
      <div key={holoMode} className="flex justify-center items-center py-2 holo-fade">
        <Hologram status={status} active={active} size={320} mode={holoMode} />
      </div>
      {/* Mode selector */}
      <div className="absolute top-10 right-3 flex flex-col gap-1">
        {modes.map((m) => (
          <button
            key={m.id}
            onClick={() => switchMode(m.id)}
            className={`w-6 h-6 rounded font-mono text-[10px] font-bold transition ${holoMode === m.id ? "bg-cyan-400/25 text-cyan-100 border border-cyan-400/50" : "text-cyan-300/40 border border-cyan-400/15 hover:text-cyan-200 hover:border-cyan-400/30"}`}
            title={m.id}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-6 font-mono text-[10px] text-cyan-300/40">
        <span className="flex items-center gap-1"><Gauge className="w-3 h-3" />OUTPUT 1.21 GW</span>
        <span className="flex items-center gap-1"><Zap className="w-3 h-3" />FLUX 99.4%</span>
        <span className="flex items-center gap-1"><Droplets className="w-3 h-3" />COOLANT NOMINAL</span>
      </div>
    </div>
  );
}

/* =================================================================== */
/*  Briefing panel                                                     */
/* =================================================================== */
function BriefingPanel({ briefing, onSpeak }: { briefing: Briefing; onSpeak: () => void }) {
  return (
    <div className="holo-panel rounded-lg p-4 relative">
      <div className="flex items-center gap-2 mb-2">
        <Sunrise className="w-4 h-4 text-amber-300" />
        <h3 className="font-mono text-xs tracking-widest text-amber-glow">MORNING BRIEFING</h3>
        <Button size="sm" variant="ghost" onClick={onSpeak} className="ml-auto h-6 px-2 text-cyan-300/70 hover:text-cyan-200 font-mono text-[10px]">
          <Volume2 className="w-3 h-3 mr-1" />SPEAK
        </Button>
      </div>
      <p className="font-mono text-sm text-cyan-100/90 leading-relaxed mb-3">{briefing.summary}</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
        <div className="rounded border border-cyan-400/15 bg-cyan-400/5 p-2">
          <div className="flex items-center gap-1.5 font-mono text-[9px] text-cyan-300/60 mb-1"><ListChecks className="w-3 h-3" />TODAY'S TASKS</div>
          <ul className="space-y-0.5">
            {briefing.todos.slice(0, 4).map((t, i) => (
              <li key={i} className="font-mono text-[10px] text-cyan-200/80 truncate">{t}</li>
            ))}
          </ul>
        </div>
        <div className="rounded border border-cyan-400/15 bg-cyan-400/5 p-2">
          <div className="flex items-center gap-1.5 font-mono text-[9px] text-cyan-300/60 mb-1"><Droplets className="w-3 h-3" />WEATHER</div>
          <div className="font-mono text-[11px] text-cyan-200/80">{briefing.weather || "18°C clear"}</div>
        </div>
        <div className="rounded border border-cyan-400/15 bg-cyan-400/5 p-2">
          <div className="flex items-center gap-1.5 font-mono text-[9px] text-cyan-300/60 mb-1"><Newspaper className="w-3 h-3" />HEADLINES</div>
          <ul className="space-y-0.5">
            {(briefing.news || []).slice(0, 3).map((n, i) => (
              <li key={i} className="font-mono text-[10px] text-cyan-200/80 truncate">{n}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* =================================================================== */
/*  Chat panel                                                         */
/* =================================================================== */
function ChatPanel({ voice }: { voice: ReturnType<typeof useVoice> }) {
  const store = useJarvis();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [store.messages]);

  const send = useCallback(async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    setInput("");
    store.pushMessage({ id: crypto.randomUUID(), role: "user", content, ts: Date.now() });
    setBusy(true);
    store.setStatus("thinking");
    try {
      const res = await api<{ data: { reply: string } }>("/api/chat", {
        method: "POST",
        json: {
          message: content,
          history: store.messages
            .filter((m) => m.id !== "welcome" && m.id !== "reset")
            .slice(-8)
            .map((m) => ({ role: m.role, content: m.content })),
          voiceLive: store.voiceLive,
        },
      });
      store.pushMessage({ id: crypto.randomUUID(), role: "assistant", content: res.data.reply, ts: Date.now() });
      // auto-speak the reply
      voice.speak(res.data.reply, store.voiceLive);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Assistant offline";
      store.pushMessage({ id: crypto.randomUUID(), role: "assistant", content: `⚠ ${msg}`, ts: Date.now() });
    } finally {
      setBusy(false);
      store.setStatus("idle");
    }
     
  }, [busy, store.messages, store.voiceLive]);

  const onMic = useCallback(() => {
    if (store.voiceLive) {
      voice.toggleLiveRecognition(
        (text) => { if (text.trim()) send(text); },
        (e) => toast.error("Mic: " + e),
      );
    } else {
      voice.recordAndTranscribe(
        (text) => { if (text.trim()) send(text); else toast.error("No speech detected"); },
        (e) => toast.error("ASR: " + e),
      );
    }
     
  }, [store.voiceLive, send]);

  return (
    <div className="holo-panel rounded-lg p-4 flex flex-col" style={{ minHeight: 360 }}>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-cyan-300" />
        <h3 className="font-mono text-xs tracking-widest text-cyan-glow">ASSISTANT</h3>
        <Badge variant="outline" className="ml-auto border-cyan-400/30 text-cyan-200/70 font-mono text-[9px]">
          {store.voiceLive ? "VOICE LIVE" : "LEGACY TTS"}
        </Badge>
        <Button size="sm" variant="ghost" onClick={() => store.clearMessages()} className="h-6 w-6 p-0 text-cyan-300/60 hover:text-cyan-200">
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto jarvis-scroll space-y-2.5 pr-1 mb-3" style={{ maxHeight: 280 }}>
        {store.messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-lg px-3 py-2 font-mono text-xs leading-relaxed ${
              m.role === "user"
                ? "bg-cyan-400/15 border border-cyan-400/30 text-cyan-50"
                : "bg-cyan-400/5 border border-cyan-400/15 text-cyan-100/90"
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="rounded-lg px-3 py-2 bg-cyan-400/5 border border-cyan-400/15 font-mono text-xs text-cyan-300/70">
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 status-dot" />
                processing…
              </span>
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="flex items-center gap-2"
      >
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onMic}
          className={`h-9 w-9 p-0 ${voice.listening ? "border-emerald-400/50 bg-emerald-400/15 text-emerald-300" : "border-cyan-400/30 bg-cyan-400/5 text-cyan-200 hover:bg-cyan-400/15"}`}
          aria-label="Voice input"
        >
          {voice.listening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
        </Button>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={store.voiceLive ? "Speak or type…" : "Type a command…"}
          className="flex-1 bg-cyan-400/5 border-cyan-400/25 text-cyan-100 placeholder:text-cyan-300/40 font-mono text-sm focus-visible:ring-cyan-400/40"
        />
        <Button type="submit" disabled={busy || !input.trim()} size="sm"
          className="h-9 px-4 bg-cyan-400/20 border border-cyan-400/40 text-cyan-100 hover:bg-cyan-400/30 font-mono text-[11px]">
          <Send className="w-3.5 h-3.5 mr-1.5" />SEND
        </Button>
      </form>
    </div>
  );
}

/* =================================================================== */
/*  Email panel                                                        */
/* =================================================================== */
function EmailPanel() {
  const [messages, setMessages] = useState<EmailMsg[]>([]);
  const [open, setOpen] = useState<EmailMsg | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ data: { messages: EmailMsg[]; accounts: { id: string; provider: string; address: string; unread: number }[] } }>("/api/email", {});
      setMessages(res.data.messages);
    } catch {} finally { setLoading(false); }
  }, []);
   
  useEffect(() => { refresh(); }, [refresh]);

  const markRead = useCallback(async (id: string) => {
    setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, read: true } : m)));
    await api("/api/email", { method: "POST", json: { action: "markRead", messageId: id } }).catch(() => {});
  }, []);

  const toggleStar = useCallback(async (id: string) => {
    setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, starred: !m.starred } : m)));
    await api("/api/email", { method: "POST", json: { action: "star", messageId: id } }).catch(() => {});
  }, []);

  return (
    <div className="holo-panel rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Mail className="w-4 h-4 text-cyan-300" />
        <h3 className="font-mono text-xs tracking-widest text-cyan-glow">INBOX</h3>
        <Badge variant="outline" className="ml-auto border-cyan-400/30 text-cyan-200/70 font-mono text-[9px]">
          {messages.filter((m) => !m.read).length} UNREAD
        </Badge>
        <Button size="sm" variant="ghost" onClick={refresh} className="h-6 w-6 p-0 text-cyan-300/60 hover:text-cyan-200">
          <RefreshCw className="w-3 h-3" />
        </Button>
      </div>
      <ScrollArea className="h-44 jarvis-scroll">
        <div className="space-y-1.5 pr-2">
          {loading && <div className="font-mono text-[10px] text-cyan-300/40">syncing inbox…</div>}
          {!loading && messages.length === 0 && <div className="font-mono text-[10px] text-cyan-300/40">No messages.</div>}
          {messages.map((m) => (
            <button
              key={m.id}
              onClick={() => { setOpen(m); markRead(m.id); }}
              className={`w-full text-left p-2 rounded border transition group ${m.read ? "border-cyan-400/10 bg-cyan-400/3" : "border-cyan-400/25 bg-cyan-400/8"} hover:bg-cyan-400/15`}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                {!m.read && <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 status-dot" style={{ color: "#22d3ee" }} />}
                <span className="font-mono text-[10px] text-cyan-200/80 truncate flex-1">{m.from}</span>
                <span className="font-mono text-[9px] text-cyan-300/40">{fmtTime(m.date)}</span>
              </div>
              <div className="font-mono text-[11px] text-cyan-100/90 truncate">{m.subject}</div>
              <div className="font-mono text-[9px] text-cyan-300/50 truncate">{m.preview}</div>
            </button>
          ))}
        </div>
      </ScrollArea>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(null)}>
          <div className="holo-panel rounded-lg p-5 max-w-lg w-full max-h-[80vh] overflow-y-auto jarvis-scroll" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-2 mb-3">
              <div className="flex-1">
                <div className="font-mono text-[10px] text-cyan-300/60">FROM {open.from}</div>
                <h4 className="font-mono text-sm text-cyan-glow mt-0.5">{open.subject}</h4>
              </div>
              <Button size="sm" variant="ghost" onClick={() => toggleStar(open.id)} className="h-7 w-7 p-0">
                <Star className={`w-3.5 h-3.5 ${open.starred ? "fill-amber-300 text-amber-300" : "text-cyan-300/60"}`} />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setOpen(null)} className="h-7 w-7 p-0 text-cyan-300/60 hover:text-cyan-200">
                <X className="w-4 h-4" />
              </Button>
            </div>
            <pre className="font-mono text-xs text-cyan-100/85 whitespace-pre-wrap leading-relaxed">{open.body || open.preview}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

/* =================================================================== */
/*  Calendar panel                                                     */
/* =================================================================== */
function CalendarPanel() {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState("");

  const refresh = useCallback(async () => {
    try {
      const res = await api<{ data: { events: CalEvent[] } }>("/api/calendar", {});
      setEvents(res.data.events);
    } catch {}
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { refresh(); }, [refresh]);

  const add = useCallback(async () => {
    if (!title.trim() || !when) return;
    try {
      await api("/api/calendar", { method: "POST", json: { title, startAt: new Date(when).toISOString() } });
      setTitle(""); setWhen(""); setAdding(false);
      refresh();
      toast.success("Event added");
    } catch (e) { toast.error((e as Error).message); }
  }, [title, when, refresh]);

  return (
    <div className="holo-panel rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <CalIcon className="w-4 h-4 text-cyan-300" />
        <h3 className="font-mono text-xs tracking-widest text-cyan-glow">CALENDAR</h3>
        <Badge variant="outline" className="ml-auto border-cyan-400/30 text-cyan-200/70 font-mono text-[9px]">{events.length} EVENTS</Badge>
        <Button size="sm" variant="ghost" onClick={() => setAdding((a) => !a)} className="h-6 w-6 p-0 text-cyan-300/60 hover:text-cyan-200">
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>
      {adding && (
        <div className="mb-3 space-y-2 p-2 rounded border border-cyan-400/20 bg-cyan-400/5">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event title" className="h-8 bg-cyan-400/5 border-cyan-400/25 text-cyan-100 font-mono text-xs" />
          <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="h-8 bg-cyan-400/5 border-cyan-400/25 text-cyan-100 font-mono text-xs" />
          <Button size="sm" onClick={add} className="w-full h-7 bg-cyan-400/20 border border-cyan-400/40 text-cyan-100 font-mono text-[10px]">ADD EVENT</Button>
        </div>
      )}
      <ScrollArea className="h-40 jarvis-scroll">
        <div className="space-y-1.5 pr-2">
          {events.length === 0 && <div className="font-mono text-[10px] text-cyan-300/40">No upcoming events.</div>}
          {events.map((e) => (
            <div key={e.id} className="p-2 rounded border border-cyan-400/15 bg-cyan-400/5">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-300" />
                <span className="font-mono text-[11px] text-cyan-100/90 truncate flex-1">{e.title}</span>
                <span className="font-mono text-[9px] text-cyan-300/50">{fmtTime(e.startAt)}</span>
              </div>
              <div className="font-mono text-[9px] text-cyan-300/50 ml-3">
                {fmtDate(e.startAt)}{e.location ? ` · ${e.location}` : ""}{e.source === "google" ? " · google" : ""}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

/* =================================================================== */
/*  Habits panel                                                       */
/* =================================================================== */
function HabitsPanel() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");

  const refresh = useCallback(async () => {
    try {
      const res = await api<{ data: { habits: Habit[] } }>("/api/habits", {});
      setHabits(res.data.habits);
    } catch {}
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { refresh(); }, [refresh]);

  const toggle = useCallback(async (id: string) => {
    setHabits((hs) => hs.map((h) => (h.id === id ? { ...h, completed: !h.completed, streak: h.completed ? h.streak - 1 : h.streak + 1 } : h)));
    await api("/api/habits", { method: "POST", json: { action: "complete", id } }).catch(() => {});
  }, []);

  const add = useCallback(async () => {
    if (!title.trim()) return;
    await api("/api/habits", { method: "POST", json: { action: "create", title } });
    setTitle(""); setAdding(false); refresh();
  }, [title, refresh]);

  const remove = useCallback(async (id: string) => {
    setHabits((hs) => hs.filter((h) => h.id !== id));
    await api("/api/habits", { method: "POST", json: { action: "delete", id } }).catch(() => {});
  }, []);

  return (
    <div className="holo-panel rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <ListChecks className="w-4 h-4 text-cyan-300" />
        <h3 className="font-mono text-xs tracking-widest text-cyan-glow">HABITS</h3>
        <Button size="sm" variant="ghost" onClick={() => setAdding((a) => !a)} className="ml-auto h-6 w-6 p-0 text-cyan-300/60 hover:text-cyan-200">
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>
      {adding && (
        <div className="mb-3 flex gap-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New habit" className="h-8 bg-cyan-400/5 border-cyan-400/25 text-cyan-100 font-mono text-xs" />
          <Button size="sm" onClick={add} className="h-8 px-3 bg-cyan-400/20 border border-cyan-400/40 text-cyan-100 font-mono text-[10px]">ADD</Button>
        </div>
      )}
      <ScrollArea className="h-40 jarvis-scroll">
        <div className="space-y-1.5 pr-2">
          {habits.length === 0 && <div className="font-mono text-[10px] text-cyan-300/40">No habits tracked.</div>}
          {habits.map((h) => (
            <div key={h.id} className={`p-2 rounded border transition ${h.completed ? "border-emerald-400/30 bg-emerald-400/5" : "border-cyan-400/15 bg-cyan-400/5"} group`}>
              <div className="flex items-center gap-2">
                <button onClick={() => toggle(h.id)} className={`w-4 h-4 rounded border flex items-center justify-center transition ${h.completed ? "bg-emerald-400/30 border-emerald-400/50 text-emerald-200" : "border-cyan-400/40 hover:border-cyan-400/70"}`} aria-label="Toggle habit">
                  {h.completed && <Check className="w-3 h-3" />}
                </button>
                <span className={`font-mono text-[11px] flex-1 truncate ${h.completed ? "text-cyan-300/50 line-through" : "text-cyan-100/90"}`}>{h.title}</span>
                <span className="font-mono text-[9px] text-amber-300/70">{h.streak}🔥</span>
                <button onClick={() => remove(h.id)} className="opacity-0 group-hover:opacity-100 text-cyan-300/40 hover:text-rose-300 transition"><X className="w-3 h-3" /></button>
              </div>
              {h.time && <div className="font-mono text-[9px] text-cyan-300/40 ml-6">{h.cadence} · {h.time}</div>}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

/* =================================================================== */
/*  Schedules panel                                                    */
/* =================================================================== */
function SchedulesPanel() {
  const [items, setItems] = useState<Sched[]>([]);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [cron, setCron] = useState("");

  const refresh = useCallback(async () => {
    try {
      const res = await api<{ data: { schedules: Sched[] } }>("/api/schedules", {});
      setItems(res.data.schedules);
    } catch {}
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { refresh(); }, [refresh]);

  const add = useCallback(async () => {
    if (!title.trim()) return;
    try {
      await api("/api/schedules", { method: "POST", json: { action: "create", title, cron } });
      setTitle(""); setCron(""); setAdding(false); refresh();
      toast.success("Schedule created");
    } catch (e) { toast.error((e as Error).message); }
  }, [title, cron, refresh]);

  const complete = useCallback(async (id: string) => {
    setItems((it) => it.map((s) => (s.id === id ? { ...s, done: true } : s)));
    await api("/api/schedules", { method: "POST", json: { action: "complete", id } }).catch(() => {});
  }, []);

  const remove = useCallback(async (id: string) => {
    setItems((it) => it.filter((s) => s.id !== id));
    await api("/api/schedules", { method: "POST", json: { action: "delete", id } }).catch(() => {});
  }, []);

  return (
    <div className="holo-panel rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-cyan-300" />
        <h3 className="font-mono text-xs tracking-widest text-cyan-glow">SCHEDULES</h3>
        <Button size="sm" variant="ghost" onClick={() => setAdding((a) => !a)} className="ml-auto h-6 w-6 p-0 text-cyan-300/60 hover:text-cyan-200">
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>
      {adding && (
        <div className="mb-3 space-y-2 p-2 rounded border border-cyan-400/20 bg-cyan-400/5">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Schedule title" className="h-8 bg-cyan-400/5 border-cyan-400/25 text-cyan-100 font-mono text-xs" />
          <Input value={cron} onChange={(e) => setCron(e.target.value)} placeholder="cron e.g. 0 9 * * *" className="h-8 bg-cyan-400/5 border-cyan-400/25 text-cyan-100 font-mono text-xs" />
          <Button size="sm" onClick={add} className="w-full h-7 bg-cyan-400/20 border border-cyan-400/40 text-cyan-100 font-mono text-[10px]">CREATE</Button>
        </div>
      )}
      <ScrollArea className="h-36 jarvis-scroll">
        <div className="space-y-1.5 pr-2">
          {items.length === 0 && <div className="font-mono text-[10px] text-cyan-300/40">No schedules.</div>}
          {items.map((s) => (
            <div key={s.id} className={`p-2 rounded border group ${s.done ? "border-emerald-400/20 bg-emerald-400/3 opacity-60" : "border-cyan-400/15 bg-cyan-400/5"}`}>
              <div className="flex items-center gap-2">
                <ChevronRight className="w-3 h-3 text-cyan-300/60" />
                <span className={`font-mono text-[11px] flex-1 truncate ${s.done ? "text-cyan-300/50 line-through" : "text-cyan-100/90"}`}>{s.title}</span>
                {!s.done && <button onClick={() => complete(s.id)} className="opacity-0 group-hover:opacity-100 text-emerald-300/70 hover:text-emerald-200"><Check className="w-3 h-3" /></button>}
                <button onClick={() => remove(s.id)} className="opacity-0 group-hover:opacity-100 text-cyan-300/40 hover:text-rose-300"><X className="w-3 h-3" /></button>
              </div>
              {s.cron && <div className="font-mono text-[9px] text-cyan-300/40 ml-5">cron {s.cron}</div>}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

/* =================================================================== */
/*  News drawer (opens on NEWS button)                                 */
/* =================================================================== */
function NewsDrawer() {
  const store = useJarvis();
  const [topic, setTopic] = useState("technology");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNews = useCallback(async (t: string) => {
    setLoading(true); setError(null);
    try {
      const res = await api<{ data: { items: NewsItem[] } }>("/api/news", { method: "POST", json: { topic: t, num: 8 } });
      store.setNews(res.data.items);
    } catch (e) {
      setError((e as Error).message);
    } finally { setLoading(false); }
  }, [store]);

  useEffect(() => {
    if (store.newsOpen && store.news.length === 0) fetchNews(topic);
     
  }, [store.newsOpen]);

  if (!store.newsOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm" onClick={() => store.setNewsOpen(false)}>
      <div
        className="holo-panel rounded-l-lg w-full max-w-md h-full flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 p-4 border-b border-cyan-400/20">
          <Newspaper className="w-4 h-4 text-cyan-300" />
          <h3 className="font-mono text-xs tracking-widest text-cyan-glow">NEWS FEED</h3>
          <Button size="sm" variant="ghost" onClick={() => store.setNewsOpen(false)} className="ml-auto h-7 w-7 p-0 text-cyan-300/60 hover:text-cyan-200">
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="p-3 border-b border-cyan-400/15 flex items-center gap-2">
          <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="topic" className="h-8 bg-cyan-400/5 border-cyan-400/25 text-cyan-100 font-mono text-xs" />
          <Button size="sm" onClick={() => fetchNews(topic)} disabled={loading} className="h-8 px-3 bg-cyan-400/20 border border-cyan-400/40 text-cyan-100 font-mono text-[10px]">
            {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : "SEARCH"}
          </Button>
        </div>
        <ScrollArea className="flex-1 jarvis-scroll">
          <div className="p-3 space-y-2">
            {error && <div className="font-mono text-xs text-rose-300 p-2">{error}</div>}
            {!loading && store.news.length === 0 && !error && (
              <div className="font-mono text-[11px] text-cyan-300/50">No results. Try another topic.</div>
            )}
            {store.news.map((n, i) => (
              <a key={i} href={n.url} target="_blank" rel="noreferrer" className="block p-2.5 rounded border border-cyan-400/15 bg-cyan-400/5 hover:bg-cyan-400/12 hover:border-cyan-400/30 transition group">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="font-mono text-[9px] text-amber-300/70 uppercase tracking-wider">{n.source || "source"}</span>
                  {n.date && <span className="font-mono text-[9px] text-cyan-300/40">{fmtDate(n.date)}</span>}
                  <ChevronRight className="w-3 h-3 text-cyan-300/40 ml-auto group-hover:translate-x-0.5 transition" />
                </div>
                <div className="font-mono text-[12px] text-cyan-100/90 leading-snug mb-1">{n.title}</div>
                {n.snippet && <div className="font-mono text-[10px] text-cyan-300/60 leading-relaxed line-clamp-2">{n.snippet}</div>}
              </a>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

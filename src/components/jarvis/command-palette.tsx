"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Search, Newspaper, Settings2, Camera, Volume2, Mic, Plus, Trash2,
  RefreshCw, Power, Zap, CloudSun, Mail, Calendar as CalIcon, ListChecks,
  Clock, Sparkles, Send, X, CornerDownLeft,
} from "lucide-react";
import { useJarvis } from "@/lib/store";
import { api } from "@/lib/api-client";
import { toast } from "sonner";

interface Command {
  id: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
  section: string;
  keywords: string[];
  run: (ctx: CommandContext) => void | Promise<void>;
}

interface CommandContext {
  store: ReturnType<typeof useJarvis.getState>;
  voiceToggle: () => void;
  voiceSpeak: (text: string) => void;
  captureScreenshot: () => void;
  refreshAll: () => void;
}

export function CommandPalette({
  open,
  onClose,
  ctx,
}: {
  open: boolean;
  onClose: () => void;
  ctx: CommandContext;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // load recent commands from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("jarvis:recent-cmds");
      if (saved) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setRecent(JSON.parse(saved));
      }
    } catch {}
  }, []);

  const recordRecent = (id: string) => {
    setRecent((r) => {
      const next = [id, ...r.filter((x) => x !== id)].slice(0, 4);
      try { localStorage.setItem("jarvis:recent-cmds", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const commands: Command[] = [
    { id: "news", label: "Open News Feed", hint: "Open the news drawer", section: "Navigate", icon: <Newspaper className="w-4 h-4" />, keywords: ["news", "headlines", "articles"],
      run: (c) => { c.store.setNewsOpen(true); } },
    { id: "settings", label: "Open Command Center", hint: "Settings & configuration", section: "Navigate", icon: <Settings2 className="w-4 h-4" />, keywords: ["settings", "config", "theme", "accent"],
      run: (c) => { c.store.setSettingsOpen(true); } },
    { id: "voice-live", label: "Toggle Voice Live", hint: "Switch real-time voice mode", section: "Voice", icon: <Zap className="w-4 h-4" />, keywords: ["voice", "live", "speech", "tts"],
      run: (c) => { c.store.setVoiceLive(!c.store.voiceLive); toast.success(`Voice Live ${!c.store.voiceLive ? "ON" : "OFF"}`); } },
    { id: "speak-status", label: "Speak System Status", hint: "JARVIS reads current telemetry", section: "Voice", icon: <Mic className="w-4 h-4" />, keywords: ["speak", "status", "read", "announce"],
      run: (c) => {
        const m = c.store.metrics;
        const txt = m.length
          ? `System status. CPU ${m[0].value} degrees, GPU ${m[1]?.value} degrees. CPU load ${m[2]?.value} percent, memory ${m[3]?.value} percent. All systems nominal.`
          : "Telemetry initialising. Stand by.";
        c.voiceSpeak(txt);
      } },
    { id: "screenshot", label: "Capture Screenshot", hint: "Grab the current screen", section: "Actions", icon: <Camera className="w-4 h-4" />, keywords: ["screenshot", "capture", "screen", "image"],
      run: (c) => { c.captureScreenshot(); } },
    { id: "briefing", label: "Regenerate Briefing", hint: "Compose a fresh morning briefing", section: "Actions", icon: <Sparkles className="w-4 h-4" />, keywords: ["briefing", "summary", "morning", "report"],
      run: async (c) => {
        toast.info("Composing briefing…");
        try {
          const res = await api<{ data: { briefing: { summary: string; todos: string[]; weather?: string } } }>("/api/briefing", { method: "POST", json: { regenerate: true } });
          c.store.setBriefing(res.data.briefing);
          toast.success("Briefing updated");
        } catch (e) { toast.error((e as Error).message); }
      } },
    { id: "weather", label: "Refresh Weather", hint: "Fetch latest forecast", section: "Actions", icon: <CloudSun className="w-4 h-4" />, keywords: ["weather", "forecast", "temperature"],
      run: () => { toast.info("Weather refreshes in its panel"); } },
    { id: "active", label: "Activate JARVIS", hint: "Set state to ACTIVE", section: "System", icon: <Power className="w-4 h-4" />, keywords: ["active", "enable", "on", "power"],
      run: (c) => { c.store.setActive("active"); toast.success("JARVIS active"); } },
    { id: "disable", label: "Disable JARVIS", hint: "Set state to DISABLED", section: "System", icon: <Power className="w-4 h-4" />, keywords: ["disable", "off", "standby"],
      run: (c) => { c.store.setActive("disabled"); toast.warning("JARVIS disabled"); } },
    { id: "clear-chat", label: "Clear Chat History", hint: "Reset conversation context", section: "System", icon: <Trash2 className="w-4 h-4" />, keywords: ["clear", "chat", "reset", "history"],
      run: (c) => { c.store.clearMessages(); toast.success("Chat cleared"); } },
    { id: "refresh", label: "Refresh All Panels", hint: "Reload inbox, calendar, habits", section: "System", icon: <RefreshCw className="w-4 h-4" />, keywords: ["refresh", "reload", "sync"],
      run: (c) => { c.refreshAll(); } },
  ];

  // fuzzy match: checks if all chars of query appear in order in the target
  const fuzzyMatch = (target: string, q: string): boolean => {
    if (target.includes(q)) return true;
    let ti = 0;
    for (let qi = 0; qi < q.length && ti < target.length; ) {
      if (target[ti] === q[qi]) qi++;
      ti++;
    }
    return ti < target.length || (target.length > 0 && q.length > 0 && target[target.length - 1] === q[q.length - 1] && q.every(ch => target.includes(ch)));
  };

  const filtered = commands
    .map((cmd) => {
      if (!query.trim()) return { cmd, score: recent.includes(cmd.id) ? 100 - recent.indexOf(cmd.id) * 10 : 0 };
      const q = query.toLowerCase();
      const label = cmd.label.toLowerCase();
      const kws = cmd.keywords.map((k) => k.toLowerCase());
      const sec = cmd.section.toLowerCase();
      let score = 0;
      if (label.includes(q)) score = 100 - label.indexOf(q);
      else if (kws.some((k) => k.includes(q))) score = 80 - kws.findIndex((k) => k.includes(q)) * 5;
      else if (sec.includes(q)) score = 60;
      else if (fuzzyMatch(label, q)) score = 40;
      else if (kws.some((k) => fuzzyMatch(k, q))) score = 30;
      // boost recent commands
      if (recent.includes(cmd.id)) score += 15;
      return { cmd, score };
    })
    .filter((x) => x.score > 0 || !query.trim())
    .sort((a, b) => b.score - a.score)
    .map((x) => x.cmd);

  // group by section, with "Recent" first when no query
  const sections: Record<string, Command[]> = {};
  if (!query.trim() && recent.length > 0) {
    sections["Recent"] = recent
      .map((id) => commands.find((c) => c.id === id))
      .filter((c): c is Command => !!c);
  }
  filtered.forEach((cmd) => {
    (sections[cmd.section] = sections[cmd.section] || []).push(cmd);
  });

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(filtered.length - 1, a + 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
      if (e.key === "Enter") {
        e.preventDefault();
        const cmd = filtered[active];
        if (cmd) { recordRecent(cmd.id); cmd.run(ctx); onClose(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, active, ctx, onClose]);

  // scroll active into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  let runningIdx = -1;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] px-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="holo-panel rounded-lg w-full max-w-xl overflow-hidden"
        style={{ borderColor: "rgba(34,211,238,0.45)", boxShadow: "0 0 48px rgba(34,211,238,0.2)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-cyan-400/20">
          <Search className="w-4 h-4 text-cyan-300" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            placeholder="Type a command or search…"
            className="flex-1 bg-transparent outline-none font-mono text-sm text-cyan-100 placeholder:text-cyan-300/40"
          />
          <kbd className="font-mono text-[9px] text-cyan-300/50 border border-cyan-400/20 rounded px-1.5 py-0.5">ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto jarvis-scroll p-2">
          {filtered.length === 0 && (
            <div className="font-mono text-xs text-cyan-300/40 text-center py-6">No commands match "{query}"</div>
          )}
          {Object.entries(sections).map(([section, cmds]) => (
            <div key={section} className="mb-1">
              <div className="font-mono text-[9px] tracking-widest text-cyan-300/40 px-2 py-1.5">{section}</div>
              {cmds.map((cmd) => {
                runningIdx += 1;
                const idx = runningIdx;
                const isActive = idx === active;
                return (
                  <button
                    key={cmd.id}
                    data-idx={idx}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => { recordRecent(cmd.id); cmd.run(ctx); onClose(); }}
                    className={`w-full flex items-center gap-3 px-2.5 py-2 rounded transition ${isActive ? "bg-cyan-400/15 border border-cyan-400/30" : "border border-transparent hover:bg-cyan-400/5"}`}
                  >
                    <span className={isActive ? "text-cyan-200" : "text-cyan-300/60"}>{cmd.icon}</span>
                    <div className="flex-1 text-left">
                      <div className={`font-mono text-xs ${isActive ? "text-cyan-100" : "text-cyan-200/80"}`}>{cmd.label}</div>
                      <div className="font-mono text-[9px] text-cyan-300/40">{cmd.hint}</div>
                    </div>
                    {isActive && <CornerDownLeft className="w-3 h-3 text-cyan-300/50" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-cyan-400/15 text-[9px] font-mono text-cyan-300/40">
          <span className="flex items-center gap-2">
            <kbd className="border border-cyan-400/20 rounded px-1">↑↓</kbd> navigate
            <kbd className="border border-cyan-400/20 rounded px-1">↵</kbd> run
          </span>
          <span>{filtered.length} commands</span>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TerminalSquare, Send, Trash2, ChevronRight } from "lucide-react";
import { HoloPanel } from "./holo-panel";
import { api } from "@/lib/api-client";
import { Input } from "@/components/ui/input";

interface Line {
  id: string;
  type: "cmd" | "out" | "err";
  text: string;
  ts: number;
}

const BOOT_LINES = [
  "JARVIS Terminal v1.0 — secure shell",
  "Type 'help' for available commands. Tab to autocomplete.",
  "",
];

const KNOWN_COMMANDS = [
  "help", "status", "time", "date", "whoami", "uptime", "scan", "ping",
  "echo", "clear", "weather", "news", "alerts", "calendar", "email",
  "habits", "volume", "sysinfo", "reboot", "holo", "sudo",
];

export function TerminalPanel() {
  const [lines, setLines] = useState<Line[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<string[]>([]);
  const histIdxRef = useRef(-1);

  // boot message
  useEffect(() => {
    setLines(BOOT_LINES.map((t, i) => ({ id: `boot-${i}`, type: "out" as const, text: t, ts: Date.now() })));
  }, []);

  // autoscroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [lines]);

  const run = useCallback(async (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;
    setBusy(true);
    historyRef.current.push(trimmed);
    histIdxRef.current = -1;
    setLines((l) => [...l, { id: crypto.randomUUID(), type: "cmd", text: trimmed, ts: Date.now() }]);
    setInput("");
    try {
      const res = await api<{ data: { output: string; ok: boolean } }>("/api/terminal", {
        method: "POST", json: { command: trimmed },
      });
      if (res.data.output === "__CLEAR__") {
        setLines([]);
      } else {
        setLines((l) => [...l, {
          id: crypto.randomUUID(),
          type: res.data.ok ? "out" : "err",
          text: res.data.output,
          ts: Date.now(),
        }]);
      }
    } catch (e) {
      setLines((l) => [...l, { id: crypto.randomUUID(), type: "err", text: `error: ${(e as Error).message}`, ts: Date.now() }]);
    } finally { setBusy(false); }
  }, []);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); run(input); }
    else if (e.key === "Tab") {
      e.preventDefault();
      // tab-completion: find matching commands
      const q = input.trim().toLowerCase();
      if (!q) return;
      const parts = input.split(/\s+/);
      if (parts.length === 1) {
        const matches = KNOWN_COMMANDS.filter((c) => c.startsWith(q));
        if (matches.length === 1) { setInput(matches[0] + " "); }
        else if (matches.length > 1) {
          setLines((l) => [...l, { id: crypto.randomUUID(), type: "out", text: matches.join("  "), ts: Date.now() }]);
        }
      }
    }
    else if (e.key === "ArrowUp") {
      e.preventDefault();
      const hist = historyRef.current;
      if (hist.length === 0) return;
      if (histIdxRef.current === -1) histIdxRef.current = hist.length - 1;
      else histIdxRef.current = Math.max(0, histIdxRef.current - 1);
      setInput(hist[histIdxRef.current] || "");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const hist = historyRef.current;
      if (histIdxRef.current === -1) return;
      histIdxRef.current = Math.min(hist.length - 1, histIdxRef.current + 1);
      if (histIdxRef.current === hist.length - 1) { setInput(""); histIdxRef.current = -1; }
      else setInput(hist[histIdxRef.current] || "");
    }
  };

  return (
    <HoloPanel
      title="TERMINAL"
      icon={<TerminalSquare className="w-4 h-4" />}
      accent="emerald"
      right={
        <button
          onClick={() => setLines(BOOT_LINES.map((t, i) => ({ id: `boot-${i}`, type: "out" as const, text: t, ts: Date.now() })))}
          className="h-6 w-6 p-0 text-cyan-300/60 hover:text-cyan-200 flex items-center justify-center"
          title="Clear terminal"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      }
    >
      <div
        ref={scrollRef}
        className="h-40 overflow-y-auto jarvis-scroll rounded border border-emerald-400/15 bg-black/40 p-2 mb-2 font-mono text-[10px] leading-relaxed"
        onClick={() => inputRef.current?.focus()}
      >
        {lines.map((l) => (
          <div key={l.id} className="whitespace-pre-wrap break-words">
            {l.type === "cmd" ? (
              <span><span className="text-emerald-400">operator@jarvis</span><span className="text-cyan-300/50">:~$ </span><span className="text-cyan-100">{l.text}</span></span>
            ) : l.type === "err" ? (
              <span className="text-amber-300/80">{l.text}</span>
            ) : (
              <span className="text-cyan-200/70">{l.text}</span>
            )}
          </div>
        ))}
        {busy && <div className="text-emerald-300/60 animate-pulse">▋</div>}
      </div>
      <div className="flex items-center gap-1.5">
        <ChevronRight className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder="type a command… (try 'help')"
          className="flex-1 bg-transparent outline-none font-mono text-[11px] text-cyan-100 placeholder:text-cyan-300/30"
          spellCheck={false}
          autoComplete="off"
        />
        <button
          onClick={() => run(input)}
          disabled={busy || !input.trim()}
          className="text-emerald-300/60 hover:text-emerald-200 disabled:opacity-30"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </HoloPanel>
  );
}

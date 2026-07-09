"use client";

import { useEffect } from "react";
import { X, Keyboard } from "lucide-react";

interface ShortcutsOverlayProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS: { keys: string; desc: string; section: string }[] = [
  { keys: "Ctrl+K", desc: "Open Command Palette", section: "Global" },
  { keys: "?", desc: "Toggle this shortcuts overlay", section: "Global" },
  { keys: "Esc", desc: "Close any overlay/modal", section: "Global" },
  { keys: "Enter", desc: "Send chat message", section: "Chat" },
  { keys: "↑ / ↓", desc: "Navigate command palette / terminal history", section: "Navigation" },
  { keys: "Tab", desc: "Autocomplete terminal command", section: "Terminal" },
  { keys: "R / S / W / @", desc: "Switch hologram mode (Reactor/Spectrum/Waveform/Radar)", section: "Hologram" },
];

export function ShortcutsOverlay({ open, onClose }: ShortcutsOverlayProps) {
  // close on Escape (but let the parent handle it too)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  // group by section
  const sections: Record<string, typeof SHORTCUTS> = {};
  SHORTCUTS.forEach((s) => {
    (sections[s.section] = sections[s.section] || []).push(s);
  });

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="holo-panel rounded-lg p-5 max-w-md w-full"
        style={{ borderColor: "rgba(34,211,238,0.4)", boxShadow: "0 0 48px rgba(34,211,238,0.15)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-4">
          <Keyboard className="w-4 h-4 text-cyan-300" />
          <h3 className="font-mono text-sm tracking-widest text-cyan-glow">KEYBOARD SHORTCUTS</h3>
          <div className="flex-1" />
          <button onClick={onClose} className="text-cyan-300/60 hover:text-cyan-200">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          {Object.entries(sections).map(([section, items]) => (
            <div key={section}>
              <div className="font-mono text-[9px] tracking-widest text-cyan-300/40 mb-2">{section.toUpperCase()}</div>
              <div className="space-y-1.5">
                {items.map((s) => (
                  <div key={s.keys} className="flex items-center gap-3">
                    <kbd className="font-mono text-[10px] px-2 py-0.5 rounded border border-cyan-400/30 bg-cyan-400/5 text-cyan-100 min-w-16 text-center">
                      {s.keys}
                    </kbd>
                    <span className="font-mono text-[11px] text-cyan-200/70">{s.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t border-cyan-400/10 text-center">
          <span className="font-mono text-[9px] text-cyan-300/40">Press ? anytime to toggle this overlay</span>
        </div>
      </div>
    </div>
  );
}

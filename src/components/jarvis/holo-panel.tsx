"use client";

import { useEffect, useRef, useState } from "react";

/**
 * HoloPanel — a reusable holographic panel wrapper with HUD corner brackets,
 * an accent header bar, and optional glow. Replaces the raw `.holo-panel` div
 * usage so every panel gets consistent frame decorations.
 */
interface HoloPanelProps {
  title?: string;
  icon?: React.ReactNode;
  accent?: "cyan" | "amber" | "emerald" | "violet" | "rose";
  right?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  scroll?: boolean;
  children: React.ReactNode;
}

const ACCENT_MAP = {
  cyan: { text: "text-cyan-glow", bar: "bg-cyan-400", border: "rgba(34,211,238,0.4)", glow: "rgba(34,211,238,0.18)" },
  amber: { text: "text-amber-glow", bar: "bg-amber-400", border: "rgba(251,191,36,0.4)", glow: "rgba(251,191,36,0.18)" },
  emerald: { text: "text-emerald-glow", bar: "bg-emerald-400", border: "rgba(52,211,153,0.4)", glow: "rgba(52,211,153,0.18)" },
  violet: { text: "text-violet-glow", bar: "bg-violet-400", border: "rgba(167,139,250,0.4)", glow: "rgba(167,139,250,0.18)" },
  rose: { text: "text-rose-300", bar: "bg-rose-400", border: "rgba(251,113,133,0.4)", glow: "rgba(251,113,133,0.18)" },
};

export function HoloPanel({
  title,
  icon,
  accent = "cyan",
  right,
  className = "",
  bodyClassName = "",
  scroll = false,
  children,
}: HoloPanelProps) {
  const a = ACCENT_MAP[accent];
  return (
    <div
      className={`holo-panel rounded-lg relative ${className}`}
      style={{ borderColor: a.border }}
    >
      {/* HUD corner brackets */}
      <CornerBrackets color={a.border} />
      {/* Accent header bar */}
      {title && (
        <div className="flex items-center gap-2 px-4 pt-3 pb-2">
          <div className={`w-1 h-3.5 rounded-full ${a.bar}`} style={{ boxShadow: `0 0 8px ${a.glow}` }} />
          {icon && <span className={a.text}>{icon}</span>}
          <h3 className={`font-mono text-xs tracking-widest ${a.text}`}>{title}</h3>
          <div className="flex-1" />
          {right}
        </div>
      )}
      <div className={`${title ? "px-4 pb-4" : "p-4"} ${scroll ? "overflow-y-auto jarvis-scroll" : ""} ${bodyClassName}`}>
        {children}
      </div>
    </div>
  );
}

function CornerBrackets({ color }: { color: string }) {
  const base = "absolute w-3 h-3 pointer-events-none";
  return (
    <>
      <span className={`${base} top-0 left-0 border-t border-l rounded-tl`} style={{ borderColor: color }} />
      <span className={`${base} top-0 right-0 border-t border-r rounded-tr`} style={{ borderColor: color }} />
      <span className={`${base} bottom-0 left-0 border-b border-l rounded-bl`} style={{ borderColor: color }} />
      <span className={`${base} bottom-0 right-0 border-b border-r rounded-br`} style={{ borderColor: color }} />
    </>
  );
}

/**
 * AnimatedReadout — counts up/down to a target number with a smooth tween.
 * Useful for temperatures and percentage gauges so values feel alive.
 */
export function AnimatedReadout({
  value,
  duration = 500,
  format,
  className,
}: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      const cur = from + (to - from) * eased;
      setDisplay(cur);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return (
    <span className={className}>
      {format ? format(display) : Math.round(display)}
    </span>
  );
}

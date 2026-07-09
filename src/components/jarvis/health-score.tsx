"use client";

import { ShieldCheck, Heart } from "lucide-react";
import { useJarvis } from "@/lib/store";

/**
 * HealthScore — computes an overall system health score (0-100) from the
 * current metrics: penalises high temps, high loads, low battery. Shows a
 * circular ring + grade label + colour-coded status.
 */
export function HealthScore() {
  const metrics = useJarvis((s) => s.metrics);
  const power = useJarvis((s) => s.power);

  if (metrics.length === 0) {
    return (
      <div className="flex items-center gap-2 p-2 rounded border border-cyan-400/15 bg-cyan-400/5">
        <Heart className="w-3.5 h-3.5 text-cyan-300/40" />
        <span className="font-mono text-[10px] text-cyan-300/40">computing health…</span>
      </div>
    );
  }

  // Compute score: start at 100, deduct for each metric exceeding thresholds
  let score = 100;
  const deductions: string[] = [];
  for (const m of metrics) {
    if (m.critical) { score -= 20; deductions.push(`${m.label} critical`); }
    else if (m.warn) { score -= 8; deductions.push(`${m.label} elevated`); }
    // gradual deduction for load metrics above 60%
    if (!m.temp && m.value > 60 && !m.critical && !m.warn) {
      score -= Math.round((m.value - 60) * 0.2);
    }
  }
  // battery penalty
  if (!power.charging && power.battery < 50) {
    score -= 5;
    deductions.push("battery low");
  }
  score = Math.max(0, Math.min(100, score));

  const grade = score >= 90 ? "OPTIMAL" : score >= 70 ? "NOMINAL" : score >= 50 ? "DEGRADED" : "CRITICAL";
  const color = score >= 90 ? "#34d399" : score >= 70 ? "#22d3ee" : score >= 50 ? "#fbbf24" : "#fb7185";
  const Icon = score >= 70 ? ShieldCheck : Heart;

  // circular ring
  const size = 48;
  const stroke = 4;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <div className="flex items-center gap-3 p-2.5 rounded border border-cyan-400/20 bg-cyan-400/5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="block">
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(34,211,238,0.1)" strokeWidth={stroke} />
          <circle
            cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            transform={`rotate(-90 ${size/2} ${size/2})`}
            style={{ filter: `drop-shadow(0 0 3px ${color}80)`, transition: "stroke-dasharray 0.6s ease-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-mono text-sm font-bold tabular-nums" style={{ color }}>{score}</span>
        </div>
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-1.5 mb-0.5">
          <Icon className="w-3 h-3" style={{ color }} />
          <span className="font-mono text-[10px] tracking-widest text-cyan-300/50">SYSTEM HEALTH</span>
        </div>
        <div className="font-mono text-xs font-bold" style={{ color, textShadow: `0 0 8px ${color}60` }}>{grade}</div>
        {deductions.length > 0 && (
          <div className="font-mono text-[8px] text-cyan-300/40 mt-0.5 truncate">
            {deductions.slice(0, 2).join(" · ")}
          </div>
        )}
      </div>
    </div>
  );
}

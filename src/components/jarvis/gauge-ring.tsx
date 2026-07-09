"use client";

import { Thermometer, Cpu, MemoryStick, HardDrive } from "lucide-react";
import { AnimatedReadout } from "./holo-panel";

/**
 * GaugeRing — a circular progress gauge with a glowing arc, tick marks,
 * and a central readout. Used for the system resource visual centerpiece.
 */
interface GaugeRingProps {
  value: number;       // 0-100
  label: string;
  unit?: string;
  icon: React.ReactNode;
  color?: string;
  size?: number;
  warnThreshold?: number;
  criticalThreshold?: number;
}

export function GaugeRing({
  value,
  label,
  unit = "%",
  icon,
  color = "#22d3ee",
  size = 96,
  warnThreshold = 80,
  criticalThreshold = 95,
}: GaugeRingProps) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  // arc spans 270° (from 135° to 405°), leaving a 90° gap at the bottom
  const arcFraction = 0.75;
  const arcLen = circ * arcFraction;
  const offset = circ * (1 - arcFraction) / 2;
  const dash = (Math.min(100, Math.max(0, value)) / 100) * arcLen;

  const activeColor =
    value >= criticalThreshold ? "#fb7185" :
    value >= warnThreshold ? "#fbbf24" : color;

  // tick marks around the arc
  const ticks = Array.from({ length: 28 }, (_, i) => {
    const a = 135 + (i / 27) * 270; // degrees
    const rad = (a * Math.PI) / 180;
    const r1 = r + stroke / 2 + 3;
    const r2 = r1 + (i % 7 === 0 ? 5 : 2);
    return {
      x1: cx + Math.cos(rad) * r1,
      y1: cy + Math.sin(rad) * r1,
      x2: cx + Math.cos(rad) * r2,
      y2: cy + Math.sin(rad) * r2,
      major: i % 7 === 0,
    };
  });

  const gradId = `gauge-${label.replace(/\s/g, "")}-${color.replace("#", "")}`;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="block">
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={activeColor} stopOpacity="0.6" />
              <stop offset="100%" stopColor={activeColor} stopOpacity="1" />
            </linearGradient>
          </defs>
          {/* track */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke="rgba(34,211,238,0.08)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${arcLen} ${circ}`}
            strokeDashoffset={-offset}
            transform={`rotate(90 ${cx} ${cy})`}
          />
          {/* value arc */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            strokeDashoffset={-offset}
            transform={`rotate(90 ${cx} ${cy})`}
            style={{ filter: `drop-shadow(0 0 4px ${activeColor}80)`, transition: "stroke-dasharray 0.6s ease-out" }}
          />
          {/* ticks */}
          {ticks.map((t, i) => (
            <line
              key={i}
              x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
              stroke={t.major ? `${activeColor}66` : "rgba(34,211,238,0.15)"}
              strokeWidth={t.major ? 1 : 0.5}
            />
          ))}
        </svg>
        {/* center readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-cyan-300/70 mb-0.5">{icon}</span>
          <AnimatedReadout
            value={value}
            format={(n) => `${Math.round(n)}${unit}`}
            className="font-mono text-lg font-bold tabular-nums"
            // colour follows threshold
          />
        </div>
      </div>
      <span className="font-mono text-[9px] tracking-widest text-cyan-300/60 uppercase">{label}</span>
    </div>
  );
}

/**
 * ResourceGauges — a row of 3-4 circular gauges for CPU/MEM/DISK (and
 * optionally GPU temp). Designed to sit at the top of the System panel
 * as a visual centerpiece.
 */
export function ResourceGauges({ metrics, onMetricClick }: { metrics: { id: string; label: string; value: number; unit: string; temp: boolean; critical?: boolean; warn?: boolean }[]; onMetricClick?: (id: string) => void }) {
  const loadMetrics = metrics.filter((m) => !m.temp);
  return (
    <div className="grid grid-cols-3 gap-2">
      {loadMetrics.map((m) => {
        const icon =
          m.id === "cpu-load" ? <Cpu className="w-3.5 h-3.5" /> :
          m.id === "mem-load" ? <MemoryStick className="w-3.5 h-3.5" /> :
          m.id === "disk-load" ? <HardDrive className="w-3.5 h-3.5" /> :
          <Thermometer className="w-3.5 h-3.5" />;
        return (
          <button
            key={m.id}
            onClick={() => onMetricClick?.(m.id)}
            className="flex flex-col items-center gap-1.5 p-1 rounded transition hover:bg-cyan-400/5 cursor-pointer group"
            title={`Click for ${m.label} history`}
          >
            <GaugeRing
              value={m.value}
              label={m.label.replace(" LOAD", "").replace("DISK I/O", "DISK")}
              unit={m.unit}
              icon={icon}
              color="#22d3ee"
              size={88}
            />
            <span className="font-mono text-[8px] text-cyan-300/0 group-hover:text-cyan-300/50 transition">▾ chart</span>
          </button>
        );
      })}
    </div>
  );
}

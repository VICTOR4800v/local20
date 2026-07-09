"use client";

import { useEffect, useRef, useState } from "react";
import { X, Thermometer, Cpu, MemoryStick, HardDrive } from "lucide-react";
import { useJarvis } from "@/lib/store";

interface MetricChartModalProps {
  open: boolean;
  metricId: string | null;
  onClose: () => void;
}

interface MetricInfo {
  label: string;
  short: string;
  unit: string;
  color: string;
  icon: React.ReactNode;
  warn?: number;
  critical?: number;
  temp: boolean;
}

const METRIC_INFO: Record<string, MetricInfo> = {
  "cpu-temp": { label: "CPU Temperature", short: "CPU T", unit: "°C", color: "#22d3ee", icon: <Thermometer className="w-4 h-4" />, warn: 70, critical: 85, temp: true },
  "gpu-temp": { label: "GPU Temperature", short: "GPU T", unit: "°C", color: "#22d3ee", icon: <Thermometer className="w-4 h-4" />, warn: 75, critical: 90, temp: true },
  "cpu-load": { label: "CPU Load", short: "CPU", unit: "%", color: "#22d3ee", icon: <Cpu className="w-4 h-4" />, warn: 80, critical: 95, temp: false },
  "mem-load": { label: "Memory Usage", short: "MEM", unit: "%", color: "#22d3ee", icon: <MemoryStick className="w-4 h-4" />, warn: 85, critical: 95, temp: false },
  "disk-load": { label: "Disk I/O", short: "DISK", unit: "%", color: "#22d3ee", icon: <HardDrive className="w-4 h-4" />, warn: 80, critical: false, temp: false },
};

const METRIC_IDS = Object.keys(METRIC_INFO);

export function MetricChartModal({ open, metricId, onClose }: MetricChartModalProps) {
  const history = useJarvis((s) => s.metricHistory);
  const metrics = useJarvis((s) => s.metrics);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // local active metric so the user can switch tabs without changing the prop
  const [activeMetric, setActiveMetric] = useState<string | null>(metricId);

  // sync with prop when it changes (e.g. clicking a different gauge)
  useEffect(() => { setActiveMetric(metricId); }, [metricId]);

  const activeId = activeMetric || metricId;
  const info = activeId ? METRIC_INFO[activeId] : null;
  const data = activeId ? (history[activeId] || []) : [];
  const current = metrics.find((m) => m.id === activeId);

  useEffect(() => {
    if (!open || !info || data.length < 2) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = 560;
    const H = 220;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // clear
    ctx.clearRect(0, 0, W, H);

    const padL = 44, padR = 16, padT = 16, padB = 28;
    const cw = W - padL - padR;
    const ch = H - padT - padB;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    // pad range a bit
    const lo = Math.floor(min - range * 0.15);
    const hi = Math.ceil(max + range * 0.15);

    // grid lines + y labels
    ctx.font = "10px monospace";
    ctx.textAlign = "right";
    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
      const v = lo + ((hi - lo) * i) / gridLines;
      const y = padT + ch - (ch * i) / gridLines;
      ctx.strokeStyle = "rgba(34,211,238,0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(W - padR, y);
      ctx.stroke();
      ctx.fillStyle = "rgba(103,232,249,0.4)";
      ctx.fillText(`${Math.round(v)}`, padL - 6, y + 3);
    }

    // warn/critical threshold lines
    const drawThreshold = (val: number | undefined, color: string, label: string) => {
      if (val === undefined || val < lo || val > hi) return;
      const y = padT + ch - (ch * (val - lo)) / (hi - lo);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(W - padR, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = color;
      ctx.textAlign = "left";
      ctx.fillText(label, padL + 4, y - 3);
    };
    drawThreshold(info.warn, "rgba(251,191,36,0.5)", "warn");
    drawThreshold(info.critical, "rgba(251,113,133,0.5)", "crit");

    // data points
    const stepX = cw / (data.length - 1);
    const pts = data.map((v, i) => {
      const x = padL + i * stepX;
      const y = padT + ch - (ch * (v - lo)) / (hi - lo);
      return [x, y] as const;
    });

    // area fill
    const grad = ctx.createLinearGradient(0, padT, 0, padT + ch);
    grad.addColorStop(0, `${info.color}55`);
    grad.addColorStop(1, `${info.color}00`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], padT + ch);
    pts.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.lineTo(pts[pts.length - 1][0], padT + ch);
    ctx.closePath();
    ctx.fill();

    // line
    ctx.strokeStyle = info.color;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.shadowColor = info.color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.stroke();
    ctx.shadowBlur = 0;

    // last point dot
    const [lx, ly] = pts[pts.length - 1];
    ctx.fillStyle = info.color;
    ctx.beginPath();
    ctx.arc(lx, ly, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(lx, ly, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // x-axis time labels (first, middle, last)
    ctx.fillStyle = "rgba(103,232,249,0.4)";
    ctx.textAlign = "center";
    const sampleSec = 3; // 3s per sample
    const totalSec = (data.length - 1) * sampleSec;
    const fmtAgo = (s: number) => (s < 60 ? `${s}s` : `${Math.floor(s / 60)}m`);
    ctx.fillText(`-${fmtAgo(totalSec)}s`, padL, H - padB + 16);
    ctx.fillText(`-${fmtAgo(Math.round(totalSec / 2))}`, padL + cw / 2, H - padB + 16);
    ctx.fillText("now", W - padR, H - padB + 16);
  }, [open, info, data]);

  if (!open || !info) return null;

  const avg = data.length ? (data.reduce((a, b) => a + b, 0) / data.length).toFixed(1) : "—";
  const minV = data.length ? Math.min(...data) : "—";
  const maxV = data.length ? Math.max(...data) : "—";
  const cur = current?.value ?? "—";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="holo-panel rounded-lg p-5 max-w-2xl w-full"
        style={{ borderColor: `${info.color}66`, boxShadow: `0 0 48px ${info.color}33` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <span style={{ color: info.color }}>{info.icon}</span>
          <h3 className="font-mono text-sm tracking-widest" style={{ color: info.color, textShadow: `0 0 12px ${info.color}80` }}>
            {info.label.toUpperCase()} HISTORY
          </h3>
          <div className="flex-1" />
          <button onClick={onClose} className="text-cyan-300/60 hover:text-cyan-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Metric tabs */}
        <div className="flex items-center gap-1 mb-3 pb-2 border-b border-cyan-400/10">
          {METRIC_IDS.map((id) => {
            const m = METRIC_INFO[id];
            const isActive = id === activeId;
            return (
              <button
                key={id}
                onClick={() => setActiveMetric(id)}
                className={`flex items-center gap-1 px-2 py-1 rounded font-mono text-[10px] tracking-wider transition ${isActive ? "bg-cyan-400/20 text-cyan-100 border border-cyan-400/40" : "text-cyan-300/50 border border-transparent hover:text-cyan-200 hover:bg-cyan-400/5"}`}
              >
                <span className="opacity-70">{m.icon}</span>
                {m.short}
              </button>
            );
          })}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          <StatBox label="CURRENT" value={`${cur}${info.unit}`} color={info.color} />
          <StatBox label="AVERAGE" value={`${avg}${info.unit}`} color="#67e8f9" />
          <StatBox label="MIN" value={`${minV}${info.unit}`} color="#34d399" />
          <StatBox label="MAX" value={`${maxV}${info.unit}`} color="#fbbf24" />
        </div>

        {/* Chart */}
        <div className="rounded border border-cyan-400/15 bg-black/30 p-2">
          <canvas ref={canvasRef} style={{ width: 560, height: 220 }} className="w-full h-auto" />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-3 font-mono text-[10px] text-cyan-300/50">
          <span>{data.length} samples · 3s interval</span>
          <span>~{Math.round((data.length - 1) * 3 / 60)}m window</span>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded border border-cyan-400/20 bg-cyan-400/5 p-2 text-center">
      <div className="font-mono text-[9px] tracking-widest text-cyan-300/50">{label}</div>
      <div className="font-mono text-base font-bold tabular-nums" style={{ color }}>{value}</div>
    </div>
  );
}

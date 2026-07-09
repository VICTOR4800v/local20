"use client";

import { useState, useRef } from "react";

/**
 * Sparkline — a tiny inline SVG line chart with interactive hover tooltip.
 * Shows the trend line + soft area fill + glowing leading dot. Colour shifts
 * to amber/rose when crossing thresholds. On hover, a vertical guide + dot
 * appear and a tooltip shows the exact value + relative time (e.g. "3m ago").
 *
 * Data is assumed to be oldest→newest, sampled every `sampleMs` (default 3000ms
 * matching the system poll). The tooltip shows "Ns ago" relative to the latest.
 */
interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  warnThreshold?: number;
  criticalThreshold?: number;
  strokeWidth?: number;
  unit?: string;
  sampleMs?: number;
  label?: string;
}

export function Sparkline({
  data,
  width = 120,
  height = 28,
  color = "#22d3ee",
  warnThreshold,
  criticalThreshold,
  strokeWidth = 1.5,
  unit = "",
  sampleMs = 3000,
  label = "",
}: SparklineProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (!data || data.length < 2) {
    return (
      <svg width={width} height={height} className="block">
        <line
          x1={0} y1={height / 2} x2={width} y2={height / 2}
          stroke="rgba(34,211,238,0.15)" strokeWidth={1} strokeDasharray="2 3"
        />
      </svg>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2;
  const stepX = (width - pad * 2) / (data.length - 1);

  const points = data.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (height - pad * 2) * (1 - (v - min) / range);
    return [x, y] as const;
  });

  const linePath = points
    .map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`))
    .join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1][0]} ${height - pad} L ${points[0][0]} ${height - pad} Z`;

  const last = data[data.length - 1];
  const [lastX, lastY] = points[points.length - 1];

  let dotColor = color;
  if (criticalThreshold !== undefined && last >= criticalThreshold) dotColor = "#fb7185";
  else if (warnThreshold !== undefined && last >= warnThreshold) dotColor = "#fbbf24";

  const gradId = `spark-${color.replace("#", "")}-${Math.round(width)}-${label.replace(/\s/g, "")}`;

  // hover handling: find nearest point to mouse x
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    let nearest = 0;
    let bestDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const d = Math.abs(points[i][0] - mx);
      if (d < bestDist) { bestDist = d; nearest = i; }
    }
    setHoverIdx(nearest);
  };

  const hover = hoverIdx !== null ? points[hoverIdx] : null;
  const hoverVal = hoverIdx !== null ? data[hoverIdx] : null;
  const hoverAgo =
    hoverIdx !== null
      ? (() => {
          const secsAgo = (data.length - 1 - hoverIdx) * (sampleMs / 1000);
          if (secsAgo < 60) return `${Math.round(secsAgo)}s ago`;
          if (secsAgo < 3600) return `${Math.round(secsAgo / 60)}m ago`;
          return `${Math.round(secsAgo / 3600)}h ago`;
        })()
      : "";

  const tooltipW = 64;
  const tooltipH = 30;
  const tooltipX = hover ? Math.max(2, Math.min(width - tooltipW - 2, hover[0] - tooltipW / 2)) : 0;
  const tooltipY = hover ? Math.max(0, hover[1] - tooltipH - 6) : 0;

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      className="block overflow-visible cursor-crosshair"
      onMouseMove={onMove}
      onMouseLeave={() => setHoverIdx(null)}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 3px ${color}80)` }}
      />
      {/* leading dot */}
      <circle cx={lastX} cy={lastY} r={2.5} fill={dotColor} style={{ filter: `drop-shadow(0 0 4px ${dotColor})` }} />
      <circle cx={lastX} cy={lastY} r={1} fill="#fff" />

      {/* hover guide + dot */}
      {hover && (
        <>
          <line
            x1={hover[0]} y1={pad} x2={hover[0]} y2={height - pad}
            stroke={color} strokeWidth={1} strokeOpacity={0.4} strokeDasharray="2 2"
          />
          <circle cx={hover[0]} cy={hover[1]} r={3.5} fill={color} fillOpacity={0.25} />
          <circle cx={hover[0]} cy={hover[1]} r={2} fill={color} stroke="#fff" strokeWidth={0.8} />
          <g transform={`translate(${tooltipX}, ${tooltipY})`}>
            <rect width={tooltipW} height={tooltipH} rx={4} fill="rgba(8,12,20,0.95)" stroke={color} strokeOpacity={0.4} strokeWidth={0.8} />
            <text x={6} y={12} fill={color} fontSize={9} fontFamily="monospace" fontWeight="600">
              {hoverVal !== null ? `${Math.round(hoverVal * 10) / 10}${unit}` : ""}
            </text>
            <text x={6} y={23} fill="rgba(207,250,254,0.5)" fontSize={7.5} fontFamily="monospace">
              {hoverAgo}
            </text>
          </g>
        </>
      )}
    </svg>
  );
}

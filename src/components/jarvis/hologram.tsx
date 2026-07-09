"use client";

import { useEffect, useRef, useState } from "react";

export type HoloMode = "reactor" | "spectrum" | "waveform" | "radar";

interface HologramProps {
  status: "idle" | "speaking" | "listening" | "thinking";
  active: "active" | "disabled";
  size?: number;
  mode?: HoloMode;
}

/**
 * JARVIS Hologram — an animated core rendered on canvas with multiple modes:
 *  - reactor: arc-reactor style (default) — rotating rings, particles, core
 *  - spectrum: equalizer bars radiating from center
 *  - waveform: oscilloscope-style wave rings
 *  - radar: sweeping radar with blip dots
 */
export function Hologram({ status, active, size = 360, mode = "reactor" }: HologramProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ status, active, accent: "#22d3ee", mode });
  useEffect(() => {
    stateRef.current = { status, active, accent: stateRef.current.accent, mode };
  }, [status, active, mode]);

  // track accent CSS variable changes
  useEffect(() => {
    const readAccent = () => {
      const v = getComputedStyle(document.documentElement).getPropertyValue("--jarvis-accent").trim();
      if (v) stateRef.current.accent = v;
    };
    readAccent();
    const observer = new MutationObserver(readAccent);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });
    const interval = setInterval(readAccent, 1000);
    return () => { observer.disconnect(); clearInterval(interval); };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    let raf = 0;
    let t = 0;
    const particles = Array.from({ length: 60 }, () => ({
      angle: Math.random() * Math.PI * 2,
      radius: 90 + Math.random() * 70,
      speed: 0.002 + Math.random() * 0.004,
      size: 0.6 + Math.random() * 1.6,
      drift: (Math.random() - 0.5) * 0.4,
    }));

    const hexToRgb = (hex: string) => {
      const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 34, g: 211, b: 238 };
    };

    const colourFor = (s: string) => {
      switch (s) {
        case "speaking":
          return { r: 251, g: 191, b: 36 }; // amber
        case "listening":
          return { r: 52, g: 211, b: 153 }; // emerald
        case "thinking":
          return { r: 167, g: 139, b: 250 }; // violet
        default:
          return hexToRgb(stateRef.current.accent); // accent theme (default cyan)
      }
    };

    const draw = () => {
      t += 0.016;
      const { status: st, active: act, mode: md } = stateRef.current;
      const dim = act === "disabled" ? 0.25 : 1;
      const c = colourFor(st);
      const cx = size / 2;
      const cy = size / 2;

      ctx.clearRect(0, 0, size, size);

      // ---- outer glow halo (all modes) ----
      const halo = ctx.createRadialGradient(cx, cy, 10, cx, cy, size / 2);
      halo.addColorStop(0, `rgba(${c.r},${c.g},${c.b},${0.18 * dim})`);
      halo.addColorStop(0.5, `rgba(${c.r},${c.g},${c.b},${0.06 * dim})`);
      halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, size, size);

      // Mode dispatch
      if (md === "spectrum") { drawSpectrum(ctx, t, c, cx, cy, size, dim, st); return; }
      if (md === "waveform") { drawWaveform(ctx, t, c, cx, cy, size, dim, st); return; }
      if (md === "radar") { drawRadar(ctx, t, c, cx, cy, size, dim); return; }

      // ---- reactor mode (default): rotating outer ring with ticks ----
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.15);
      ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${0.5 * dim})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.42, 0, Math.PI * 2);
      ctx.stroke();
      const ticks = 60;
      for (let i = 0; i < ticks; i++) {
        const a = (i / ticks) * Math.PI * 2;
        const len = i % 5 === 0 ? 10 : 4;
        const r1 = size * 0.42;
        const r2 = r1 - len;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
        ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
        ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${(i % 5 === 0 ? 0.8 : 0.35) * dim})`;
        ctx.stroke();
      }
      ctx.restore();

      // ---- outermost data ring with rotating readout numbers ----
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-t * 0.08);
      const dataR = size * 0.47;
      ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${0.15 * dim})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(0, 0, dataR, 0, Math.PI * 2);
      ctx.stroke();
      // 4 rotating data nodes with tiny readout labels
      const dataLabels = ["01", "10", "11", "00"];
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const nx = Math.cos(a) * dataR;
        const ny = Math.sin(a) * dataR;
        // node dot
        ctx.beginPath();
        ctx.arc(nx, ny, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${0.9 * dim})`;
        ctx.fill();
        // small binary-ish readout label
        ctx.save();
        ctx.translate(nx, ny);
        ctx.rotate(a + Math.PI / 2);
        ctx.font = "7px monospace";
        ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${0.6 * dim})`;
        ctx.textAlign = "center";
        ctx.fillText(dataLabels[i], 0, -6);
        ctx.restore();
      }
      ctx.restore();

      // ---- second ring (counter-rotating, segmented arcs) ----
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-t * 0.25);
      const segs = 8;
      for (let i = 0; i < segs; i++) {
        const a0 = (i / segs) * Math.PI * 2 + 0.04;
        const a1 = ((i + 0.7) / segs) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.34, a0, a1);
        ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${0.7 * dim})`;
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.stroke();
      }
      ctx.restore();

      // ---- third ring with spokes ----
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.4);
      ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${0.35 * dim})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.27, 0, Math.PI * 2);
      ctx.stroke();
      const spokes = 12;
      for (let i = 0; i < spokes; i++) {
        const a = (i / spokes) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * size * 0.18, Math.sin(a) * size * 0.18);
        ctx.lineTo(Math.cos(a) * size * 0.27, Math.sin(a) * size * 0.27);
        ctx.stroke();
      }
      ctx.restore();

      // ---- radiating energy waves (pulsing outward) ----
      const waveCount = 3;
      for (let w = 0; w < waveCount; w++) {
        const phase = (t * 0.5 + w / waveCount) % 1;
        const wr = size * 0.15 + phase * size * 0.3;
        const alpha = (1 - phase) * 0.25 * dim;
        ctx.beginPath();
        ctx.arc(cx, cy, wr, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${alpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // ---- particle field ----
      particles.forEach((p) => {
        p.angle += p.speed * (st === "speaking" ? 3 : st === "listening" ? 2 : 1);
        p.radius += p.drift;
        if (p.radius > 160 || p.radius < 90) p.drift *= -1;
        const px = cx + Math.cos(p.angle) * p.radius;
        const py = cy + Math.sin(p.angle) * p.radius;
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${0.55 * dim})`;
        ctx.fill();
      });

      // ---- pulsing core ----
      const pulse = st === "speaking" ? 0.5 + Math.abs(Math.sin(t * 8)) * 0.5 : 0.5 + Math.sin(t * 2) * 0.12;
      const coreR = size * 0.14 * (0.9 + pulse * 0.25);

      // core glow
      const coreGlow = ctx.createRadialGradient(cx, cy, 2, cx, cy, coreR * 2.4);
      coreGlow.addColorStop(0, `rgba(255,255,255,${0.95 * dim})`);
      coreGlow.addColorStop(0.3, `rgba(${c.r},${c.g},${c.b},${0.85 * dim})`);
      coreGlow.addColorStop(1, `rgba(${c.r},${c.g},${c.b},0)`);
      ctx.fillStyle = coreGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR * 2.4, 0, Math.PI * 2);
      ctx.fill();

      // core solid
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${Math.min(255, c.r + 80)},${Math.min(255, c.g + 80)},${Math.min(255, c.b + 80)},${dim})`;
      ctx.fill();

      // core shimmer — rotating highlight arc on the core edge
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 1.5);
      const shimmerGrad = ctx.createLinearGradient(-coreR, 0, coreR, 0);
      shimmerGrad.addColorStop(0, "rgba(255,255,255,0)");
      shimmerGrad.addColorStop(0.5, `rgba(255,255,255,${0.4 * dim})`);
      shimmerGrad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.strokeStyle = shimmerGrad;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, coreR * 0.7, -0.6, 0.6);
      ctx.stroke();
      ctx.restore();

      // inner core triangles (reactor vents)
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.6);
      const vents = 6;
      for (let i = 0; i < vents; i++) {
        const a = (i / vents) * Math.PI * 2;
        const r = coreR * 1.6;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        ctx.lineTo(Math.cos(a + 0.3) * r * 1.3, Math.sin(a + 0.3) * r * 1.3);
        ctx.lineTo(Math.cos(a - 0.3) * r * 1.3, Math.sin(a - 0.3) * r * 1.3);
        ctx.closePath();
        ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${0.5 * dim})`;
        ctx.fill();
      }
      ctx.restore();

      // ---- scanlines overlay for holographic feel ----
      ctx.globalAlpha = 0.06 * dim;
      ctx.fillStyle = "#000";
      for (let y = 0; y < size; y += 3) {
        ctx.fillRect(0, y, size, 1);
      }
      ctx.globalAlpha = 1;

      raf = requestAnimationFrame(draw);
    };

    // ---- Spectrum mode: equalizer bars radiating from center ----
    function drawSpectrum(ctx: CanvasRenderingContext2D, t: number, c: {r:number;g:number;b:number}, cx: number, cy: number, size: number, dim: number, st: string) {
      const bars = 48;
      const innerR = size * 0.16;
      const maxBarLen = size * 0.28;
      const speed = st === "speaking" ? 3 : st === "listening" ? 2 : 1;
      for (let i = 0; i < bars; i++) {
        const a = (i / bars) * Math.PI * 2 - Math.PI / 2;
        // pseudo-random bar height driven by sine waves
        const h = (0.3 + 0.7 * Math.abs(Math.sin(t * speed * 1.5 + i * 0.7) * Math.cos(t * speed + i * 0.3))) * maxBarLen;
        const x1 = cx + Math.cos(a) * innerR;
        const y1 = cy + Math.sin(a) * innerR;
        const x2 = cx + Math.cos(a) * (innerR + h);
        const y2 = cy + Math.sin(a) * (innerR + h);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${0.8 * dim})`;
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.stroke();
      }
      // center ring
      ctx.beginPath();
      ctx.arc(cx, cy, innerR - 4, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${0.4 * dim})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // core
      const pulse = 0.5 + Math.abs(Math.sin(t * 4)) * 0.5;
      ctx.beginPath();
      ctx.arc(cx, cy, innerR * 0.5 * (0.9 + pulse * 0.2), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${Math.min(255,c.r+80)},${Math.min(255,c.g+80)},${Math.min(255,c.b+80)},${dim})`;
      ctx.fill();
    }

    // ---- Waveform mode: oscilloscope-style concentric wave rings ----
    function drawWaveform(ctx: CanvasRenderingContext2D, t: number, c: {r:number;g:number;b:number}, cx: number, cy: number, size: number, dim: number, st: string) {
      const rings = 5;
      const amp = st === "speaking" ? 14 : st === "listening" ? 9 : 5;
      const speed = st === "speaking" ? 4 : 2;
      for (let r = 0; r < rings; r++) {
        const baseR = size * 0.12 + r * size * 0.07;
        ctx.beginPath();
        const steps = 80;
        for (let i = 0; i <= steps; i++) {
          const a = (i / steps) * Math.PI * 2;
          const wave = Math.sin(a * 6 + t * speed + r * 0.8) * amp * (1 - r * 0.15);
          const rr = baseR + wave;
          const x = cx + Math.cos(a) * rr;
          const y = cy + Math.sin(a) * rr;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${(0.7 - r * 0.1) * dim})`;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = `rgba(${c.r},${c.g},${c.b},0.5)`;
        ctx.shadowBlur = 4;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      // center dot
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${Math.min(255,c.r+80)},${Math.min(255,c.g+80)},${Math.min(255,c.b+80)},${dim})`;
      ctx.fill();
    }

    // ---- Radar mode: sweeping radar with blip dots ----
    function drawRadar(ctx: CanvasRenderingContext2D, t: number, c: {r:number;g:number;b:number}, cx: number, cy: number, size: number, dim: number) {
      const maxR = size * 0.42;
      // range rings
      for (let i = 1; i <= 4; i++) {
        ctx.beginPath();
        ctx.arc(cx, cy, (maxR / 4) * i, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${0.12 * dim})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      // crosshair
      ctx.beginPath();
      ctx.moveTo(cx - maxR, cy); ctx.lineTo(cx + maxR, cy);
      ctx.moveTo(cx, cy - maxR); ctx.lineTo(cx, cy + maxR);
      ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${0.1 * dim})`;
      ctx.stroke();
      // sweep
      const sweepAngle = (t * 1.2) % (Math.PI * 2);
      const sweepGrad = ctx.createConicGradient ? ctx.createConicGradient(sweepAngle, cx, cy) : null;
      if (sweepGrad) {
        sweepGrad.addColorStop(0, `rgba(${c.r},${c.g},${c.b},${0.4 * dim})`);
        sweepGrad.addColorStop(0.15, `rgba(${c.r},${c.g},${c.b},0)`);
        sweepGrad.addColorStop(1, `rgba(${c.r},${c.g},${c.b},0)`);
        ctx.fillStyle = sweepGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // fallback: simple sweep line
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(sweepAngle) * maxR, cy + Math.sin(sweepAngle) * maxR);
        ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${0.6 * dim})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      // blips (deterministic positions, fade in when sweep passes)
      const blips = [
        { a: 0.5, r: 0.6 }, { a: 2.1, r: 0.4 }, { a: 3.8, r: 0.75 },
        { a: 5.2, r: 0.5 }, { a: 1.3, r: 0.85 },
      ];
      blips.forEach((b, i) => {
        const ba = b.a;
        const diff = ((sweepAngle - ba + Math.PI * 2) % (Math.PI * 2));
        const fade = Math.max(0, 1 - diff / (Math.PI * 0.8));
        if (fade > 0) {
          const bx = cx + Math.cos(ba) * maxR * b.r;
          const by = cy + Math.sin(ba) * maxR * b.r;
          ctx.beginPath();
          ctx.arc(bx, by, 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${fade * dim})`;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(bx, by, 6, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${fade * 0.2 * dim})`;
          ctx.fill();
        }
      });
      // center
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${Math.min(255,c.r+80)},${Math.min(255,c.g+80)},${Math.min(255,c.b+80)},${dim})`;
      ctx.fill();
    }

    draw();
    return () => cancelAnimationFrame(raf);
  }, [size]);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size }}
        className="block"
        aria-label="JARVIS hologram core"
      />
    </div>
  );
}

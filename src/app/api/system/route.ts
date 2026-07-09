/**
 * GET /api/system
 * Returns system metrics + top processes + network throughput.
 * In this sandbox we return realistic simulated telemetry for the JARVIS
 * dashboard. The shape is stable so the real Windows build can swap in
 * psutil-derived values verbatim.
 */
import { route } from "@/lib/api";
import { jsonOk } from "@/lib/security";

// Deterministic-ish but slowly drifting values so the gauges feel alive.
let drift = 0;
const PROC_NAMES = [
  "jarvis-core.exe", "iron-os-shell.exe", "arc-reactor-svc", "repulsor-daemon",
  "neural-net.exe", "holo-render.exe", "secure-tunnel", "voice-engine.exe",
  "calendar-sync", "mail-fetcher", "telemetry-agent", "firewall-guard",
];
const procState = PROC_NAMES.map((name) => ({
  name,
  cpu: 1 + Math.random() * 8,
  mem: 40 + Math.random() * 200,
}));

function readSensors() {
  drift += 0.05;
  const cpuTemp = 48 + Math.round(Math.sin(drift) * 4 + Math.random() * 2);
  const gpuTemp = 62 + Math.round(Math.cos(drift * 0.7) * 6 + Math.random() * 3);
  const cpuLoad = Math.max(2, Math.min(98, Math.round(20 + Math.sin(drift * 1.3) * 15 + Math.random() * 8)));
  const memLoad = Math.max(20, Math.min(95, Math.round(55 + Math.cos(drift * 0.5) * 10 + Math.random() * 5)));
  const diskLoad = Math.max(5, Math.min(90, Math.round(30 + Math.sin(drift * 0.9) * 20 + Math.random() * 10)));

  // drift process stats
  procState.forEach((p) => {
    p.cpu = Math.max(0.1, Math.min(45, p.cpu + (Math.random() - 0.5) * 3));
    p.mem = Math.max(20, Math.min(800, p.mem + (Math.random() - 0.5) * 15));
  });
  const processes = [...procState]
    .sort((a, b) => b.cpu - a.cpu)
    .slice(0, 6)
    .map((p, i) => ({
      id: `p${i}`,
      name: p.name,
      cpu: Math.round(p.cpu * 10) / 10,
      mem: Math.round(p.mem),
      status: p.cpu > 20 ? "hot" : p.cpu > 8 ? "active" : "idle",
    }));

  // network throughput (simulated, MB/s)
  const netDown = Math.max(0, Math.round((Math.sin(drift * 1.7) * 1.5 + 2 + Math.random()) * 10) / 10);
  const netUp = Math.max(0, Math.round((Math.cos(drift * 1.3) * 0.8 + 0.6 + Math.random() * 0.4) * 10) / 10);

  // battery / power
  const battery = Math.max(40, Math.min(100, Math.round(82 + Math.sin(drift * 0.3) * 6)));
  const charging = Math.sin(drift * 0.2) > 0.5;

  return { cpuTemp, gpuTemp, cpuLoad, memLoad, diskLoad, processes, netDown, netUp, battery, charging, diskSpace: { total: 512, used: 342, unit: "GB" }, activeConnections: Math.floor(8 + Math.sin(drift * 0.4) * 4 + Math.random() * 3) };
}

export const GET = route({ scope: "generic" }, async (ctx) => {
  const s = readSensors();
  const now = new Date().toISOString();

  const metrics = [
    { id: "cpu-temp", label: "CPU TEMP", value: s.cpuTemp, unit: "°C", temp: true, critical: s.cpuTemp >= 85, warn: s.cpuTemp >= 70 },
    { id: "gpu-temp", label: "GPU TEMP", value: s.gpuTemp, unit: "°C", temp: true, critical: s.gpuTemp >= 90, warn: s.gpuTemp >= 75 },
    { id: "cpu-load", label: "CPU LOAD", value: s.cpuLoad, unit: "%", temp: false, critical: s.cpuLoad >= 95, warn: s.cpuLoad >= 80 },
    { id: "mem-load", label: "MEMORY", value: s.memLoad, unit: "%", temp: false, critical: s.memLoad >= 95, warn: s.memLoad >= 85 },
    { id: "disk-load", label: "DISK I/O", value: s.diskLoad, unit: "%", temp: false, critical: false, warn: s.diskLoad >= 80 },
  ];

  return jsonOk({
    timestamp: now,
    hostname: "JARVIS-CORE",
    uptimeSec: Math.floor(process.uptime()),
    metrics,
    processes: s.processes,
    network: { down: s.netDown, up: s.netUp, unit: "MB/s" },
    power: { battery: s.battery, charging: s.charging },
    diskSpace: s.diskSpace,
    activeConnections: s.activeConnections,
    summary: `CPU ${s.cpuTemp}°C · GPU ${s.gpuTemp}°C · Load ${s.cpuLoad}% · Mem ${s.memLoad}%`,
  });
});

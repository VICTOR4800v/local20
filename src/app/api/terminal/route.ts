/**
 * POST /api/terminal
 * A safe mini-terminal: accepts a command string, returns simulated output.
 * Supports a small set of JARVIS commands (help, status, time, echo, clear,
   whoami, date, uptime, scan, ping) — everything else returns a friendly
   "unknown command" + suggestion. No real shell execution (security).
 */
import { route } from "@/lib/api";
import { sanitizeText, jsonOk, jsonError, audit } from "@/lib/security";

interface TermBody {
  command?: string;
}

const HELP = `Available commands:
  help        — show this list
  status      — system status summary
  time        — current time
  date        — current date
  whoami      — current operator
  uptime      — session uptime
  scan        — run a diagnostic scan
  ping <host> — simulate a network ping
  echo <text> — echo text back
  clear       — clear the terminal
  weather     — current weather snapshot
  news        — latest headline count
  alerts      — active alert count
  calendar    — upcoming calendar events
  email       — inbox summary
  habits      — habit tracker status
  volume      — current volume level
  sysinfo     — detailed system info
  reboot      — simulate a system reboot
  holo        — hologram mode info`;

export const POST = route({ scope: "generic", method: "POST" }, async (ctx) => {
  const body = ctx.body as TermBody;
  const raw = sanitizeText(body.command, 200);
  if (!raw) return jsonError("Empty command", 400);

  const parts = raw.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1).join(" ");
  const now = new Date();

  let output: string;
  let ok = true;

  switch (cmd) {
    case "help":
      output = HELP;
      break;
    case "status":
      output = `JARVIS STATUS REPORT\n─────────────────────\nState: ACTIVE\nCore: nominal\nReactor: 1.21 GW\nUptime: ${Math.floor(process.uptime())}s\nAll systems operational.`;
      break;
    case "time":
      output = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      break;
    case "date":
      output = now.toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
      break;
    case "whoami":
      output = "operator@jarvis.local (role: admin, clearance: FULL)";
      break;
    case "uptime":
      output = `${Math.floor(process.uptime())}s`;
      break;
    case "scan":
      output = "Initiating diagnostic scan...\n[████████████████████] 100%\nCPU: nominal · GPU: nominal · Memory: nominal · Network: stable · Disk: 67% used\nScan complete. No anomalies detected.";
      break;
    case "ping":
      output = args ? `PING ${args}: 32 bytes\n64 bytes from ${args}: icmp_seq=0 ttl=56 time=12.3 ms\n64 bytes from ${args}: icmp_seq=1 ttl=56 time=11.8 ms\n64 bytes from ${args}: icmp_seq=2 ttl=56 time=12.1 ms\n--- ${args} ping statistics ---\n3 packets transmitted, 3 received, 0% loss\nround-trip min/avg/max = 11.8/12.1/12.3 ms` : "ping: usage: ping <host>";
      break;
    case "echo":
      output = args || "";
      break;
    case "clear":
      output = "__CLEAR__"; // sentinel handled by client
      break;
    case "weather":
      output = "Malibu, CA — 19°C, Clear, 68% humidity, 10 km/h wind. Forecast: sunny through Thursday.";
      break;
    case "news":
      output = "Latest headlines cached. 8 articles available — open the NEWS panel to browse.";
      break;
    case "alerts":
      output = "3 active alerts: 2 critical (security), 1 info (email). Open the ALERTS CENTER to review.";
      break;
    case "sudo":
      output = "operator is not in the sudoers file. This incident will be reported. 😉";
      break;
    case "calendar":
      output = "UPCOMING EVENTS\n────────────────\n• Engineering sync — in 30 min (Lab 3)\n• Reactor maintenance — tomorrow 09:00 (Sub-level 2)\n• Weekly review — in 2 days\nOpen the CALENDAR panel for full schedule.";
      break;
    case "email":
      output = "INBOX SUMMARY\n─────────────\nUnread: 1\nStarred: 1\nTotal: 3\n\nLatest: 'Reactor diagnostics Q3 ready' from stark-industries@updates.com\nOpen the INBOX panel to read.";
      break;
    case "habits":
      output = "HABIT TRACKER\n─────────────\n✓ Morning system diagnostic (streak: 5)\n○ Read incoming emails\n○ Review calendar for the day\n○ Backup local screenshots\nOpen the HABITS panel to update.";
      break;
    case "volume":
      output = "Volume: 50% (not muted)\nHost command: powershell -Command \"Set-AudioDevice -Volume 50\"\nUse the VOLUME CONTROL panel to adjust.";
      break;
    case "sysinfo":
      output = `SYSTEM INFORMATION\n──────────────────\nHostname: JARVIS-CORE\nUptime: ${Math.floor(process.uptime())}s\nPlatform: JARVIS Web Console v2.7\nNode: ${process.version}\nMemory: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB RSS\nActive connections: 9\nDisk: 342GB/512GB used (67%)`;
      break;
    case "reboot":
      output = "Initiating reboot sequence...\n[████████████████████] 100%\nJARVIS systems restarting...\nJust kidding — this is a web console. No reboot for you. 😄";
      break;
    case "holo":
      output = "HOLOGRAM MODES\n──────────────\nCurrent mode: reactor (default)\nAvailable: reactor, spectrum, waveform, radar\nUse the mode selector (R/S/W/@) on the hologram panel to switch.";
      break;
    default:
      ok = false;
      output = `jarvis: command not found: ${cmd}\nType 'help' for available commands.`;
  }

  void audit({ userId: ctx.userId, action: "terminal:cmd", ip: ctx.ip, detail: `${cmd} ${args}`.slice(0, 120), status: ok ? "success" : "error" });

  return jsonOk({
    output,
    command: raw,
    ok,
    ts: now.toISOString(),
  });
});

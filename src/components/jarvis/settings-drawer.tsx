"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Settings2, X, ShieldCheck, Palette, Mic2, Activity, AlertTriangle,
  CheckCircle2, XCircle, RefreshCw, Trash2,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useJarvis } from "@/lib/store";

interface AuditLog {
  id: string;
  action: string;
  resource: string | null;
  ip: string | null;
  status: string;
  detail: string | null;
  createdAt: string;
}

interface AuditSummary {
  total24h: number;
  denied: number;
  errors: number;
  topActions: { action: string; count: number }[];
}

const ACCENTS = [
  { id: "cyan", label: "Cyan", color: "#22d3ee" },
  { id: "amber", label: "Amber", color: "#fbbf24" },
  { id: "emerald", label: "Emerald", color: "#34d399" },
  { id: "violet", label: "Violet", color: "#a78bfa" },
  { id: "rose", label: "Rose", color: "#fb7185" },
];

const VOICES = [
  { id: "tongtong", label: "Tongtong (warm)" },
  { id: "jam", label: "Jam (British)" },
  { id: "xiaochen", label: "Xiaochen (calm)" },
  { id: "kazi", label: "Kazi (clear)" },
];

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  accent: string;
  onAccentChange: (a: string) => void;
}

export function SettingsDrawer({ open, onClose, accent, onAccentChange }: SettingsDrawerProps) {
  const store = useJarvis();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [newsTopic, setNewsTopic] = useState("technology");
  const [voice, setVoice] = useState("jam");
  const [speed, setSpeed] = useState(1.0);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const res = await api<{ data: { settings: Record<string, string> } }>("/api/settings", {});
      setNewsTopic(res.data.settings.newsTopic || "technology");
      setVoice(res.data.settings.voice || "jam");
      setSpeed(Number(res.data.settings.voiceSpeed) || 1.0);
    } catch {}
  }, []);

  const loadAudit = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const res = await api<{ data: { logs: AuditLog[]; summary: AuditSummary } }>("/api/audit?limit=40", {});
      setLogs(res.data.logs);
      setSummary(res.data.summary);
    } catch {} finally { setLoadingLogs(false); }
  }, []);

  useEffect(() => {
    if (open) { loadSettings(); loadAudit(); }
  }, [open]);

  const saveSetting = useCallback(async (key: string, value: string) => {
    try {
      await api("/api/settings", { method: "POST", json: { key, value } });
      toast.success(`${key} updated`);
    } catch (e) { toast.error((e as Error).message); }
  }, []);

  if (!open) return null;

  const statusIcon = (s: string) =>
    s === "success" ? <CheckCircle2 className="w-3 h-3 text-emerald-300" /> :
    s === "denied" ? <XCircle className="w-3 h-3 text-amber-300" /> :
    <AlertTriangle className="w-3 h-3 text-rose-300" />;

  const fmtTime = (d: string) =>
    new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="holo-panel rounded-l-lg w-full max-w-md h-full flex flex-col"
        style={{ borderColor: "rgba(34,211,238,0.4)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 p-4 border-b border-cyan-400/20">
          <Settings2 className="w-4 h-4 text-cyan-300" />
          <h3 className="font-mono text-xs tracking-widest text-cyan-glow">COMMAND CENTER</h3>
          <Button size="sm" variant="ghost" onClick={onClose} className="ml-auto h-7 w-7 p-0 text-cyan-300/60 hover:text-cyan-200">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1 jarvis-scroll">
          <div className="p-4 space-y-5">
            {/* Operator profile */}
            <Section icon={<ShieldCheck className="w-3.5 h-3.5" />} title="OPERATOR">
              <div className="flex items-center gap-3 p-2.5 rounded border border-cyan-400/20 bg-cyan-400/5">
                <div className="w-10 h-10 rounded-full border border-cyan-400/40 flex items-center justify-center bg-cyan-400/10">
                  <span className="font-mono text-sm text-cyan-glow">OP</span>
                </div>
                <div className="flex-1">
                  <div className="font-mono text-xs text-cyan-100">operator@jarvis.local</div>
                  <div className="font-mono text-[10px] text-cyan-300/60">role: admin · clearance: FULL</div>
                </div>
                <Badge label="ONLINE" color="emerald" />
              </div>
            </Section>

            {/* Accent theme */}
            <Section icon={<Palette className="w-3.5 h-3.5" />} title="ACCENT THEME">
              <div className="grid grid-cols-5 gap-2">
                {ACCENTS.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => { onAccentChange(a.id); saveSetting("accent", a.id); }}
                    className={`flex flex-col items-center gap-1 p-2 rounded border transition ${accent === a.id ? "border-white/60 bg-white/5" : "border-cyan-400/15 hover:border-cyan-400/40"}`}
                  >
                    <span className="w-6 h-6 rounded-full" style={{ background: a.color, boxShadow: `0 0 10px ${a.color}80` }} />
                    <span className="font-mono text-[9px] text-cyan-200/70">{a.label}</span>
                  </button>
                ))}
              </div>
            </Section>

            {/* Voice config */}
            <Section icon={<Mic2 className="w-3.5 h-3.5" />} title="VOICE CONFIG">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between p-2.5 rounded border border-cyan-400/20 bg-cyan-400/5">
                  <span className="font-mono text-[11px] text-cyan-200/80">Voice Live (default)</span>
                  <Switch checked={store.voiceLive} onCheckedChange={(v) => { store.setVoiceLive(v); saveSetting("voiceLiveDefault", String(v)); }} />
                </div>
                <div>
                  <label className="font-mono text-[10px] text-cyan-300/60 mb-1 block">TTS VOICE (LEGACY)</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {VOICES.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => { setVoice(v.id); saveSetting("voice", v.id); }}
                        className={`p-1.5 rounded border font-mono text-[10px] transition ${voice === v.id ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-100" : "border-cyan-400/15 text-cyan-300/60 hover:border-cyan-400/30"}`}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="font-mono text-[10px] text-cyan-300/60 mb-1 block">SPEED: {speed.toFixed(1)}x</label>
                  <input
                    type="range" min={0.5} max={2} step={0.1} value={speed}
                    onChange={(e) => setSpeed(Number(e.target.value))}
                    onMouseUp={() => saveSetting("voiceSpeed", String(speed))}
                    className="w-full accent-cyan-400"
                  />
                </div>
              </div>
            </Section>

            {/* News default topic */}
            <Section icon={<Activity className="w-3.5 h-3.5" />} title="NEWS DEFAULT TOPIC">
              <Input
                value={newsTopic}
                onChange={(e) => setNewsTopic(e.target.value)}
                onBlur={() => saveSetting("newsTopic", newsTopic)}
                className="h-8 bg-cyan-400/5 border-cyan-400/25 text-cyan-100 font-mono text-xs"
              />
            </Section>

            {/* Security audit */}
            <Section
              icon={<ShieldCheck className="w-3.5 h-3.5" />}
              title="SECURITY AUDIT"
              right={
                <Button size="sm" variant="ghost" onClick={loadAudit} className="h-6 w-6 p-0 text-cyan-300/60 hover:text-cyan-200">
                  <RefreshCw className={`w-3 h-3 ${loadingLogs ? "animate-spin" : ""}`} />
                </Button>
              }
            >
              {summary && (
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <StatTile label="EVENTS 24H" value={summary.total24h} color="cyan" />
                  <StatTile label="DENIED" value={summary.denied} color="amber" />
                  <StatTile label="ERRORS" value={summary.errors} color="rose" />
                </div>
              )}
              <div className="space-y-1 max-h-48 overflow-y-auto jarvis-scroll pr-1">
                {logs.length === 0 && <div className="font-mono text-[10px] text-cyan-300/40 text-center py-3">No audit events.</div>}
                {logs.slice(0, 30).map((l) => (
                  <div key={l.id} className="flex items-center gap-2 p-1.5 rounded border border-cyan-400/10 bg-cyan-400/3">
                    {statusIcon(l.status)}
                    <span className="font-mono text-[10px] text-cyan-200/80 truncate flex-1">{l.action}</span>
                    <span className="font-mono text-[9px] text-cyan-300/40">{fmtTime(l.createdAt)}</span>
                  </div>
                ))}
              </div>
            </Section>

            {/* Danger zone */}
            <Section icon={<AlertTriangle className="w-3.5 h-3.5" />} title="DATA">
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  if (!confirm("Clear all chat history in this session?")) return;
                  store.clearMessages();
                  toast.success("Chat context cleared");
                }}
                className="w-full h-8 border-amber-400/30 bg-amber-400/5 text-amber-200 hover:bg-amber-400/15 font-mono text-[10px]"
              >
                <Trash2 className="w-3 h-3 mr-1.5" />CLEAR CHAT CONTEXT
              </Button>
            </Section>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function Section({ icon, title, right, children }: { icon: React.ReactNode; title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-cyan-300">{icon}</span>
        <h4 className="font-mono text-[10px] tracking-widest text-cyan-300/80">{title}</h4>
        <div className="flex-1 h-px bg-cyan-400/15" />
        {right}
      </div>
      {children}
    </div>
  );
}

function StatTile({ label, value, color }: { label: string; value: number; color: "cyan" | "amber" | "rose" }) {
  const colors = {
    cyan: "border-cyan-400/30 bg-cyan-400/5 text-cyan-200",
    amber: "border-amber-400/30 bg-amber-400/5 text-amber-200",
    rose: "border-rose-400/30 bg-rose-400/5 text-rose-200",
  };
  return (
    <div className={`rounded border p-2 text-center ${colors[color]}`}>
      <div className="font-mono text-lg font-bold tabular-nums">{value}</div>
      <div className="font-mono text-[8px] tracking-widest opacity-70">{label}</div>
    </div>
  );
}

function Badge({ label, color }: { label: string; color: "emerald" }) {
  const colors = { emerald: "bg-emerald-400/20 text-emerald-300 border-emerald-400/40" };
  return (
    <span className={`px-1.5 py-0.5 rounded-full border font-mono text-[9px] ${colors[color]}`}>
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-300 mr-1 status-dot" style={{ color: "#34d399" }} />
      {label}
    </span>
  );
}

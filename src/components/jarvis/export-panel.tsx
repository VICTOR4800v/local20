"use client";

import { useCallback, useState } from "react";
import { Download, FileJson, Loader2, Check } from "lucide-react";
import { HoloPanel } from "./holo-panel";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * ExportPanel — lets the operator download their data as JSON files.
 * Supports: all, settings, notes, audit. Each triggers a fetch + blob download.
 */
export function ExportPanel() {
  const [busy, setBusy] = useState<string | null>(null);

  const doExport = useCallback(async (type: "all" | "settings" | "notes" | "audit") => {
    setBusy(type);
    try {
      const res = await fetch(`/api/export?type=${type}`);
      if (!res.ok) throw new Error("Export failed");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `jarvis-${type}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`${type.toUpperCase()} exported`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }, []);

  const exports: { type: "all" | "settings" | "notes" | "audit"; label: string; desc: string }[] = [
    { type: "all", label: "Full Backup", desc: "All data (settings, notes, audit, habits, schedules, briefings)" },
    { type: "settings", label: "Settings", desc: "Configuration + preferences" },
    { type: "notes", label: "Notes", desc: "All quick notes" },
    { type: "audit", label: "Audit Log", desc: "Last 200 security events" },
  ];

  return (
    <HoloPanel title="DATA EXPORT" icon={<Download className="w-4 h-4" />} accent="violet">
      <div className="space-y-2">
        {exports.map((e) => (
          <div key={e.type} className="flex items-center gap-3 p-2.5 rounded border border-cyan-400/15 bg-cyan-400/5 hover:bg-cyan-400/10 transition group">
            <FileJson className="w-4 h-4 text-violet-300/70 group-hover:text-violet-200 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-mono text-[11px] font-semibold text-cyan-100">{e.label}</div>
              <div className="font-mono text-[9px] text-cyan-300/50 truncate">{e.desc}</div>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={busy !== null}
              onClick={() => doExport(e.type)}
              className="h-7 px-2 border-cyan-400/30 bg-cyan-400/5 text-cyan-200 hover:bg-cyan-400/15 font-mono text-[10px] flex-shrink-0"
            >
              {busy === e.type ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : busy !== null && busy !== e.type ? (
                <Check className="w-3 h-3 text-emerald-300/40" />
              ) : (
                <>
                  <Download className="w-3 h-3 mr-1" />
                  <span className="hidden sm:inline">DL</span>
                </>
              )}
            </Button>
          </div>
        ))}
      </div>
      <div className="mt-2.5 pt-2 border-t border-cyan-400/10">
        <p className="font-mono text-[8px] text-cyan-300/40 text-center">
          Exports are downloaded as JSON. Sensitive settings values are decrypted for backup.
        </p>
      </div>
    </HoloPanel>
  );
}

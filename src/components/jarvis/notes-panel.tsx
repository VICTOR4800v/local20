"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { StickyNote, Plus, Pin, Trash2, X, Check, Search } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { HoloPanel } from "./holo-panel";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Note {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  color: string;
  updatedAt: string;
}

const COLORS: Record<string, { border: string; bg: string; text: string }> = {
  cyan: { border: "border-cyan-400/30", bg: "bg-cyan-400/5", text: "text-cyan-200" },
  amber: { border: "border-amber-400/30", bg: "bg-amber-400/5", text: "text-amber-200" },
  emerald: { border: "border-emerald-400/30", bg: "bg-emerald-400/5", text: "text-emerald-200" },
  violet: { border: "border-violet-400/30", bg: "bg-violet-400/5", text: "text-violet-200" },
  rose: { border: "border-rose-400/30", bg: "bg-rose-400/5", text: "text-rose-200" },
};

const fmtAgo = (d: string) => {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
};

export function NotesPanel() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [color, setColor] = useState("cyan");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const refresh = useCallback(async () => {
    try {
      const res = await api<{ data: { notes: Note[] } }>("/api/notes", {});
      setNotes(res.data.notes);
    } catch {}
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { refresh(); }, []);

  // Filter notes by search query (title + body)
  const filtered = useMemo(() => {
    if (!search.trim()) return notes;
    const q = search.toLowerCase();
    return notes.filter(
      (n) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q),
    );
  }, [notes, search]);

  const create = useCallback(async () => {
    if (!title.trim() && !body.trim()) { setAdding(false); return; }
    try {
      await api("/api/notes", { method: "POST", json: { action: "create", title: title || "Untitled", body, color } });
      setTitle(""); setBody(""); setColor("cyan"); setAdding(false);
      refresh();
      toast.success("Note saved");
    } catch (e) { toast.error((e as Error).message); }
  }, [title, body, color, refresh]);

  const pin = useCallback(async (id: string) => {
    setNotes((ns) => ns.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n)));
    await api("/api/notes", { method: "POST", json: { action: "pin", id } }).catch(() => {});
  }, []);

  const remove = useCallback(async (id: string) => {
    setNotes((ns) => ns.filter((n) => n.id !== id));
    await api("/api/notes", { method: "POST", json: { action: "delete", id } }).catch(() => {});
  }, []);

  const saveEdit = useCallback(async (id: string, t: string, b: string) => {
    await api("/api/notes", { method: "POST", json: { action: "update", id, title: t, body: b } });
    setEditingId(null);
    refresh();
  }, [refresh]);

  return (
    <HoloPanel
      title="QUICK NOTES"
      icon={<StickyNote className="w-4 h-4" />}
      accent="amber"
      right={
        <Button size="sm" variant="ghost" onClick={() => setAdding((a) => !a)} className="h-6 w-6 p-0 text-cyan-300/60 hover:text-cyan-200">
          <Plus className="w-3.5 h-3.5" />
        </Button>
      }
    >
      {adding && (
        <div className="mb-3 space-y-2 p-2.5 rounded border border-amber-400/25 bg-amber-400/5">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="h-8 bg-amber-400/5 border-amber-400/25 text-cyan-100 font-mono text-xs" />
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Memo… (Markdown supported: **bold**, *italic*, - lists, [links](url))" rows={3} className="bg-amber-400/5 border-amber-400/25 text-cyan-100 font-mono text-xs resize-none" />
          <div className="flex items-center gap-1.5">
            {Object.entries(COLORS).map(([k, c]) => (
              <button key={k} onClick={() => setColor(k)} className={`w-4 h-4 rounded-full border-2 ${color === k ? "border-white" : "border-transparent"} ${c.bg} ${c.border}`} aria-label={`${k} color`} />
            ))}
            <div className="flex-1" />
            <Button size="sm" onClick={create} className="h-7 px-3 bg-amber-400/20 border border-amber-400/40 text-amber-100 font-mono text-[10px]">SAVE</Button>
          </div>
        </div>
      )}
      {/* Search */}
      {notes.length > 0 && (
        <div className="relative mb-2">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-cyan-300/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes…"
            className="w-full h-7 pl-7 pr-2 rounded bg-cyan-400/5 border border-cyan-400/20 text-cyan-100 font-mono text-[11px] outline-none focus:border-cyan-400/40"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-cyan-300/40 hover:text-cyan-200">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
      <ScrollArea className="h-40 jarvis-scroll">
        <div className="space-y-2 pr-2">
          {notes.length === 0 && !adding && (
            <div className="font-mono text-[10px] text-cyan-300/40 text-center py-4">No notes yet. Tap + to add one.</div>
          )}
          {notes.length > 0 && filtered.length === 0 && (
            <div className="font-mono text-[10px] text-cyan-300/40 text-center py-4">No notes match "{search}".</div>
          )}
          {filtered.map((n) => {
            const c = COLORS[n.color] || COLORS.cyan;
            const isEditing = editingId === n.id;
            return (
              <div key={n.id} className={`p-2.5 rounded border ${c.border} ${c.bg} group relative`}>
                {n.pinned && <Pin className="absolute top-1.5 right-1.5 w-2.5 h-2.5 text-amber-300 fill-amber-300" />}
                {isEditing ? (
                  <NoteEditor note={n} onSave={(t, b) => saveEdit(n.id, t, b)} onCancel={() => setEditingId(null)} />
                ) : (
                  <>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`font-mono text-[11px] font-semibold ${c.text} truncate flex-1`}>{n.title}</span>
                    </div>
                    {n.body && (
                      <div className="text-[10px] text-cyan-200/70 leading-relaxed mb-1 prose-jarvis-note">
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                            strong: ({ children }) => <strong className="text-cyan-100 font-semibold">{children}</strong>,
                            em: ({ children }) => <em className="text-cyan-200">{children}</em>,
                            a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" className="text-cyan-300 underline hover:text-cyan-100">{children}</a>,
                            ul: ({ children }) => <ul className="list-disc list-inside mb-1">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal list-inside mb-1">{children}</ol>,
                            li: ({ children }) => <li className="ml-1">{children}</li>,
                            code: ({ children }) => <code className="px-1 py-0.5 rounded bg-black/30 text-amber-200 font-mono text-[9px]">{children}</code>,
                          }}
                        >{n.body}</ReactMarkdown>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[9px] text-cyan-300/40">{fmtAgo(n.updatedAt)}</span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button onClick={() => setEditingId(n.id)} className="text-cyan-300/60 hover:text-cyan-200"><StickyNote className="w-3 h-3" /></button>
                        <button onClick={() => pin(n.id)} className="text-amber-300/60 hover:text-amber-200"><Pin className="w-3 h-3" /></button>
                        <button onClick={() => remove(n.id)} className="text-rose-300/60 hover:text-rose-200"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </HoloPanel>
  );
}

function NoteEditor({ note, onSave, onCancel }: { note: Note; onSave: (t: string, b: string) => void; onCancel: () => void }) {
  const [t, setT] = useState(note.title);
  const [b, setB] = useState(note.body);
  return (
    <div className="space-y-1.5">
      <Input value={t} onChange={(e) => setT(e.target.value)} className="h-7 bg-black/30 border-cyan-400/25 text-cyan-100 font-mono text-xs" autoFocus />
      <Textarea value={b} onChange={(e) => setB(e.target.value)} rows={2} className="bg-black/30 border-cyan-400/25 text-cyan-100 font-mono text-xs resize-none" />
      <div className="flex gap-1.5 justify-end">
        <Button size="sm" variant="ghost" onClick={onCancel} className="h-6 px-2 text-cyan-300/60 font-mono text-[10px]"><X className="w-3 h-3" /></Button>
        <Button size="sm" onClick={() => onSave(t, b)} className="h-6 px-2 bg-cyan-400/20 border border-cyan-400/40 text-cyan-100 font-mono text-[10px]"><Check className="w-3 h-3" /></Button>
      </div>
    </div>
  );
}

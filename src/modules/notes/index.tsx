// ============================================================
// NOTES MODULE — ROOT  (redesign v2)
// Clean 3-pane layout: sidebar list | editor with inline toolbar
// ============================================================

import { useEffect, useCallback } from "react";
import { registry } from "@/kernel/router";
import { useNoteStore } from "./store";
import { NoteList } from "./components/NoteList";
import { NoteEditor } from "./components/NoteEditor";
import { NoteToolbar } from "./components/NoteToolbar";
import { DailyNoteContext } from "./components/DailyNoteContext";
import { FileText, Plus } from "lucide-react";
import type { ModuleManifest } from "@/shared/types";

const manifest: ModuleManifest = {
  id: "notes",
  name: "Notes",
  icon: "FileText",
  sidebarOrder: 4,
  isEnabled: true,
  routes: [{ path: "/notes", label: "Notes" }],
  commands: [
    { id: "note.new",   label: "New note",          group: "Notes", action: "navigate:to" },
    { id: "note.today", label: "Open today's note",  group: "Notes", action: "navigate:to" },
  ],
  shortcuts: [
    { keys: "g n", action: "navigate:to", description: "Go to Notes", global: false },
  ],
};

export function NotesModule() {
  const { loadNotes, openNoteId, getNoteById, createNote, openNote } = useNoteStore();

  useEffect(() => {
    registry.register(manifest);
    void loadNotes();
  }, [loadNotes]);

  const openedNote = openNoteId ? getNoteById(openNoteId) : null;
  const isDaily    = openedNote?.type === "daily";

  const handleNewNote = useCallback(async () => {
    const note = await createNote();
    openNote(note.id);
  }, [createNote, openNote]);

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-background">

      {/* ── Sidebar list ──────────────────────────────────── */}
      <aside
        className="flex flex-col shrink-0 overflow-hidden border-r"
        style={{
          width: 260,
          borderColor: "hsl(var(--border))",
          background: "hsl(var(--sidebar-bg, var(--card)))",
        }}
      >
        <NoteList />
      </aside>

      {/* ── Editor pane ───────────────────────────────────── */}
      <main className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden bg-background">
        {openedNote ? (
          <>
            {/* Toolbar (title + meta) */}
            <NoteToolbar note={openedNote} />

            {/* Daily context ribbon */}
            {isDaily && (
              <div
                className="px-6 py-2.5 border-b text-xs"
                style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--muted) / 0.4)" }}
              >
                <DailyNoteContext />
              </div>
            )}

            {/* Editor — full remaining height */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <NoteEditor
                key={openedNote.id}
                note={openedNote}
                className="h-full overflow-y-auto"
              />
            </div>
          </>
        ) : (
          <EmptyEditor onNew={() => void handleNewNote()} />
        )}
      </main>
    </div>
  );
}

// ── Empty state when no note is open ─────────────────────────
function EmptyEditor({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 select-none">
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center"
        style={{ background: "hsl(var(--muted))" }}
      >
        <FileText size={22} style={{ color: "hsl(var(--muted-foreground))" }} />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold" style={{ color: "hsl(var(--foreground))" }}>
          No note selected
        </p>
        <p className="text-xs mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>
          Pick a note from the list or start fresh.
        </p>
      </div>
      <button
        onClick={onNew}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        style={{
          background: "hsl(var(--primary))",
          color: "hsl(var(--primary-foreground))",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
      >
        <Plus size={14} /> New note
      </button>
    </div>
  );
}

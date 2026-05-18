// ============================================================
// NOTES MODULE — ROOT  (journal redesign)
// 2-pane: narrow sidebar list | wide editor pane
// ============================================================

import { useEffect, useCallback } from "react";
import { registry } from "@/kernel/router";
import { useNoteStore } from "./store";
import { NoteList } from "./components/NoteList";
import { NoteEditor } from "./components/NoteEditor";
import { NoteToolbar } from "./components/NoteToolbar";
import { DailyNoteContext } from "./components/DailyNoteContext";
import { BookOpen, Plus } from "lucide-react";
import type { ModuleManifest } from "@/shared/types";

const manifest: ModuleManifest = {
  id: "notes",
  name: "Notes",
  icon: "FileText",
  sidebarOrder: 4,
  isEnabled: true,
  routes: [{ path: "/notes", label: "Notes" }],
  commands: [
    { id: "note.new",   label: "New note",         group: "Notes", action: "navigate:to" },
    { id: "note.today", label: "Open today's note", group: "Notes", action: "navigate:to" },
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
    <div
      className="flex h-full min-h-0 overflow-hidden"
      style={{ background: "hsl(var(--background))" }}
    >
      {/* ── Sidebar ────────────────────────────────────────── */}
      <aside
        className="flex flex-col shrink-0 overflow-hidden"
        style={{
          width: 252,
          borderRight: "1px solid hsl(var(--border))",
          background: "hsl(var(--surface-1))",
        }}
      >
        <NoteList />
      </aside>

      {/* ── Editor pane ────────────────────────────────────── */}
      <main
        className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden"
        style={{ background: "hsl(var(--background))" }}
      >
        {openedNote ? (
          <>
            <NoteToolbar note={openedNote} />

            {/* Daily context ribbon */}
            {isDaily && (
              <div
                className="px-8 py-2 text-xs shrink-0"
                style={{
                  borderBottom: "1px solid hsl(var(--border))",
                  background: "hsl(var(--muted) / 0.35)",
                  color: "hsl(var(--muted-foreground))",
                }}
              >
                <DailyNoteContext />
              </div>
            )}

            {/* Editor — scroll inside */}
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

// ── Empty state ────────────────────────────────────────────────
function EmptyEditor({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 select-none px-8">
      {/* Journal-style icon */}
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{
          background: "hsl(var(--primary) / 0.08)",
          border: "1px solid hsl(var(--primary) / 0.14)",
        }}
      >
        <BookOpen size={24} style={{ color: "hsl(var(--primary) / 0.7)" }} />
      </div>

      <div className="text-center">
        <p
          className="text-sm font-semibold"
          style={{ color: "hsl(var(--foreground))" }}
        >
          Open a note
        </p>
        <p
          className="text-xs mt-1"
          style={{ color: "hsl(var(--muted-foreground))" }}
        >
          Pick from the list, or start a new one.
        </p>
      </div>

      <button
        onClick={onNew}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-fast"
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

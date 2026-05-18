// ============================================================
// NOTES MODULE — ROOT (Polished UI)
// Lazy-loaded. Registers manifest on mount.
// ============================================================

import React, { useEffect, useCallback } from "react";
import { registry } from "@/kernel/router";
import { useNoteStore } from "./store";
import { NoteList } from "./components/NoteList";
import { NoteEditor } from "./components/NoteEditor";
import { NoteToolbar } from "./components/NoteToolbar";
import { DailyNoteContext } from "./components/DailyNoteContext";
import { EmptyState } from "@/shared/ui";
import type { ModuleManifest } from "@/shared/types";

const manifest: ModuleManifest = {
  id: "notes",
  name: "Notes",
  icon: "FileText",
  sidebarOrder: 4,
  isEnabled: true,
  routes: [{ path: "/notes", label: "Notes" }],
  commands: [
    { id: "note.new", label: "New note", group: "Notes", action: "navigate:to" },
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
  const isDaily = openedNote?.type === "daily";

  const handleNewNote = useCallback(async () => {
    const note = await createNote();
    openNote(note.id);
  }, [createNote, openNote]);

  return (
    <div className="grid h-full min-h-0 grid-cols-[320px_minmax(0,1fr)] overflow-hidden rounded-2xl border border-border/60 bg-background shadow-sm">
      <aside className="min-h-0 border-r border-border/60 bg-card/40">
        <div className="h-full min-h-0 p-3">
          <div className="h-full min-h-0 overflow-hidden rounded-xl border border-border/60 bg-background/80 shadow-sm">
            <NoteList />
          </div>
        </div>
      </aside>

      <section className="flex min-h-0 flex-col overflow-hidden bg-background">
        {openedNote ? (
          <>
            <div className="border-b border-border/60 bg-card/50 px-4 py-3">
              <NoteToolbar note={openedNote} />
            </div>

            {isDaily && (
              <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
                <DailyNoteContext />
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-hidden p-4">
              <div className="h-full rounded-2xl border border-border/60 bg-card/30 shadow-sm">
                <NoteEditor
                  key={openedNote.id}
                  note={openedNote}
                  className="flex-1 overflow-y-auto"
                />
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center p-6">
            <EmptyState
              title="No note selected"
              subtitle="Pick a note from the list or create a new one."
              action={{ label: "New note", onClick: () => void handleNewNote() }}
            />
          </div>
        )}
      </section>
    </div>
  );
}
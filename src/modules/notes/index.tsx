import { useEffect } from "react";
import { registry } from "@/kernel/router";
import { useNoteStore } from "./store";
import { NoteList } from "./components/NoteList";
import { NoteEditor } from "./components/NoteEditor";
import { NoteToolbar } from "./components/NoteToolbar";
import { DailyNoteContext } from "./components/DailyNoteContext";
import { EmptyState } from "@/shared/ui";
import type { ModuleManifest } from "@/shared/types";

const manifest: ModuleManifest = {
  id: "notes", name: "Notes", icon: "FileText",
  sidebarOrder: 4, isEnabled: true,
  routes: [{ path: "/notes", label: "Notes" }],
  commands: [
    { id: "note.new",   label: "New note",         group: "Notes", action: "navigate:to" },
    { id: "note.today", label: "Open today's note", group: "Notes", action: "navigate:to" },
  ],
  shortcuts: [
    { keys: "g n", action: "navigate:to", description: "Go to Notes", global: false },
  ],
};
registry.register(manifest);

export function NotesModule() {
  const { loadNotes, openNoteId, getNoteById, createNote, openNote, getOrCreateToday } =
    useNoteStore();

  useEffect(() => { void loadNotes(); }, []);

  const openedNote = openNoteId ? getNoteById(openNoteId) : null;
  const isDaily    = openedNote?.type === "daily";

  const handleNewNote = async () => {
    const note = await createNote();
    openNote(note.id);
  };

  return (
    <div className="flex h-full overflow-hidden">
      <NoteList />

      <div className="flex flex-col flex-1 overflow-hidden">
        {openedNote ? (
          <>
            <NoteToolbar note={openedNote} />
            {/* Daily notes get today's context strip */}
            {isDaily && <DailyNoteContext />}
            <NoteEditor
              key={openedNote.id}
              note={openedNote}
              className="flex-1 overflow-y-auto"
            />
          </>
        ) : (
          <EmptyState
            title="No note selected"
            subtitle="Pick a note from the list or create a new one."
            action={{ label: "New note", onClick: () => void handleNewNote() }}
          />
        )}
      </div>
    </div>
  );
}

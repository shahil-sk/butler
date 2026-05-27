import React, { useState, useEffect } from "react";
import { Compass } from "lucide-react";
import { useNotesStore } from "../state/notesStore";
import { Note } from "../types";
import { NoteSidebar } from "./NoteSidebar";
import { NoteEditor } from "./NoteEditor";
import { NoteBacklinks } from "./NoteBacklinks";

export const NotesView: React.FC = () => {
  const {
    notes,
    activeNote,
    backlinks,
    loadNotes,
    setActiveNote,
    createNote,
  } = useNotesStore();

  const [semanticLinks, setSemanticLinks] = useState<{ note: Note; similarity: number }[]>([]);

  // Initial load
  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  // Reset semantic links when note selection changes
  useEffect(() => {
    setSemanticLinks([]);
  }, [activeNote]);

  const selectNote = async (note: Note | null) => {
    // Parent selectNote delegates to store active note updates
    await setActiveNote(note);
  };

  const handleWikilinkClick = async (title: string) => {
    const existing = notes.find(n => n.title.toLowerCase() === title.toLowerCase());
    if (existing) {
      await selectNote(existing);
    } else {
      // Find note in database stubs
      await loadNotes();
      const freshNotes = useNotesStore.getState().notes;
      const found = freshNotes.find(n => n.title.toLowerCase() === title.toLowerCase());
      if (found) {
        await selectNote(found);
      } else {
        const newNote = await createNote(title, `This is your new page for [[${title}]]. Start typing to edit!`);
        await selectNote(newNote);
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6 overflow-hidden h-full">
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 overflow-hidden">
        {/* Sidebar */}
        <NoteSidebar onSelectNote={selectNote} />

        {/* Editor */}
        {activeNote ? (
          <NoteEditor
            activeNote={activeNote}
            onWikilinkClick={handleWikilinkClick}
            onSemanticLinksFound={setSemanticLinks}
          />
        ) : (
          <div className="lg:col-span-2 bg-zinc-900/10 border border-zinc-850 rounded-2xl p-5 flex flex-col items-center justify-center text-zinc-500 text-center gap-2">
            <Compass className="w-10 h-10 text-zinc-700 animate-pulse" />
            <p className="text-xs font-semibold max-w-sm leading-relaxed">
              Select a note from the sidebar or click the new note button to begin mapping your Second Brain.
            </p>
          </div>
        )}

        {/* Backlinks & Recommendations */}
        <NoteBacklinks
          activeNote={activeNote}
          backlinks={backlinks}
          semanticLinks={semanticLinks}
          onWikilinkClick={handleWikilinkClick}
        />
      </div>
    </div>
  );
};

export default NotesView;

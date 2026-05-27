import React from "react";
import { Search, FileText, Trash2, Plus, X, BookOpen } from "lucide-react";
import { useNotesStore } from "../state/notesStore";
import { Note } from "../types";

interface NoteSidebarProps {
  onSelectNote: (note: Note | null) => Promise<void>;
}

export const NoteSidebar: React.FC<NoteSidebarProps> = ({ onSelectNote }) => {
  const {
    notes,
    activeNote,
    searchQuery,
    setSearchQuery,
    loadNotes,
    searchNotes,
    createNote,
    deleteNote,
  } = useNotesStore();

  const handleCreateNote = async () => {
    try {
      const defaultTitle = `Untitled ${notes.length + 1}`;
      const newNote = await createNote(defaultTitle, "");
      await onSelectNote(newNote);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this note?")) {
      try {
        await deleteNote(id);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="lg:col-span-1 border-r border-zinc-850 pr-4 flex flex-col gap-4 h-full overflow-hidden">
      <div className="flex justify-between items-center shrink-0">
        <h1 className="text-lg font-bold text-zinc-100 flex items-center gap-1.5">
          <BookOpen className="w-5 h-5 text-amber-500" />
          Second Brain
        </h1>
        <button
          onClick={handleCreateNote}
          className="bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold p-2 rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-lg shadow-amber-500/10"
          title="New Note"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 shrink-0">
        <Search className="w-4 h-4 text-zinc-500 mr-2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            searchNotes(e.target.value);
          }}
          placeholder="Search notes..."
          className="bg-transparent border-0 outline-none text-xs w-full text-zinc-300 placeholder-zinc-650"
        />
        {searchQuery && (
          <button onClick={() => { setSearchQuery(""); void loadNotes(); }} className="text-zinc-500 hover:text-zinc-300">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-1 pr-1">
        {notes.length === 0 ? (
          <div className="text-center py-8 text-zinc-500 text-xs">
            No notes found. Create one!
          </div>
        ) : (
          notes.map((note) => {
            const isActive = activeNote?.id === note.id;
            const isStub = !note.content || note.content.trim() === "";
            return (
              <div
                key={note.id}
                onClick={() => void onSelectNote(note)}
                className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col gap-1 group relative ${
                  isActive
                    ? "bg-zinc-800/40 border-amber-500/50 text-zinc-100"
                    : "bg-zinc-900/10 border-transparent hover:bg-zinc-900/30 hover:border-zinc-850 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <div className="flex items-start justify-between pr-6">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <FileText className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-amber-500" : "text-zinc-500"}`} />
                    <span className="text-xs font-semibold truncate">{note.title}</span>
                    {isStub && (
                      <span className="text-[9px] px-1 py-0.2 bg-zinc-900 border border-zinc-800 text-zinc-500 rounded uppercase font-bold tracking-wider shrink-0">
                        Stub
                      </span>
                    )}
                  </div>
                </div>
                
                <span className="text-[10px] text-zinc-550">
                  {formatTime(note.updated_at)}
                </span>

                <button
                  onClick={(e) => void handleDelete(note.id, e)}
                  className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-rose-400 p-1 rounded-md hover:bg-zinc-800/80 transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

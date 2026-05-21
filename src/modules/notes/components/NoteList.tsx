// ============================================================
// NOTES — NoteList
// Search only. Filter + new note actions live in index.tsx.
// ============================================================

import { Search, Pin, FileText, Calendar, Users, Star, StickyNote } from "lucide-react";
import { cn, formatRelative } from "@/shared/utils";
import { useNoteStore } from "../store";
import type { Note } from "@/shared/types";

const TYPE_ICONS: Record<string, React.ElementType> = {
  note:     StickyNote,
  daily:    Calendar,
  meeting:  Users,
  template: Star,
};

export function NoteList() {
  const {
    searchQuery, setSearchQuery,
    getFilteredNotes, openNote, openNoteId,
  } = useNoteStore();

  const notes = getFilteredNotes();

  return (
    <div className="flex flex-col h-full min-h-0 bg-[hsl(var(--surface-1))]">

    <div className="flex items-center justify-between px-4 py-2.5 shrink-0">
    <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
    Search
    </span>
    </div>

      {/* ── Search ─────────────────────────────────────────── */}
      <div className="px-3 pb-2 shrink-0">
        <label className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-muted/40 border border-border/40 focus-within:ring-1 focus-within:ring-primary/25 transition-all">
          <Search size={11} className="text-muted-foreground/40 shrink-0" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search…"
            className="flex-1 bg-transparent text-[12px] placeholder:text-muted-foreground/40 focus:outline-none"
          />
        </label>
      </div>

      {/* ── Note items ─────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0 py-1 px-1.5">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12">
            <FileText size={26} className="text-muted-foreground/25" />
            <p className="text-[11px] text-muted-foreground/40 italic">
              {searchQuery ? "No matching notes" : "No notes yet"}
            </p>
          </div>
        ) : (
          notes.map((note) => (
            <NoteListItem
              key={note.id}
              note={note}
              isActive={openNoteId === note.id}
              onOpen={() => openNote(note.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── Note row ──────────────────────────────────────────────────
function NoteListItem({ note, isActive, onOpen }: {
  note: Note;
  isActive: boolean;
  onOpen: () => void;
}) {
  const Icon = TYPE_ICONS[note.type] ?? FileText;

  const preview = (() => {
    try {
      const doc = JSON.parse(note.content);
      const texts: string[] = [];
      const walk = (node: { type?: string; text?: string; content?: unknown[] }) => {
        if (node.text) texts.push(node.text);
        node.content?.forEach((c) => walk(c as typeof node));
      };
      walk(doc);
      return texts.join(" ").slice(0, 80);
    } catch { return ""; }
  })();

  return (
    <button
      onClick={onOpen}
      className={cn(
        "w-full text-left flex flex-col gap-0.5 px-3 py-2.5 rounded-lg mb-px transition-colors",
        isActive ? "bg-accent" : "hover:bg-accent/60",
      )}
    >
      {/* Title row */}
      <div className="flex items-center gap-1.5 min-w-0">
        {note.isPinned
          ? <Pin size={10} className="text-primary shrink-0" />
          : <Icon size={11} className="text-muted-foreground/60 shrink-0" />
        }
        <span className={cn(
          "text-[13px] font-medium truncate leading-tight",
          isActive ? "text-foreground" : "text-foreground/90",
        )}>
          {note.title || "Untitled"}
        </span>
      </div>

      {/* Preview */}
      {preview && (
        <p className="text-[11px] truncate leading-snug text-muted-foreground/60 pl-[18px]">
          {preview}
        </p>
      )}

      {/* Meta */}
      <div className="flex items-center gap-2 text-[10px] tabular-nums text-muted-foreground/50 pl-[18px]">
        <span>{formatRelative(note.updatedAt)}</span>
        {note.tags.length > 0 && (
          <span className="text-muted-foreground/40">
            {note.tags.slice(0, 2).map((t) => `#${t}`).join(" ")}
          </span>
        )}
      </div>
    </button>
  );
}

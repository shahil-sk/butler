import { Plus, Search, Pin, FileText, Calendar, Users, Star } from "lucide-react";
import { cn, formatRelative } from "@/shared/utils";
import { useNoteStore } from "../store";
import { FilterBar, type FilterTab } from "@/shared/ui";
import type { Note } from "@/shared/types";

const FILTER_TABS: FilterTab[] = [
  { id: "all",     label: "All" },
  { id: "note",    label: "Notes" },
  { id: "daily",   label: "Daily" },
  { id: "meeting", label: "Meetings" },
  { id: "pinned",  label: "Pinned" },
];

const TYPE_ICONS: Record<string, React.ElementType> = {
  note:    FileText,
  daily:   Calendar,
  meeting: Users,
  template:Star,
};

export function NoteList() {
  const {
    searchQuery, setSearchQuery,
    activeFilter, setActiveFilter,
    getFilteredNotes, openNote, openNoteId,
    createNote, getOrCreateToday,
  } = useNoteStore();

  const notes = getFilteredNotes();

  const handleNewNote = async () => {
    const note = await createNote();
    openNote(note.id);
  };

  const handleTodayNote = async () => {
    const note = await getOrCreateToday();
    openNote(note.id);
  };

  return (
    <div className="flex flex-col w-64 shrink-0 border-r border-border bg-surface-1 h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-border shrink-0">
        <span className="text-xs font-semibold flex-1 text-muted-foreground uppercase tracking-widest">
          Notes
        </span>
        <button
          onClick={handleTodayNote}
          title="Today's note"
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-fast"
        >
          <Calendar size={13} />
        </button>
        <button
          onClick={() => void handleNewNote()}
          title="New note"
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-fast"
        >
          <Plus size={13} />
        </button>
      </div>

      {/* Search */}
      <div className="px-2 py-1.5 border-b border-border shrink-0">
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-background border border-border">
          <Search size={11} className="text-muted-foreground/50 shrink-0" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes…"
            className="flex-1 text-xs bg-transparent outline-none placeholder:text-muted-foreground/40"
          />
        </div>
      </div>

      {/* Filter tabs */}
      <FilterBar
        tabs={FILTER_TABS}
        activeId={activeFilter}
        onSelect={(id) => setActiveFilter(id as typeof activeFilter)}
        className="px-2 py-1"
      />

      {/* Note list */}
      <div className="flex-1 overflow-y-auto py-1">
        {notes.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-muted-foreground/60">
            {searchQuery ? "No matching notes" : "No notes yet"}
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

function NoteListItem({
  note, isActive, onOpen,
}: {
  note: Note;
  isActive: boolean;
  onOpen: () => void;
}) {
  const Icon = TYPE_ICONS[note.type] ?? FileText;

  // Extract plain text preview from Tiptap JSON
  const preview = (() => {
    try {
      const doc = JSON.parse(note.content);
      const texts: string[] = [];
      const walk = (node: { type?: string; text?: string; content?: unknown[] }) => {
        if (node.text) texts.push(node.text);
        if (node.content) node.content.forEach((c) => walk(c as typeof node));
      };
      walk(doc);
      return texts.join(" ").slice(0, 80);
    } catch {
      return "";
    }
  })();

  return (
    <button
      onClick={onOpen}
      className={cn(
        "w-full text-left flex flex-col gap-0.5 px-3 py-2.5 transition-fast",
        isActive
          ? "bg-primary/8 border-r-2 border-r-primary"
          : "hover:bg-accent/60 border-r-2 border-r-transparent"
      )}
    >
      <div className="flex items-center gap-1.5">
        {note.isPinned && <Pin size={10} className="text-muted-foreground/60 shrink-0" />}
        <Icon size={11} className="text-muted-foreground/60 shrink-0" />
        <span className="text-xs font-medium truncate flex-1">{note.title}</span>
      </div>
      {preview && (
        <p className="text-[11px] text-muted-foreground/60 truncate pl-5">{preview}</p>
      )}
      <span className="text-[10px] text-muted-foreground/40 pl-5 tabular-nums">
        {formatRelative(note.updatedAt)}
      </span>
    </button>
  );
}

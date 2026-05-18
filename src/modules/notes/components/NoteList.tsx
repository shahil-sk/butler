// ============================================================
// NOTES — NoteList  (redesign v2)
// Clean sidebar: search, filter tabs, note items
// ============================================================

import { Plus, Search, Pin, FileText, Calendar, Users, Star, StickyNote } from "lucide-react";
import { cn, formatRelative } from "@/shared/utils";
import { useNoteStore } from "../store";
import type { Note } from "@/shared/types";

const FILTER_TABS = [
  { id: "all",      label: "All" },
  { id: "note",     label: "Notes" },
  { id: "daily",    label: "Daily" },
  { id: "meeting",  label: "Meetings" },
  { id: "pinned",   label: "Pinned" },
] as const;

const TYPE_ICONS: Record<string, React.ElementType> = {
  note:     StickyNote,
  daily:    Calendar,
  meeting:  Users,
  template: Star,
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
    <div className="flex flex-col h-full min-h-0">

      {/* ── Header ──────────────────────────────────────────── */}
      <div
        className="flex items-center gap-1 px-3 h-11 shrink-0 border-b"
        style={{ borderColor: "hsl(var(--border))" }}
      >
        <span
          className="text-xs font-semibold flex-1 tracking-wide"
          style={{ color: "hsl(var(--foreground))" }}
        >
          Notes
        </span>
        <HeaderBtn onClick={() => void handleTodayNote()} title="Today's note" aria-label="Open today's note">
          <Calendar size={14} />
        </HeaderBtn>
        <HeaderBtn onClick={() => void handleNewNote()} title="New note" aria-label="New note">
          <Plus size={14} />
        </HeaderBtn>
      </div>

      {/* ── Search ──────────────────────────────────────────── */}
      <div className="px-2.5 py-2 shrink-0">
        <div
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
          style={{
            background: "hsl(var(--background))",
            border: "1px solid hsl(var(--border))",
          }}
        >
          <Search size={12} style={{ color: "hsl(var(--muted-foreground) / 0.5)", flexShrink: 0 }} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes…"
            className="flex-1 text-xs bg-transparent outline-none"
            style={{ color: "hsl(var(--foreground))" }}
          />
        </div>
      </div>

      {/* ── Filter tabs ─────────────────────────────────────── */}
      <div
        className="flex gap-0.5 px-2 pb-1.5 shrink-0 overflow-x-auto"
        style={{ scrollbarWidth: "none" }}
      >
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveFilter(tab.id as typeof activeFilter)}
            className="shrink-0 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors"
            style={{
              background: activeFilter === tab.id ? "hsl(var(--primary) / 0.12)" : "transparent",
              color: activeFilter === tab.id
                ? "hsl(var(--primary))"
                : "hsl(var(--muted-foreground))",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Note list ───────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0 pb-2">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <FileText size={28} style={{ color: "hsl(var(--muted-foreground) / 0.3)" }} />
            <p className="text-xs" style={{ color: "hsl(var(--muted-foreground) / 0.5)" }}>
              {searchQuery ? "No matching notes" : "No notes yet"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-px px-1.5">
            {notes.map((note) => (
              <NoteListItem
                key={note.id}
                note={note}
                isActive={openNoteId === note.id}
                onOpen={() => openNote(note.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Header icon button ────────────────────────────────────────
function HeaderBtn({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) {
  return (
    <button
      {...props}
      className="w-7 h-7 flex items-center justify-center rounded-md transition-colors"
      style={{ color: "hsl(var(--muted-foreground))" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "hsl(var(--accent))";
        e.currentTarget.style.color = "hsl(var(--foreground))";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = "hsl(var(--muted-foreground))";
      }}
    >
      {children}
    </button>
  );
}

// ── Note list item ─────────────────────────────────────────────
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
      return texts.join(" ").slice(0, 90);
    } catch { return ""; }
  })();

  return (
    <button
      onClick={onOpen}
      className={cn(
        "w-full text-left flex flex-col gap-0.5 px-3 py-2.5 rounded-lg transition-colors group",
        isActive ? "" : ""
      )}
      style={{
        background: isActive ? "hsl(var(--primary) / 0.10)" : "transparent",
        color: isActive ? "hsl(var(--foreground))" : "hsl(var(--foreground))",
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.background = "hsl(var(--accent))";
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.background = "transparent";
      }}
    >
      {/* Title row */}
      <div className="flex items-center gap-1.5 min-w-0">
        {note.isPinned
          ? <Pin size={10} style={{ color: "hsl(var(--primary))", flexShrink: 0 }} />
          : <Icon size={11} style={{ color: "hsl(var(--muted-foreground))", flexShrink: 0 }} />
        }
        <span
          className="text-[13px] font-medium truncate flex-1 leading-tight"
          style={{ color: isActive ? "hsl(var(--foreground))" : "hsl(var(--foreground))" }}
        >
          {note.title || "Untitled"}
        </span>
      </div>

      {/* Preview */}
      {preview && (
        <p
          className="text-[11px] truncate pl-[18px] leading-snug"
          style={{ color: "hsl(var(--muted-foreground) / 0.7)" }}
        >
          {preview}
        </p>
      )}

      {/* Metadata row */}
      <div className="flex items-center gap-2 pl-[18px]">
        <span
          className="text-[10px] tabular-nums"
          style={{ color: "hsl(var(--muted-foreground) / 0.45)" }}
        >
          {formatRelative(note.updatedAt)}
        </span>
        {note.tags.length > 0 && (
          <span
            className="text-[10px] truncate"
            style={{ color: "hsl(var(--muted-foreground) / 0.4)" }}
          >
            {note.tags.slice(0, 2).map((t) => `#${t}`).join(" ")}
          </span>
        )}
      </div>
    </button>
  );
}

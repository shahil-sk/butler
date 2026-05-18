// ============================================================
// NOTES — NoteList  (journal redesign)
// Warm paper sidebar: search, type filters, note rows.
// Uses only hsl(var(--*)) tokens — fully dark/light aware.
// ============================================================

import { Plus, Search, Pin, FileText, Calendar, Users, Star, StickyNote } from "lucide-react";
import { cn, formatRelative } from "@/shared/utils";
import { useNoteStore } from "../store";
import type { Note } from "@/shared/types";

const FILTER_TABS = [
  { id: "all",     label: "All" },
  { id: "note",    label: "Notes" },
  { id: "daily",   label: "Daily" },
  { id: "meeting", label: "Meetings" },
  { id: "pinned",  label: "Pinned" },
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
    <div
      className="flex flex-col h-full min-h-0"
      style={{ background: "hsl(var(--surface-1))" }}
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <div
        className="flex items-center gap-1 px-3 h-11 shrink-0"
        style={{ borderBottom: "1px solid hsl(var(--border))" }}
      >
        <span
          className="text-[11px] font-semibold uppercase tracking-widest flex-1 select-none"
          style={{ color: "hsl(var(--muted-foreground))" }}
        >
          Notes
        </span>
        <SidebarIconBtn onClick={() => void handleTodayNote()} title="Today's note">
          <Calendar size={14} />
        </SidebarIconBtn>
        <SidebarIconBtn onClick={() => void handleNewNote()} title="New note">
          <Plus size={14} />
        </SidebarIconBtn>
      </div>

      {/* ── Search ─────────────────────────────────────────── */}
      <div className="px-2.5 py-2 shrink-0">
        <label
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-fast"
          style={{
            background: "hsl(var(--background))",
            border: "1px solid hsl(var(--border))",
          }}
        >
          <Search size={12} style={{ color: "hsl(var(--muted-foreground))", flexShrink: 0 }} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search…"
            className="flex-1 text-xs bg-transparent outline-none"
            style={{ color: "hsl(var(--foreground))" }}
          />
        </label>
      </div>

      {/* ── Filter pills ───────────────────────────────────── */}
      <div
        className="flex gap-0.5 px-2 pb-2 shrink-0"
        style={{ overflowX: "auto", scrollbarWidth: "none" }}
      >
        {FILTER_TABS.map((tab) => {
          const active = activeFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id as typeof activeFilter)}
              className="shrink-0 px-2.5 py-1 rounded-md text-[11px] font-medium transition-fast select-none"
              style={{
                background: active ? "hsl(var(--primary) / 0.12)" : "transparent",
                color: active ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Note items ─────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0 py-1 px-1.5">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12">
            <FileText size={26} style={{ color: "hsl(var(--muted-foreground) / 0.25)" }} />
            <p className="text-[11px]" style={{ color: "hsl(var(--muted-foreground) / 0.4)" }}>
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

// ── Small icon button in sidebar header ───────────────────────
function SidebarIconBtn({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="w-6 h-6 flex items-center justify-center rounded transition-fast"
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
      className="w-full text-left flex flex-col gap-0.5 px-3 py-2.5 rounded-lg mb-px transition-fast group"
      style={{
        background: isActive ? "hsl(var(--primary) / 0.09)" : "transparent",
        borderLeft: isActive
          ? "2px solid hsl(var(--primary))"
          : "2px solid transparent",
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
          : <Icon size={11} style={{ color: "hsl(var(--muted-foreground) / 0.6)", flexShrink: 0 }} />
        }
        <span
          className="text-[13px] font-medium truncate leading-tight"
          style={{ color: "hsl(var(--foreground))" }}
        >
          {note.title || "Untitled"}
        </span>
      </div>

      {/* Preview line */}
      {preview && (
        <p
          className="text-[11px] truncate leading-snug"
          style={{
            paddingLeft: 18,
            color: "hsl(var(--muted-foreground) / 0.6)",
          }}
        >
          {preview}
        </p>
      )}

      {/* Meta: date + tags */}
      <div
        className="flex items-center gap-2 text-[10px] tabular-nums"
        style={{ paddingLeft: 18, color: "hsl(var(--text-tertiary))" }}
      >
        <span>{formatRelative(note.updatedAt)}</span>
        {note.tags.length > 0 && (
          <span style={{ color: "hsl(var(--muted-foreground) / 0.4)" }}>
            {note.tags.slice(0, 2).map((t) => `#${t}`).join(" ")}
          </span>
        )}
      </div>
    </button>
  );
}

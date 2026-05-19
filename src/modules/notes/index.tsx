// ============================================================
// NOTES MODULE — ROOT
// Layout mirrors Planner: Row1 header | Row2 tabs | flex body
// ============================================================

import { useEffect, useCallback } from "react";
import { BookOpen, Plus, AlignLeft, Calendar, FileText, Pin } from "lucide-react";
import { registry } from "@/kernel/router";
import { useNoteStore } from "./store";
import { NoteList } from "./components/NoteList";
import { NoteEditor } from "./components/NoteEditor";
import { NoteToolbar } from "./components/NoteToolbar";
import { DailyNoteContext } from "./components/DailyNoteContext";
import { cn } from "@/shared/utils";
import { format } from "date-fns";
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

registry.register(manifest);

const FILTER_TABS = [
  { id: "all",     icon: AlignLeft, label: "All"    },
  { id: "note",    icon: FileText,  label: "Notes"  },
  { id: "daily",   icon: Calendar,  label: "Daily"  },
  { id: "pinned",  icon: Pin,       label: "Pinned" },
] as const;

// ── Module ───────────────────────────────────────────────────
export function NotesModule() {
  const {
    loadNotes, openNoteId, getNoteById,
    createNote, openNote, getOrCreateToday,
    activeFilter, setActiveFilter,
  } = useNoteStore();

  useEffect(() => { void loadNotes(); }, [loadNotes]);

  const openedNote = openNoteId ? getNoteById(openNoteId) : null;
  const isDaily    = openedNote?.type === "daily";

  const handleNewNote = useCallback(async () => {
    const note = await createNote();
    openNote(note.id);
  }, [createNote, openNote]);

  const handleTodayNote = useCallback(async () => {
    const note = await getOrCreateToday();
    openNote(note.id);
  }, [getOrCreateToday, openNote]);

  const today = format(new Date(), "EEEE, MMMM d");

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">

      {/* ── Row 1: Title + ghost action btns (Planner style) ─ */}
      <div className="flex items-center justify-between px-6 pt-6 pb-3 shrink-0">
        <div>
          <h1 className="text-[18px] font-bold leading-tight tracking-tight">Notes</h1>
          <p className="text-[12px] text-muted-foreground mt-0.5 leading-tight">{today}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Today's note — ghost style matching Planner "Templates" */}
          <button
            onClick={() => void handleTodayNote()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <Calendar size={13} />
            Today
          </button>

          <div className="w-px h-4 bg-border" />

          {/* New note — ghost style */}
          <button
            onClick={() => void handleNewNote()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <Plus size={13} />
            New note
          </button>
        </div>
      </div>

      {/* ── Row 2: Filter tabs ───────────────────────────────── */}
      <div className="flex items-center px-6 border-b border-border shrink-0">
        {FILTER_TABS.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setActiveFilter(id)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-3 text-[13px] font-medium",
              "border-b-2 -mb-px transition-colors",
              activeFilter === id
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
            )}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Body: sidebar + editor ───────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        <aside
          className="flex flex-col shrink-0 overflow-hidden border-r border-border bg-[hsl(var(--surface-1))]"
          style={{ width: 252 }}
        >
          <NoteList />
        </aside>

        <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
          {openedNote ? (
            <>
              <NoteToolbar note={openedNote} />

              {isDaily && (
                <div className="px-6 py-2 text-xs shrink-0 border-b border-border bg-muted/35 text-muted-foreground">
                  <DailyNoteContext />
                </div>
              )}

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
        </div>

      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────
function EmptyEditor({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 select-none px-6">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-primary/8 border border-primary/14">
        <BookOpen size={24} className="text-primary/70" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-foreground">Open a note</p>
        <p className="text-xs mt-1 text-muted-foreground">Pick from the list, or start a new one.</p>
      </div>
      <button
        onClick={onNew}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
      >
        <Plus size={14} /> New note
      </button>
    </div>
  );
}

import { create } from "zustand";
import { db } from "@/kernel/db";
import { bus } from "@/kernel/event-bus";
import { generateId, now, today } from "@/shared/utils";
import type { Note, ID } from "@/shared/types";

// ── DB row ↔ Note ─────────────────────────────────────────────

function rowToNote(r: Record<string, unknown>): Note {
  return {
    id:               r.id as string,
    title:            r.title as string,
    content:          r.content as string,
    type:             r.type as Note["type"],
    date:             (r.date as string | null) ?? undefined,
    linkedTaskIds:    JSON.parse((r.linked_task_ids as string) || "[]"),
    linkedProjectIds: JSON.parse((r.linked_project_ids as string) || "[]"),
    linkedEventIds:   JSON.parse((r.linked_event_ids as string) || "[]"),
    backlinks:        JSON.parse((r.backlinks as string) || "[]"),
    tags:             JSON.parse((r.tags as string) || "[]"),
    isPinned:         Boolean(r.is_pinned),
    createdAt:        r.created_at as string,
    updatedAt:        r.updated_at as string,
  };
}

const INSERT_SQL = `
  INSERT INTO notes
    (id, title, content, type, date, linked_task_ids, linked_project_ids,
     linked_event_ids, backlinks, tags, is_pinned, created_at, updated_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
`;
const UPDATE_SQL = `
  UPDATE notes SET
    title=?, content=?, type=?, date=?,
    linked_task_ids=?, linked_project_ids=?, linked_event_ids=?,
    backlinks=?, tags=?, is_pinned=?, updated_at=?
  WHERE id=?
`;

function insertParams(n: Note): unknown[] {
  return [
    n.id, n.title, n.content, n.type, n.date ?? null,
    JSON.stringify(n.linkedTaskIds), JSON.stringify(n.linkedProjectIds),
    JSON.stringify(n.linkedEventIds), JSON.stringify(n.backlinks),
    JSON.stringify(n.tags), n.isPinned ? 1 : 0,
    n.createdAt, n.updatedAt,
  ];
}
function updateParams(n: Note): unknown[] {
  return [
    n.title, n.content, n.type, n.date ?? null,
    JSON.stringify(n.linkedTaskIds), JSON.stringify(n.linkedProjectIds),
    JSON.stringify(n.linkedEventIds), JSON.stringify(n.backlinks),
    JSON.stringify(n.tags), n.isPinned ? 1 : 0, n.updatedAt,
    n.id,
  ];
}

// ── State ─────────────────────────────────────────────────────

interface NoteState {
  notes:        Note[];
  loading:      boolean;
  openNoteId:   ID | null;
  searchQuery:  string;
  activeFilter: "all" | "note" | "daily" | "meeting" | "pinned";
}

interface NoteActions {
  loadNotes:        () => Promise<void>;
  createNote:       (input?: Partial<Note>) => Promise<Note>;
  updateNote:       (id: ID, patch: Partial<Note>) => Promise<void>;
  deleteNote:       (id: ID) => Promise<void>;
  openNote:         (id: ID) => void;
  closeNote:        () => void;
  pinNote:          (id: ID) => Promise<void>;
  getTodayNote:     () => Note | undefined;
  getOrCreateToday: () => Promise<Note>;
  setSearchQuery:   (q: string) => void;
  setActiveFilter:  (f: NoteState["activeFilter"]) => void;
  getFilteredNotes: () => Note[];
  getNoteById:      (id: ID) => Note | undefined;
}

export const useNoteStore = create<NoteState & NoteActions>()((set, get) => ({
  notes: [], loading: false, openNoteId: null,
  searchQuery: "", activeFilter: "all",

  loadNotes: async () => {
    set({ loading: true });
    try {
      const rows = await db.select<Record<string, unknown>>(
        "SELECT * FROM notes ORDER BY is_pinned DESC, updated_at DESC"
      );
      set({ notes: rows.map(rowToNote), loading: false });
    } catch (err) {
      console.error("[Notes] loadNotes error:", err);
      set({ loading: false });
    }
  },

  createNote: async (input = {}) => {
    const note: Note = {
      id:               generateId(),
      title:            input.title ?? "Untitled",
      content:          input.content ?? JSON.stringify({ type: "doc", content: [] }),
      type:             input.type ?? "note",
      date:             input.date,
      linkedTaskIds:    input.linkedTaskIds    ?? [],
      linkedProjectIds: input.linkedProjectIds ?? [],
      linkedEventIds:   input.linkedEventIds   ?? [],
      backlinks:        input.backlinks        ?? [],
      tags:             input.tags             ?? [],
      isPinned:         input.isPinned         ?? false,
      createdAt:        now(),
      updatedAt:        now(),
    };
    await db.execute(INSERT_SQL, insertParams(note));
    set((s) => ({ notes: [note, ...s.notes] }));
    bus.emit("note:created", { note });
    bus.emit("search:index-invalidated", { entityType: "note", id: note.id });
    return note;
  },

  updateNote: async (id, patch) => {
    const existing = get().notes.find((n) => n.id === id);
    if (!existing) return;
    const updated: Note = { ...existing, ...patch, updatedAt: now() };
    await db.execute(UPDATE_SQL, updateParams(updated));
    set((s) => ({ notes: s.notes.map((n) => n.id === id ? updated : n) }));
    bus.emit("note:updated", { note: updated });
    bus.emit("search:index-invalidated", { entityType: "note", id });
  },

  deleteNote: async (id) => {
    await db.execute("DELETE FROM notes WHERE id=?", [id]);
    set((s) => ({
      notes: s.notes.filter((n) => n.id !== id),
      openNoteId: s.openNoteId === id ? null : s.openNoteId,
    }));
    bus.emit("note:deleted", { noteId: id });
  },

  openNote:  (id) => { set({ openNoteId: id }); bus.emit("note:open", { noteId: id }); },
  closeNote: ()   => set({ openNoteId: null }),

  pinNote: async (id) => {
    const note = get().notes.find((n) => n.id === id);
    if (!note) return;
    await get().updateNote(id, { isPinned: !note.isPinned });
  },

  getTodayNote: () => {
    const t = today();
    return get().notes.find((n) => n.type === "daily" && n.date === t);
  },

  getOrCreateToday: async () => {
    const existing = get().getTodayNote();
    if (existing) return existing;
    return get().createNote({ type: "daily", date: today(), title: `Daily — ${today()}` });
  },

  setSearchQuery:  (q) => set({ searchQuery: q }),
  setActiveFilter: (f) => set({ activeFilter: f }),

  getFilteredNotes: () => {
    const { notes, searchQuery, activeFilter } = get();
    let result = notes;

    if (activeFilter === "pinned") result = result.filter((n) => n.isPinned);
    else if (activeFilter !== "all") result = result.filter((n) => n.type === activeFilter);

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
      );
    }
    return result;
  },

  getNoteById: (id) => get().notes.find((n) => n.id === id),
}));

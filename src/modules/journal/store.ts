// ============================================================
// JOURNAL MODULE — STORE
// No cross-module store writes. Emit bus events instead.
// ============================================================

import { create } from "zustand";
import { db } from "@/kernel/db";
import { bus } from "@/kernel/event-bus";
import { generateId, now, today } from "@/shared/utils";
import type { JournalEntry, ISODate, ID } from "@/shared/types";

// ── DB helpers ───────────────────────────────────────────────

function rowToEntry(row: Record<string, unknown>): JournalEntry {
  return {
    id:                row.id as string,
    date:              row.date as string,
    type:              row.type as JournalEntry["type"],
    content:           row.content as string,
    mood:              row.mood != null ? (row.mood as 1 | 2 | 3 | 4 | 5) : undefined,
    linkedTaskIds:     JSON.parse(row.linked_task_ids as string),
    linkedProjectIds:  JSON.parse(row.linked_project_ids as string),
    tags:              JSON.parse(row.tags as string),
    createdAt:         row.created_at as string,
    updatedAt:         row.updated_at as string,
  };
}

const INSERT_SQL = `
  INSERT INTO journal_entries
    (id, date, type, content, mood, linked_task_ids, linked_project_ids, tags, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;
function insertParams(e: JournalEntry): unknown[] {
  return [
    e.id,
    e.date,
    e.type,
    e.content,
    e.mood ?? null,
    JSON.stringify(e.linkedTaskIds),
    JSON.stringify(e.linkedProjectIds),
    JSON.stringify(e.tags),
    e.createdAt,
    e.updatedAt,
  ];
}

const UPDATE_SQL = `
  UPDATE journal_entries
  SET date=?, type=?, content=?, mood=?, linked_task_ids=?, linked_project_ids=?, tags=?, updated_at=?
  WHERE id=?
`;
function updateParams(e: JournalEntry): unknown[] {
  return [
    e.date,
    e.type,
    e.content,
    e.mood ?? null,
    JSON.stringify(e.linkedTaskIds),
    JSON.stringify(e.linkedProjectIds),
    JSON.stringify(e.tags),
    e.updatedAt,
    e.id,                        // WHERE last
  ];
}

// ── State ────────────────────────────────────────────────────

interface JournalState {
  entries: JournalEntry[];
  activeEntryId: ID | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadEntries: () => Promise<void>;
  getOrCreateDaily: (date?: ISODate) => Promise<JournalEntry>;
  createEntry: (partial: Partial<JournalEntry> & { type: JournalEntry["type"]; date: ISODate }) => Promise<JournalEntry>;
  updateEntry: (id: ID, changes: Partial<JournalEntry>) => Promise<void>;
  deleteEntry: (id: ID) => Promise<void>;
  setActiveEntry: (id: ID | null) => void;
  linkTask: (entryId: ID, taskId: ID) => Promise<void>;
  unlinkTask: (entryId: ID, taskId: ID) => Promise<void>;
}

// ── Store ────────────────────────────────────────────────────

export const useJournalStore = create<JournalState>((set, get) => ({
  entries: [],
  activeEntryId: null,
  isLoading: false,
  error: null,

  loadEntries: async () => {
    set({ isLoading: true, error: null });
    try {
      const rows = await db.select<Record<string, unknown>>(
        "SELECT * FROM journal_entries ORDER BY date DESC, created_at DESC"
      );
      set({ entries: rows.map(rowToEntry), isLoading: false });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  getOrCreateDaily: async (date = today()) => {
    // Check in-memory first
    const existing = get().entries.find(
      (e) => e.date === date && e.type === "daily"
    );
    if (existing) {
      set({ activeEntryId: existing.id });
      return existing;
    }

    // Check DB (may have been created in a prior session)
    const rows = await db.select<Record<string, unknown>>(
      "SELECT * FROM journal_entries WHERE date=? AND type='daily' LIMIT 1",
      [date]
    );
    if (rows.length > 0) {
      const entry = rowToEntry(rows[0]);
      set((s) => ({
        entries: [entry, ...s.entries.filter((e) => e.id !== entry.id)],
        activeEntryId: entry.id,
      }));
      return entry;
    }

    // Create new
    return get().createEntry({ type: "daily", date });
  },

  createEntry: async (partial) => {
    const entry: JournalEntry = {
      id:               generateId(),
      date:             partial.date,
      type:             partial.type,
      content:          partial.content ?? "{}",
      mood:             partial.mood,
      linkedTaskIds:    partial.linkedTaskIds ?? [],
      linkedProjectIds: partial.linkedProjectIds ?? [],
      tags:             partial.tags ?? [],
      createdAt:        now(),
      updatedAt:        now(),
    };

    await db.execute(INSERT_SQL, insertParams(entry));
    set((s) => ({ entries: [entry, ...s.entries], activeEntryId: entry.id }));

    bus.emit("journal:entry-created", { entry });
    bus.emit("ui:notification", {
      id: generateId(),
      type: "success",
      message: "Journal entry created",
      durationMs: 2000,
    });

    return entry;
  },

  updateEntry: async (id, changes) => {
    const entry = get().entries.find((e) => e.id === id);
    if (!entry) return;

    const updated: JournalEntry = { ...entry, ...changes, updatedAt: now() };
    await db.execute(UPDATE_SQL, updateParams(updated));

    set((s) => ({
      entries: s.entries.map((e) => (e.id === id ? updated : e)),
    }));

    bus.emit("journal:entry-updated", { entry: updated });
  },

  deleteEntry: async (id) => {
    await db.execute("DELETE FROM journal_entries WHERE id=?", [id]);
    set((s) => ({
      entries: s.entries.filter((e) => e.id !== id),
      activeEntryId: s.activeEntryId === id ? null : s.activeEntryId,
    }));
    bus.emit("search:index-invalidated", { entityType: "journal", id });
  },

  setActiveEntry: (id) => set({ activeEntryId: id }),

  linkTask: async (entryId, taskId) => {
    const entry = get().entries.find((e) => e.id === entryId);
    if (!entry || entry.linkedTaskIds.includes(taskId)) return;
    await get().updateEntry(entryId, {
      linkedTaskIds: [...entry.linkedTaskIds, taskId],
    });
  },

  unlinkTask: async (entryId, taskId) => {
    const entry = get().entries.find((e) => e.id === entryId);
    if (!entry) return;
    await get().updateEntry(entryId, {
      linkedTaskIds: entry.linkedTaskIds.filter((id) => id !== taskId),
    });
  },
}));

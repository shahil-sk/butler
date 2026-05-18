// ============================================================
// TIME TRACKING — STORE
// ============================================================

import { create } from "zustand";
import { db } from "@/kernel/db";
import { bus } from "@/kernel/event-bus";
import { generateId, now } from "@/shared/utils";
import type { TimeEntry, ID, ISODateTime } from "@/shared/types";

// ── Row mappers ──────────────────────────────────────────────

function rowToEntry(row: Record<string, unknown>): TimeEntry {
  return {
    id:              row.id as string,
    taskId:          (row.task_id as string) || undefined,
    projectId:       (row.project_id as string) || undefined,
    focusSessionId:  (row.focus_session_id as string) || undefined,
    description:     (row.description as string) || undefined,
    startAt:         row.start_at as string,
    endAt:           (row.end_at as string) || undefined,
    durationMinutes: (row.duration_minutes as number) || undefined,
    isBillable:      Boolean(row.is_billable),
    tags:            JSON.parse((row.tags as string) || "[]"),
    createdAt:       row.created_at as string,
    updatedAt:       row.updated_at as string,
  };
}

const INSERT_SQL = `
  INSERT INTO time_entries
    (id, task_id, project_id, focus_session_id, description,
     start_at, end_at, duration_minutes, is_billable, tags,
     created_at, updated_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
`;

const UPDATE_SQL = `
  UPDATE time_entries
  SET task_id=?, project_id=?, focus_session_id=?, description=?,
      start_at=?, end_at=?, duration_minutes=?, is_billable=?, tags=?,
      updated_at=?
  WHERE id=?
`;

function insertParams(e: TimeEntry): unknown[] {
  return [
    e.id,
    e.taskId ?? null,
    e.projectId ?? null,
    e.focusSessionId ?? null,
    e.description ?? null,
    e.startAt,
    e.endAt ?? null,
    e.durationMinutes ?? null,
    e.isBillable ? 1 : 0,
    JSON.stringify(e.tags),
    e.createdAt,
    e.updatedAt,
  ];
}

function updateParams(e: TimeEntry): unknown[] {
  return [
    e.taskId ?? null,
    e.projectId ?? null,
    e.focusSessionId ?? null,
    e.description ?? null,
    e.startAt,
    e.endAt ?? null,
    e.durationMinutes ?? null,
    e.isBillable ? 1 : 0,
    JSON.stringify(e.tags),
    e.updatedAt,
    e.id,          // WHERE last
  ];
}

// ── Store ────────────────────────────────────────────────────

export interface TimeStore {
  entries:        TimeEntry[];
  activeEntryId:  ID | null;
  isLoaded:       boolean;

  // Actions
  load:           () => Promise<void>;
  startTimer:     (partial?: Partial<TimeEntry>) => Promise<TimeEntry>;
  stopTimer:      () => Promise<void>;
  createEntry:    (partial: Partial<TimeEntry> & { startAt: ISODateTime }) => Promise<TimeEntry>;
  updateEntry:    (id: ID, changes: Partial<TimeEntry>) => Promise<void>;
  deleteEntry:    (id: ID) => Promise<void>;

  // Selectors (derived — call outside render via getState or use in selectors)
  getActiveEntry: () => TimeEntry | null;
  getEntriesForDate: (date: string) => TimeEntry[];
  getEntriesForRange: (from: ISODateTime, to: ISODateTime) => TimeEntry[];
}

export const useTimeStore = create<TimeStore>((set, get) => ({
  entries:       [],
  activeEntryId: null,
  isLoaded:      false,

  load: async () => {
    const rows = await db.select<Record<string, unknown>>(
      `SELECT * FROM time_entries ORDER BY start_at DESC LIMIT 500`
    );
    const entries = rows.map(rowToEntry);
    // Detect any running timer (no end_at)
    const active = entries.find((e) => !e.endAt) ?? null;
    set({ entries, activeEntryId: active?.id ?? null, isLoaded: true });
  },

  startTimer: async (partial = {}) => {
    // Stop existing timer first
    const { activeEntryId, stopTimer } = get();
    if (activeEntryId) await stopTimer();

    const entry: TimeEntry = {
      id:              generateId(),
      taskId:          partial.taskId,
      projectId:       partial.projectId,
      focusSessionId:  partial.focusSessionId,
      description:     partial.description ?? "",
      startAt:         now(),
      endAt:           undefined,
      durationMinutes: undefined,
      isBillable:      partial.isBillable ?? false,
      tags:            partial.tags ?? [],
      createdAt:       now(),
      updatedAt:       now(),
    };

    await db.execute(INSERT_SQL, insertParams(entry));
    set((s) => ({ entries: [entry, ...s.entries], activeEntryId: entry.id }));
    bus.emit("time:timer-started", { entryId: entry.id });
    bus.emit("time:entry-created", { entry });
    return entry;
  },

  stopTimer: async () => {
    const { activeEntryId, entries } = get();
    if (!activeEntryId) return;

    const entry = entries.find((e) => e.id === activeEntryId);
    if (!entry) return;

    const endAt = now();
    const durationMinutes = Math.round(
      (new Date(endAt).getTime() - new Date(entry.startAt).getTime()) / 60000
    );

    const updated: TimeEntry = { ...entry, endAt, durationMinutes, updatedAt: now() };
    await db.execute(UPDATE_SQL, updateParams(updated));
    set((s) => ({
      entries: s.entries.map((e) => (e.id === activeEntryId ? updated : e)),
      activeEntryId: null,
    }));
    bus.emit("time:timer-stopped", { entryId: activeEntryId });
    bus.emit("time:entry-updated", { entry: updated });
  },

  createEntry: async (partial) => {
    const endAt = partial.endAt;
    const durationMinutes =
      partial.durationMinutes ??
      (endAt
        ? Math.round(
            (new Date(endAt).getTime() - new Date(partial.startAt).getTime()) / 60000
          )
        : undefined);

    const entry: TimeEntry = {
      id:              generateId(),
      taskId:          partial.taskId,
      projectId:       partial.projectId,
      focusSessionId:  partial.focusSessionId,
      description:     partial.description ?? "",
      startAt:         partial.startAt,
      endAt,
      durationMinutes,
      isBillable:      partial.isBillable ?? false,
      tags:            partial.tags ?? [],
      createdAt:       now(),
      updatedAt:       now(),
    };

    await db.execute(INSERT_SQL, insertParams(entry));
    set((s) => ({ entries: [entry, ...s.entries] }));
    bus.emit("time:entry-created", { entry });
    return entry;
  },

  updateEntry: async (id, changes) => {
    const entry = get().entries.find((e) => e.id === id);
    if (!entry) return;

    const updated: TimeEntry = { ...entry, ...changes, updatedAt: now() };

    // Recalculate duration if start/end changed
    if ((changes.startAt || changes.endAt) && updated.endAt) {
      updated.durationMinutes = Math.round(
        (new Date(updated.endAt).getTime() - new Date(updated.startAt).getTime()) / 60000
      );
    }

    await db.execute(UPDATE_SQL, updateParams(updated));
    set((s) => ({ entries: s.entries.map((e) => (e.id === id ? updated : e)) }));
    bus.emit("time:entry-updated", { entry: updated });
  },

  deleteEntry: async (id) => {
    await db.execute(`DELETE FROM time_entries WHERE id=?`, [id]);
    set((s) => ({
      entries: s.entries.filter((e) => e.id !== id),
      activeEntryId: s.activeEntryId === id ? null : s.activeEntryId,
    }));
    bus.emit("time:entry-deleted", { entryId: id });
  },

  getActiveEntry: () => {
    const { entries, activeEntryId } = get();
    return entries.find((e) => e.id === activeEntryId) ?? null;
  },

  getEntriesForDate: (date) => {
    return get().entries.filter((e) => e.startAt.startsWith(date));
  },

  getEntriesForRange: (from, to) => {
    return get().entries.filter((e) => e.startAt >= from && e.startAt <= to);
  },
}));

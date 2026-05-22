// ============================================================
// TIME TRACKING — STORE
// State container only. All DB access via repository.*
// All business logic via service.*
// ============================================================

import { create } from "zustand";
import { bus } from "@/kernel/event-bus";
import {
  dbLoadEntries,
  dbInsertEntry,
  dbUpdateEntry,
  dbDeleteEntry,
} from "./repository";
import {
  guardStartTimer,
  startTimerEntry,
  stopTimerEntry,
  buildEntry,
  applyEntryChanges,
} from "./service";
import type { TimeEntry, ID, ISODateTime, CreateEntryInput } from "./types";

// ── Store ────────────────────────────────────────────────────

export interface TimeStore {
  entries:       TimeEntry[];
  activeEntryId: ID | null;
  isLoaded:      boolean;

  // Actions
  load:        () => Promise<void>;
  startTimer:  (partial?: Partial<TimeEntry>) => Promise<TimeEntry | null>;
  stopTimer:   (id?: ID) => Promise<void>;
  createEntry: (input: CreateEntryInput) => Promise<TimeEntry>;
  updateEntry: (id: ID, changes: Partial<TimeEntry>) => Promise<void>;
  deleteEntry: (id: ID) => Promise<void>;

  // Derived selectors
  getActiveEntry:     () => TimeEntry | null;
  getEntriesForDate:  (date: string) => TimeEntry[];
  getEntriesForRange: (from: ISODateTime, to: ISODateTime) => TimeEntry[];

  // Internal — used by focus module via dynamic import
  runningEntry: TimeEntry | null;
}

export const useTimeStore = create<TimeStore>((set, get) => ({
  entries:       [],
  activeEntryId: null,
  isLoaded:      false,
  runningEntry:  null,

  load: async () => {
    const entries = await dbLoadEntries();
    const active  = entries.find((e) => !e.endAt) ?? null;
    set({ entries, activeEntryId: active?.id ?? null, runningEntry: active, isLoaded: true });
  },

  startTimer: async (partial = {}) => {
    // Mutual exclusion: bail if a focus session is running
    const allowed = await guardStartTimer();
    if (!allowed) return null;

    // Stop any existing running timer first
    const { activeEntryId } = get();
    if (activeEntryId) await get().stopTimer(activeEntryId);

    const entry = await startTimerEntry(partial);
    set((s) => ({ entries: [entry, ...s.entries], activeEntryId: entry.id, runningEntry: entry }));
    return entry;
  },

  stopTimer: async (id) => {
    const targetId = id ?? get().activeEntryId;
    if (!targetId) return;
    const entry = get().entries.find((e) => e.id === targetId);
    if (!entry) return;

    const updated = await stopTimerEntry(entry);
    set((s) => ({
      entries: s.entries.map((e) => (e.id === targetId ? updated : e)),
      activeEntryId: s.activeEntryId === targetId ? null : s.activeEntryId,
      runningEntry:  s.activeEntryId === targetId ? null : s.runningEntry,
    }));
  },

  createEntry: async (input) => {
    const entry = buildEntry(input);
    await dbInsertEntry(entry);
    set((s) => ({ entries: [entry, ...s.entries] }));
    bus.emit("time:entry-created", { entry });
    return entry;
  },

  updateEntry: async (id, changes) => {
    const entry = get().entries.find((e) => e.id === id);
    if (!entry) return;
    const updated = applyEntryChanges(entry, changes);
    await dbUpdateEntry(updated);
    set((s) => ({ entries: s.entries.map((e) => (e.id === id ? updated : e)) }));
    bus.emit("time:entry-updated", { entry: updated });
  },

  deleteEntry: async (id) => {
    await dbDeleteEntry(id);
    set((s) => ({
      entries:       s.entries.filter((e) => e.id !== id),
      activeEntryId: s.activeEntryId === id ? null : s.activeEntryId,
      runningEntry:  s.activeEntryId === id ? null : s.runningEntry,
    }));
    bus.emit("time:entry-deleted", { entryId: id });
  },

  getActiveEntry: () => {
    const { entries, activeEntryId } = get();
    return entries.find((e) => e.id === activeEntryId) ?? null;
  },

  getEntriesForDate: (date) =>
    get().entries.filter((e) => e.startAt.startsWith(date)),

  getEntriesForRange: (from, to) =>
    get().entries.filter((e) => e.startAt >= from && e.startAt <= to),
}));

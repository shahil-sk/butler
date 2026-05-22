// ============================================================
// JOURNAL — STORE
// UI state only. Zero db import. Zero SQL.
// Delegates all writes to svc.*; owns entries[], activeEntryId,
// isLoading, error.
// ============================================================

import { create } from "zustand";
import * as svc from "./service";
import { dbLoadAllEntries } from "./repository";
import type { JournalEntry } from "./types";
import { today } from "@/shared/utils";

// ── State shape ───────────────────────────────────────────────

interface JournalState {
  entries:       JournalEntry[];
  activeEntryId: string | null;
  isLoading:     boolean;
  error:         string | null;

  loadEntries:      () => Promise<void>;
  getOrCreateDaily: (date?: string) => Promise<JournalEntry>;
  createEntry:      (partial: Partial<JournalEntry> & { type: JournalEntry["type"]; date: string }) => Promise<JournalEntry>;
  updateEntry:      (id: string, changes: Partial<JournalEntry>) => Promise<void>;
  deleteEntry:      (id: string) => Promise<void>;
  setActiveEntry:   (id: string | null) => void;
  linkTask:         (entryId: string, taskId: string) => Promise<void>;
  unlinkTask:       (entryId: string, taskId: string) => Promise<void>;
}

// ── Store ────────────────────────────────────────────────────

export const useJournalStore = create<JournalState>((set, get) => ({
  entries:       [],
  activeEntryId: null,
  isLoading:     false,
  error:         null,

  loadEntries: async () => {
    set({ isLoading: true, error: null });
    try {
      const entries = await dbLoadAllEntries();
      set({ entries, isLoading: false });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  getOrCreateDaily: async (date = today()) => {
    const { entry } = await svc.getOrCreateDaily(get().entries, date);
    set((s) => ({
      entries:       s.entries.some((e) => e.id === entry.id)
        ? s.entries.map((e) => (e.id === entry.id ? entry : e))
        : [entry, ...s.entries],
      activeEntryId: entry.id,
    }));
    return entry;
  },

  createEntry: async (partial) => {
    const entry = await svc.createEntry(partial);
    set((s) => ({ entries: [entry, ...s.entries], activeEntryId: entry.id }));
    return entry;
  },

  updateEntry: async (id, changes) => {
    const entry = get().entries.find((e) => e.id === id);
    if (!entry) return;
    const updated = await svc.updateEntry(entry, changes);
    set((s) => ({ entries: s.entries.map((e) => (e.id === id ? updated : e)) }));
  },

  deleteEntry: async (id) => {
    await svc.deleteEntry(id);
    set((s) => ({
      entries:       s.entries.filter((e) => e.id !== id),
      activeEntryId: s.activeEntryId === id ? null : s.activeEntryId,
    }));
  },

  setActiveEntry: (id) => set({ activeEntryId: id }),

  linkTask: async (entryId, taskId) => {
    const entry = get().entries.find((e) => e.id === entryId);
    if (!entry) return;
    const updated = await svc.linkTask(entry, taskId);
    if (!updated) return;
    set((s) => ({ entries: s.entries.map((e) => (e.id === entryId ? updated : e)) }));
  },

  unlinkTask: async (entryId, taskId) => {
    const entry = get().entries.find((e) => e.id === entryId);
    if (!entry) return;
    const updated = await svc.unlinkTask(entry, taskId);
    set((s) => ({ entries: s.entries.map((e) => (e.id === entryId ? updated : e)) }));
  },
}));

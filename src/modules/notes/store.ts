// src/modules/notes/store.ts
// UI state only. Delegates all persistence to service.ts.
// No raw SQL, no direct db import.

import { create } from 'zustand';
import * as svc from './service';
import type { Note, NoteFilter, CreateNoteInput, UpdateNoteInput } from './types';

// ── State & actions types ────────────────────────────────────────

interface NoteState {
  notes:        Note[];
  loading:      boolean;
  openNoteId:   string | null;
  searchQuery:  string;
  activeFilter: NoteFilter;
}

interface NoteActions {
  loadNotes:        () => Promise<void>;
  createNote:       (input?: CreateNoteInput) => Promise<Note>;
  updateNote:       (id: string, patch: UpdateNoteInput) => Promise<void>;
  deleteNote:       (id: string) => Promise<void>;
  pinNote:          (id: string) => Promise<void>;
  openNote:         (id: string) => void;
  closeNote:        () => void;
  getOrCreateToday: () => Promise<Note>;
  setSearchQuery:   (q: string) => void;
  setActiveFilter:  (f: NoteFilter) => void;
  // Selectors (pure, synchronous)
  getTodayNote:     () => Note | undefined;
  getFilteredNotes: () => Note[];
  getNoteById:      (id: string) => Note | undefined;
}

// ── Store ────────────────────────────────────────────────────────

export const useNoteStore = create<NoteState & NoteActions>()(
  (set, get) => ({
    notes: [], loading: false,
    openNoteId: null, searchQuery: '', activeFilter: 'all',

    loadNotes: async () => {
      set({ loading: true });
      try {
        const notes = await svc.loadNotes();
        set({ notes, loading: false });
      } catch (err) {
        console.error('[Notes] loadNotes:', err);
        set({ loading: false });
      }
    },

    createNote: async (input = {}) => {
      const note = await svc.createNote(input);
      set((s) => ({ notes: [note, ...s.notes] }));
      return note;
    },

    updateNote: async (id, patch) => {
      const existing = get().notes.find((n) => n.id === id);
      if (!existing) return;
      const updated = await svc.updateNote(existing, patch);
      set((s) => ({ notes: s.notes.map((n) => n.id === id ? updated : n) }));
    },

    deleteNote: async (id) => {
      await svc.deleteNote(id);
      set((s) => ({
        notes: s.notes.filter((n) => n.id !== id),
        openNoteId: s.openNoteId === id ? null : s.openNoteId,
      }));
    },

    pinNote: async (id) => {
      const existing = get().notes.find((n) => n.id === id);
      if (!existing) return;
      const updated = await svc.pinNote(existing);
      set((s) => ({ notes: s.notes.map((n) => n.id === id ? updated : n) }));
    },

    openNote: (id) => {
      set({ openNoteId: id });
      // note:open is a UI-only signal (no persistence) — emitting from store is fine
      // because it carries no data that belongs in the service layer.
      import('@/kernel/event-bus').then(({ bus }) =>
        bus.emit('note:open', { noteId: id })
      );
    },
    closeNote: () => set({ openNoteId: null }),

    getOrCreateToday: async () => {
      const note = await svc.getOrCreateTodayNote();
      // Merge into in-memory list if not already present.
      set((s) => (
        s.notes.some((n) => n.id === note.id)
          ? s
          : { notes: [note, ...s.notes] }
      ));
      return note;
    },

    setSearchQuery:  (q) => set({ searchQuery: q }),
    setActiveFilter: (f) => set({ activeFilter: f }),

    // Selectors delegate to service pure functions
    getTodayNote:     () => svc.findTodayNote(get().notes),
    getFilteredNotes: () => svc.filterNotes(get().notes, get().activeFilter, get().searchQuery),
    getNoteById:      (id) => get().notes.find((n) => n.id === id),
  }),
);

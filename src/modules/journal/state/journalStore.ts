import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { JournalEntry, Review, SaveJournalInput, SaveReviewInput } from "../types";

interface JournalState {
  entries: JournalEntry[];
  reviews: Review[];
  activeEntry: JournalEntry | null;
  activeReview: Review | null;
  loading: boolean;
  error: string | null;

  loadEntries: () => Promise<void>;
  loadReviews: () => Promise<void>;
  loadActiveEntry: (date: string) => Promise<void>;
  saveActiveEntry: (input: SaveJournalInput) => Promise<void>;
  loadActiveReview: (period: string, type: "weekly" | "monthly") => Promise<void>;
  saveActiveReview: (input: SaveReviewInput) => Promise<void>;
}

export const useJournalStore = create<JournalState>((set) => ({
  entries: [],
  reviews: [],
  activeEntry: null,
  activeReview: null,
  loading: false,
  error: null,

  loadEntries: async () => {
    set({ loading: true, error: null });
    try {
      const list = await invoke<JournalEntry[]>("list_journal_entries");
      set({ entries: list });
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to load journal history" });
    } finally {
      set({ loading: false });
    }
  },

  loadReviews: async () => {
    set({ loading: true, error: null });
    try {
      const list = await invoke<Review[]>("list_reviews");
      set({ reviews: list });
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to load review history" });
    } finally {
      set({ loading: false });
    }
  },

  loadActiveEntry: async (date) => {
    set({ loading: true, error: null, activeEntry: null });
    try {
      const entry = await invoke<JournalEntry | null>("get_journal_entry", { date });
      set({ activeEntry: entry });
    } catch (e: any) {
      console.error(e);
      set({ error: `Failed to load journal entry for ${date}` });
    } finally {
      set({ loading: false });
    }
  },

  saveActiveEntry: async (input) => {
    set({ loading: true, error: null });
    try {
      const saved = await invoke<JournalEntry>("save_journal_entry", {
        date: input.date,
        mood: input.mood,
        moodNotes: input.mood_notes,
        gratitude: input.gratitude,
        lifeAreas: input.life_areas,
      });
      
      set({ activeEntry: saved });
      
      // Refresh list
      const list = await invoke<JournalEntry[]>("list_journal_entries");
      set({ entries: list });
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to save journal entry" });
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  loadActiveReview: async (period, type) => {
    set({ loading: true, error: null, activeReview: null });
    try {
      const review = await invoke<Review | null>("get_review", { period, reviewType: type });
      set({ activeReview: review });
    } catch (e: any) {
      console.error(e);
      set({ error: `Failed to load review for ${period}` });
    } finally {
      set({ loading: false });
    }
  },

  saveActiveReview: async (input) => {
    set({ loading: true, error: null });
    try {
      const saved = await invoke<Review>("save_review", {
        period: input.period,
        reviewType: input.type,
        responses: input.responses,
      });

      set({ activeReview: saved });

      // Refresh list
      const list = await invoke<Review[]>("list_reviews");
      set({ reviews: list });
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to save review" });
      throw e;
    } finally {
      set({ loading: false });
    }
  },
}));

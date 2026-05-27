import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { Habit, HabitLog, StreakStats, CreateHabitInput } from "../types";

interface HabitsState {
  habits: Habit[];
  habitLogs: Record<string, HabitLog[]>;
  streakStats: Record<string, StreakStats>;
  loading: boolean;
  error: string | null;

  loadHabits: () => Promise<void>;
  createHabit: (input: CreateHabitInput) => Promise<void>;
  updateHabit: (id: string, input: CreateHabitInput) => Promise<void>;
  deleteHabit: (id: string) => Promise<void>;
  logHabitStatus: (habitId: string, date: string, status: "completed" | "skipped" | "failed" | "none") => Promise<void>;
  loadHabitLogs: (habitId: string) => Promise<void>;
  loadHabitStreakStats: (habitId: string) => Promise<void>;
}

export const useHabitsStore = create<HabitsState>((set, get) => ({
  habits: [],
  habitLogs: {},
  streakStats: {},
  loading: false,
  error: null,

  loadHabits: async () => {
    set({ loading: true, error: null });
    try {
      const list = await invoke<Habit[]>("list_habits");
      set({ habits: list });
      for (const h of list) {
        await get().loadHabitStreakStats(h.id);
        await get().loadHabitLogs(h.id);
      }
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to load habits" });
    } finally {
      set({ loading: false });
    }
  },

  createHabit: async (input) => {
    set({ loading: true, error: null });
    try {
      const newHabit = await invoke<Habit>("create_habit", {
        title: input.title,
        description: input.description || null,
        frequency: input.frequency,
        frequencySpec: input.frequency_spec,
        targetStreak: input.target_streak,
        routineGroup: input.routine_group || null,
        tags: input.tags || [],
        metadata: input.metadata || "{}",
      });

      set((state) => ({ habits: [newHabit, ...state.habits] }));
      await get().loadHabitStreakStats(newHabit.id);
      await get().loadHabitLogs(newHabit.id);
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to create habit" });
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  updateHabit: async (id, input) => {
    set({ loading: true, error: null });
    try {
      await invoke("update_habit", {
        id,
        title: input.title,
        description: input.description || null,
        frequency: input.frequency,
        frequencySpec: input.frequency_spec,
        targetStreak: input.target_streak,
        routineGroup: input.routine_group || null,
        tags: input.tags || [],
        metadata: input.metadata || "{}",
      });

      await get().loadHabits();
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to update habit" });
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  deleteHabit: async (id) => {
    set({ loading: true, error: null });
    try {
      await invoke("delete_habit", { id });
      set((state) => {
        const nextLogs = { ...state.habitLogs };
        const nextStreaks = { ...state.streakStats };
        delete nextLogs[id];
        delete nextStreaks[id];
        return {
          habits: state.habits.filter((h) => h.id !== id),
          habitLogs: nextLogs,
          streakStats: nextStreaks,
        };
      });
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to delete habit" });
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  logHabitStatus: async (habitId, date, status) => {
    try {
      await invoke("log_habit_status", { habitId, date, status });
      await get().loadHabitLogs(habitId);
      await get().loadHabitStreakStats(habitId);
    } catch (e: any) {
      console.error(e);
    }
  },

  loadHabitLogs: async (habitId) => {
    try {
      const logs = await invoke<HabitLog[]>("get_habit_logs", { habitId });
      set((state) => ({
        habitLogs: { ...state.habitLogs, [habitId]: logs },
      }));
    } catch (e: any) {
      console.error(e);
    }
  },

  loadHabitStreakStats: async (habitId) => {
    try {
      const stats = await invoke<StreakStats>("get_habit_streak_stats", { habitId });
      set((state) => ({
        streakStats: { ...state.streakStats, [habitId]: stats },
      }));
    } catch (e: any) {
      console.error(e);
    }
  },
}));

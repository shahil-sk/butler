import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { TimeLog } from "../types";

interface TimeTrackingState {
  logs: TimeLog[];
  secondsElapsed: number;
  isActive: boolean;
  linkedTaskId: string | null;
  description: string;
  category: string;
  loading: boolean;
  error: string | null;

  loadLogs: () => Promise<void>;
  logTime: (
    taskId: string | null,
    duration: number,
    description: string,
    category: string
  ) => Promise<void>;
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  tick: () => void;
  deleteLog: (id: string) => Promise<void>;
  setLinkedTaskId: (id: string | null) => void;
  setDescription: (desc: string) => void;
  setCategory: (cat: string) => void;
}

export const useTimeTrackingStore = create<TimeTrackingState>((set, get) => ({
  logs: [],
  secondsElapsed: 0,
  isActive: false,
  linkedTaskId: null,
  description: "",
  category: "Coding",
  loading: false,
  error: null,

  loadLogs: async () => {
    set({ loading: true, error: null });
    try {
      const list = await invoke<TimeLog[]>("list_time_logs");
      set({ logs: list });
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to load time logs" });
    } finally {
      set({ loading: false });
    }
  },

  logTime: async (taskId, duration, description, category) => {
    set({ loading: true, error: null });
    try {
      await invoke("log_time", {
        taskId,
        duration,
        description,
        category,
      });
      const list = await invoke<TimeLog[]>("list_time_logs");
      set({ logs: list });
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to log time" });
    } finally {
      set({ loading: false });
    }
  },

  startTimer: () => set({ isActive: true }),
  pauseTimer: () => set({ isActive: false }),
  resetTimer: () => set({ secondsElapsed: 0, isActive: false }),
  tick: () => set((state) => ({ secondsElapsed: state.secondsElapsed + 1 })),

  deleteLog: async (id) => {
    const previousLogs = get().logs;
    set({
      logs: previousLogs.filter((l) => l.id !== id),
    });

    try {
      await invoke("delete_time_log", { id });
    } catch (e: any) {
      console.error(e);
      set({ logs: previousLogs, error: "Failed to delete time log" });
    }
  },

  setLinkedTaskId: (id) => set({ linkedTaskId: id }),
  setDescription: (desc) => set({ description: desc }),
  setCategory: (cat) => set({ category: cat }),
}));
export default useTimeTrackingStore;

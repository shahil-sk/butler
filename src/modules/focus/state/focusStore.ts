import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { FocusSession, SessionType } from "../types";

export type TimerState = "idle" | "work" | "break";

interface FocusState {
  sessions: FocusSession[];
  secondsRemaining: number;
  isActive: boolean;
  sessionType: SessionType;
  timerState: TimerState;
  linkedTaskId: string | null;
  loading: boolean;
  error: string | null;

  loadSessions: () => Promise<void>;
  logSession: (taskId: string | null, duration: number, type: SessionType) => Promise<void>;
  setSessionType: (type: SessionType) => void;
  setLinkedTaskId: (id: string | null) => void;
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  tick: () => Promise<void>;
}

export const useFocusStore = create<FocusState>((set, get) => ({
  sessions: [],
  secondsRemaining: 1500, // 25 mins default
  isActive: false,
  sessionType: "pomodoro",
  timerState: "idle",
  linkedTaskId: null,
  loading: false,
  error: null,

  loadSessions: async () => {
    set({ loading: true, error: null });
    try {
      const list = await invoke<FocusSession[]>("list_focus_sessions");
      set({ sessions: list });
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to load focus sessions" });
    } finally {
      set({ loading: false });
    }
  },

  logSession: async (taskId, duration, type) => {
    try {
      await invoke("log_focus_session", { taskId, duration, sessionType: type });
      const list = await invoke<FocusSession[]>("list_focus_sessions");
      set({ sessions: list });
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to save focus session" });
    }
  },

  setSessionType: (type) => {
    const isRunning = get().isActive;
    if (isRunning) return; // Ignore if running

    set({
      sessionType: type,
      timerState: "idle",
      secondsRemaining: type === "pomodoro" ? 1500 : 0,
    });
  },

  setLinkedTaskId: (id) => set({ linkedTaskId: id }),

  startTimer: () => {
    const current = get().timerState;
    set({
      isActive: true,
      timerState: current === "idle" ? "work" : current,
    });
  },

  pauseTimer: () => set({ isActive: false }),

  resetTimer: () => {
    const type = get().sessionType;
    set({
      isActive: false,
      timerState: "idle",
      secondsRemaining: type === "pomodoro" ? 1500 : 0,
    });
  },

  tick: async () => {
    const state = get();
    if (!state.isActive) return;

    if (state.sessionType === "pomodoro") {
      if (state.secondsRemaining > 0) {
        set({ secondsRemaining: state.secondsRemaining - 1 });
      } else {
        // Timer completed!
        set({ isActive: false });
        if (state.timerState === "work") {
          // Log focus session of 25m (1500s)
          await state.logSession(state.linkedTaskId, 1500, "pomodoro");
          // Switch to break
          set({
            timerState: "break",
            secondsRemaining: 300, // 5 mins break
            isActive: true, // auto start break
          });
        } else if (state.timerState === "break") {
          // Switch back to work
          set({
            timerState: "work",
            secondsRemaining: 1500,
            isActive: false, // let user start work manually
          });
        }
      }
    } else {
      // Deep Work (counts UP)
      set({ secondsRemaining: state.secondsRemaining + 1 });
    }
  },
}));
export default useFocusStore;

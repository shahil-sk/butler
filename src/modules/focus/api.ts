import { useFocusStore } from "./store";
import type { FocusSession, ID } from "@/shared/types";

export interface FocusSummary {
  totalMinutes: number;
  sessionsCount: number;
}

export interface FocusModuleAPI {
  startSessionForTask(taskId: ID): Promise<FocusSession>;
  getActiveSession(): Promise<FocusSession | null>;
  getTodayFocusMinutes(): Promise<number>;
  getWeeklyFocusSummary(): Promise<FocusSummary>;
}

export const FocusAPI: FocusModuleAPI = {
  async startSessionForTask(taskId: ID): Promise<FocusSession> {
    const store = useFocusStore.getState();
    await store.startFocus(taskId);
    return useFocusStore.getState().activeSession!;
  },

  async getActiveSession(): Promise<FocusSession | null> {
    return useFocusStore.getState().activeSession;
  },

  async getTodayFocusMinutes(): Promise<number> {
    const sessions = useFocusStore.getState().sessions;
    const today = new Date().toISOString().split("T")[0];
    let mins = 0;
    for (const s of sessions) {
      if (s.status === "completed" && s.startedAt.startsWith(today)) {
        mins += s.actualMinutes || 0;
      }
    }
    return mins;
  },

  async getWeeklyFocusSummary(): Promise<FocusSummary> {
    const sessions = useFocusStore.getState().sessions;
    const nowMs = Date.now();
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    
    let totalMinutes = 0;
    let count = 0;

    for (const s of sessions) {
      if (s.status !== "completed") continue;
      const startedAt = new Date(s.startedAt).getTime();
      if (nowMs - startedAt <= oneWeekMs) {
        totalMinutes += s.actualMinutes || 0;
        count++;
      }
    }
    
    return {
      totalMinutes,
      sessionsCount: count,
    };
  }
};

import { useFocusStore } from "./store";
import type { FocusSession, ID } from "@/shared/types";
import { generateId, now } from "@/shared/utils";

export interface FocusSummary {
  totalMinutes: number;
  sessionsCount: number;
  averageFlowScore: number;
}

export interface FocusModuleAPI {
  startSessionForTask(taskId: ID): Promise<FocusSession>;
  startSessionForBlock(blockId: ID): Promise<FocusSession>;
  getActiveSession(): Promise<FocusSession | null>;
  getTodayFocusMinutes(): Promise<number>;
  getSessionsForDate(date: Date): Promise<FocusSession[]>;
  getWeeklyFocusSummary(): Promise<FocusSummary>;
}

export const FocusAPI: FocusModuleAPI = {
  async startSessionForTask(taskId: ID): Promise<FocusSession> {
    const store = useFocusStore.getState();
    const active = store.activeSession;
    if (active) {
      throw new Error("A focus session is already active.");
    }
    await store.startFocus({ taskId, config: { focusMinutes: 25 } });
    return useFocusStore.getState().activeSession!;
  },

  async startSessionForBlock(blockId: ID): Promise<FocusSession> {
    const store = useFocusStore.getState();
    const active = store.activeSession;
    if (active) {
      throw new Error("A focus session is already active.");
    }
    // For now we don't have block-specific start in store, so we just start a normal session.
    // In a fuller implementation, we'd pass blockId to the store.
    await store.startFocus({ config: { focusMinutes: 25 } });
    const session = useFocusStore.getState().activeSession!;
    return session;
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
        mins += s.workDuration || s.actualDuration || s.actualMinutes || 0;
      }
    }
    return mins;
  },

  async getSessionsForDate(date: Date): Promise<FocusSession[]> {
    const sessions = useFocusStore.getState().sessions;
    const dateStr = date.toISOString().split("T")[0];
    return sessions.filter(s => s.startedAt.startsWith(dateStr));
  },

  async getWeeklyFocusSummary(): Promise<FocusSummary> {
    const sessions = useFocusStore.getState().sessions;
    const nowMs = Date.now();
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    
    let totalMinutes = 0;
    let count = 0;
    let flowSum = 0;
    let flowCount = 0;

    for (const s of sessions) {
      if (s.status !== "completed") continue;
      const startedAt = new Date(s.startedAt).getTime();
      if (nowMs - startedAt <= oneWeekMs) {
        totalMinutes += s.workDuration || s.actualDuration || s.actualMinutes || 0;
        count++;
        if (s.flowScore) {
          flowSum += s.flowScore;
          flowCount++;
        }
      }
    }
    
    return {
      totalMinutes,
      sessionsCount: count,
      averageFlowScore: flowCount > 0 ? flowSum / flowCount : 0
    };
  }
};

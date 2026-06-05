import { create } from "zustand";
import { bus } from "@/kernel/event-bus";
import { generateId, now, today } from "@/shared/utils";
import { dbInsertSession, dbUpdateSession, dbLoadSessions } from "./db";
import type { FocusSession } from "@/shared/types";

interface FocusStore {
  activeSession: FocusSession | null;
  sessions: FocusSession[];
  isLoaded: boolean;
  load: () => Promise<void>;
  startFocus: (taskId: string, goal?: string) => Promise<void>;
  stopFocus: () => Promise<void>;
  cancelFocus: () => Promise<void>;
  // Internal
  _tick: number; 
  startTick: () => void;
  stopTick: () => void;
  _tickInterval: any;
}

export const useFocusStore = create<FocusStore>((set, get) => ({
  activeSession: null,
  sessions: [],
  isLoaded: false,
  _tick: 0,
  _tickInterval: null,

  load: async () => {
    if (get().isLoaded) return;
    const sessions = await dbLoadSessions();
    set({ sessions, isLoaded: true });
  },

  startFocus: async (taskId: string, goal?: string) => {
    const { activeSession, stopFocus } = get();
    if (activeSession) {
      if (activeSession.taskId === taskId) return;
      await stopFocus();
    }

    const session: FocusSession = {
      id: generateId(),
      taskId,
      type: "focus",
      status: "active",
      state: "focusing",
      startedAt: now(),
      createdAt: now(),
      plannedMinutes: 0,
      plannedDuration: 0,
      interruptCount: 0,
      interruptionCount: 0,
      pauses: [],
      tags: [],
      goal,
    };

    await dbInsertSession(session);
    set(s => ({ activeSession: session, sessions: [session, ...s.sessions] }));
    get().startTick();
    bus.emit("focus:session-started", { session });
  },

  stopFocus: async () => {
    const { activeSession, stopTick } = get();
    if (!activeSession) return;

    stopTick();
    const endedAt = now();
    const durationMins = Math.max(0, Math.round((new Date(endedAt).getTime() - new Date(activeSession.startedAt).getTime()) / 60000));

    const updated: FocusSession = {
      ...activeSession,
      status: "completed",
      state: "idle",
      endedAt,
      completedAt: endedAt,
      actualMinutes: durationMins,
      actualDuration: durationMins,
      workDuration: durationMins,
    };

    await dbUpdateSession(updated);
    set(s => ({
      activeSession: null,
      sessions: s.sessions.map(x => x.id === updated.id ? updated : x)
    }));

    bus.emit("focus:session-completed", { session: updated });
  },

  cancelFocus: async () => {
    const { activeSession, stopTick } = get();
    if (!activeSession) return;

    stopTick();
    const updated: FocusSession = {
      ...activeSession,
      status: "abandoned",
      state: "idle",
      endedAt: now(),
      completedAt: now(),
    };

    await dbUpdateSession(updated);
    set(s => ({
      activeSession: null,
      sessions: s.sessions.map(x => x.id === updated.id ? updated : x)
    }));
    bus.emit("focus:session-cancelled", { sessionId: updated.id });
  },

  startTick: () => {
    const int = setInterval(() => set(s => ({ _tick: s._tick + 1 })), 1000);
    set({ _tickInterval: int });
  },
  
  stopTick: () => {
    const { _tickInterval } = get();
    if (_tickInterval) clearInterval(_tickInterval);
    set({ _tickInterval: null, _tick: 0 });
  }
}));

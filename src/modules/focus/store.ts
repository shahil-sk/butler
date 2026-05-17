// ============================================================
// FOCUS — STORE
// Timer state machine. Persists every state change to SQLite.
// Emits bus events matching ButlerEventMap exactly.
//
// New in v2:
//   - goal: intention string set before starting
//   - interruptCount: incremented on pause (tracks distraction)
//   - mood: 1-5 post-session rating
//   - stats: todayMinutes, todaySessions, weekMinutes, currentStreak
//   - incrementInterrupt(): called on manual pause
//   - setGoal(): set pre-session intention
//   - setSessionMood(): rate a just-completed session
//   - setSessionNotes(): update notes on active session
// ============================================================

import { create } from "zustand";
import { bus } from "@/kernel/event-bus";
import type { FocusSession } from "@/shared/types";
import { now, today } from "@/shared/utils";
import {
  dbLoadSessions,
  dbInsertSession,
  dbUpdateSession,
  newSession,
} from "./db";

// ── Config ────────────────────────────────────────────────────────────────────

interface TimerConfig {
  focusMinutes:            number;
  shortBreakMinutes:       number;
  longBreakMinutes:        number;
  sessionsBeforeLongBreak: number;
}

const DEFAULT_CONFIG: TimerConfig = {
  focusMinutes:            25,
  shortBreakMinutes:       5,
  longBreakMinutes:        15,
  sessionsBeforeLongBreak: 4,
};

// ── Stats ─────────────────────────────────────────────────────────────────────

export interface FocusStats {
  todayMinutes:    number; // actual focus minutes today
  todaySessions:   number; // completed focus sessions today
  weekMinutes:     number; // focus minutes this calendar week
  currentStreak:   number; // consecutive days with ≥1 completed focus session
  totalMinutes:    number; // all time
  totalSessions:   number; // all time completed focus sessions
}

function computeStats(sessions: FocusSession[]): FocusStats {
  const todayStr = today();
  const completedFocus = sessions.filter(
    (s) => s.type === "focus" && s.completedAt && s.actualMinutes
  );

  const todaySessions = completedFocus.filter(
    (s) => s.startedAt?.startsWith(todayStr)
  );

  // Week: Mon–Sun of current week
  const now = new Date();
  const dayOfWeek = (now.getDay() + 6) % 7; // Mon=0
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - dayOfWeek);
  weekStart.setHours(0, 0, 0, 0);
  const weekStartStr = weekStart.toISOString().slice(0, 10);

  const weekSessions = completedFocus.filter(
    (s) => s.startedAt && s.startedAt.slice(0, 10) >= weekStartStr
  );

  // Streak: consecutive days going back from today
  const daySet = new Set(
    completedFocus.map((s) => s.startedAt?.slice(0, 10)).filter(Boolean)
  );
  let streak = 0;
  const cursor = new Date();
  while (daySet.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return {
    todayMinutes:  todaySessions.reduce((a, s) => a + (s.actualMinutes ?? 0), 0),
    todaySessions: todaySessions.length,
    weekMinutes:   weekSessions.reduce((a, s) => a + (s.actualMinutes ?? 0), 0),
    currentStreak: streak,
    totalMinutes:  completedFocus.reduce((a, s) => a + (s.actualMinutes ?? 0), 0),
    totalSessions: completedFocus.length,
  };
}

// ── State ─────────────────────────────────────────────────────────────────────

interface FocusStore {
  sessions:            FocusSession[];
  activeSession:       FocusSession | null;
  secondsLeft:         number;
  completedFocusCount: number; // resets after long break
  isLoaded:            boolean;
  stats:               FocusStats;
  pendingGoal:         string;  // intention typed before start
  lastCompletedSession: FocusSession | null; // for mood rating UI
  _tickInterval:       ReturnType<typeof setInterval> | null;

  // Actions
  load:                () => Promise<void>;
  startFocus:          (opts?: { taskId?: string; projectId?: string; config?: Partial<TimerConfig> }) => Promise<void>;
  pause:               () => void;
  resume:              () => void;
  cancel:              () => Promise<void>;
  startBreak:          (type: "short_break" | "long_break", minutes: number) => void;
  skipBreak:           () => void;
  setTaskId:           (taskId: string | undefined) => void;
  setProjectId:        (projectId: string | undefined) => void;
  setGoal:             (goal: string) => void;
  setSessionNotes:     (notes: string) => void;
  setSessionMood:      (sessionId: string, mood: 1|2|3|4|5) => Promise<void>;
  incrementInterrupt:  () => void;
  clearLastCompleted:  () => void;

  // Internal
  _tick:           () => void;
  _clearTimer:     () => void;
  _completeActive: () => Promise<void>;
  _recomputeStats: () => void;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useFocusStore = create<FocusStore>((set, get) => ({
  sessions:             [],
  activeSession:        null,
  secondsLeft:          0,
  completedFocusCount:  0,
  isLoaded:             false,
  stats:                { todayMinutes: 0, todaySessions: 0, weekMinutes: 0, currentStreak: 0, totalMinutes: 0, totalSessions: 0 },
  pendingGoal:          "",
  lastCompletedSession: null,
  _tickInterval:        null,

  // ── load ─────────────────────────────────────────────────────────────────────

  load: async () => {
    if (get().isLoaded) return;
    const sessions = await dbLoadSessions();
    set({ sessions, isLoaded: true, stats: computeStats(sessions) });
  },

  // ── startFocus ───────────────────────────────────────────────────────────────

  startFocus: async ({ taskId, projectId, config = {} } = {}) => {
    if (get().activeSession) await get().cancel();

    const cfg = { ...DEFAULT_CONFIG, ...config };
    const session = newSession({
      taskId,
      projectId,
      type:           "focus",
      plannedMinutes: cfg.focusMinutes,
      state:          "focusing",
      startedAt:      now(),
      goal:           get().pendingGoal || undefined,
      interruptCount: 0,
    });

    await dbInsertSession(session);

    const interval = setInterval(() => get()._tick(), 1000);
    set((s) => ({
      activeSession:        session,
      secondsLeft:          cfg.focusMinutes * 60,
      sessions:             [session, ...s.sessions],
      _tickInterval:        interval,
      pendingGoal:          "",
      lastCompletedSession: null,
    }));

    bus.emit("focus:session-started", { session });
    bus.emit("search:index-invalidated", { entityType: "focus_session", id: session.id });
  },

  // ── pause ─────────────────────────────────────────────────────────────────────

  pause: () => {
    const { activeSession } = get();
    if (!activeSession || activeSession.state !== "focusing") return;
    get()._clearTimer();
    const updated = {
      ...activeSession,
      state:          "paused" as const,
      interruptCount: (activeSession.interruptCount ?? 0) + 1,
    };
    void dbUpdateSession(updated);
    set({ activeSession: updated });
    _patchList(set, updated);
    bus.emit("focus:session-paused", { sessionId: updated.id });
  },

  // ── resume ───────────────────────────────────────────────────────────────────

  resume: () => {
    const { activeSession } = get();
    if (!activeSession || activeSession.state !== "paused") return;
    const updated = { ...activeSession, state: "focusing" as const };
    void dbUpdateSession(updated);
    const interval = setInterval(() => get()._tick(), 1000);
    set({ activeSession: updated, _tickInterval: interval });
    _patchList(set, updated);
    bus.emit("focus:session-resumed", { sessionId: updated.id });
  },

  // ── cancel ────────────────────────────────────────────────────────────────────

  cancel: async () => {
    const { activeSession, secondsLeft } = get();
    if (!activeSession) return;
    get()._clearTimer();
    const elapsed   = (activeSession.plannedMinutes * 60) - secondsLeft;
    const updated: FocusSession = {
      ...activeSession,
      state:         "idle",
      completedAt:   now(),
      actualMinutes: Math.max(0, Math.round(elapsed / 60)),
    };
    await dbUpdateSession(updated);
    set((s) => ({
      activeSession: null,
      secondsLeft:   0,
      sessions:      s.sessions.map((x) => (x.id === updated.id ? updated : x)),
    }));
    get()._recomputeStats();
    bus.emit("focus:session-cancelled", { sessionId: updated.id });
  },

  // ── startBreak ────────────────────────────────────────────────────────────────

  startBreak: (type, minutes) => {
    const { activeSession } = get();
    get()._clearTimer();

    const session = newSession({
      taskId:         activeSession?.taskId,
      projectId:      activeSession?.projectId,
      type,
      plannedMinutes: minutes,
      state:          "break",
      startedAt:      now(),
    });
    void dbInsertSession(session);

    const interval = setInterval(() => get()._tick(), 1000);
    set((s) => ({
      activeSession: session,
      secondsLeft:   minutes * 60,
      sessions:      [session, ...s.sessions],
      _tickInterval: interval,
    }));

    bus.emit("focus:session-started", { session });
  },

  // ── skipBreak ─────────────────────────────────────────────────────────────────

  skipBreak: () => {
    const { activeSession } = get();
    if (!activeSession) return;
    get()._clearTimer();
    const updated: FocusSession = {
      ...activeSession,
      state:         "idle",
      completedAt:   now(),
      actualMinutes: 0,
    };
    void dbUpdateSession(updated);
    set((s) => ({
      activeSession: null,
      secondsLeft:   0,
      sessions:      s.sessions.map((x) => (x.id === updated.id ? updated : x)),
    }));
    bus.emit("focus:session-cancelled", { sessionId: updated.id });
  },

  // ── setGoal ───────────────────────────────────────────────────────────────────

  setGoal: (goal) => {
    set({ pendingGoal: goal });
  },

  // ── setSessionNotes ───────────────────────────────────────────────────────────

  setSessionNotes: (notes) => {
    const { activeSession } = get();
    if (!activeSession) return;
    const updated = { ...activeSession, notes };
    void dbUpdateSession(updated);
    set({ activeSession: updated });
    _patchList(set, updated);
  },

  // ── setSessionMood ────────────────────────────────────────────────────────────

  setSessionMood: async (sessionId, mood) => {
    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session) return;
    const updated = { ...session, mood };
    await dbUpdateSession(updated);
    set((s) => ({
      sessions:             s.sessions.map((x) => (x.id === sessionId ? updated : x)),
      lastCompletedSession: s.lastCompletedSession?.id === sessionId ? updated : s.lastCompletedSession,
    }));
  },

  // ── incrementInterrupt ────────────────────────────────────────────────────────

  incrementInterrupt: () => {
    const { activeSession } = get();
    if (!activeSession) return;
    const updated = {
      ...activeSession,
      interruptCount: (activeSession.interruptCount ?? 0) + 1,
    };
    void dbUpdateSession(updated);
    set({ activeSession: updated });
    _patchList(set, updated);
  },

  // ── clearLastCompleted ────────────────────────────────────────────────────────

  clearLastCompleted: () => set({ lastCompletedSession: null }),

  // ── setTaskId / setProjectId ──────────────────────────────────────────────────

  setTaskId: (taskId) => {
    const { activeSession } = get();
    if (!activeSession) return;
    const updated = { ...activeSession, taskId };
    void dbUpdateSession(updated);
    set({ activeSession: updated });
    _patchList(set, updated);
  },

  setProjectId: (projectId) => {
    const { activeSession } = get();
    if (!activeSession) return;
    const updated = { ...activeSession, projectId };
    void dbUpdateSession(updated);
    set({ activeSession: updated });
    _patchList(set, updated);
  },

  // ── _completeActive ───────────────────────────────────────────────────────────

  _completeActive: async () => {
    const { activeSession, completedFocusCount } = get();
    if (!activeSession) return;
    get()._clearTimer();

    const updated: FocusSession = {
      ...activeSession,
      state:         "idle",
      completedAt:   now(),
      actualMinutes: activeSession.plannedMinutes,
    };
    await dbUpdateSession(updated);

    const isFocusSession = activeSession.type === "focus";
    const newCount       = isFocusSession ? completedFocusCount + 1 : completedFocusCount;

    set((s) => ({
      activeSession:        null,
      secondsLeft:          0,
      completedFocusCount:  isFocusSession ? newCount : s.completedFocusCount,
      sessions:             s.sessions.map((x) => (x.id === updated.id ? updated : x)),
      lastCompletedSession: isFocusSession ? updated : s.lastCompletedSession,
    }));

    get()._recomputeStats();

    if (isFocusSession) {
      bus.emit("focus:session-completed", { session: updated });
    }
  },

  // ── _tick ─────────────────────────────────────────────────────────────────────

  _tick: () => {
    const { activeSession, secondsLeft } = get();
    if (!activeSession) return;
    const next = secondsLeft - 1;
    bus.emit("focus:tick", { sessionId: activeSession.id, remainingSeconds: next });
    if (next <= 0) {
      void get()._completeActive();
      return;
    }
    set({ secondsLeft: next });
  },

  // ── _clearTimer ───────────────────────────────────────────────────────────────

  _clearTimer: () => {
    const { _tickInterval } = get();
    if (_tickInterval) {
      clearInterval(_tickInterval);
      set({ _tickInterval: null });
    }
  },

  // ── _recomputeStats ───────────────────────────────────────────────────────────

  _recomputeStats: () => {
    set((s) => ({ stats: computeStats(s.sessions) }));
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

type SetFn = (fn: (s: FocusStore) => Partial<FocusStore>) => void;

function _patchList(set: SetFn, updated: FocusSession) {
  set((s) => ({
    sessions: s.sessions.map((x) => (x.id === updated.id ? updated : x)),
  }));
}

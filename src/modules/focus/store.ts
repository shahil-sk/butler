// ============================================================
// FOCUS — STORE  (v2 — task integration patch)
//
// Changes on top of the timer/session gap fix:
//   Gap 3: startFocus() calls setTaskScheduledToday(taskId)
//   Gap 4: reads butler:pendingFocusTaskId from sessionStorage
//          on load, clears it after consuming
// All 6 timer gaps from the previous commit are preserved.
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
import { setTaskScheduledToday } from "./taskIntegration";

// ── Config ────────────────────────────────────────────────────

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

// ── Gap 2 (timer): persist completedFocusCount ───────────────

const FOCUS_COUNT_KEY = "butler:completedFocusCount";

function loadPersistedFocusCount(): number {
  try { const v = sessionStorage.getItem(FOCUS_COUNT_KEY); return v !== null ? parseInt(v, 10) : 0; } catch { return 0; }
}
function savePersistedFocusCount(count: number) {
  try { sessionStorage.setItem(FOCUS_COUNT_KEY, String(count)); } catch { /* sandboxed */ }
}

// ── Gap 4 (task): pending task from planner navigation ───────

const PENDING_TASK_KEY = "butler:pendingFocusTaskId";

function consumePendingTaskId(): string | undefined {
  try {
    const v = sessionStorage.getItem(PENDING_TASK_KEY) ?? undefined;
    sessionStorage.removeItem(PENDING_TASK_KEY);
    return v;
  } catch { return undefined; }
}

// ── Stats ────────────────────────────────────────────────────

export interface FocusStats {
  todayMinutes:  number;
  todaySessions: number;
  weekMinutes:   number;
  currentStreak: number;
  totalMinutes:  number;
  totalSessions: number;
}

function computeStats(sessions: FocusSession[]): FocusStats {
  const todayStr = today();
  const completedFocus = sessions.filter(
    (s) => s.type === "focus" && s.completedAt && s.actualMinutes
  );
  const todaySessions = completedFocus.filter((s) => s.startedAt?.startsWith(todayStr));

  const n = new Date();
  const dayOfWeek = (n.getDay() + 6) % 7;
  const weekStart = new Date(n);
  weekStart.setDate(n.getDate() - dayOfWeek);
  weekStart.setHours(0, 0, 0, 0);
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weekSessions = completedFocus.filter(
    (s) => s.startedAt && s.startedAt.slice(0, 10) >= weekStartStr
  );

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

// ── State ────────────────────────────────────────────────────

interface FocusStore {
  sessions:             FocusSession[];
  activeSession:        FocusSession | null;
  secondsLeft:          number;
  completedFocusCount:  number;
  isLoaded:             boolean;
  stats:                FocusStats;
  pendingGoal:          string;
  pendingTaskId:        string | undefined;
  pendingProjectId:     string | undefined;
  lastCompletedSession: FocusSession | null;
  _tickInterval:        ReturnType<typeof setInterval> | null;

  load:               () => Promise<void>;
  startFocus:         (opts?: { taskId?: string; projectId?: string; config?: Partial<TimerConfig> }) => Promise<void>;
  pause:              () => void;
  resume:             () => void;
  cancel:             () => Promise<void>;
  extendSession:      (extraMinutes: number) => void;
  startBreak:         (type: "short_break" | "long_break", minutes: number) => void;
  skipBreak:          () => void;
  setTaskId:          (taskId: string | undefined) => void;
  setProjectId:       (projectId: string | undefined) => void;
  setGoal:            (goal: string) => void;
  setSessionNotes:    (notes: string) => void;
  setSessionMood:     (sessionId: string, mood: 1|2|3|4|5) => Promise<void>;
  incrementInterrupt: () => void;
  clearLastCompleted: () => void;

  _tick:           () => void;
  _clearTimer:     () => void;
  _completeActive: () => Promise<void>;
  _recomputeStats: () => void;
}

// ── Store ────────────────────────────────────────────────────

export const useFocusStore = create<FocusStore>((set, get) => ({
  sessions:             [],
  activeSession:        null,
  secondsLeft:          0,
  completedFocusCount:  loadPersistedFocusCount(),
  isLoaded:             false,
  stats:                { todayMinutes: 0, todaySessions: 0, weekMinutes: 0, currentStreak: 0, totalMinutes: 0, totalSessions: 0 },
  pendingGoal:          "",
  pendingTaskId:        consumePendingTaskId(), // Gap 4: pre-loaded from sessionStorage
  pendingProjectId:     undefined,
  lastCompletedSession: null,
  _tickInterval:        null,

  load: async () => {
    if (get().isLoaded) return;
    const sessions = await dbLoadSessions();
    set({ sessions, isLoaded: true, stats: computeStats(sessions) });
  },

  startFocus: async ({ taskId, projectId, config = {} } = {}) => {
    if (get().activeSession) await get().cancel();

    if (taskId) {
      const { useTaskStore } = await import("@/modules/tasks/store");
      const task = useTaskStore.getState().tasks.find((t) => t.id === taskId);
      if (task && (task.status === "cancelled" || task.status === "archived")) {
        bus.emit("notify", { message: "Cannot start focus on a cancelled or archived task", type: "error" } as never);
        return;
      }
    }

    const cfg = { ...DEFAULT_CONFIG, ...config };

    // Gap 1 (timer): persist config to shell settings
    try {
      const { useShellStore } = await import("@/shell/store");
      const ss = useShellStore.getState();
      if (ss.settings && typeof ss.updateSettings === "function") {
        void ss.updateSettings({
          focusModePomodoroMinutes:         cfg.focusMinutes,
          focusModeShortBreakMinutes:       cfg.shortBreakMinutes,
          focusModeLongBreakMinutes:        cfg.longBreakMinutes,
          focusModeSessionsBeforeLongBreak: cfg.sessionsBeforeLongBreak,
        });
      }
    } catch { /* shell store may not expose updateSettings */ }

    // Gap 3 (task): mark task as scheduled for today
    if (taskId) void setTaskScheduledToday(taskId);

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
      pendingTaskId:        undefined,
      pendingProjectId:     undefined,
      lastCompletedSession: null,
    }));

    bus.emit("focus:session-started", { session });
    bus.emit("search:index-invalidated", { entityType: "focus_session", id: session.id });
  },

  pause: () => {
    const { activeSession } = get();
    if (!activeSession || activeSession.state !== "focusing") return;
    get()._clearTimer();
    const updated = { ...activeSession, state: "paused" as const };
    void dbUpdateSession(updated);
    set({ activeSession: updated });
    _patchList(set, updated);
    bus.emit("focus:session-paused", { sessionId: updated.id });
  },

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

  cancel: async () => {
    const { activeSession, secondsLeft } = get();
    if (!activeSession) return;
    get()._clearTimer();
    const elapsed = (activeSession.plannedMinutes * 60) - secondsLeft;
    const updated: FocusSession = {
      ...activeSession,
      state:         "cancelled" as FocusSession["state"],
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

  extendSession: (extraMinutes: number) => {
    const { activeSession, secondsLeft } = get();
    if (!activeSession || activeSession.state !== "focusing") return;
    const updated = { ...activeSession, plannedMinutes: activeSession.plannedMinutes + extraMinutes };
    void dbUpdateSession(updated);
    set({ activeSession: updated, secondsLeft: secondsLeft + extraMinutes * 60 });
    _patchList(set, updated);
  },

  startBreak: (type, minutes) => {
    const { activeSession } = get();
    get()._clearTimer();
    const prevTaskId    = activeSession?.taskId;
    const prevProjectId = activeSession?.projectId;
    const session = newSession({
      taskId:         prevTaskId,
      projectId:      prevProjectId,
      type,
      plannedMinutes: minutes,
      state:          "break",
      startedAt:      now(),
    });
    void dbInsertSession(session);
    const interval = setInterval(() => get()._tick(), 1000);
    set((s) => ({
      activeSession:    session,
      secondsLeft:      minutes * 60,
      sessions:         [session, ...s.sessions],
      _tickInterval:    interval,
      pendingTaskId:    prevTaskId,
      pendingProjectId: prevProjectId,
    }));
    bus.emit("focus:session-started", { session });
  },

  skipBreak: () => {
    const { activeSession } = get();
    if (!activeSession) return;
    get()._clearTimer();
    const updated: FocusSession = { ...activeSession, state: "idle", completedAt: now(), actualMinutes: 0 };
    void dbUpdateSession(updated);
    set((s) => ({
      activeSession: null,
      secondsLeft:   0,
      sessions:      s.sessions.map((x) => (x.id === updated.id ? updated : x)),
    }));
    bus.emit("focus:session-cancelled", { sessionId: updated.id });
  },

  setGoal:         (goal)  => set({ pendingGoal: goal }),
  clearLastCompleted: ()   => set({ lastCompletedSession: null }),

  setSessionNotes: (notes) => {
    const { activeSession } = get();
    if (!activeSession) return;
    const updated = { ...activeSession, notes };
    void dbUpdateSession(updated);
    set({ activeSession: updated });
    _patchList(set, updated);
  },

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

  incrementInterrupt: () => {
    const { activeSession } = get();
    if (!activeSession) return;
    const updated = { ...activeSession, interruptCount: (activeSession.interruptCount ?? 0) + 1 };
    void dbUpdateSession(updated);
    set({ activeSession: updated });
    _patchList(set, updated);
  },

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
    if (isFocusSession) savePersistedFocusCount(newCount);
    set((s) => ({
      activeSession:        null,
      secondsLeft:          0,
      completedFocusCount:  isFocusSession ? newCount : s.completedFocusCount,
      sessions:             s.sessions.map((x) => (x.id === updated.id ? updated : x)),
      lastCompletedSession: isFocusSession ? updated : s.lastCompletedSession,
    }));
    get()._recomputeStats();
    if (isFocusSession) bus.emit("focus:session-completed", { session: updated });
  },

  _tick: () => {
    const { activeSession, secondsLeft } = get();
    if (!activeSession) return;
    const next = secondsLeft - 1;
    bus.emit("focus:tick", { sessionId: activeSession.id, remainingSeconds: next });
    if (next <= 0) { void get()._completeActive(); return; }
    set({ secondsLeft: next });
  },

  _clearTimer: () => {
    const { _tickInterval } = get();
    if (_tickInterval) { clearInterval(_tickInterval); set({ _tickInterval: null }); }
  },

  _recomputeStats: () => set((s) => ({ stats: computeStats(s.sessions) })),
}));

type SetFn = (fn: (s: FocusStore) => Partial<FocusStore>) => void;
function _patchList(set: SetFn, updated: FocusSession) {
  set((s) => ({ sessions: s.sessions.map((x) => (x.id === updated.id ? updated : x)) }));
}

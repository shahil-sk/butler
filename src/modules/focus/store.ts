// ============================================================
// FOCUS — STORE
// UI state + timer interval management only.
// Zero DB imports. Zero SQL. Delegates to svc.* for all writes.
// ============================================================

import { create } from "zustand";
import { bus } from "@/kernel/event-bus";
import * as svc from "./service";
import { dbLoadSessions } from "./repository";
import type { FocusSession, FocusStats, TimerConfig } from "./types";
import { DEFAULT_TIMER_CONFIG, EMPTY_STATS } from "./types";

// ── Persisted focus count (sessionStorage) ────────────────────

const FOCUS_COUNT_KEY = "butler:completedFocusCount";
const PENDING_TASK_KEY = "butler:pendingFocusTaskId";

function loadPersistedFocusCount(): number {
  try { const v = sessionStorage.getItem(FOCUS_COUNT_KEY); return v !== null ? parseInt(v, 10) : 0; } catch { return 0; }
}
function savePersistedFocusCount(count: number) {
  try { sessionStorage.setItem(FOCUS_COUNT_KEY, String(count)); } catch { /* sandboxed */ }
}
function consumePendingTaskId(): string | undefined {
  try {
    const v = sessionStorage.getItem(PENDING_TASK_KEY) ?? undefined;
    sessionStorage.removeItem(PENDING_TASK_KEY);
    return v;
  } catch { return undefined; }
}

// ── State shape ───────────────────────────────────────────────

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
  pause:              () => Promise<void>;
  resume:             () => Promise<void>;
  cancel:             () => Promise<void>;
  extendSession:      (extraMinutes: number) => void;
  startBreak:         (type: "short_break" | "long_break", minutes: number) => Promise<void>;
  skipBreak:          () => Promise<void>;
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
  stats:                EMPTY_STATS,
  pendingGoal:          "",
  pendingTaskId:        consumePendingTaskId(),
  pendingProjectId:     undefined,
  lastCompletedSession: null,
  _tickInterval:        null,

  load: async () => {
    if (get().isLoaded) return;
    const sessions = await dbLoadSessions();
    set({ sessions, isLoaded: true, stats: svc.computeStats(sessions) });
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

    const cfg = { ...DEFAULT_TIMER_CONFIG, ...config };

    // Persist config to shell settings
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

    if (taskId) void svc.scheduleTaskToday(taskId);
    void svc.stopRunningTimer();

    const session = await svc.createSession({
      type:           "focus",
      plannedMinutes: cfg.focusMinutes,
      state:          "focusing",
      taskId,
      projectId,
      goal:           get().pendingGoal || undefined,
    });

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

  pause: async () => {
    const { activeSession } = get();
    if (!activeSession || activeSession.state !== "focusing") return;
    get()._clearTimer();
    const updated = await svc.pauseSession(activeSession);
    set({ activeSession: updated });
    _patchList(set, updated);
  },

  resume: async () => {
    const { activeSession } = get();
    if (!activeSession || activeSession.state !== "paused") return;
    const updated = await svc.resumeSession(activeSession);
    const interval = setInterval(() => get()._tick(), 1000);
    set({ activeSession: updated, _tickInterval: interval });
    _patchList(set, updated);
  },

  cancel: async () => {
    const { activeSession, secondsLeft } = get();
    if (!activeSession) return;
    get()._clearTimer();
    const updated = await svc.cancelSession(activeSession, secondsLeft);
    set((s) => ({
      activeSession: null,
      secondsLeft:   0,
      sessions:      s.sessions.map((x) => (x.id === updated.id ? updated : x)),
    }));
    get()._recomputeStats();
  },

  extendSession: (extraMinutes) => {
    const { activeSession, secondsLeft } = get();
    if (!activeSession || activeSession.state !== "focusing") return;
    const updated = svc.extendSession(activeSession, extraMinutes);
    set({ activeSession: updated, secondsLeft: secondsLeft + extraMinutes * 60 });
    _patchList(set, updated);
  },

  startBreak: async (type, minutes) => {
    const { activeSession } = get();
    get()._clearTimer();
    const session = await svc.startBreak(type, minutes, activeSession);
    const interval = setInterval(() => get()._tick(), 1000);
    set((s) => ({
      activeSession:    session,
      secondsLeft:      minutes * 60,
      sessions:         [session, ...s.sessions],
      _tickInterval:    interval,
      pendingTaskId:    activeSession?.taskId,
      pendingProjectId: activeSession?.projectId,
    }));
  },

  skipBreak: async () => {
    const { activeSession } = get();
    if (!activeSession) return;
    get()._clearTimer();
    const updated = await svc.skipBreak(activeSession);
    set((s) => ({
      activeSession: null,
      secondsLeft:   0,
      sessions:      s.sessions.map((x) => (x.id === updated.id ? updated : x)),
    }));
  },

  setGoal:            (goal)  => set({ pendingGoal: goal }),
  clearLastCompleted: ()      => set({ lastCompletedSession: null }),

  setSessionNotes: (notes) => {
    const { activeSession } = get();
    if (!activeSession) return;
    const updated = svc.setNotes(activeSession, notes);
    set({ activeSession: updated });
    _patchList(set, updated);
  },

  setSessionMood: async (sessionId, mood) => {
    const updated = await svc.setMood(get().sessions, sessionId, mood);
    set((s) => ({
      sessions:             updated,
      lastCompletedSession: s.lastCompletedSession?.id === sessionId
        ? updated.find((x) => x.id === sessionId) ?? s.lastCompletedSession
        : s.lastCompletedSession,
    }));
  },

  incrementInterrupt: () => {
    const { activeSession } = get();
    if (!activeSession) return;
    const updated = svc.incrementInterrupt(activeSession);
    set({ activeSession: updated });
    _patchList(set, updated);
  },

  setTaskId: (taskId) => {
    const { activeSession } = get();
    if (!activeSession) return;
    const updated = svc.setTaskId(activeSession, taskId);
    set({ activeSession: updated });
    _patchList(set, updated);
  },

  setProjectId: (projectId) => {
    const { activeSession } = get();
    if (!activeSession) return;
    const updated = svc.setProjectId(activeSession, projectId);
    set({ activeSession: updated });
    _patchList(set, updated);
  },

  _completeActive: async () => {
    const { activeSession, completedFocusCount } = get();
    if (!activeSession) return;
    get()._clearTimer();
    const updated = await svc.completeSession(activeSession);
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

  _recomputeStats: () => set((s) => ({ stats: svc.computeStats(s.sessions) })),
}));

type SetFn = (fn: (s: FocusStore) => Partial<FocusStore>) => void;
function _patchList(set: SetFn, updated: FocusSession) {
  set((s) => ({ sessions: s.sessions.map((x) => (x.id === updated.id ? updated : x)) }));
}

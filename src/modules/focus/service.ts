// ============================================================
// FOCUS — SERVICE
// Business logic only.  Calls repository.*; no direct db import.
// Cross-module side-effects (task status, time-entry creation)
// that previously lived in taskIntegration.ts live here.
// taskIntegration.ts is retained for bus-listener registration
// (registerFocusTaskIntegration) but delegates to this file.
// ============================================================

import { bus } from "@/kernel/event-bus";
import { generateId, now, today } from "@/shared/utils";
import {
  dbInsertSession,
  dbLoadSessions,
  dbLoadTodaySessions,
  dbLoadSessionsInRange,
  dbUpdateSession,
  newSession,
} from "./repository";
import { type FocusSession, type FocusStats, type TimerConfig, DEFAULT_TIMER_CONFIG } from "./types";

export type { FocusSession, FocusStats, TimerConfig };

// ── Stats ─────────────────────────────────────────────────────

export function computeStats(sessions: FocusSession[]): FocusStats {
  const todayStr      = today();
  const completedFocus = sessions.filter((s) => s.type === "focus" && s.completedAt && s.actualMinutes);
  const todaySessions  = completedFocus.filter((s) => s.startedAt?.startsWith(todayStr));

  const n = new Date();
  const dayOfWeek  = (n.getDay() + 6) % 7;
  const weekStart  = new Date(n);
  weekStart.setDate(n.getDate() - dayOfWeek);
  weekStart.setHours(0, 0, 0, 0);
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weekSessions  = completedFocus.filter((s) => s.startedAt && s.startedAt.slice(0, 10) >= weekStartStr);

  const daySet = new Set(completedFocus.map((s) => s.startedAt?.slice(0, 10)).filter(Boolean));
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

// ── Session factory ───────────────────────────────────────────

export { newSession };

// ── Load ──────────────────────────────────────────────────────

export async function loadSessions(): Promise<FocusSession[]> {
  return dbLoadSessions();
}

export async function loadTodaySessions(): Promise<FocusSession[]> {
  return dbLoadTodaySessions();
}

export async function loadSessionsInRange(from: string, to: string): Promise<FocusSession[]> {
  return dbLoadSessionsInRange(from, to);
}

// ── Create & persist a new session ───────────────────────────

export async function createSession(
  opts: {
    type:           FocusSession["type"];
    plannedMinutes: number;
    state:          FocusSession["state"];
    taskId?:        string;
    projectId?:     string;
    goal?:          string;
  }
): Promise<FocusSession> {
  const session = newSession({
    ...opts,
    startedAt:      now(),
    interruptCount: 0,
  });
  await dbInsertSession(session);
  return session;
}

// ── State transitions ─────────────────────────────────────────

export async function pauseSession(session: FocusSession): Promise<FocusSession> {
  const updated = { ...session, state: "paused" as const };
  await dbUpdateSession(updated);
  bus.emit("focus:session-paused", { sessionId: updated.id });
  return updated;
}

export async function resumeSession(session: FocusSession): Promise<FocusSession> {
  const updated = { ...session, state: "focusing" as const };
  await dbUpdateSession(updated);
  bus.emit("focus:session-resumed", { sessionId: updated.id });
  return updated;
}

export async function cancelSession(
  session: FocusSession,
  secondsLeft: number
): Promise<FocusSession> {
  const elapsed = (session.plannedMinutes * 60) - secondsLeft;
  const updated: FocusSession = {
    ...session,
    state:         "cancelled",
    completedAt:   now(),
    actualMinutes: Math.max(0, Math.round(elapsed / 60)),
  };
  await dbUpdateSession(updated);
  bus.emit("focus:session-cancelled", { sessionId: updated.id });
  return updated;
}

export async function completeSession(session: FocusSession): Promise<FocusSession> {
  const updated: FocusSession = {
    ...session,
    state:         "idle",
    completedAt:   now(),
    actualMinutes: session.plannedMinutes,
  };
  await dbUpdateSession(updated);
  if (session.type === "focus") {
    bus.emit("focus:session-completed", { session: updated });
    bus.emit("search:index-invalidated", { entityType: "focus_session", id: updated.id });
  }
  return updated;
}

export function extendSession(session: FocusSession, extraMinutes: number): FocusSession {
  const updated = { ...session, plannedMinutes: session.plannedMinutes + extraMinutes };
  void dbUpdateSession(updated);
  return updated;
}

export async function startBreak(
  type: "short_break" | "long_break",
  minutes: number,
  prevSession: FocusSession | null
): Promise<FocusSession> {
  const session = newSession({
    taskId:         prevSession?.taskId,
    projectId:      prevSession?.projectId,
    type,
    plannedMinutes: minutes,
    state:          "break",
    startedAt:      now(),
  });
  await dbInsertSession(session);
  bus.emit("focus:session-started", { session });
  return session;
}

export async function skipBreak(session: FocusSession): Promise<FocusSession> {
  const updated: FocusSession = { ...session, state: "idle", completedAt: now(), actualMinutes: 0 };
  await dbUpdateSession(updated);
  bus.emit("focus:session-cancelled", { sessionId: updated.id });
  return updated;
}

// ── Field updates ─────────────────────────────────────────────

export function setNotes(session: FocusSession, notes: string): FocusSession {
  const updated = { ...session, notes };
  void dbUpdateSession(updated);
  return updated;
}

export async function setMood(
  sessions: FocusSession[],
  sessionId: string,
  mood: 1|2|3|4|5
): Promise<FocusSession[]> {
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return sessions;
  const updated = { ...session, mood };
  await dbUpdateSession(updated);
  return sessions.map((s) => (s.id === sessionId ? updated : s));
}

export function setTaskId(session: FocusSession, taskId: string | undefined): FocusSession {
  const updated = { ...session, taskId };
  void dbUpdateSession(updated);
  return updated;
}

export function setProjectId(session: FocusSession, projectId: string | undefined): FocusSession {
  const updated = { ...session, projectId };
  void dbUpdateSession(updated);
  return updated;
}

export function incrementInterrupt(session: FocusSession): FocusSession {
  const updated = { ...session, interruptCount: (session.interruptCount ?? 0) + 1 };
  void dbUpdateSession(updated);
  return updated;
}

// ── Cross-module side-effects ─────────────────────────────────
// These were previously scattered across taskIntegration.ts.
// They are pure async functions — no bus.on() here; listeners
// remain in taskIntegration.ts / events.ts.

export async function autoCreateTimeEntry(session: FocusSession): Promise<void> {
  if (!session.actualMinutes || session.actualMinutes <= 0) return;
  try {
    const { useTimeStore } = await import("@/modules/time-tracking/store");
    await useTimeStore.getState().createEntry({
      taskId:          session.taskId,
      projectId:       session.projectId,
      durationMinutes: session.actualMinutes,
      description:     session.goal ? `[Focus] ${session.goal}` : "[Focus] Pomodoro session",
      date:            session.startedAt?.slice(0, 10) ?? today(),
      source:          "focus",
      focusSessionId:  session.id,
    });
  } catch (e) {
    console.warn("[focus] auto time-entry creation failed", e);
  }
}

export async function autoTransitionTaskStatus(session: FocusSession): Promise<void> {
  if (!session.taskId) return;
  try {
    const { useTaskStore } = await import("@/modules/tasks/store");
    const task = useTaskStore.getState().tasks.find((t) => t.id === session.taskId);
    if (task?.status === "todo") {
      await useTaskStore.getState().updateTask(task.id, { status: "in_progress" });
    }
  } catch (e) {
    console.warn("[focus] task status transition failed", e);
  }
}

export async function stopRunningTimer(): Promise<void> {
  try {
    const { useTimeStore } = await import("@/modules/time-tracking/store");
    const running = useTimeStore.getState().runningEntry;
    if (running) {
      await useTimeStore.getState().stopTimer(running.id);
      bus.emit("notify", { message: "Time tracker stopped — focus session started", type: "info" } as never);
    }
  } catch (e) {
    console.warn("[focus] could not stop running timer", e);
  }
}

export async function scheduleTaskToday(taskId: string): Promise<void> {
  try {
    const { useTaskStore } = await import("@/modules/tasks/store");
    const task = useTaskStore.getState().tasks.find((t) => t.id === taskId);
    if (!task) return;
    if (task.scheduledDate !== today()) {
      await useTaskStore.getState().updateTask(taskId, { scheduledDate: today() });
    }
  } catch (e) {
    console.warn("[focus] scheduledDate update failed", e);
  }
}

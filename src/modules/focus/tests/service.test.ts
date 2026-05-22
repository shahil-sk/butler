// ============================================================
// FOCUS — service.test.ts
// Unit tests for the focus service layer.
// repository and event bus are mocked at the boundary.
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock repository ───────────────────────────────────────────
vi.mock("../repository", () => ({
  dbInsertSession:        vi.fn().mockResolvedValue(undefined),
  dbUpdateSession:        vi.fn().mockResolvedValue(undefined),
  dbLoadSessions:         vi.fn().mockResolvedValue([]),
  dbLoadTodaySessions:    vi.fn().mockResolvedValue([]),
  dbLoadSessionsInRange:  vi.fn().mockResolvedValue([]),
  newSession: (overrides = {}) => ({
    id:             "test-id",
    type:           "focus",
    plannedMinutes: 25,
    state:          "idle",
    interruptCount: 0,
    createdAt:      "2026-01-01T00:00:00.000Z",
    ...overrides,
  }),
}));

// ── Mock event bus ────────────────────────────────────────────
const mockEmit = vi.fn();
vi.mock("@/kernel/event-bus", () => ({ bus: { emit: mockEmit, on: vi.fn() } }));

// ── Mock shared utils ─────────────────────────────────────────
vi.mock("@/shared/utils", () => ({
  now:        () => "2026-05-22T09:00:00.000Z",
  today:      () => "2026-05-22",
  generateId: () => "test-id",
}));

import * as svc from "../service";
import * as repo from "../repository";

const baseSession = (): svc.FocusSession => ({
  id:             "sess-1",
  type:           "focus",
  plannedMinutes: 25,
  state:          "focusing",
  interruptCount: 0,
  createdAt:      "2026-05-22T08:00:00.000Z",
  startedAt:      "2026-05-22T08:00:00.000Z",
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ── computeStats ──────────────────────────────────────────────

describe("computeStats", () => {
  it("returns zeroed stats for empty sessions", () => {
    const stats = svc.computeStats([]);
    expect(stats.todaySessions).toBe(0);
    expect(stats.totalMinutes).toBe(0);
    expect(stats.currentStreak).toBe(0);
  });

  it("counts only completed focus sessions", () => {
    const sessions: svc.FocusSession[] = [
      { ...baseSession(), id: "a", completedAt: "2026-05-22T09:00:00.000Z", actualMinutes: 25 },
      { ...baseSession(), id: "b", type: "short_break", completedAt: "2026-05-22T09:30:00.000Z", actualMinutes: 5 },
      { ...baseSession(), id: "c", state: "cancelled" },
    ];
    const stats = svc.computeStats(sessions);
    expect(stats.todaySessions).toBe(1);
    expect(stats.totalSessions).toBe(1);
    expect(stats.todayMinutes).toBe(25);
  });
});

// ── createSession ─────────────────────────────────────────────

describe("createSession", () => {
  it("inserts a session and returns it", async () => {
    const session = await svc.createSession({
      type: "focus", plannedMinutes: 25, state: "focusing",
    });
    expect(repo.dbInsertSession).toHaveBeenCalledOnce();
    expect(session.type).toBe("focus");
    expect(session.plannedMinutes).toBe(25);
  });

  it("carries taskId and projectId through", async () => {
    const session = await svc.createSession({
      type: "focus", plannedMinutes: 25, state: "focusing",
      taskId: "t-1", projectId: "p-1",
    });
    expect(session.taskId).toBe("t-1");
    expect(session.projectId).toBe("p-1");
  });
});

// ── pauseSession ──────────────────────────────────────────────

describe("pauseSession", () => {
  it("sets state to paused and emits event", async () => {
    const updated = await svc.pauseSession(baseSession());
    expect(updated.state).toBe("paused");
    expect(repo.dbUpdateSession).toHaveBeenCalledWith(expect.objectContaining({ state: "paused" }));
    expect(mockEmit).toHaveBeenCalledWith("focus:session-paused", { sessionId: "sess-1" });
  });
});

// ── resumeSession ─────────────────────────────────────────────

describe("resumeSession", () => {
  it("sets state to focusing and emits event", async () => {
    const session = { ...baseSession(), state: "paused" as const };
    const updated = await svc.resumeSession(session);
    expect(updated.state).toBe("focusing");
    expect(mockEmit).toHaveBeenCalledWith("focus:session-resumed", { sessionId: "sess-1" });
  });
});

// ── cancelSession ─────────────────────────────────────────────

describe("cancelSession", () => {
  it("calculates elapsed minutes and emits cancelled event", async () => {
    const updated = await svc.cancelSession(baseSession(), 900); // 15 min left of 25
    expect(updated.state).toBe("cancelled");
    expect(updated.actualMinutes).toBe(10); // 25 - 15 = 10 min elapsed
    expect(mockEmit).toHaveBeenCalledWith("focus:session-cancelled", { sessionId: "sess-1" });
  });

  it("clamps negative elapsed to 0", async () => {
    // secondsLeft > planned — edge case after extend
    const updated = await svc.cancelSession(baseSession(), 9999);
    expect(updated.actualMinutes).toBe(0);
  });
});

// ── completeSession ───────────────────────────────────────────

describe("completeSession", () => {
  it("sets actualMinutes = plannedMinutes and emits completed", async () => {
    const updated = await svc.completeSession(baseSession());
    expect(updated.actualMinutes).toBe(25);
    expect(updated.completedAt).toBeTruthy();
    expect(mockEmit).toHaveBeenCalledWith("focus:session-completed", expect.any(Object));
  });

  it("does not emit focus:session-completed for break sessions", async () => {
    const breakSession = { ...baseSession(), type: "short_break" as const };
    await svc.completeSession(breakSession);
    expect(mockEmit).not.toHaveBeenCalledWith("focus:session-completed", expect.any(Object));
  });
});

// ── extendSession ─────────────────────────────────────────────

describe("extendSession", () => {
  it("adds extra minutes to plannedMinutes", () => {
    const updated = svc.extendSession(baseSession(), 5);
    expect(updated.plannedMinutes).toBe(30);
    expect(repo.dbUpdateSession).toHaveBeenCalledWith(expect.objectContaining({ plannedMinutes: 30 }));
  });
});

// ── incrementInterrupt ────────────────────────────────────────

describe("incrementInterrupt", () => {
  it("increments interruptCount by 1", () => {
    const s = { ...baseSession(), interruptCount: 2 };
    const updated = svc.incrementInterrupt(s);
    expect(updated.interruptCount).toBe(3);
  });
});

// ── setMood ───────────────────────────────────────────────────

describe("setMood", () => {
  it("updates the target session's mood in the list", async () => {
    const sessions = [baseSession(), { ...baseSession(), id: "sess-2" }];
    const updated = await svc.setMood(sessions, "sess-1", 4);
    expect(updated.find((s) => s.id === "sess-1")?.mood).toBe(4);
    expect(updated.find((s) => s.id === "sess-2")?.mood).toBeUndefined();
  });

  it("returns the list unchanged if sessionId not found", async () => {
    const sessions = [baseSession()];
    const updated = await svc.setMood(sessions, "no-such-id", 3);
    expect(updated).toBe(sessions); // same reference
  });
});

// ── startBreak ────────────────────────────────────────────────

describe("startBreak", () => {
  it("inserts a break session and emits session-started", async () => {
    const session = await svc.startBreak("short_break", 5, baseSession());
    expect(session.type).toBe("short_break");
    expect(session.state).toBe("break");
    expect(session.plannedMinutes).toBe(5);
    expect(repo.dbInsertSession).toHaveBeenCalledOnce();
    expect(mockEmit).toHaveBeenCalledWith("focus:session-started", expect.any(Object));
  });

  it("inherits taskId from prevSession", async () => {
    const prev = { ...baseSession(), taskId: "t-42" };
    const session = await svc.startBreak("long_break", 15, prev);
    expect(session.taskId).toBe("t-42");
  });
});

// ── skipBreak ─────────────────────────────────────────────────

describe("skipBreak", () => {
  it("marks state idle with 0 actualMinutes and emits cancelled", async () => {
    const session = { ...baseSession(), type: "short_break" as const, state: "break" as const };
    const updated = await svc.skipBreak(session);
    expect(updated.state).toBe("idle");
    expect(updated.actualMinutes).toBe(0);
    expect(mockEmit).toHaveBeenCalledWith("focus:session-cancelled", expect.any(Object));
  });
});

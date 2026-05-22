// ============================================================
// RESEARCH — events.test.ts
// Integration tests for all 5 event handlers.
// The store is mocked so handlers can be driven synchronously.
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock event bus ────────────────────────────────────────────
const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
const mockEmit = vi.fn((event: string, payload?: unknown) => {
  listeners[event]?.forEach((fn) => fn(payload));
});
const mockOn = vi.fn((event: string, fn: (...args: unknown[]) => void) => {
  if (!listeners[event]) listeners[event] = [];
  listeners[event].push(fn);
  return () => {
    listeners[event] = listeners[event].filter((l) => l !== fn);
  };
});
vi.mock("@/kernel/event-bus", () => ({ bus: { emit: mockEmit, on: mockOn } }));

// ── Mock shared utils ─────────────────────────────────────────
vi.mock("@/shared/utils", () => ({
  now:        () => "2026-05-22T09:00:00.000Z",
  generateId: () => "gen-id",
}));

// ── Mock store ────────────────────────────────────────────────
const mockUpdateHighlight  = vi.fn().mockResolvedValue(undefined);
const mockUpdateAnnotation = vi.fn().mockResolvedValue(undefined);
const mockUpdateThread     = vi.fn().mockResolvedValue(undefined);

const storeState = {
  activeSourceId:   null as string | null,
  activeThreadId:   null as string | null,
  activeDocumentId: null as string | null,
  highlights:       [] as Array<{ id: string; linkedTaskId?: string; linkedNoteId?: string }>,
  annotations:      [] as Array<{ id: string; linkedTaskId?: string; linkedNoteId?: string; content: string }>,
  threads:          [] as Array<{ id: string; linkedProjectIds: string[] }>,
  updateHighlight:  mockUpdateHighlight,
  updateAnnotation: mockUpdateAnnotation,
  updateThread:     mockUpdateThread,
};

vi.mock("../store", () => ({
  useResearchStore: { getState: () => storeState },
}));

import { setupResearchEventListeners } from "../events";

let cleanup: () => void;

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(listeners).forEach((k) => { listeners[k] = []; });
  storeState.activeSourceId   = null;
  storeState.activeThreadId   = null;
  storeState.activeDocumentId = null;
  storeState.highlights       = [];
  storeState.annotations      = [];
  storeState.threads          = [];
  cleanup = setupResearchEventListeners();
});

// ── focus:session-started ─────────────────────────────────────

describe("focus:session-started", () => {
  it("emits ui:notification when a source is active", () => {
    storeState.activeSourceId = "src-1";
    mockEmit("focus:session-started", { session: { id: "sess-1" } });
    expect(mockEmit).toHaveBeenCalledWith("ui:notification",
      expect.objectContaining({ type: "info", id: "research-focus-sess-1" }));
  });

  it("does not emit notification when nothing is active", () => {
    mockEmit("focus:session-started", { session: { id: "sess-1" } });
    const calls = mockEmit.mock.calls.filter(([e]) => e === "ui:notification");
    expect(calls).toHaveLength(0);
  });
});

// ── focus:session-completed ───────────────────────────────────

describe("focus:session-completed", () => {
  it("emits annotation suggestion when a document is active", () => {
    storeState.activeDocumentId = "doc-1";
    mockEmit("focus:session-completed", { session: { id: "sess-2" } });
    const calls = mockEmit.mock.calls.filter(([e]) => e === "ui:notification");
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).toMatchObject({ id: "research-session-done-sess-2", type: "info" });
  });

  it("does nothing when no document or thread active", () => {
    mockEmit("focus:session-completed", { session: { id: "sess-3" } });
    const calls = mockEmit.mock.calls.filter(([e]) => e === "ui:notification");
    expect(calls).toHaveLength(0);
  });
});

// ── task:deleted ──────────────────────────────────────────────

describe("task:deleted", () => {
  it("clears linkedTaskId from matching highlights", () => {
    storeState.highlights = [
      { id: "h-1", linkedTaskId: "task-1" },
      { id: "h-2", linkedTaskId: "task-2" },
    ];
    mockEmit("task:deleted", { taskId: "task-1" });
    expect(mockUpdateHighlight).toHaveBeenCalledOnce();
    expect(mockUpdateHighlight).toHaveBeenCalledWith("h-1", { linkedTaskId: undefined });
  });

  it("clears linkedTaskId from matching annotations", () => {
    storeState.annotations = [
      { id: "a-1", linkedTaskId: "task-1", content: "Note about task" },
      { id: "a-2", linkedTaskId: "task-2", content: "Other" },
    ];
    mockEmit("task:deleted", { taskId: "task-1" });
    expect(mockUpdateAnnotation).toHaveBeenCalledOnce();
    expect(mockUpdateAnnotation).toHaveBeenCalledWith("a-1", "Note about task");
  });

  it("does nothing when no matches", () => {
    storeState.highlights  = [{ id: "h-1", linkedTaskId: "task-99" }];
    storeState.annotations = [];
    mockEmit("task:deleted", { taskId: "task-1" });
    expect(mockUpdateHighlight).not.toHaveBeenCalled();
    expect(mockUpdateAnnotation).not.toHaveBeenCalled();
  });
});

// ── note:deleted ──────────────────────────────────────────────

describe("note:deleted", () => {
  it("clears linkedNoteId from matching highlights", () => {
    storeState.highlights = [
      { id: "h-1", linkedNoteId: "note-1" },
      { id: "h-2", linkedNoteId: "note-2" },
    ];
    mockEmit("note:deleted", { noteId: "note-1" });
    expect(mockUpdateHighlight).toHaveBeenCalledOnce();
    expect(mockUpdateHighlight).toHaveBeenCalledWith("h-1", { linkedNoteId: undefined });
  });

  it("clears linkedNoteId from matching annotations", () => {
    storeState.annotations = [
      { id: "a-1", linkedNoteId: "note-1", content: "Annotation" },
    ];
    mockEmit("note:deleted", { noteId: "note-1" });
    expect(mockUpdateAnnotation).toHaveBeenCalledWith("a-1", "Annotation");
  });
});

// ── project:archived ──────────────────────────────────────────

describe("project:archived", () => {
  it("removes archived projectId from threads that link to it", () => {
    storeState.threads = [
      { id: "thr-1", linkedProjectIds: ["proj-1", "proj-2"] },
      { id: "thr-2", linkedProjectIds: ["proj-3"] },
    ];
    mockEmit("project:archived", { projectId: "proj-1" });
    expect(mockUpdateThread).toHaveBeenCalledOnce();
    expect(mockUpdateThread).toHaveBeenCalledWith(
      "thr-1",
      { linkedProjectIds: ["proj-2"] },
    );
  });

  it("does nothing when no threads link to the archived project", () => {
    storeState.threads = [
      { id: "thr-1", linkedProjectIds: ["proj-99"] },
    ];
    mockEmit("project:archived", { projectId: "proj-1" });
    expect(mockUpdateThread).not.toHaveBeenCalled();
  });
});

// ── cleanup / teardown ────────────────────────────────────────

describe("cleanup", () => {
  it("unregisters all listeners on teardown", () => {
    cleanup();
    storeState.highlights = [{ id: "h-1", linkedTaskId: "task-1" }];
    mockEmit("task:deleted", { taskId: "task-1" });
    // listener was torn down — updateHighlight should NOT be called
    expect(mockUpdateHighlight).not.toHaveBeenCalled();
  });
});

// ============================================================
// TASKS — SERVICE TESTS
// Unit tests for the service layer.
// DB is mocked at the repository boundary so no SQLite is needed.
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Task } from "@/shared/types";

// ── Mock repository ───────────────────────────────────────────

vi.mock("../repository", () => ({
  dbInsertTask:          vi.fn().mockResolvedValue(undefined),
  dbUpdateTask:          vi.fn().mockResolvedValue(undefined),
  dbDeleteTask:          vi.fn().mockResolvedValue(undefined),
  dbDeleteTasks:         vi.fn().mockResolvedValue(undefined),
  dbReorderTasks:        vi.fn().mockResolvedValue(undefined),
  dbFindAllActive:       vi.fn().mockResolvedValue([]),
  dbFindById:            vi.fn().mockResolvedValue(null),
  dbFindByProject:       vi.fn().mockResolvedValue([]),
  dbFindPurgeCandidates: vi.fn().mockResolvedValue([]),
  dbFindScheduledTasks:  vi.fn().mockResolvedValue([]),
}));

// ── Mock event bus ────────────────────────────────────────────

vi.mock("@/kernel/event-bus", () => ({
  bus: { emit: vi.fn() },
}));

import * as repo from "../repository";
import { bus } from "@/kernel/event-bus";
import {
  buildTask,
  mergeTaskPatch,
  createTask,
  updateTask,
  deleteTask,
  deleteTasks,
  completeTask,
  restoreTask,
  archiveTask,
  moveTask,
  duplicateTask,
  purgeCompleted,
  addChecklistItem,
  toggleChecklistItem,
  deleteChecklistItem,
  batchUpdateTasks,
} from "../service";

// ── Fixtures ─────────────────────────────────────────────────

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id:              "task-1",
    title:           "Test task",
    status:          "todo",
    priority:        "none",
    labels:          [],
    tags:            [],
    dependencies:    [],
    checklistItems:  [],
    linkedNoteIds:   [],
    linkedEventIds:  [],
    order:           0,
    createdAt:       "2025-01-01T00:00:00.000Z",
    updatedAt:       "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── buildTask ─────────────────────────────────────────────────

describe("buildTask", () => {
  it("sets required defaults", () => {
    const t = buildTask({ title: "Hello" });
    expect(t.status).toBe("todo");
    expect(t.priority).toBe("none");
    expect(t.labels).toEqual([]);
    expect(t.checklistItems).toEqual([]);
    expect(t.completedAt).toBeUndefined();
    expect(t.id).toBeTruthy();
  });

  it("trims title", () => {
    const t = buildTask({ title: "  Hello  " });
    expect(t.title).toBe("Hello");
  });

  it("falls back to 'Untitled task' for blank title", () => {
    const t = buildTask({ title: "   " });
    expect(t.title).toBe("Untitled task");
  });

  it("preserves recurrence when supplied", () => {
    const rec = { freq: "weekly" as const, interval: 1, byDay: ["MO", "WE"] };
    const t = buildTask({ title: "Recurring", recurrence: rec });
    expect(t.recurrence).toEqual(rec);
  });

  it("preserves projectId when supplied", () => {
    const t = buildTask({ title: "Proj task", projectId: "proj-42" });
    expect(t.projectId).toBe("proj-42");
  });
});

// ── mergeTaskPatch ────────────────────────────────────────────

describe("mergeTaskPatch", () => {
  it("stamps completedAt when transitioning to done", () => {
    const existing = makeTask({ status: "todo" });
    const merged = mergeTaskPatch(existing, { status: "done" });
    expect(merged.status).toBe("done");
    expect(merged.completedAt).toBeTruthy();
  });

  it("stamps completedAt when transitioning to cancelled", () => {
    const existing = makeTask({ status: "todo" });
    const merged = mergeTaskPatch(existing, { status: "cancelled" });
    expect(merged.completedAt).toBeTruthy();
    expect(merged.status).toBe("cancelled");
  });

  it("clears completedAt when reopening to todo", () => {
    const existing = makeTask({ status: "done", completedAt: "2025-01-01T00:00:00.000Z" });
    const merged = mergeTaskPatch(existing, { status: "todo" });
    expect(merged.completedAt).toBeUndefined();
  });

  it("clears completedAt when reopening to in_progress", () => {
    const existing = makeTask({ status: "done", completedAt: "2025-01-01T00:00:00.000Z" });
    const merged = mergeTaskPatch(existing, { status: "in_progress" });
    expect(merged.completedAt).toBeUndefined();
  });

  it("does not re-stamp completedAt if already set", () => {
    const existing = makeTask({ status: "done", completedAt: "2025-01-01T00:00:00.000Z" });
    const merged = mergeTaskPatch(existing, { title: "Updated" });
    expect(merged.completedAt).toBe("2025-01-01T00:00:00.000Z");
  });

  it("stamps updatedAt on every patch", () => {
    const existing = makeTask();
    const before = existing.updatedAt;
    const merged = mergeTaskPatch(existing, { title: "new" });
    expect(merged.updatedAt).not.toBe(before);
  });
});

// ── createTask ────────────────────────────────────────────────

describe("createTask", () => {
  it("inserts to DB and emits task:created", async () => {
    const task = await createTask({ title: "My task" });
    expect(repo.dbInsertTask).toHaveBeenCalledWith(task);
    expect(bus.emit).toHaveBeenCalledWith("task:created", { task });
  });

  it("emits search:index-invalidated", async () => {
    const task = await createTask({ title: "My task" });
    expect(bus.emit).toHaveBeenCalledWith("search:index-invalidated", {
      entityType: "task",
      id: task.id,
    });
  });

  it("round-trips recurrence through buildTask", async () => {
    const rec = { freq: "daily" as const };
    const task = await createTask({ title: "Daily", recurrence: rec });
    expect(task.recurrence).toEqual(rec);
    expect(repo.dbInsertTask).toHaveBeenCalledWith(expect.objectContaining({ recurrence: rec }));
  });
});

// ── updateTask ────────────────────────────────────────────────

describe("updateTask", () => {
  it("updates DB and emits task:updated", async () => {
    const existing = makeTask();
    const updated = await updateTask("task-1", { title: "New title" }, existing);
    expect(repo.dbUpdateTask).toHaveBeenCalledWith(updated);
    expect(bus.emit).toHaveBeenCalledWith("task:updated",
      expect.objectContaining({ task: updated }));
  });

  it("includes changed patch in task:updated payload", async () => {
    const existing = makeTask();
    const patch    = { priority: "high" as const };
    await updateTask("task-1", patch, existing);
    expect(bus.emit).toHaveBeenCalledWith("task:updated",
      expect.objectContaining({ changed: patch }));
  });
});

// ── deleteTask ────────────────────────────────────────────────

describe("deleteTask", () => {
  it("deletes from DB and emits task:deleted", async () => {
    await deleteTask("task-1");
    expect(repo.dbDeleteTask).toHaveBeenCalledWith("task-1");
    expect(bus.emit).toHaveBeenCalledWith("task:deleted", { taskId: "task-1" });
  });
});

// ── deleteTasks (batch) ───────────────────────────────────────

describe("deleteTasks", () => {
  it("calls dbDeleteTasks and emits task:deleted for each id", async () => {
    await deleteTasks(["t1", "t2", "t3"]);
    expect(repo.dbDeleteTasks).toHaveBeenCalledWith(["t1", "t2", "t3"]);
    expect(bus.emit).toHaveBeenCalledWith("task:deleted", { taskId: "t1" });
    expect(bus.emit).toHaveBeenCalledWith("task:deleted", { taskId: "t2" });
    expect(bus.emit).toHaveBeenCalledWith("task:deleted", { taskId: "t3" });
  });

  it("does not call dbDeleteTasks for empty array", async () => {
    await deleteTasks([]);
    expect(repo.dbDeleteTasks).toHaveBeenCalledWith([]);
    // no task:deleted emitted
    expect(bus.emit).not.toHaveBeenCalledWith("task:deleted", expect.anything());
  });
});

// ── completeTask ──────────────────────────────────────────────

describe("completeTask", () => {
  it("sets status to done and emits task:completed", async () => {
    const existing = makeTask({ status: "todo" });
    const updated = await completeTask("task-1", existing);
    expect(updated.status).toBe("done");
    expect(updated.completedAt).toBeTruthy();
    expect(bus.emit).toHaveBeenCalledWith("task:completed",
      expect.objectContaining({ taskId: "task-1" }));
  });

  it("completedAt in task:completed payload matches task.completedAt", async () => {
    const existing = makeTask({ status: "todo" });
    const updated  = await completeTask("task-1", existing);
    const [, payload] = vi.mocked(bus.emit).mock.calls.find(
      ([evt]) => evt === "task:completed",
    ) as [string, { taskId: string; completedAt: string }];
    expect(payload.completedAt).toBe(updated.completedAt);
  });
});

// ── restoreTask ───────────────────────────────────────────────

describe("restoreTask", () => {
  it("sets status to todo and clears completedAt", async () => {
    const existing = makeTask({ status: "done", completedAt: "2025-01-01T00:00:00.000Z" });
    const updated = await restoreTask("task-1", existing);
    expect(updated.status).toBe("todo");
    expect(updated.completedAt).toBeUndefined();
    expect(bus.emit).toHaveBeenCalledWith("task:restored", { taskId: "task-1" });
  });
});

// ── archiveTask ───────────────────────────────────────────────

describe("archiveTask", () => {
  it("sets status to archived", async () => {
    const existing = makeTask();
    const updated = await archiveTask("task-1", existing);
    expect(updated.status).toBe("archived");
  });

  it("does NOT emit task:deleted (archive differs from delete)", async () => {
    const existing = makeTask();
    await archiveTask("task-1", existing);
    expect(bus.emit).not.toHaveBeenCalledWith("task:deleted", expect.anything());
  });
});

// ── moveTask ──────────────────────────────────────────────────

describe("moveTask", () => {
  it("updates projectId and emits task:moved", async () => {
    const existing = makeTask();
    const updated = await moveTask("task-1", "proj-2", existing);
    expect(updated.projectId).toBe("proj-2");
    expect(bus.emit).toHaveBeenCalledWith("task:moved",
      { taskId: "task-1", toProjectId: "proj-2" });
  });

  it("clears projectId when passed null", async () => {
    const existing = makeTask({ projectId: "proj-1" });
    const updated = await moveTask("task-1", null, existing);
    expect(updated.projectId).toBeUndefined();
  });
});

// ── duplicateTask ─────────────────────────────────────────────

describe("duplicateTask", () => {
  it("creates copy with '(copy)' suffix and todo status", async () => {
    const src = makeTask({ title: "Original", status: "done", completedAt: "2025-01-01T00:00:00.000Z" });
    const copy = await duplicateTask(src);
    expect(copy.title).toBe("Original (copy)");
    expect(copy.status).toBe("todo");
    expect(copy.completedAt).toBeUndefined();
    expect(copy.id).not.toBe(src.id);
  });

  it("copy has a fresh unique id", async () => {
    const src  = makeTask();
    const cop1 = await duplicateTask(src);
    const cop2 = await duplicateTask(src);
    expect(cop1.id).not.toBe(cop2.id);
  });
});

// ── purgeCompleted ────────────────────────────────────────────

describe("purgeCompleted", () => {
  it("returns empty array when no candidates", async () => {
    vi.mocked(repo.dbFindPurgeCandidates).mockResolvedValueOnce([]);
    const result = await purgeCompleted();
    expect(result).toEqual([]);
    expect(repo.dbDeleteTasks).not.toHaveBeenCalled();
  });

  it("deletes candidates and emits task:deleted for each", async () => {
    vi.mocked(repo.dbFindPurgeCandidates).mockResolvedValueOnce([
      { id: "task-a" },
      { id: "task-b" },
    ]);
    const result = await purgeCompleted();
    expect(result).toEqual(["task-a", "task-b"]);
    expect(repo.dbDeleteTasks).toHaveBeenCalledWith(["task-a", "task-b"]);
    expect(bus.emit).toHaveBeenCalledWith("task:deleted", { taskId: "task-a" });
    expect(bus.emit).toHaveBeenCalledWith("task:deleted", { taskId: "task-b" });
  });
});

// ── Checklist ─────────────────────────────────────────────────

describe("addChecklistItem", () => {
  it("appends item with correct defaults", async () => {
    const task = makeTask({ checklistItems: [] });
    const updated = await addChecklistItem(task, "Step 1");
    expect(updated.checklistItems).toHaveLength(1);
    expect(updated.checklistItems[0].text).toBe("Step 1");
    expect(updated.checklistItems[0].checked).toBe(false);
    expect(updated.checklistItems[0].order).toBe(0);
  });

  it("order increments for second item", async () => {
    const item0 = { id: "ci-0", text: "A", checked: false, order: 0 };
    const task  = makeTask({ checklistItems: [item0] });
    const updated = await addChecklistItem(task, "B");
    expect(updated.checklistItems[1].order).toBe(1);
  });
});

describe("toggleChecklistItem", () => {
  it("flips checked state", async () => {
    const item = { id: "ci-1", text: "Step 1", checked: false, order: 0 };
    const task = makeTask({ checklistItems: [item] });
    const updated = await toggleChecklistItem(task, "ci-1");
    expect(updated.checklistItems[0].checked).toBe(true);
  });

  it("leaves other items untouched", async () => {
    const items = [
      { id: "ci-1", text: "A", checked: false, order: 0 },
      { id: "ci-2", text: "B", checked: false, order: 1 },
    ];
    const task = makeTask({ checklistItems: items });
    const updated = await toggleChecklistItem(task, "ci-1");
    expect(updated.checklistItems[1].checked).toBe(false);
  });

  it("can flip back to unchecked", async () => {
    const item = { id: "ci-1", text: "Done", checked: true, order: 0 };
    const task = makeTask({ checklistItems: [item] });
    const updated = await toggleChecklistItem(task, "ci-1");
    expect(updated.checklistItems[0].checked).toBe(false);
  });
});

describe("deleteChecklistItem", () => {
  it("removes item by id", async () => {
    const items = [
      { id: "ci-1", text: "A", checked: false, order: 0 },
      { id: "ci-2", text: "B", checked: false, order: 1 },
    ];
    const task = makeTask({ checklistItems: items });
    const updated = await deleteChecklistItem(task, "ci-1");
    expect(updated.checklistItems).toHaveLength(1);
    expect(updated.checklistItems[0].id).toBe("ci-2");
  });

  it("is a no-op for unknown id", async () => {
    const items = [{ id: "ci-1", text: "A", checked: false, order: 0 }];
    const task  = makeTask({ checklistItems: items });
    const updated = await deleteChecklistItem(task, "ghost-id");
    expect(updated.checklistItems).toHaveLength(1);
  });
});

// ── batchUpdateTasks ──────────────────────────────────────────

describe("batchUpdateTasks", () => {
  it("updates each task in the map", async () => {
    const t1 = makeTask({ id: "t1", title: "T1" });
    const t2 = makeTask({ id: "t2", title: "T2" });
    const map = new Map([["t1", t1], ["t2", t2]]);
    const results = await batchUpdateTasks(["t1", "t2"], { priority: "high" }, map);
    expect(results).toHaveLength(2);
    results.forEach((t) => expect(t.priority).toBe("high"));
  });

  it("skips ids not in map", async () => {
    const t1  = makeTask({ id: "t1" });
    const map = new Map([["t1", t1]]);
    const results = await batchUpdateTasks(["t1", "ghost"], { priority: "high" }, map);
    expect(results).toHaveLength(1);
  });

  it("emits task:updated for each processed task", async () => {
    const t1  = makeTask({ id: "t1" });
    const t2  = makeTask({ id: "t2" });
    const map = new Map([["t1", t1], ["t2", t2]]);
    await batchUpdateTasks(["t1", "t2"], { status: "done" }, map);
    const emittedEvents = vi.mocked(bus.emit).mock.calls
      .filter(([evt]) => evt === "task:updated")
      .map(([, payload]) => (payload as { task: Task }).task.id);
    expect(emittedEvents).toContain("t1");
    expect(emittedEvents).toContain("t2");
  });
});

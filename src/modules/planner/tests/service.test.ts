// ============================================================
// PLANNER — service.test.ts
// Unit tests for the planner service layer.
// repository and event bus are mocked at the boundary.
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../repository", () => ({
  dbLoadBlocksByDate:     vi.fn().mockResolvedValue([]),
  dbLoadBlocksByDateRange:vi.fn().mockResolvedValue([]),
  dbInsertBlock:          vi.fn().mockResolvedValue(undefined),
  dbUpdateBlock:          vi.fn().mockResolvedValue(undefined),
  dbDeleteBlock:          vi.fn().mockResolvedValue(undefined),
  dbLoadTemplates:        vi.fn().mockResolvedValue([]),
  dbInsertTemplate:       vi.fn().mockResolvedValue(undefined),
  dbDeleteTemplate:       vi.fn().mockResolvedValue(undefined),
  dbInsertCarryForward:   vi.fn().mockResolvedValue(undefined),
}));

const mockEmit = vi.fn();
vi.mock("@/kernel/event-bus", () => ({ bus: { emit: mockEmit, on: vi.fn() } }));

vi.mock("@/shared/utils", () => ({
  now:       () => "2026-05-22T09:00:00.000Z",
  today:     () => "2026-05-22",
  toISODate: (d: Date) => d.toISOString().slice(0, 10),
  generateId: vi.fn().mockReturnValue("test-id"),
}));

import * as svc from "../service";
import * as repo from "../repository";

const baseBlock = (): svc.TimeBlock => ({
  id:        "block-1",
  date:      "2026-05-22",
  title:     "Test block",
  startTime: "09:00",
  endTime:   "10:00",
  isBreak:   false,
  createdAt: "2026-05-22T08:00:00.000Z",
  updatedAt: "2026-05-22T08:00:00.000Z",
});

beforeEach(() => vi.clearAllMocks());

// ── buildBlock ────────────────────────────────────────────────
describe("buildBlock", () => {
  it("applies defaults", () => {
    const b = svc.buildBlock({ date: "2026-05-22", startTime: "09:00", endTime: "10:00" });
    expect(b.title).toBe("Block");
    expect(b.isBreak).toBe(false);
  });

  it("carries provided fields", () => {
    const b = svc.buildBlock({ date: "2026-05-22", startTime: "09:00", endTime: "10:00", title: "Deep work", isBreak: true });
    expect(b.title).toBe("Deep work");
    expect(b.isBreak).toBe(true);
  });
});

// ── createBlock ──────────────────────────────────────────────
describe("createBlock", () => {
  it("inserts and emits ui:notification", async () => {
    await svc.createBlock({ date: "2026-05-22", startTime: "09:00", endTime: "10:00" });
    expect(repo.dbInsertBlock).toHaveBeenCalledOnce();
    expect(mockEmit).toHaveBeenCalledWith("ui:notification", expect.objectContaining({ type: "success" }));
  });

  it("emits planner:block-linked-task when taskId present", async () => {
    await svc.createBlock({ date: "2026-05-22", startTime: "09:00", endTime: "10:00", taskId: "task-1" });
    expect(mockEmit).toHaveBeenCalledWith("planner:block-linked-task", expect.objectContaining({ taskId: "task-1" }));
  });

  it("does not emit planner:block-linked-task when no taskId", async () => {
    await svc.createBlock({ date: "2026-05-22", startTime: "09:00", endTime: "10:00" });
    expect(mockEmit).not.toHaveBeenCalledWith("planner:block-linked-task", expect.anything());
  });
});

// ── updateBlock ──────────────────────────────────────────────
describe("updateBlock", () => {
  it("merges patch, stamps updatedAt, persists", async () => {
    const updated = await svc.updateBlock(baseBlock(), { title: "Renamed" });
    expect(updated.title).toBe("Renamed");
    expect(updated.updatedAt).toBe("2026-05-22T09:00:00.000Z");
    expect(repo.dbUpdateBlock).toHaveBeenCalledOnce();
  });

  it("emits block-unlinked-task when taskId removed", async () => {
    const block = { ...baseBlock(), taskId: "task-1" };
    await svc.updateBlock(block, { taskId: undefined });
    expect(mockEmit).toHaveBeenCalledWith("planner:block-unlinked-task", expect.objectContaining({ previousTaskId: "task-1" }));
  });

  it("emits block-linked-task when taskId added", async () => {
    await svc.updateBlock(baseBlock(), { taskId: "task-2" });
    expect(mockEmit).toHaveBeenCalledWith("planner:block-linked-task", expect.objectContaining({ taskId: "task-2" }));
  });
});

// ── deleteBlock ──────────────────────────────────────────────
describe("deleteBlock", () => {
  it("calls dbDeleteBlock and emits unlinked-task when linked", async () => {
    const block = { ...baseBlock(), taskId: "task-1" };
    await svc.deleteBlock(block);
    expect(repo.dbDeleteBlock).toHaveBeenCalledWith("block-1");
    expect(mockEmit).toHaveBeenCalledWith("planner:block-unlinked-task", { blockId: "block-1", previousTaskId: "task-1" });
  });

  it("does not emit unlinked-task when no taskId", async () => {
    await svc.deleteBlock(baseBlock());
    expect(mockEmit).not.toHaveBeenCalledWith("planner:block-unlinked-task", expect.anything());
  });
});

// ── resizeBlock ──────────────────────────────────────────────
describe("resizeBlock", () => {
  it("sets endTime when valid", async () => {
    const updated = await svc.resizeBlock(baseBlock(), "11:00");
    expect(updated.endTime).toBe("11:00");
  });

  it("clamps endTime to startTime when newEnd <= startTime", async () => {
    const updated = await svc.resizeBlock(baseBlock(), "08:00"); // before start 09:00
    expect(updated.endTime).toBe("09:00"); // clamped to startTime
  });
});

// ── scheduleTask ─────────────────────────────────────────────
describe("scheduleTask", () => {
  it("creates a block with correct endTime and emits task:updated", async () => {
    const block = await svc.scheduleTask({
      taskId: "task-1", taskTitle: "Write tests",
      estimateMinutes: 90, date: "2026-05-22", startTime: "09:00",
    });
    expect(block.endTime).toBe("10:30");
    expect(mockEmit).toHaveBeenCalledWith("task:updated", expect.objectContaining({
      changed: { scheduledDate: "2026-05-22" },
    }));
    expect(repo.dbInsertBlock).toHaveBeenCalledOnce();
  });
});

// ── carryForward ─────────────────────────────────────────────
describe("carryForward", () => {
  it("inserts carry-forward record and emits task:updated", async () => {
    await svc.carryForward({ taskId: "t1", taskStatus: "in_progress", fromDate: "2026-05-21", toDate: "2026-05-22" });
    expect(repo.dbInsertCarryForward).toHaveBeenCalledOnce();
    expect(mockEmit).toHaveBeenCalledWith("task:updated", expect.objectContaining({ changed: { scheduledDate: "2026-05-22" } }));
  });

  it("is a no-op for done/cancelled/archived tasks", async () => {
    for (const status of ["done", "cancelled", "archived"]) {
      await svc.carryForward({ taskId: "t1", taskStatus: status, fromDate: "2026-05-21", toDate: "2026-05-22" });
    }
    expect(repo.dbInsertCarryForward).not.toHaveBeenCalled();
    expect(mockEmit).not.toHaveBeenCalled();
  });
});

// ── savePlanTemplate ────────────────────────────────────────────
describe("savePlanTemplate", () => {
  it("creates template from source blocks and emits notification", async () => {
    const template = await svc.savePlanTemplate("Morning routine", [baseBlock()]);
    expect(template.name).toBe("Morning routine");
    expect(template.blocks).toHaveLength(1);
    expect(template.blocks[0].title).toBe("Test block");
    expect(repo.dbInsertTemplate).toHaveBeenCalledOnce();
    expect(mockEmit).toHaveBeenCalledWith("ui:notification", expect.objectContaining({ type: "success" }));
  });
});

// ── applyTemplate ──────────────────────────────────────────────
describe("applyTemplate", () => {
  it("creates one block per template block on target date", async () => {
    const template: svc.PlanTemplate = {
      id: "tmpl-1", name: "My template", createdAt: "2026-05-22T09:00:00.000Z",
      blocks: [
        { title: "Morning focus", startTime: "08:00", endTime: "09:30", isBreak: false },
        { title: "Break",         startTime: "09:30", endTime: "09:45", isBreak: true  },
      ],
    };
    const created = await svc.applyTemplate(template, "2026-05-23");
    expect(created).toHaveLength(2);
    expect(repo.dbInsertBlock).toHaveBeenCalledTimes(2);
    expect(created[0].date).toBe("2026-05-23");
    expect(created[1].isBreak).toBe(true);
  });
});

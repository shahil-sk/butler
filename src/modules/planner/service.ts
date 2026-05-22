// ============================================================
// PLANNER — SERVICE
// Business logic only. Calls repository.*; no direct db import.
// scheduleTask and carryForward accept resolved task data as
// parameters — no dynamic store imports inside service layer.
// ============================================================

import { bus } from "@/kernel/event-bus";
import { generateId, now, toISODate } from "@/shared/utils";
import {
  dbLoadBlocksByDate,
  dbLoadBlocksByDateRange,
  dbInsertBlock,
  dbUpdateBlock,
  dbDeleteBlock,
  dbLoadTemplates,
  dbInsertTemplate,
  dbDeleteTemplate,
  dbInsertCarryForward,
} from "./repository";
import { addMinutesToTime, clampTime } from "./utils";
import { type TimeBlock, type TemplateBlock, type PlanTemplate } from "./types";

export type { TimeBlock, TemplateBlock, PlanTemplate, PlannerView } from "./types";

// ── Factory ──────────────────────────────────────────────────

export function buildBlock(
  input: Partial<TimeBlock> & { date: string; startTime: string; endTime: string }
): TimeBlock {
  return {
    id:        generateId(),
    date:      input.date,
    taskId:    input.taskId,
    title:     input.title ?? "Block",
    startTime: input.startTime,
    endTime:   input.endTime,
    color:     input.color,
    isBreak:   input.isBreak ?? false,
    notes:     input.notes,
    createdAt: now(),
    updatedAt: now(),
  };
}

// ── Load ──────────────────────────────────────────────────────

export async function loadBlocksByDate(date: string): Promise<TimeBlock[]> {
  return dbLoadBlocksByDate(date);
}

export async function loadBlocksByWeek(startDate: string): Promise<{ blocks: TimeBlock[]; startDate: string; endDate: string }> {
  const start = new Date(startDate);
  const end   = new Date(startDate);
  end.setDate(end.getDate() + 7);
  const endStr   = toISODate(end);
  const blocks   = await dbLoadBlocksByDateRange(startDate, endStr);
  return { blocks, startDate, endDate: endStr };
}

// ── Create ──────────────────────────────────────────────────

export async function createBlock(
  input: Partial<TimeBlock> & { date: string; startTime: string; endTime: string }
): Promise<TimeBlock> {
  const block = buildBlock(input);
  await dbInsertBlock(block);

  if (block.taskId) {
    bus.emit("planner:block-linked-task", { blockId: block.id, taskId: block.taskId, date: block.date });
  }
  bus.emit("ui:notification", {
    id: generateId(), type: "success",
    message: `Block “${block.title}” created`, durationMs: 2000,
  });
  return block;
}

// ── Update ──────────────────────────────────────────────────

export async function updateBlock(
  existing: TimeBlock,
  patch: Partial<TimeBlock>
): Promise<TimeBlock> {
  const updated: TimeBlock = { ...existing, ...patch, updatedAt: now() };
  await dbUpdateBlock(updated);

  const prevTaskId = existing.taskId;
  const nextTaskId = updated.taskId;

  if (prevTaskId && prevTaskId !== nextTaskId) {
    bus.emit("planner:block-unlinked-task", { blockId: updated.id, previousTaskId: prevTaskId });
  }
  if (nextTaskId && (nextTaskId !== prevTaskId || updated.date !== existing.date)) {
    bus.emit("planner:block-linked-task", { blockId: updated.id, taskId: nextTaskId, date: updated.date });
  }

  return updated;
}

// ── Delete ──────────────────────────────────────────────────

export async function deleteBlock(block: TimeBlock): Promise<void> {
  await dbDeleteBlock(block.id);
  if (block.taskId) {
    bus.emit("planner:block-unlinked-task", { blockId: block.id, previousTaskId: block.taskId });
  }
}

// ── Reschedule / resize ─────────────────────────────────────────

export async function rescheduleBlock(
  existing: TimeBlock,
  newStart: string,
  newEnd: string
): Promise<TimeBlock> {
  return updateBlock(existing, { startTime: newStart, endTime: newEnd });
}

export async function resizeBlock(
  existing: TimeBlock,
  newEnd: string
): Promise<TimeBlock> {
  // Guard: end must be strictly after start
  const safeEnd = newEnd > existing.startTime ? newEnd : existing.startTime;
  return updateBlock(existing, { endTime: safeEnd });
}

// ── scheduleTask ────────────────────────────────────────────────
// Accepts resolved task data — caller (store) is responsible for
// looking up the task from its own state. No cross-module store
// import inside the service layer.

export async function scheduleTask(
  params: {
    taskId: string;
    taskTitle: string;
    estimateMinutes: number;
    date: string;
    startTime: string;
  }
): Promise<TimeBlock> {
  const endTime = addMinutesToTime(params.startTime, params.estimateMinutes);

  bus.emit("task:updated", {
    task:    { id: params.taskId } as never,
    changed: { scheduledDate: params.date },
  });

  return createBlock({
    date:      params.date,
    taskId:    params.taskId,
    title:     params.taskTitle,
    startTime: params.startTime,
    endTime:   clampTime(endTime),
  });
}

// ── carryForward ────────────────────────────────────────────────
// Caller passes task status so the service layer doesn’t need to
// import the tasks module.

export async function carryForward(params: {
  taskId: string;
  taskStatus: string;
  fromDate: string;
  toDate: string;
}): Promise<void> {
  if (["done", "cancelled", "archived"].includes(params.taskStatus)) return;
  await dbInsertCarryForward(params.taskId, params.fromDate, params.toDate, now());
  bus.emit("task:updated", {
    task:    { id: params.taskId } as never,
    changed: { scheduledDate: params.toDate },
  });
}

// ── Templates ───────────────────────────────────────────────────

export async function loadTemplates(): Promise<PlanTemplate[]> {
  return dbLoadTemplates();
}

export async function savePlanTemplate(
  name: string,
  sourceBlocks: TimeBlock[]
): Promise<PlanTemplate> {
  const templateBlocks: TemplateBlock[] = sourceBlocks.map((b) => ({
    title:     b.title,
    startTime: b.startTime,
    endTime:   b.endTime,
    color:     b.color,
    isBreak:   b.isBreak,
    notes:     b.notes,
  }));
  const template: PlanTemplate = {
    id:        generateId(),
    name,
    blocks:    templateBlocks,
    createdAt: now(),
  };
  await dbInsertTemplate(template.id, template.name, template.blocks, template.createdAt);
  bus.emit("ui:notification", {
    id: generateId(), type: "success",
    message: `Template “${name}” saved`, durationMs: 2000,
  });
  return template;
}

export async function deleteTemplate(id: string): Promise<void> {
  await dbDeleteTemplate(id);
}

export async function applyTemplate(
  template: PlanTemplate,
  targetDate: string
): Promise<TimeBlock[]> {
  const created: TimeBlock[] = [];
  for (const tb of template.blocks) {
    const block = await createBlock({
      date:      targetDate,
      title:     tb.title,
      startTime: tb.startTime,
      endTime:   tb.endTime,
      color:     tb.color,
      isBreak:   tb.isBreak,
      notes:     tb.notes,
    });
    created.push(block);
  }
  bus.emit("ui:notification", {
    id: generateId(), type: "success",
    message: `Applied template “${template.name}”`, durationMs: 2000,
  });
  return created;
}

// ============================================================
// TASKS — SERVICE
// Business logic only. No direct DB access — all DB calls
// go through repository. All cross-module side-effects go
// through the kernel event bus.
// ============================================================

import { bus } from "@/kernel/event-bus";
import { generateId, now } from "@/shared/utils";
import type { Task, ChecklistItem, ID } from "@/shared/types";
import type { CreateTaskInput, UpdateTaskInput } from "./types";
import * as repo from "./repository";

// ── Constants ─────────────────────────────────────────────────

const PURGE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 h

// ── Task factory ─────────────────────────────────────────────

export function buildTask(input: CreateTaskInput): Task {
  return {
    id:              generateId(),
    title:           input.title.trim() || "Untitled task",
    description:     input.description,
    status:          input.status        ?? "todo",
    priority:        input.priority       ?? "none",
    projectId:       input.projectId,
    parentTaskId:    input.parentTaskId,
    labels:          input.labels         ?? [],
    tags:            input.tags           ?? [],
    dueDate:         input.dueDate,
    startDate:       input.startDate,
    scheduledDate:   input.scheduledDate,
    completedAt:     undefined,
    estimateMinutes: input.estimateMinutes,
    actualMinutes:   undefined,
    recurrence:      input.recurrence,
    dependencies:    input.dependencies   ?? [],
    checklistItems:  input.checklistItems ?? [],
    linkedNoteIds:   input.linkedNoteIds  ?? [],
    linkedEventIds:  input.linkedEventIds ?? [],
    order:           Date.now(),
    createdAt:       now(),
    updatedAt:       now(),
  };
}

// ── Merge helper — stamps completedAt and updatedAt ───────────

export function mergeTaskPatch(existing: Task, patch: UpdateTaskInput): Task {
  const isCompletingNow =
    (patch.status === "done" || patch.status === "cancelled") && !existing.completedAt;
  const isReopening =
    patch.status === "todo" || patch.status === "in_progress";

  const completedAt = isReopening
    ? undefined
    : isCompletingNow
      ? now()
      : (patch.completedAt ?? existing.completedAt);

  return { ...existing, ...patch, completedAt, updatedAt: now() };
}

// ── CRUD ──────────────────────────────────────────────────────

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const task = buildTask(input);
  await repo.dbInsertTask(task);
  bus.emit("task:created", { task });
  bus.emit("search:index-invalidated", { entityType: "task", id: task.id });
  return task;
}

export async function updateTask(
  id: ID,
  patch: UpdateTaskInput,
  existing: Task,
): Promise<Task> {
  const updated = mergeTaskPatch(existing, patch);
  await repo.dbUpdateTask(updated);
  bus.emit("task:updated", { task: updated, changed: patch });
  bus.emit("search:index-invalidated", { entityType: "task", id });
  return updated;
}

export async function deleteTask(id: ID): Promise<void> {
  await repo.dbDeleteTask(id);
  bus.emit("task:deleted", { taskId: id });
}

export async function deleteTasks(ids: ID[]): Promise<void> {
  await repo.dbDeleteTasks(ids);
  ids.forEach((id) => bus.emit("task:deleted", { taskId: id }));
}

// ── Status transitions ────────────────────────────────────────

export async function completeTask(id: ID, existing: Task): Promise<Task> {
  const completedAt = now();
  const updated = await updateTask(id, { status: "done", completedAt }, existing);
  bus.emit("task:completed", { taskId: id, completedAt });
  return updated;
}

export async function restoreTask(id: ID, existing: Task): Promise<Task> {
  const updated = await updateTask(id, { status: "todo", completedAt: undefined }, existing);
  bus.emit("task:restored", { taskId: id });
  return updated;
}

export async function archiveTask(id: ID, existing: Task): Promise<Task> {
  return updateTask(id, { status: "archived" }, existing);
}

export async function moveTask(id: ID, toProjectId: ID | null, existing: Task): Promise<Task> {
  const updated = await updateTask(id, { projectId: toProjectId ?? undefined }, existing);
  bus.emit("task:moved", { taskId: id, toProjectId: toProjectId! });
  return updated;
}

export async function duplicateTask(src: Task): Promise<Task> {
  return createTask({ ...src, title: `${src.title} (copy)`, status: "todo", completedAt: undefined });
}

// ── Reorder ───────────────────────────────────────────────────

export async function reorderTasks(ids: ID[]): Promise<void> {
  await repo.dbReorderTasks(ids, now());
}

// ── Checklist ─────────────────────────────────────────────────

export async function addChecklistItem(
  task: Task,
  text: string,
): Promise<Task> {
  const item: ChecklistItem = {
    id:      generateId(),
    text,
    checked: false,
    order:   task.checklistItems.length,
  };
  return updateTask(task.id, { checklistItems: [...task.checklistItems, item] }, task);
}

export async function toggleChecklistItem(
  task: Task,
  itemId: ID,
): Promise<Task> {
  return updateTask(
    task.id,
    { checklistItems: task.checklistItems.map((i) => i.id === itemId ? { ...i, checked: !i.checked } : i) },
    task,
  );
}

export async function deleteChecklistItem(
  task: Task,
  itemId: ID,
): Promise<Task> {
  return updateTask(
    task.id,
    { checklistItems: task.checklistItems.filter((i) => i.id !== itemId) },
    task,
  );
}

// ── Purge ─────────────────────────────────────────────────────

/**
 * Hard-deletes all done/cancelled tasks whose completedAt is older
 * than PURGE_WINDOW_MS (24 h). Returns the purged IDs.
 */
export async function purgeCompleted(): Promise<string[]> {
  const cutoff = new Date(Date.now() - PURGE_WINDOW_MS).toISOString();
  const candidates = await repo.dbFindPurgeCandidates(cutoff);
  if (candidates.length === 0) return [];

  const ids = candidates.map((r) => r.id);
  await repo.dbDeleteTasks(ids);
  ids.forEach((id) => bus.emit("task:deleted", { taskId: id }));
  return ids;
}

// ── Bulk helpers ──────────────────────────────────────────────

export async function batchUpdateTasks(
  ids: ID[],
  patch: UpdateTaskInput,
  taskMap: Map<ID, Task>,
): Promise<Task[]> {
  const results: Task[] = [];
  for (const id of ids) {
    const existing = taskMap.get(id);
    if (!existing) continue;
    results.push(await updateTask(id, patch, existing));
  }
  return results;
}

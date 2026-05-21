// ============================================================
// PLANNER MODULE — usePlannerTaskSync
// Two-way sync between planner blocks and tasks.
// Exposes helpers for scheduling, carry-forward, and
// surfacing unscheduled tasks in the planner sidebar.
// ============================================================

import { useMemo, useCallback } from "react";
import { usePlannerStore } from "../store";
import { useTaskStore } from "@/modules/tasks/store";
import { bus } from "@/kernel/event-bus";
import { today } from "@/shared/utils";
import type { ID, ISODate, Task } from "@/shared/types";

// ── Unscheduled tasks for the planner sidebar drag-list ──────

/**
 * Tasks that have no planner block on `date`.
 * Filters out done/archived. Optionally filtered by projectId.
 */
export function usePlannerUnscheduledTasks(
  date: ISODate,
  projectId?: ID
) {
  const blocks = usePlannerStore((s) => s.blocks.filter((b) => b.date === date && b.taskId != null));
  const scheduledTaskIds = useMemo(() => new Set(blocks.map((b) => b.taskId!)), [blocks]);

  return useTaskStore((s) =>
    s.tasks.filter(
      (t) =>
        t.status !== "done" &&
        t.status !== "archived" &&
        !scheduledTaskIds.has(t.id) &&
        (projectId == null || t.projectId === projectId)
    )
  );
}

// ── Tasks that have a block on a given date ───────────────────

export function usePlannerScheduledTasks(date: ISODate) {
  const blocks = usePlannerStore((s) => s.blocks.filter((b) => b.date === date && b.taskId != null));
  const tasks  = useTaskStore((s) => s.tasks);

  return useMemo(() => {
    return blocks
      .map((b) => ({
        block: b,
        task:  tasks.find((t) => t.id === b.taskId),
      }))
      .filter((entry): entry is { block: typeof blocks[0]; task: Task } => entry.task != null);
  }, [blocks, tasks]);
}

// ── Schedule a task into planner from any module ──────────────

export function useScheduleTask() {
  const scheduleTask = usePlannerStore((s) => s.scheduleTask);

  return useCallback(
    async (task: Task, date: ISODate, startTime: string) => {
      const block = await scheduleTask(
        task.id,
        date,
        startTime,
        task.estimateMinutes ?? 60
      );
      bus.emit("planner:block-linked-task", { blockId: block.id, taskId: task.id, date });
      return block;
    },
    [scheduleTask]
  );
}

// ── Carry-forward: surface yesterday's unfinished blocks ─────

/**
 * Returns tasks that were scheduled for `date` but not completed.
 * The planner "carry forward" button uses this to repopulate today.
 */
export function useCarryForwardCandidates(fromDate: ISODate) {
  const blocks = usePlannerStore((s) =>
    s.blocks.filter((b) => b.date === fromDate && b.taskId != null)
  );
  const tasks = useTaskStore((s) => s.tasks);

  return useMemo(() => {
    const t = today();
    return blocks
      .map((b) => tasks.find((task) => task.id === b.taskId))
      .filter(
        (task): task is Task =>
          task != null &&
          task.status !== "done" &&
          task.status !== "archived" &&
          fromDate < t // only past dates make sense
      );
  }, [blocks, tasks, fromDate]);
}

// ── Block completion → task completion crossover ─────────────

/**
 * Call when the user marks a planner block as "done" in the UI.
 * Completes the linked task via the tasks store.
 */
export function useCompleteBlockTask() {
  const completeTask = useTaskStore((s) => s.completeTask);

  return useCallback(
    async (taskId: ID) => {
      await completeTask(taskId);
      // task:completed is already emitted by completeTask → downstream subscribers handle the rest
    },
    [completeTask]
  );
}

// ── Project-filtered planning view ───────────────────────────

/**
 * Planner day view segmented by project.
 * Returns blocks for `date`, grouped by their linked task's projectId.
 */
export function usePlannerBlocksByProject(date: ISODate) {
  const blocks = usePlannerStore((s) => s.blocks.filter((b) => b.date === date));
  const tasks  = useTaskStore((s) => s.tasks);

  return useMemo(() => {
    const grouped = new Map<string, typeof blocks>();

    for (const block of blocks) {
      const projectId = tasks.find((t) => t.id === block.taskId)?.projectId ?? "__unassigned__";
      const existing  = grouped.get(projectId) ?? [];
      grouped.set(projectId, [...existing, block]);
    }

    return grouped;
  }, [blocks, tasks]);
}

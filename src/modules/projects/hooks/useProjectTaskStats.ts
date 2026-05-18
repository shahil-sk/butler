// ============================================================
// PROJECTS MODULE — useProjectTaskStats
// Derives live task stats per project from the tasks store.
// Safe cross-module read: reads task state, never writes.
// ============================================================

import { useMemo } from "react";
import { useTaskStore } from "@/modules/tasks/store";
import { today } from "@/shared/utils";
import type { ID } from "@/shared/types";

export interface ProjectTaskStats {
  total:     number;
  done:      number;
  inProgress:number;
  overdue:   number;
  scheduled: number;  // tasks with a scheduledDate
  progress:  number;  // 0-100 percent
}

/**
 * Returns live task stats for a project.
 * Re-renders only when tasks for this project change.
 */
export function useProjectTaskStats(projectId: ID): ProjectTaskStats {
  const tasks = useTaskStore((s) =>
    s.tasks.filter((t) => t.projectId === projectId && t.status !== "archived")
  );

  return useMemo(() => {
    const t = today();
    const total      = tasks.length;
    const done       = tasks.filter((t) => t.status === "done").length;
    const inProgress = tasks.filter((t) => t.status === "in_progress").length;
    const overdue    = tasks.filter(
      (task) => task.status !== "done" && task.dueDate != null && task.dueDate < t
    ).length;
    const scheduled  = tasks.filter((task) => task.scheduledDate != null).length;
    const progress   = total === 0 ? 0 : Math.round((done / total) * 100);

    return { total, done, inProgress, overdue, scheduled, progress };
  }, [tasks]);
}

/**
 * Returns unscheduled + incomplete tasks for a project.
 * Used by Planner's "Add from project" panel.
 */
export function useProjectUnscheduledTasks(projectId: ID) {
  return useTaskStore((s) =>
    s.tasks.filter(
      (t) =>
        t.projectId === projectId &&
        t.status !== "done" &&
        t.status !== "archived" &&
        t.scheduledDate == null
    )
  );
}

/**
 * Summary stats across ALL active projects.
 * Used by dashboard KPIs.
 */
export function useAllProjectsTaskStats(): Record<ID, ProjectTaskStats> {
  const tasks = useTaskStore((s) => s.tasks);

  return useMemo(() => {
    const t = today();
    const map: Record<ID, ProjectTaskStats> = {};

    for (const task of tasks) {
      if (!task.projectId || task.status === "archived") continue;
      const pid = task.projectId;
      if (!map[pid]) map[pid] = { total: 0, done: 0, inProgress: 0, overdue: 0, scheduled: 0, progress: 0 };
      const s = map[pid];
      s.total++;
      if (task.status === "done")        s.done++;
      if (task.status === "in_progress") s.inProgress++;
      if (task.status !== "done" && task.dueDate && task.dueDate < t) s.overdue++;
      if (task.scheduledDate) s.scheduled++;
    }

    // Compute progress for each
    for (const pid in map) {
      const s = map[pid];
      s.progress = s.total === 0 ? 0 : Math.round((s.done / s.total) * 100);
    }

    return map;
  }, [tasks]);
}

// ============================================================
// PROJECTS MODULE — useProjectPlannerBridge
// Connects a project detail view with the planner:
// lets users schedule project tasks directly from project view.
// ============================================================

import { useCallback } from "react";
import { bus } from "@/kernel/event-bus";
import { useProjectStore } from "../store";
import { useTaskStore } from "@/modules/tasks/store";
import { today } from "@/shared/utils";
import type { ID } from "@/shared/types";

/**
 * Returns a fn that opens the planner split panel pre-filtered
 * to show unscheduled tasks from a specific project.
 */
export function useOpenProjectInPlanner(projectId: ID) {
  const project = useProjectStore((s) => s.projects.find((p) => p.id === projectId));

  return useCallback(() => {
    bus.emit("ui:panel-open", {
      panelId: "planner",
      props: { route: `/planner?projectId=${projectId}&date=${today()}` },
    });
    bus.emit("ui:notification", {
      id: `plan-project-${projectId}`,
      type: "info",
      message: `Planning tasks for "${project?.name ?? "project"}"`,
      durationMs: 2500,
    });
  }, [projectId, project?.name]);
}

/**
 * Schedules all overdue tasks in a project to today,
 * distributing them in 1h slots starting at 09:00.
 * Emits task:schedule-in-planner for each — workspace
 * provider opens the planner split and shows a toast.
 */
export function useBulkScheduleProjectToToday(projectId: ID) {
  const tasks = useTaskStore((s) =>
    s.tasks.filter(
      (t) =>
        t.projectId === projectId &&
        t.status !== "done" &&
        t.status !== "archived" &&
        t.scheduledDate == null
    )
  );

  return useCallback(async () => {
    const date = today();
    let slotHour = 9;

    for (const task of tasks) {
      const startTime = `${String(slotHour).padStart(2, "0")}:00`;
      bus.emit("task:schedule-in-planner", { task, date, startTime });
      slotHour = Math.min(slotHour + 1, 21);
    }
  }, [tasks]);
}

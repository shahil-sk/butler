// ============================================================
// GOALS MODULE — EVENTS
// Cross-module reactions to goal lifecycle events.
// ============================================================

import { bus } from "@/kernel/event-bus";
import { useGoalsStore } from "./store";
import { useTaskStore } from "@/modules/tasks/store";
import { useProjectStore } from "@/modules/projects/store";

export function syncGoalTaskProgress(goalId: string) {
  const goal = useGoalsStore.getState().goals.find(g => g.id === goalId);
  if (!goal || goal.progressType !== "task_based") return;

  const projects = useProjectStore.getState().projects.filter(p => p.goalId === goalId);
  const projectIds = new Set(projects.map(p => p.id));
  
  const tasks = useTaskStore.getState().tasks.filter(t => 
    t.goalId === goalId || (t.projectId && projectIds.has(t.projectId))
  );

  if (tasks.length === 0) {
    if (goal.progressPercent !== 0) {
      void useGoalsStore.getState().updateGoal(goalId, { progressPercent: 0 });
    }
    return;
  }

  const completedTasks = tasks.filter(t => t.status === "done").length;
  const progressPercent = Math.round((completedTasks / tasks.length) * 100);

  if (goal.progressPercent !== progressPercent) {
    void useGoalsStore.getState().updateGoal(goalId, { progressPercent });
  }
}

export function setupGoalsEventListeners(): () => void {
  const unsubs: Array<() => void> = [];

  // ── Search: invalidate index on goal mutations ────────────
  unsubs.push(
    bus.on("goal:created", ({ goal }) => {
      bus.emit("search:index-invalidated", { entityType: "goal", id: goal.id });
    })
  );

  unsubs.push(
    bus.on("goal:updated", ({ goal }) => {
      bus.emit("search:index-invalidated", { entityType: "goal", id: goal.id });
    })
  );

  unsubs.push(
    bus.on("goal:deleted", ({ goalId }) => {
      bus.emit("search:index-invalidated", { entityType: "goal", id: goalId });
    })
  );

  // ── Search: navigate on result selected ───────────────────
  unsubs.push(
    bus.on("search:result-selected", ({ result }) => {
      if (result.type === "goal") {
        bus.emit("goal:open", { goalId: result.id });
        bus.emit("navigate:to", { path: `/goals` });
      }
    })
  );

  // ── task:completed/restored → update goal progress ──
  const handleTaskChange = (taskId: string) => {
    const task = useTaskStore.getState().getTaskById(taskId);
    if (!task) return;
    if (task.goalId) {
      syncGoalTaskProgress(task.goalId);
    }
    if (task.projectId) {
      const project = useProjectStore.getState().getProjectById(task.projectId);
      if (project && project.goalId) {
        syncGoalTaskProgress(project.goalId);
      }
    }
  };

  unsubs.push(
    bus.on("task:completed", ({ taskId }) => {
      handleTaskChange(taskId);
    })
  );

  unsubs.push(
    bus.on("task:restored", ({ taskId }) => {
      handleTaskChange(taskId);
    })
  );

  unsubs.push(
    bus.on("task:created", ({ task }) => {
      if (task.goalId) {
        syncGoalTaskProgress(task.goalId);
      }
      if (task.projectId) {
        const project = useProjectStore.getState().getProjectById(task.projectId);
        if (project && project.goalId) {
          syncGoalTaskProgress(project.goalId);
        }
      }
    })
  );

  unsubs.push(
    bus.on("task:deleted", ({ taskId }) => {
      // For deleted tasks, we cannot read the task state easily if it's already removed.
      // But we can trigger a resync for ALL task_based goals just in case, since deletions are rare.
      const taskBasedGoals = useGoalsStore.getState().goals.filter(g => g.progressType === "task_based");
      taskBasedGoals.forEach(g => syncGoalTaskProgress(g.id));
    })
  );

  return () => unsubs.forEach((u) => u());
}

// ─────────────────────────────────────────────────────────────
// Hook: useScheduleInPlanner
// One-liner to schedule any task from anywhere in the UI.
// Usage:  const schedule = useScheduleInPlanner();
//         schedule(task);               // opens planner at today
//         schedule(task, "2026-05-20");  // opens planner at specific date
// ─────────────────────────────────────────────────────────────

import { useCallback } from "react";
import { bus } from "@/kernel/event-bus";
import type { Task } from "@/shared/types";

export function useScheduleInPlanner() {
  return useCallback(
    (task: Task, date?: string, startTime?: string) => {
      bus.emit("task:schedule-in-planner", { task, date, startTime });
    },
    []
  );
}

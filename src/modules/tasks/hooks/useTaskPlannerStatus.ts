// ─────────────────────────────────────────────────────────────
// Hook: useTaskPlannerStatus
// Returns the planner blocks associated with a task so any
// task-detail panel can show "Scheduled: Mon 09:00 – 10:00"
// ─────────────────────────────────────────────────────────────

import { useMemo } from "react";
import { usePlannerStore } from "@/modules/planner/store";
import type { ID } from "@/shared/types";

export function useTaskPlannerStatus(taskId: ID) {
  const blocks = usePlannerStore((s) => s.blocks);
  return useMemo(
    () => blocks.filter((b) => b.taskId === taskId),
    [blocks, taskId]
  );
}

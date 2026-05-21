// ============================================================
// focus/selectors.ts
//
// Gap 1: suggestNextTask()
//   Ranks incomplete tasks by:
//     1. Overdue (dueDate < today)                  +100
//     2. Due today                                  +50
//     3. Priority: urgent=40, high=30, medium=20, low=10
//     4. Same project as last completed session     +25
//     5. Already scheduled for today                +15
//   Returns the top candidate, or null if no tasks.
// ============================================================

import type { Task } from "@/shared/types";
import type { FocusSession } from "@/shared/types";
import { today } from "@/shared/utils";

const PRIORITY_SCORE: Record<string, number> = {
  urgent: 40,
  high:   30,
  medium: 20,
  low:    10,
};

export function suggestNextTask(
  tasks: Task[],
  lastSession: FocusSession | null
): Task | null {
  const todayStr = today();

  const actionable = tasks.filter(
    (t) =>
      t.status !== "completed" &&
      t.status !== "cancelled" &&
      t.status !== "archived"
  );

  if (actionable.length === 0) return null;

  const scored = actionable.map((task) => {
    let score = 0;

    if (task.dueDate) {
      if (task.dueDate < todayStr)  score += 100; // overdue
      else if (task.dueDate === todayStr) score += 50;  // due today
    }

    score += PRIORITY_SCORE[task.priority ?? "medium"] ?? 20;

    if (lastSession?.projectId && task.projectId === lastSession.projectId) {
      score += 25; // same project — maintain context
    }

    if (task.scheduledDate === todayStr) score += 15;

    return { task, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.task ?? null;
}

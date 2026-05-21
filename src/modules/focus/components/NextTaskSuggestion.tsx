// ============================================================
// NextTaskSuggestion
//
// Gap 1: shown in the post-session panel (after mood picker).
// Derives the top-ranked task via suggestNextTask() and
// renders a one-click card to start a new focus session on it.
// ============================================================

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRightIcon } from "lucide-react";
import { useFocusStore } from "../store";
import { suggestNextTask } from "../selectors";
import { useTaskStore } from "@/modules/tasks/store";

export function NextTaskSuggestion() {
  const tasks              = useTaskStore((s) => s.tasks);
  const lastCompleted      = useFocusStore((s) => s.lastCompletedSession);
  const startFocus         = useFocusStore((s) => s.startFocus);
  const clearLastCompleted = useFocusStore((s) => s.clearLastCompleted);

  const suggestion = useMemo(
    () => suggestNextTask(tasks, lastCompleted ?? null),
    [tasks, lastCompleted]
  );

  if (!suggestion) return null;

  function handleStart() {
    clearLastCompleted();
    void startFocus({ taskId: suggestion!.id, projectId: suggestion!.projectId ?? undefined });
  }

  return (
    <Card className="p-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">Suggested next</p>
        <p className="text-sm font-medium truncate">{suggestion.title}</p>
        {suggestion.dueDate && (
          <p className="text-xs text-muted-foreground">
            Due {suggestion.dueDate}
          </p>
        )}
      </div>
      <Button size="sm" onClick={handleStart}>
        Focus on this
        <ArrowRightIcon className="h-4 w-4 ml-1" />
      </Button>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// Hook: useTaskEvents
// Returns tasks that should appear on the calendar for a given
// date — tasks with dueDate or scheduledDate matching that date.
// Used by calendar Shell to render task chips on day cells.
// ─────────────────────────────────────────────────────────────

import { useMemo } from "react";
import { useTaskStore } from "@/modules/tasks/store";
import type { ISODate } from "@/shared/types";

export function useTaskEvents(date: ISODate) {
  const tasks = useTaskStore((s) => s.tasks);
  return useMemo(
    () =>
      tasks.filter(
        (t) =>
          t.status !== "archived" &&
          (t.dueDate === date || t.scheduledDate === date)
      ),
    [tasks, date]
  );
}

/** Returns a map of date → task[] for a range of dates (for week/month views). */
export function useTaskEventsByRange(dates: ISODate[]) {
  const tasks = useTaskStore((s) => s.tasks);
  return useMemo(() => {
    const map = new Map<ISODate, typeof tasks>();
    for (const date of dates) {
      map.set(
        date,
        tasks.filter(
          (t) =>
            t.status !== "archived" &&
            (t.dueDate === date || t.scheduledDate === date)
        )
      );
    }
    return map;
  }, [tasks, dates]);
}

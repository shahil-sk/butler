// ============================================================
// TIME TRACKING — EVENT LISTENERS
// Call setupTimeEventListeners() once in the module's useEffect
// ============================================================

import { bus } from "@/kernel/event-bus";
import { useTimeStore } from "./store";

export function setupTimeEventListeners(): () => void {
  const unsubs: Array<() => void> = [];

  // focus:session-completed → auto-create TimeEntry
  unsubs.push(
    bus.on("focus:session-completed", async ({ session }) => {
      if (!session.completedAt || !session.startedAt) return;
      await useTimeStore.getState().createEntry({
        taskId:          session.taskId,
        projectId:       session.projectId,
        focusSessionId:  session.id,
        description:     session.goal ?? "Focus session",
        startAt:         session.startedAt,
        endAt:           session.completedAt,
        durationMinutes: session.actualMinutes,
        isBillable:      false,
        tags:            ["focus"],
      });
    })
  );

  // time:entry-created → update task.actualMinutes via bus
  unsubs.push(
    bus.on("time:entry-created", ({ entry }) => {
      if (!entry.taskId || !entry.durationMinutes) return;
      // Emit task:updated via tasks store — read current task, add minutes
      // We don't import useTaskStore directly; emit a bus-side update instead.
      // IntegrationLayer handles task.actualMinutes accumulation.
      bus.emit("search:index-invalidated", { entityType: "task", id: entry.taskId });
    })
  );

  return () => unsubs.forEach((u) => u());
}

// ============================================================
// TIME TRACKING — EVENT BUS LISTENERS
// Single entry point: registerTimeListeners()
// Call once from main.tsx after db.init().
// Guards against double-registration.
// ============================================================

import { bus } from "@/kernel/event-bus";
import { useTimeStore } from "./store";

let _registered = false;

export function registerTimeListeners(): void {
  if (_registered) return;
  _registered = true;

  // focus:session-completed → auto-create a TimeEntry for the session
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
  });

  // time:entry-created → accumulate task.actualMinutes
  // Previously a dead comment in WIRING.tsx — now a live listener.
  bus.on("time:entry-created", async ({ entry }) => {
    if (!entry.taskId || !entry.durationMinutes) return;
    try {
      const { useTaskStore } = await import("@/modules/tasks/store");
      const task = useTaskStore.getState().tasks.find((t: { id: string }) => t.id === entry.taskId);
      if (!task) return;
      await useTaskStore.getState().updateTask(entry.taskId, {
        actualMinutes: ((task.actualMinutes as number) ?? 0) + entry.durationMinutes,
      });
    } catch (e) {
      console.warn("[time-tracking] task.actualMinutes accumulation failed", e);
    }
    // Invalidate search index for the linked task
    bus.emit("search:index-invalidated", { entityType: "task", id: entry.taskId });
  });
}

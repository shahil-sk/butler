// ============================================================
// focus/taskIntegration.ts
//
// All cross-module side-effects between focus sessions and tasks.
// Import this file once in the app entry point (main.tsx / App.tsx).
//
// Gap 2: listen to focus:session-completed → update task.status
// Gap 3: called from store.startFocus → set task.scheduledDate = today
// Gap 4: focus:start-requested → persist _pendingTaskId to sessionStorage
// ============================================================

import { bus } from "@/kernel/event-bus";
import { today } from "@/shared/utils";

let _registered = false;

export function registerFocusTaskIntegration() {
  if (_registered) return;
  _registered = true;

  // ----------------------------------------------------------
  // Gap 2: when a focus session completes, move the linked task
  //        from "todo" → "in_progress" (idempotent for other statuses)
  // ----------------------------------------------------------
  bus.on("focus:session-completed", async ({ session }) => {
    if (!session.taskId) return;
    try {
      const { useTaskStore } = await import("@/modules/tasks/store");
      const task = useTaskStore.getState().tasks.find((t) => t.id === session.taskId);
      if (!task) return;
      if (task.status === "todo") {
        await useTaskStore.getState().updateTask(task.id, { status: "in_progress" });
      }
    } catch (e) {
      console.warn("[focus] task status transition failed", e);
    }
  });

  // ----------------------------------------------------------
  // Gap 4: persist the requested taskId across navigation so
  //        FocusStartForm can pick it up after the route change
  // ----------------------------------------------------------
  bus.on("focus:start-requested", ({ taskId }: { taskId?: string }) => {
    if (taskId) {
      try { sessionStorage.setItem("butler:pendingFocusTaskId", taskId); } catch { /* sandboxed */ }
    }
  });
}

// ----------------------------------------------------------
// Gap 3: called from store.startFocus when a taskId is present
// Sets task.scheduledDate = today so the planner knows work
// is actively happening on this task today.
// ----------------------------------------------------------
export async function setTaskScheduledToday(taskId: string) {
  try {
    const { useTaskStore } = await import("@/modules/tasks/store");
    const task = useTaskStore.getState().tasks.find((t) => t.id === taskId);
    if (!task) return;
    if (task.scheduledDate !== today()) {
      await useTaskStore.getState().updateTask(taskId, { scheduledDate: today() });
    }
  } catch (e) {
    console.warn("[focus] scheduledDate update failed", e);
  }
}

// ============================================================
// TASKS MODULE — EVENTS
// What this module emits and listens to via the event bus.
// Never import other module stores directly.
// ============================================================

import { bus } from "@/kernel/event-bus";
import { useTaskStore } from "./store";

// ── Setup listeners (call once at module mount) ──────────────

export function setupTaskEventListeners(): () => void {
  const unsubs: Array<() => void> = [];

  // Other modules can request quick-add with prefill
  unsubs.push(
    bus.on("task:quick-add", (payload) => {
      useTaskStore.getState().openQuickAdd(payload.prefill);
    })
  );

  // Notes module linking a task
  unsubs.push(
    bus.on("note:link-to-task", ({ taskId, noteId }) => {
      const task = useTaskStore.getState().tasks.find((t) => t.id === taskId);
      if (!task) return;
      const linked = [...new Set([...task.linkedNoteIds, noteId])];
      useTaskStore.getState().updateTask(taskId, { linkedNoteIds: linked });
    })
  );

  // Search result navigates to task
  unsubs.push(
    bus.on("search:result-selected", ({ result }) => {
      if (result.type === "task") {
        bus.emit("task:open", { taskId: result.id });
      }
    })
  );

  return () => unsubs.forEach((u) => u());
}

// ============================================================
// TASKS MODULE — EVENTS
// What this module emits and listens to via the event bus.
// Never import other module stores directly.
//
// Also owns the task-calendar-sync bus registrations — all
// task bus wiring is centralised here.
// ============================================================

import { bus } from "@/kernel/event-bus";
import { useTaskStore } from "./store";
import { setupTaskCalendarSync } from "./task-calendar-sync";

// ── Setup listeners (call once at module mount) ──────────────

export function setupTaskEventListeners(): () => void {
  const unsubs: Array<() => void> = [];

  // ── Calendar sync wiring ─────────────────────────────────
  // Delegates to task-calendar-sync.ts which emits the bus event;
  // the calendar module handles the actual DB insert.
  unsubs.push(setupTaskCalendarSync());

  // Other modules can request quick-add with prefill
  unsubs.push(
    bus.on("task:quick-add", (payload) => {
      useTaskStore.getState().openQuickAdd(payload.prefill);
    }),
  );

  // Notes module linking a task
  unsubs.push(
    bus.on("note:link-to-task", ({ taskId, noteId }) => {
      const task = useTaskStore.getState().tasks.find((t) => t.id === taskId);
      if (!task) return;
      const linked = [...new Set([...task.linkedNoteIds, noteId])];
      useTaskStore.getState().updateTask(taskId, { linkedNoteIds: linked });
    }),
  );

  // Search result navigates to task
  unsubs.push(
    bus.on("search:result-selected", ({ result }) => {
      if (result.type === "task") {
        bus.emit("task:open", { taskId: result.id });
      }
    }),
  );

  // ── Planner → Task: block linked back to a task ──────────
  // When user links a planner block to a task, sync scheduledDate onto the task.
  unsubs.push(
    bus.on("planner:block-linked-task", ({ taskId, date }) => {
      const store = useTaskStore.getState();
      const task  = store.tasks.find((t) => t.id === taskId);
      if (!task) return;
      if (task.scheduledDate !== date) {
        store.updateTask(taskId, { scheduledDate: date });
      }
    }),
  );

  // When a planner block is unlinked, clear scheduledDate if it came from planner
  unsubs.push(
    bus.on("planner:block-unlinked-task", ({ previousTaskId }) => {
      const store = useTaskStore.getState();
      const task  = store.tasks.find((t) => t.id === previousTaskId);
      if (!task || !task.scheduledDate) return;
      store.updateTask(previousTaskId, { scheduledDate: undefined });
    }),
  );

  // Project deleted → unlink tasks from that project
  unsubs.push(
    bus.on("project:deleted", ({ projectId }) => {
      const store    = useTaskStore.getState();
      const affected = store.tasks.filter((t) => t.projectId === projectId);
      affected.forEach((t) => store.updateTask(t.id, { projectId: undefined }));
    }),
  );

  // Project archived → unlink tasks from that project (same behavior as delete)
  unsubs.push(
    bus.on("project:updated", ({ project, changed }) => {
      if (changed.status === "archived") {
        const store    = useTaskStore.getState();
        const affected = store.tasks.filter((t) => t.projectId === project.id);
        affected.forEach((t) => store.updateTask(t.id, { projectId: undefined }));
      }
    }),
  );

  return () => unsubs.forEach((u) => u());
}

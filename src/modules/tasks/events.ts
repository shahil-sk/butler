// ============================================================
// TASKS MODULE — EVENTS
// Integration wires: task lifecycle → cross-module reactions
// Added:
//   task:completed   → focus:cancel active session
//   task:completed   → database: update linked row
//   task:created     → calendar: shadow deadline event (handled in kernel)
//   task:due-today   → journal: append task entry
//   task:overdue     → ui:notification overdue warning
//   task:unblocked   → planner:task-unblocked
//   task:schedule-in-planner → planner:create-block
//   task:open        → research: semantic search
//   Daily cron:      → emits task:due-today and task:overdue
// ============================================================

import { bus } from "@/kernel/event-bus";
import { today } from "@/shared/utils";
import { useTaskStore } from "./store";

export function setupTaskEventListeners(): () => void {
  const unsubs: Array<() => void> = [];

  // ── Other modules requesting quick-add ────────────────────
  unsubs.push(
    bus.on("task:quick-add", (payload) => {
      useTaskStore.getState().openQuickAdd(payload.prefill);
    })
  );

  // ── Notes module linking a task ───────────────────────────
  unsubs.push(
    bus.on("note:link-to-task", ({ taskId, noteId }) => {
      const task = useTaskStore.getState().tasks.find((t) => t.id === taskId);
      if (!task) return;
      const linked = [...new Set([...task.linkedNoteIds, noteId])];
      useTaskStore.getState().updateTask(taskId, { linkedNoteIds: linked });
    })
  );

  // ── Search result navigates to task ───────────────────────
  unsubs.push(
    bus.on("search:result-selected", ({ result }) => {
      if (result.type === "task") {
        bus.emit("task:open", { taskId: result.id });
      }
    })
  );

  // ── Planner → Task: block linked back to a task ───────────
  unsubs.push(
    bus.on("planner:block-linked-task", ({ taskId, date }) => {
      const store = useTaskStore.getState();
      const task  = store.tasks.find((t) => t.id === taskId);
      if (!task) return;
      if (task.scheduledDate !== date) {
        store.updateTask(taskId, { scheduledDate: date });
      }
    })
  );

  // ── Project deleted → unlink tasks ────────────────────────
  unsubs.push(
    bus.on("project:deleted", ({ projectId }) => {
      const store = useTaskStore.getState();
      const affected = store.tasks.filter((t) => t.projectId === projectId);
      affected.forEach((t) => store.updateTask(t.id, { projectId: undefined }));
    })
  );

  // ── task:completed → focus: cancel active session ─────────
  unsubs.push(
    bus.on("task:completed", ({ taskId }) => {
      bus.emit("focus:cancel-if-active", { taskId });
    })
  );

  // ── task:completed → database: update linked row ──────────
  unsubs.push(
    bus.on("task:completed", ({ taskId }) => {
      const task = useTaskStore.getState().tasks.find((t) => t.id === taskId);
      if (!task) return;
      // Notify database module to set linked row's status cell to "Done"
      bus.emit("database:task-completed", { taskId, linkedNoteIds: task.linkedNoteIds });
    })
  );

  // ── task:unblocked → planner: task available for scheduling ─
  unsubs.push(
    bus.on("task:unblocked", ({ taskId }) => {
      const task = useTaskStore.getState().tasks.find((t) => t.id === taskId);
      if (!task) return;
      bus.emit("planner:task-unblocked", { task });
      // Also notify the user
      bus.emit("ui:notification", {
        id:         `unblocked-${taskId}`,
        type:       "info",
        message:    `"${task.title}" is now unblocked`,
        durationMs: 4000,
      });
    })
  );

  // ── task:schedule-in-planner → planner:create-block ───────
  unsubs.push(
    bus.on("task:schedule-in-planner", ({ task, date }) => {
      const effectiveDate = date ?? task.dueDate ?? task.scheduledDate;
      bus.emit("planner:create-block", {
        title:          task.title,
        date:           effectiveDate,
        durationMinutes: task.estimateMinutes ?? 60,
        linkedTaskId:   task.id,
        color:          "#8b5cf6",
      });
      bus.emit("ui:notification", {
        id:         `sched-${task.id}`,
        type:       "success",
        message:    `"${task.title}" sent to Planner`,
        durationMs: 3000,
      });
    })
  );

  // ── task:open → research: semantic search ─────────────────
  unsubs.push(
    bus.on("task:open", ({ taskId }) => {
      const task = useTaskStore.getState().tasks.find((t) => t.id === taskId);
      if (!task) return;
      bus.emit("research:search-for-context", {
        query:    task.title,
        sourceId: taskId,
        sourceType: "task",
      });
    })
  );

  // ── Daily cron: due-today + overdue notifications ─────────
  const cronUnsub = startDailyCron();
  unsubs.push(cronUnsub);

  return () => unsubs.forEach((u) => u());
}

// ── Daily Cron ────────────────────────────────────────────────

const CRON_INTERVAL_MS = 60_000; // every minute

function startDailyCron(): () => void {
  let lastCheckedDate = "";

  const check = () => {
    const t = today();
    // Emit overdue + due-today once per calendar day (+ on first run)
    if (t === lastCheckedDate) return;
    lastCheckedDate = t;

    const store = useTaskStore.getState();
    const allTasks = store.tasks;

    // task:due-today
    const todayTasks = allTasks.filter(
      (task) =>
        task.status !== "done" &&
        task.status !== "archived" &&
        (task.dueDate === t || task.scheduledDate === t)
    );
    todayTasks.forEach((task) => {
      bus.emit("task:due-today", { taskId: task.id });
    });

    // task:overdue
    const overdueTasks = allTasks.filter(
      (task) =>
        task.status !== "done" &&
        task.status !== "archived" &&
        task.dueDate &&
        task.dueDate < t
    );
    overdueTasks.forEach((task) => {
      const dueDate  = new Date(task.dueDate! + "T00:00:00");
      const today    = new Date(t + "T00:00:00");
      const daysPast = Math.floor((today.getTime() - dueDate.getTime()) / 86_400_000);
      bus.emit("task:overdue", { taskId: task.id, daysPast });
      bus.emit("ui:notification", {
        id:         `overdue-${task.id}`,
        type:       "warning",
        message:    `Overdue: "${task.title}"`,
        durationMs: 6000,
      });
    });
  };

  // Fire once immediately (on next tick after store is ready)
  const timer = setTimeout(() => check(), 2000);
  const interval = setInterval(check, CRON_INTERVAL_MS);

  return () => {
    clearTimeout(timer);
    clearInterval(interval);
  };
}

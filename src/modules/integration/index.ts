// ============================================================
// BUTLER — INTEGRATION SERVICE
// Wires Tasks ↔ Calendar ↔ Planner via the event bus.
// Import and call startIntegration() ONCE at app boot (App.tsx).
// Never import module stores directly across module boundaries
// except inside this file — this is the approved seam.
// ============================================================

import { bus } from "@/kernel/event-bus";
import { toISODate } from "@/shared/utils";

let started = false;

// Per-task mutex: prevents race between concurrent task:created + task:updated
// events from inserting two calendar events for the same task.
const syncInFlight = new Set<string>();

async function withTaskMutex<T>(taskId: string, fn: () => Promise<T>): Promise<T | undefined> {
  if (syncInFlight.has(taskId)) return undefined;
  syncInFlight.add(taskId);
  try {
    return await fn();
  } finally {
    syncInFlight.delete(taskId);
  }
}

export function startIntegration() {
  if (started) return;
  started = true;

  // ── 1. Task completed → gray-out / remove planner block ──────────────────
  bus.on("task:completed", ({ taskId }) => {
    import("@/modules/planner/store").then(({ usePlannerStore }) => {
      const { blocks, deleteBlock } = usePlannerStore.getState();
      const linked = blocks.filter((b) => b.taskId === taskId);
      // Mark as done-tinted instead of deleting so user can see it was completed
      linked.forEach((b) => {
        usePlannerStore.getState().updateBlock(b.id, { color: "#6b7280", title: `✓ ${b.title}` });
      });
    });
  });

  // ── 2. Task deleted → remove all linked planner blocks ─────────────────
  bus.on("task:deleted", ({ taskId }) => {
    import("@/modules/planner/store").then(({ usePlannerStore }) => {
      const { blocks, deleteBlock } = usePlannerStore.getState();
      blocks
        .filter((b) => b.taskId === taskId)
        .forEach((b) => void deleteBlock(b.id));
    });

    // Also unlink from calendar events
    import("@/modules/calendar/store").then(({ useCalendarStore }) => {
      const { events, updateEvent } = useCalendarStore.getState();
      events
        .filter((e) => e.taskId === taskId)
        .forEach((e) => void updateEvent(e.id, { taskId: undefined }));
    });
  });

  // ── 3. Task scheduledDate changed → move / create planner block ────────
  bus.on("task:updated", ({ task, changed }) => {
    if (!changed.scheduledDate) return;

    void withTaskMutex(task.id + ":planner", async () => {
      const { usePlannerStore } = await import("@/modules/planner/store");
      const { blocks, createBlock, updateBlock } = usePlannerStore.getState();
      const existing = blocks.find((b) => b.taskId === task.id);

      if (existing) {
        await updateBlock(existing.id, { date: changed.scheduledDate! });
      } else if (changed.scheduledDate) {
        const dur = task.estimateMinutes ?? 60;
        const endH = 9 + Math.floor(dur / 60);
        const endM = dur % 60;
        await createBlock({
          date:      changed.scheduledDate,
          taskId:    task.id,
          title:     task.title,
          startTime: "09:00",
          endTime:   `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`,
        });
      }
    });
  });

  // ── 4. Task dueDate / title changed → update linked calendar event ─────
  bus.on("task:updated", ({ task, changed }) => {
    if (!changed.dueDate && !changed.title) return;

    void withTaskMutex(task.id + ":calendar-update", async () => {
      const { useCalendarStore } = await import("@/modules/calendar/store");
      const { events, updateEvent } = useCalendarStore.getState();
      const linked = events.filter((e) => e.taskId === task.id);
      for (const e of linked) {
        const patch: Record<string, unknown> = {};
        if (changed.title)   patch.title = task.title;
        if (changed.dueDate) patch.date  = task.dueDate;
        if (Object.keys(patch).length) await updateEvent(e.id, patch);
      }
    });
  });

  // ── 5. Calendar event created with taskId → sync task scheduledDate ───
  bus.on("calendar:event-created", ({ event }) => {
    if (!event.taskId) return;

    void withTaskMutex(event.taskId + ":task-sync", async () => {
      const { useTaskStore } = await import("@/modules/tasks/store");
      const { updateTask } = useTaskStore.getState();
      await updateTask(event.taskId!, {
        scheduledDate: event.date ?? toISODate(new Date(event.startTime ?? Date.now())),
      });
    });
  });

  bus.on("calendar:event-updated", ({ event }) => {
    if (!event.taskId) return;

    void withTaskMutex(event.taskId + ":planner-sync", async () => {
      const { usePlannerStore } = await import("@/modules/planner/store");
      const { blocks, rescheduleBlock, updateBlock } = usePlannerStore.getState();
      const block = blocks.find((b) => b.taskId === event.taskId);
      if (!block) return;

      const newDate  = event.date ?? block.date;
      const newStart = event.startTime ? event.startTime.slice(11, 16) : block.startTime;
      const newEnd   = event.endTime   ? event.endTime.slice(11, 16)   : block.endTime;

      await updateBlock(block.id, { date: newDate });
      if (newStart !== block.startTime || newEnd !== block.endTime) {
        await rescheduleBlock(block.id, newStart, newEnd);
      }
    });
  });

  // ── 6. Focus session completed → write actualMinutes to task ─────────
  bus.on("focus:session-completed", ({ session }) => {
    if (!session.taskId) return;

    void withTaskMutex(session.taskId + ":focus", async () => {
      const { useTaskStore } = await import("@/modules/tasks/store");
      const { tasks, updateTask } = useTaskStore.getState();
      const task = tasks.find((t) => t.id === session.taskId);
      if (!task) return;
      const prev  = task.actualMinutes ?? 0;
      const added = Math.round((session.durationSeconds ?? 0) / 60);
      await updateTask(session.taskId!, { actualMinutes: prev + added });
    });
  });

  // ── 7. Planner block linked to task → set task.scheduledDate ─────────
  bus.on("planner:block-linked-task", ({ blockId, taskId, date }) => {
    void withTaskMutex(taskId + ":planner-link", async () => {
      const { useTaskStore } = await import("@/modules/tasks/store");
      await useTaskStore.getState().updateTask(taskId, { scheduledDate: date });
    });
  });

  // ── 8. Task "schedule in planner" request ───────────────────────
  bus.on("task:schedule-in-planner", ({ task, date, startTime }) => {
    void withTaskMutex(task.id + ":schedule", async () => {
      const { usePlannerStore } = await import("@/modules/planner/store");
      await usePlannerStore.getState().scheduleTask(
        task.id,
        date ?? toISODate(new Date()),
        startTime ?? "09:00",
        task.estimateMinutes ?? 60
      );
      usePlannerStore.getState().setActiveDate(date ?? toISODate(new Date()));
    });
    bus.emit("navigate:to", { path: "/planner" });
  });
}

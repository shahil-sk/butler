// ============================================================
// focus/taskIntegration.ts
//
// All cross-module side-effects wired from bus events.
// Call registerFocusTaskIntegration() once in main.tsx / App.tsx.
//
// Task-integration gaps (previous commit):
//   Gap 2: focus:session-completed → task.status = in_progress
//   Gap 3: startFocus → task.scheduledDate = today
//   Gap 4: focus:start-requested → sessionStorage pending task
//
// Time-tracking gaps (this commit):
//   Gap 1: focus:session-completed → auto-create TimeEntry
//   Gap 2: focus:session-started   → stop running time-entry timer
// ============================================================

import { bus } from "@/kernel/event-bus";
import { today } from "@/shared/utils";

let _registered = false;

export function registerFocusTaskIntegration() {
  if (_registered) return;
  _registered = true;

  // ----------------------------------------------------------
  // Time-tracking Gap 1 (Phase 1c):
  // When a focus session completes, automatically create a
  // corresponding TimeEntry so every completed Pomodoro shows
  // up in the time tracker and reports.
  // ----------------------------------------------------------
  bus.on("focus:session-completed", async ({ session }) => {
    if (!session.actualMinutes || session.actualMinutes <= 0) return;
    try {
      const { useTimeStore } = await import("@/modules/time-tracking/store");
      await useTimeStore.getState().createEntry({
        taskId:          session.taskId,
        projectId:       session.projectId,
        durationMinutes: session.actualMinutes,
        description:     session.goal
          ? `[Focus] ${session.goal}`
          : "[Focus] Pomodoro session",
        date:            session.startedAt?.slice(0, 10) ?? today(),
        source:          "focus",           // allows reports to split by source
        focusSessionId:  session.id,        // dedup guard — unique per session
      });
    } catch (e) {
      console.warn("[focus] auto time-entry creation failed", e);
    }

    // Task-integration Gap 2: transition todo → in_progress
    if (session.taskId) {
      try {
        const { useTaskStore } = await import("@/modules/tasks/store");
        const task = useTaskStore.getState().tasks.find((t) => t.id === session.taskId);
        if (task?.status === "todo") {
          await useTaskStore.getState().updateTask(task.id, { status: "in_progress" });
        }
      } catch (e) {
        console.warn("[focus] task status transition failed", e);
      }
    }
  });

  // ----------------------------------------------------------
  // Time-tracking Gap 2 (mutual exclusion — focus side):
  // When a focus session starts, stop any running time-entry
  // timer so time is never double-logged.
  // ----------------------------------------------------------
  bus.on("focus:session-started", async ({ session }) => {
    if (session.type !== "focus") return;
    try {
      const { useTimeStore } = await import("@/modules/time-tracking/store");
      const running = useTimeStore.getState().runningEntry;
      if (running) {
        await useTimeStore.getState().stopTimer(running.id);
        bus.emit("notify", {
          message: "Time tracker stopped — focus session started",
          type: "info",
        } as never);
      }
    } catch (e) {
      console.warn("[focus] could not stop running timer", e);
    }
  });

  // ----------------------------------------------------------
  // Task-integration Gap 4:
  // Persist pending task across /focus navigation
  // ----------------------------------------------------------
  bus.on("focus:start-requested", ({ taskId }: { taskId?: string }) => {
    if (taskId) {
      try { sessionStorage.setItem("butler:pendingFocusTaskId", taskId); } catch { /* sandboxed */ }
    }
  });
}

// ----------------------------------------------------------
// Task-integration Gap 3:
// Called from store.startFocus when a taskId is present.
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

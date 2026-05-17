// ============================================================
// FOCUS — EVENTS
// Called once inside FocusModule root via useEffect.
//
// Listeners:
//   task:open              → if idle, offer focus session (existing)
//   focus:start-requested  → navigate + pre-select task (new)
//   task:completed         → if active session linked to that task → prompt stop
// ============================================================

import { useEffect } from "react";
import { bus } from "@/kernel/event-bus";
import { useFocusStore } from "./store";

export function useFocusEventListeners() {
  const activeSession = useFocusStore((s) => s.activeSession);

  useEffect(() => {
    const unsubs: Array<() => void> = [];

    // ── task:open → idle guard: offer focus session ───────────────────────────
    unsubs.push(
      bus.on("task:open", ({ taskId }) => {
        if (useFocusStore.getState().activeSession) return;
        bus.emit("ui:notification", {
          id:         `focus-offer-${taskId}`,
          type:       "info",
          message:    "Start a focus session on this task? Go to Focus → select the task.",
          durationMs: 6000,
        });
      })
    );

    // ── focus:start-requested → navigate + pre-select task ───────────────────
    // Any module (tasks, planner, cmd palette) can emit this to deep-link
    // into focus with a task already selected.
    unsubs.push(
      bus.on("focus:start-requested", ({ taskId }) => {
        // Navigate to focus view
        bus.emit("navigate:to", { path: "/focus" });
        // Pre-select the task if provided; store will handle it once idle
        if (taskId) {
          // If currently idle, pre-select immediately via a microtask
          // so the UI renders with the task selected
          setTimeout(() => {
            const store = useFocusStore.getState();
            if (!store.activeSession) {
              // Trigger a synthetic selection by emitting into a known side channel.
              // The Focus UI reads `pendingTaskId` from the store.
              useFocusStore.setState({ _pendingTaskId: taskId } as never);
            }
          }, 50);
        }
      })
    );

    // ── task:completed → if active session is on that task, prompt end ────────
    unsubs.push(
      bus.on("task:completed", ({ taskId }) => {
        const store = useFocusStore.getState();
        if (!store.activeSession) return;
        if (store.activeSession.taskId !== taskId) return;
        if (store.activeSession.type !== "focus") return;
        bus.emit("ui:notification", {
          id:         `focus-task-done-${taskId}`,
          type:       "success",
          message:    "Task completed! End your focus session when ready.",
          durationMs: 8000,
        });
      })
    );

    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!activeSession]);
}

// ============================================================
// FOCUS — EVENT BUS LISTENERS
// Wire focus module to task events (completed, cancelled, etc.)
// Call useFocusEventListeners() from the Focus UI component.
// ============================================================

import { useEffect } from "react";
import { bus } from "@/kernel/event-bus";
import { useFocusStore } from "./store";

export function useFocusEventListeners() {
  const activeSession = useFocusStore((s) => s.activeSession);
  const cancel        = useFocusStore((s) => s.cancel);

  useEffect(() => {
    // Prompt user to end session when task is completed
    const offCompleted = bus.on("task:completed", ({ taskId }) => {
      if (!activeSession?.taskId || activeSession.taskId !== taskId) return;
      const shouldStop = window.confirm(
        "The task you're focusing on was just completed. End this focus session?"
      );
      if (shouldStop) void cancel();
    });

    // Prompt user to end session when task is cancelled
    const offCancelled = bus.on("task:cancelled", ({ taskId }) => {
      if (!activeSession?.taskId || activeSession.taskId !== taskId) return;
      const shouldStop = window.confirm(
        "The task you're focusing on was just cancelled. End this focus session?"
      );
      if (shouldStop) void cancel();
    });

    return () => {
      offCompleted();
      offCancelled();
    };
  }, [activeSession?.taskId, cancel]);
}

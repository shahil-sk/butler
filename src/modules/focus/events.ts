import { useEffect } from "react";
import { bus } from "@/kernel/event-bus";
import { useFocusStore } from "./store";

export function useFocusEventListeners() {
  useEffect(() => {
    const unsubs: Array<() => void> = [];

    // task:open → idle guard: offer focus session
    unsubs.push(
      bus.on("task:open", ({ taskId }) => {
        if (useFocusStore.getState().activeSession) return;
        bus.emit("ui:notification", {
          id: `focus-offer-${taskId}`,
          type: "info",
          message: "Start a focus session on this task by clicking the Flow button.",
          durationMs: 4000,
        });
      })
    );

    // focus:start-requested
    unsubs.push(
      bus.on("focus:start-requested", ({ taskId }) => {
        if (taskId) {
          useFocusStore.getState().startFocus(taskId);
        }
      })
    );

    return () => unsubs.forEach((u) => u());
  }, []);
}

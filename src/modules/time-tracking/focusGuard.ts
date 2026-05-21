// ============================================================
// time-tracking/focusGuard.ts
//
// Time-tracking Gap 2 (mutual exclusion — time-tracker side):
// Call guardStartTimer() before starting a manual time-entry
// timer. If a focus session is actively running it shows a
// confirmation toast and returns false — the caller must bail.
//
// Usage in the time-tracking store's startTimer action:
//
//   import { guardStartTimer } from "./focusGuard";
//
//   startTimer: async (entryId) => {
//     if (!await guardStartTimer()) return;
//     // ... existing logic
//   }
// ============================================================

export async function guardStartTimer(): Promise<boolean> {
  try {
    const { useFocusStore } = await import("@/modules/focus/store");
    const active = useFocusStore.getState().activeSession;
    if (active && active.type === "focus" && active.state === "focusing") {
      const { bus } = await import("@/kernel/event-bus");
      bus.emit("notify", {
        message:
          "A focus session is running. Stop it before starting a manual timer.",
        type: "warning",
        action: {
          label: "Stop focus",
          onClick: () => void useFocusStore.getState().cancel(),
        },
      } as never);
      return false;
    }
  } catch { /* focus module may not be loaded */ }
  return true;
}

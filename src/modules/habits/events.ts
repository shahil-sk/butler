// ============================================================
// HABITS MODULE — EVENTS
// Cross-module reactions to habit lifecycle events.
// ============================================================

import { bus } from "@/kernel/event-bus";
import { useHabitsStore } from "./store";

export function setupHabitsEventListeners(): () => void {
  const unsubs: Array<() => void> = [];

  // ── habit:logged → recompute streak ──────────────────────
  unsubs.push(
    bus.on("habit:logged", ({ habitId, date, status }) => {
      // Optimistically re-evaluate streaks after any log
      const store = useHabitsStore.getState();
      const streak = store.streaks.find((s) => s.habitId === habitId && s.streakType === "current");
      if (streak) {
        bus.emit("habit:streak-updated", { habitId, streak: streak.count });
      }
    })
  );

  // ── day:started → check habits that need logging reminder ─
  unsubs.push(
    bus.on("day:started", ({ date }) => {
      const { habits } = useHabitsStore.getState();
      const activeHabits = habits.filter((h) => !h.archivedAt && h.reminderEnabled);
      if (activeHabits.length > 0) {
        bus.emit("ui:notification", {
          type: "info",
          message: `You have ${activeHabits.length} habit${activeHabits.length > 1 ? "s" : ""} to track today.`,
          durationMs: 4000,
        });
      }
    })
  );

  return () => unsubs.forEach((u) => u());
}

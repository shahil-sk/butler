// ============================================================
// PLANNER MODULE — EVENTS
// Cross-module reactions to planner lifecycle events.
// ============================================================

import { bus } from "@/kernel/event-bus";
import { usePlannerStore } from "./store";

export function setupPlannerEventListeners(): () => void {
  const unsubs: Array<() => void> = [];

  unsubs.push(
    bus.on("focus:session-completed", async ({ session }) => {
      if (session.timeBlockId) {
        const store = usePlannerStore.getState();
        const block = store.blocks.find(b => b.id === session.timeBlockId);
        if (block) {
          await store.completeBlock(session.timeBlockId);
          if (session.actualDuration !== undefined && session.actualDuration !== block.durationMinutes) {
            import("@/kernel/db").then(({ db }) => {
              db.execute("UPDATE planner_blocks SET actual_duration=?, updated_at=? WHERE id=?", [
                session.actualDuration,
                new Date().toISOString(),
                session.timeBlockId
              ]);
              store.loadBlocks(block.date); // Reload to reflect changes
            });
          }
        } else {
          // If block is not currently loaded in the UI state, just update DB
          import("@/kernel/db").then(({ db }) => {
            db.execute("UPDATE planner_blocks SET is_completed=1, actual_duration=?, updated_at=? WHERE id=?", [
              session.actualDuration ?? null,
              new Date().toISOString(),
              session.timeBlockId
            ]);
          });
        }
      }
    })
  );

  return () => unsubs.forEach((u) => u());
}

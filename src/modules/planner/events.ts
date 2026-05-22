// ============================================================
// PLANNER — EVENT BUS LISTENERS
// Wire planner module to task/calendar events.
// Call usePlannerEventListeners() from the Planner UI component.
// ============================================================


import { bus } from "@/kernel/event-bus";
import { usePlannerStore } from "./store";

export function setupPlannerEventListeners(): () => void {
  const createBlock  = usePlannerStore.getState().createBlock;
  const updateBlock  = usePlannerStore.getState().updateBlock;
  const deleteBlock  = usePlannerStore.getState().deleteBlock;

  const unsubs: Array<() => void> = [];

  // ── task:created (scheduledDate) → auto-create planner block ──
  unsubs.push(
    bus.on("task:created", ({ task }) => {
      if (!task.scheduledDate) return;
      const blocks = usePlannerStore.getState().blocks;
      if (blocks.some((b) => b.taskId === task.id)) return;
      const dur  = task.estimateMinutes ?? 60;
      const endH = 9 + Math.floor(dur / 60);
      const endM = dur % 60;
      void createBlock({
        date:      task.scheduledDate,
        taskId:    task.id,
        title:     task.title,
        startTime: "09:00",
        endTime:   `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`,
      });
    })
  );

  // ── task:completed → mark linked blocks ✓ ─────────────
  unsubs.push(
    bus.on("task:completed", ({ taskId }) => {
      const blocks = usePlannerStore.getState().blocks;
      for (const b of blocks.filter((b) => b.taskId === taskId)) {
        void updateBlock(b.id, {
          color: "#6b7280",
          title: `✓ ${b.title.replace(/^[✓✗]\s*/, "")}`,
        });
      }
    })
  );

  // ── task:cancelled → mark linked blocks ✗ ─────────────
  unsubs.push(
    bus.on("task:cancelled", ({ taskId }) => {
      const blocks = usePlannerStore.getState().blocks;
      for (const b of blocks.filter((b) => b.taskId === taskId)) {
        void updateBlock(b.id, {
          color: "#ef4444",
          title: `✗ ${b.title.replace(/^[✓✗]\s*/, "")}`,
        });
      }
    })
  );

  // ── task:deleted → remove linked blocks ───────────────
  unsubs.push(
    bus.on("task:deleted", ({ taskId }) => {
      const blocks = usePlannerStore.getState().blocks;
      for (const b of blocks.filter((b) => b.taskId === taskId)) {
        void deleteBlock(b.id);
      }
    })
  );

  return () => unsubs.forEach((u) => u());
}

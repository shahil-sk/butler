// ============================================================
// PLANNER — EVENT BUS LISTENERS
// Wire planner module to task/calendar events.
// Call usePlannerEventListeners() from the Planner UI component.
// ============================================================

import { useEffect } from "react";
import { bus } from "@/kernel/event-bus";
import { usePlannerStore } from "./store";

export function usePlannerEventListeners() {
  const createBlock  = usePlannerStore((s) => s.createBlock);
  const updateBlock  = usePlannerStore((s) => s.updateBlock);
  const deleteBlock  = usePlannerStore((s) => s.deleteBlock);
  const blocks       = usePlannerStore((s) => s.blocks);

  useEffect(() => {
    // ── task:created (scheduledDate) → auto-create planner block ──
    const offCreated = bus.on("task:created", ({ task }) => {
      if (!task.scheduledDate) return;
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
    });

    // ── task:completed → mark linked blocks ✓ ─────────────
    const offCompleted = bus.on("task:completed", ({ taskId }) => {
      for (const b of blocks.filter((b) => b.taskId === taskId)) {
        void updateBlock(b.id, {
          color: "#6b7280",
          title: `✓ ${b.title.replace(/^[✓✗]\s*/, "")}`,
        });
      }
    });

    // ── task:cancelled → mark linked blocks ✗ ─────────────
    const offCancelled = bus.on("task:cancelled", ({ taskId }) => {
      for (const b of blocks.filter((b) => b.taskId === taskId)) {
        void updateBlock(b.id, {
          color: "#ef4444",
          title: `✗ ${b.title.replace(/^[✓✗]\s*/, "")}`,
        });
      }
    });

    // ── task:deleted → remove linked blocks ───────────────
    const offDeleted = bus.on("task:deleted", ({ taskId }) => {
      for (const b of blocks.filter((b) => b.taskId === taskId)) {
        void deleteBlock(b.id);
      }
    });

    return () => {
      offCreated();
      offCompleted();
      offCancelled();
      offDeleted();
    };
  }, [blocks, createBlock, updateBlock, deleteBlock]);
}

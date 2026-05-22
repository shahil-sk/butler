// ============================================================
// PROJECTS — EVENT BUS LISTENERS
// Wire projects module to task/focus/time events.
// Call useProjectEventListeners() from the Projects UI component.
// Projects was previously completely dark to the integration layer.
// ============================================================

import { useEffect } from "react";
import { bus } from "@/kernel/event-bus";
import { useProjectStore } from "./store";

export function useProjectEventListeners() {
  const getProjectById = useProjectStore((s) => s.getProjectById);
  const updateProject  = useProjectStore((s) => s.updateProject);

  useEffect(() => {
    // ── project:health-changed → mark project at-risk or done ─
    const offHealth = bus.on("project:health-changed", ({ projectId, allTasksDone }) => {
      const project = getProjectById(projectId);
      if (!project) return;
      if (allTasksDone && project.status === "active") {
        void updateProject(projectId, { status: "completed" });
        bus.emit("project:updated", {
          project: { ...project, status: "completed" },
          changed: { status: "completed" },
        });
      }
    });

    // ── task:created (projectId) → emit project:updated so list re-renders ──
    const offTaskCreated = bus.on("task:created", ({ task }) => {
      if (!task.projectId) return;
      const project = getProjectById(task.projectId);
      if (project) {
        bus.emit("project:updated", { project, changed: {} });
      }
    });

    // ── focus:session-completed → project activity signal ───
    const offFocusCompleted = bus.on("focus:session-completed", ({ session }) => {
      if (!session.projectId) return;
      const project = getProjectById(session.projectId);
      if (project) {
        bus.emit("project:updated", { project, changed: {} });
      }
    });

    return () => {
      offHealth();
      offTaskCreated();
      offFocusCompleted();
    };
  }, [getProjectById, updateProject]);
}

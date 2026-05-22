// ============================================================
// PROJECTS — EVENT BUS LISTENERS
// Wire projects module to task/focus/time events.
// Call useProjectEventListeners() from the Projects UI component.
// Projects was previously completely dark to the integration layer.
// ============================================================

import { bus } from "@/kernel/event-bus";
import { useProjectStore } from "./store";

export function setupProjectEventListeners(): () => void {
  const getProjectById = useProjectStore.getState().getProjectById;
  const updateProject  = useProjectStore.getState().updateProject;

  const unsubs: Array<() => void> = [];

  // ── project:health-changed → mark project at-risk or done ─
  unsubs.push(
    bus.on("project:health-changed", ({ projectId, allTasksDone }) => {
      const project = getProjectById(projectId);
      if (!project) return;
      if (allTasksDone && project.status === "active") {
        void updateProject(projectId, { status: "completed" });
        bus.emit("project:updated", {
          project: { ...project, status: "completed" },
          changed: { status: "completed" },
        });
      }
    })
  );

  // ── task:created (projectId) → emit project:updated so list re-renders ──
  unsubs.push(
    bus.on("task:created", ({ task }) => {
      if (!task.projectId) return;
      const project = getProjectById(task.projectId);
      if (project) {
        bus.emit("project:updated", { project, changed: {} });
      }
    })
  );

  // ── focus:session-completed → project activity signal ───
  unsubs.push(
    bus.on("focus:session-completed", ({ session }) => {
      if (!session.projectId) return;
      const project = getProjectById(session.projectId);
      if (project) {
        bus.emit("project:updated", { project, changed: {} });
      }
    })
  );

  return () => unsubs.forEach((u) => u());
}

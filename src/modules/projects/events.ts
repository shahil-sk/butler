// ============================================================
// PROJECTS MODULE — EVENTS
// Cross-module reactions to project lifecycle events.
// ============================================================

import { bus } from "@/kernel/event-bus";
import { useProjectStore } from "./store";
import { useCalendarStore } from "@/modules/calendar/store";
import type { Milestone } from "@/shared/types";

export function setupProjectEventListeners(): () => void {
  const unsubs: Array<() => void> = [];

  // ── Search: invalidate index on project mutations ─────────
  unsubs.push(
    bus.on("project:created", ({ project }) => {
      bus.emit("search:index-invalidated", { entityType: "project", id: project.id });
    })
  );

  unsubs.push(
    bus.on("project:updated", ({ project }) => {
      bus.emit("search:index-invalidated", { entityType: "project", id: project.id });
    })
  );

  unsubs.push(
    bus.on("project:deleted", ({ projectId }) => {
      bus.emit("search:index-invalidated", { entityType: "project", id: projectId });
    })
  );

  // ── Search: navigate on result selected ───────────────────
  unsubs.push(
    bus.on("search:result-selected", ({ result }) => {
      if (result.type === "project") {
        bus.emit("project:open", { projectId: result.id });
        bus.emit("navigate:to", { path: `/projects/${result.id}` });
      }
    })
  );

  // ── Goal deleted → unlink from projects ──────────────────
  unsubs.push(
    bus.on("goal:deleted", ({ goalId }) => {
      const store = useProjectStore.getState();
      const affected = store.projects.filter((p) => p.goalId === goalId);
      affected.forEach((p) => store.updateProject(p.id, { goalId: undefined }));
    })
  );

  // ── Sync milestones to calendar ──────────────────────────
  unsubs.push(
    bus.on("project:updated", async ({ project, changed }) => {
      if (!changed.milestones) return;
      
      const currentMilestones = project.milestones || [];
      const calendarStore = useCalendarStore.getState();
      let needsProjectUpdate = false;
      const updatedMilestones: Milestone[] = [...currentMilestones];

      for (let i = 0; i < updatedMilestones.length; i++) {
        const ms = updatedMilestones[i];
        
        if (!ms.calendarEventId && ms.dueDate) {
          const event = await calendarStore.createEvent({
            title: `Milestone: ${ms.title}`,
            startAt: ms.dueDate,
            endAt: ms.dueDate,
            isAllDay: true,
            allDay: true,
            projectId: project.id,
            category: "milestone",
            externalId: ms.id,
            color: project.color,
          });
          updatedMilestones[i] = { ...ms, calendarEventId: event.id };
          needsProjectUpdate = true;
        } else if (ms.calendarEventId) {
          const existingEvent = calendarStore.events.find(e => e.id === ms.calendarEventId);
          if (existingEvent) {
            if (existingEvent.startAt !== ms.dueDate || existingEvent.title !== `Milestone: ${ms.title}`) {
              await calendarStore.updateEvent(ms.calendarEventId, {
                startAt: ms.dueDate,
                endAt: ms.dueDate,
                title: `Milestone: ${ms.title}`,
              });
            }
          }
        }
      }

      if (needsProjectUpdate) {
        // Will loop once, but next time calendarEventId is present
        void useProjectStore.getState().updateProject(project.id, { milestones: updatedMilestones });
      }
    })
  );

  unsubs.push(
    bus.on("calendar:event-updated", async ({ event }) => {
      if (event.category === "milestone" && event.projectId && event.externalId) {
        const project = useProjectStore.getState().getProjectById(event.projectId);
        if (!project) return;
        const ms = project.milestones.find(m => m.id === event.externalId);
        if (ms && ms.dueDate !== event.startAt) {
          void useProjectStore.getState().updateMilestone(project.id, ms.id, {
            dueDate: event.startAt,
          });
        }
      }
    })
  );

  return () => unsubs.forEach((u) => u());
}

// ============================================================
// BUTLER — INTEGRATION LAYER
// Wires all cross-module bus events in one place.
// Mounted once in Shell. No UI — pure side effects.
// Rule: never import module components. Only stores + bus.
// ============================================================

import { useEffect } from "react";
import { bus } from "@/kernel/event-bus";
import { useTaskStore } from "@/modules/tasks/store";
import { useProjectStore } from "@/modules/projects/store";
import { useNoteStore } from "@/modules/notes/store";
import { useCalendarStore } from "@/modules/calendar/store";
import { useJournalStore } from "@/modules/journal/store";
import { useFocusStore } from "@/modules/focus/store";
import { useShellStore } from "@/shell/store";

export function IntegrationLayer() {
  useEffect(() => {
    const unsubs: Array<() => void> = [];
    const notify = useShellStore.getState().notify;

    // =========================================================
    // TASKS ↔ PROJECTS
    // =========================================================

    // project:deleted → archive all its tasks
    unsubs.push(bus.on("project:deleted", ({ projectId }) => {
      const tasks = useTaskStore.getState().tasks.filter(
        (t) => t.projectId === projectId && t.status !== "archived"
      );
      tasks.forEach((t) => void useTaskStore.getState().archiveTask(t.id));
      if (tasks.length > 0) {
        notify({
          type: "info",
          message: `${tasks.length} task${tasks.length > 1 ? "s" : ""} archived with project.`,
          durationMs: 4000,
        });
      }
    }));

    // task:completed → milestone check + journal link + toast
    unsubs.push(bus.on("task:completed", ({ taskId, completedAt }) => {
      // ① Milestone auto-complete
      const projects = useProjectStore.getState().projects;
      projects.forEach((project) => {
        project.milestones.forEach((milestone) => {
          if (!milestone.completedAt && milestone.linkedTaskIds.includes(taskId)) {
            const allDone = milestone.linkedTaskIds.every((tid) => {
              const t = useTaskStore.getState().tasks.find((x) => x.id === tid);
              return !t || t.status === "done";
            });
            if (allDone) {
              void useProjectStore.getState().completeMilestone(project.id, milestone.id);
              notify({
                type: "success",
                message: `Milestone "${milestone.title}" completed!`,
                durationMs: 4000,
              });
            }
          }
        });
      });

      // ② Toast
      const task = useTaskStore.getState().tasks.find((t) => t.id === taskId);
      if (task) {
        notify({ type: "success", message: `"${task.title}" completed`, durationMs: 2500 });
      }

      // ③ Real-time link to today's open daily journal entry
      const date = completedAt.slice(0, 10);
      const daily = useJournalStore.getState().entries.find(
        (e) => e.type === "daily" && e.date === date
      );
      if (daily && !daily.linkedTaskIds.includes(taskId)) {
        void useJournalStore.getState().linkTask(daily.id, taskId);
      }
    }));

    // =========================================================
    // TASKS ↔ NOTES
    // =========================================================

    unsubs.push(bus.on("note:link-to-task", ({ noteId, taskId }) => {
      const task = useTaskStore.getState().getTaskById(taskId);
      if (!task) return;
      if (task.linkedNoteIds.includes(noteId)) return;
      void useTaskStore.getState().updateTask(taskId, {
        linkedNoteIds: [...task.linkedNoteIds, noteId],
      });
    }));

    unsubs.push(bus.on("note:deleted", ({ noteId }) => {
      const affectedTasks = useTaskStore.getState().tasks.filter(
        (t) => t.linkedNoteIds.includes(noteId)
      );
      affectedTasks.forEach((t) =>
        void useTaskStore.getState().updateTask(t.id, {
          linkedNoteIds: t.linkedNoteIds.filter((id) => id !== noteId),
        })
      );
    }));

    // =========================================================
    // TASKS ↔ CALENDAR
    // =========================================================

    unsubs.push(bus.on("calendar:event-created", ({ event }) => {
      event.linkedTaskIds.forEach((taskId) => {
        const task = useTaskStore.getState().getTaskById(taskId);
        if (!task) return;
        if (task.linkedEventIds.includes(event.id)) return;
        void useTaskStore.getState().updateTask(taskId, {
          linkedEventIds: [...task.linkedEventIds, event.id],
        });
      });
    }));

    unsubs.push(bus.on("calendar:event-deleted", ({ eventId }) => {
      const affected = useTaskStore.getState().tasks.filter(
        (t) => t.linkedEventIds.includes(eventId)
      );
      affected.forEach((t) =>
        void useTaskStore.getState().updateTask(t.id, {
          linkedEventIds: t.linkedEventIds.filter((id) => id !== eventId),
        })
      );
    }));

    // =========================================================
    // NOTES ↔ PROJECTS
    // =========================================================

    unsubs.push(bus.on("note:created", ({ note }) => {
      note.linkedProjectIds.forEach((projectId) => {
        const project = useProjectStore.getState().getProjectById(projectId);
        if (!project) return;
        if (project.linkedNoteIds.includes(note.id)) return;
        void useProjectStore.getState().updateProject(projectId, {
          linkedNoteIds: [...project.linkedNoteIds, note.id],
        });
      });
    }));

    unsubs.push(bus.on("note:deleted", ({ noteId }) => {
      const affectedProjects = useProjectStore.getState().projects.filter(
        (p) => p.linkedNoteIds.includes(noteId)
      );
      affectedProjects.forEach((p) =>
        void useProjectStore.getState().updateProject(p.id, {
          linkedNoteIds: p.linkedNoteIds.filter((id) => id !== noteId),
        })
      );
    }));

    // =========================================================
    // NOTES ↔ CALENDAR
    // =========================================================

    unsubs.push(bus.on("note:updated", ({ note }) => {
      note.linkedEventIds.forEach((eventId) => {
        const event = useCalendarStore.getState().events.find((e) => e.id === eventId);
        if (!event) return;
        if (event.linkedNoteIds.includes(note.id)) return;
        void useCalendarStore.getState().updateEvent(eventId, {
          linkedNoteIds: [...event.linkedNoteIds, note.id],
        });
      });
    }));

    // =========================================================
    // JOURNAL ↔ TASKS
    // =========================================================

    unsubs.push(bus.on("journal:entry-created", ({ entry }) => {
      if (entry.type !== "daily") return;
      const completedToday = useTaskStore.getState().tasks.filter(
        (t) => t.completedAt?.startsWith(entry.date)
      );
      completedToday.forEach((t) => {
        void useJournalStore.getState().linkTask(entry.id, t.id);
      });
      if (completedToday.length > 0) {
        notify({
          type: "info",
          message: `${completedToday.length} completed task${completedToday.length > 1 ? "s" : ""} linked to journal`,
          durationMs: 3000,
        });
      }
    }));

    // =========================================================
    // JOURNAL ↔ PROJECTS
    // =========================================================

    unsubs.push(bus.on("project:deleted", ({ projectId }) => {
      const affected = useJournalStore.getState().entries.filter(
        (e) => e.linkedProjectIds.includes(projectId)
      );
      affected.forEach((e) =>
        void useJournalStore.getState().updateEntry(e.id, {
          linkedProjectIds: e.linkedProjectIds.filter((id) => id !== projectId),
        })
      );
    }));

    // =========================================================
    // JOURNAL ↔ NOTES
    // =========================================================

    unsubs.push(bus.on("journal:open-date", ({ date }) => {
      const existing = useNoteStore.getState().notes.find(
        (n) => n.type === "daily" && n.date === date
      );
      if (!existing) {
        void useNoteStore.getState().createNote({
          type:  "daily",
          date,
          title: `Daily — ${date}`,
        });
      }
    }));

    // =========================================================
    // FOCUS ↔ TASKS
    // =========================================================

    // focus:session-completed → update task.actualMinutes
    unsubs.push(bus.on("focus:session-completed", ({ session }) => {
      if (!session.taskId) return;
      const task = useTaskStore.getState().getTaskById(session.taskId);
      if (!task) return;
      const mins = session.actualMinutes ?? session.plannedMinutes;
      void useTaskStore.getState().updateTask(session.taskId, {
        actualMinutes: (task.actualMinutes ?? 0) + mins,
      });
    }));

    // focus:session-completed → if task has estimateMinutes, warn over/under
    unsubs.push(bus.on("focus:session-completed", ({ session }) => {
      if (!session.taskId) return;
      const task = useTaskStore.getState().getTaskById(session.taskId);
      if (!task?.estimateMinutes) return;

      // Sum ALL completed focus sessions for this task
      const allSessions = useFocusStore.getState().sessions;
      const totalActual = allSessions
        .filter(
          (s) =>
            s.taskId === session.taskId &&
            s.type === "focus" &&
            s.actualMinutes
        )
        .reduce((a, s) => a + (s.actualMinutes ?? 0), 0);

      const estimate = task.estimateMinutes;
      if (totalActual > estimate * 1.2) {
        notify({
          type: "warning",
          message: `"${task.title}" is ${Math.round(totalActual - estimate)}m over estimate.`,
          durationMs: 6000,
        });
      } else if (totalActual >= estimate * 0.8 && totalActual <= estimate) {
        notify({
          type: "info",
          message: `"${task.title}" on track — ${Math.round(estimate - totalActual)}m remaining in estimate.`,
          durationMs: 4000,
        });
      }
    }));

    // =========================================================
    // FOCUS ↔ JOURNAL
    // =========================================================

    // focus:session-completed → link session's task to today's daily journal
    unsubs.push(bus.on("focus:session-completed", ({ session }) => {
      if (!session.taskId) return;
      const todayStr = new Date().toISOString().slice(0, 10);
      const daily = useJournalStore.getState().entries.find(
        (e) => e.type === "daily" && e.date === todayStr
      );
      if (daily && !daily.linkedTaskIds.includes(session.taskId)) {
        void useJournalStore.getState().linkTask(daily.id, session.taskId);
      }
    }));

    // focus:session-completed → open/ensure today's daily journal exists
    unsubs.push(bus.on("focus:session-completed", ({ session }) => {
      if (session.type !== "focus") return;
      const todayStr = new Date().toISOString().slice(0, 10);
      // Ensure daily journal entry exists (IntegrationLayer creates it via journal:open-date)
      bus.emit("journal:open-date", { date: todayStr });
    }));

    // =========================================================
    // FOCUS ↔ PROJECTS
    // =========================================================

    // focus:session-completed → check milestone completion for linked project
    unsubs.push(bus.on("focus:session-completed", ({ session }) => {
      if (!session.taskId || !session.projectId) return;
      const project = useProjectStore.getState().getProjectById(session.projectId);
      if (!project) return;

      project.milestones.forEach((milestone) => {
        if (milestone.completedAt) return;
        if (!milestone.linkedTaskIds.includes(session.taskId!)) return;
        const allDone = milestone.linkedTaskIds.every((tid) => {
          const t = useTaskStore.getState().tasks.find((x) => x.id === tid);
          return !t || t.status === "done";
        });
        if (allDone) {
          void useProjectStore.getState().completeMilestone(project.id, milestone.id);
          notify({
            type: "success",
            message: `Milestone "${milestone.title}" completed!`,
            durationMs: 4000,
          });
        }
      });
    }));

    // =========================================================
    // FOCUS — TOAST & NOTIFICATIONS
    // =========================================================

    unsubs.push(bus.on("focus:session-completed", ({ session }) => {
      if (session.type !== "focus") return;
      const mins = session.actualMinutes ?? session.plannedMinutes;
      const taskTitle = session.taskId
        ? useTaskStore.getState().getTaskById(session.taskId)?.title
        : null;
      const interrupts = session.interruptCount ?? 0;

      let msg = `Focus session complete — ${mins}m logged.`;
      if (taskTitle) msg += ` Task: "${taskTitle}".`;
      if (interrupts > 0) msg += ` ${interrupts} interruption${interrupts > 1 ? "s" : ""}.`;

      notify({ type: "success", message: msg, durationMs: 6000 });
    }));

    // =========================================================
    // SEARCH INVALIDATION
    // =========================================================

    unsubs.push(bus.on("search:result-selected", ({ result }) => {
      switch (result.type) {
        case "task":
          bus.emit("task:open", { taskId: result.id });
          break;
        case "note":
          bus.emit("note:open", { noteId: result.id });
          bus.emit("navigate:to", { path: "/notes" });
          break;
        case "project":
          bus.emit("project:open", { projectId: result.id });
          bus.emit("navigate:to", { path: "/projects" });
          break;
        case "event":
          bus.emit("navigate:to", { path: "/calendar" });
          break;
        case "journal":
          bus.emit("navigate:to", { path: "/journal" });
          break;
      }
    }));

    // =========================================================
    // GENERAL NOTIFICATIONS
    // =========================================================

    unsubs.push(bus.on("task:created", ({ task }) => {
      notify({ type: "success", message: `Task created: "${task.title}"`, durationMs: 2000 });
    }));

    unsubs.push(bus.on("project:created", ({ project }) => {
      notify({ type: "success", message: `Project "${project.name}" created`, durationMs: 2000 });
    }));

    unsubs.push(bus.on("note:created", ({ note }) => {
      notify({ type: "success", message: `Note "${note.title}" created`, durationMs: 1500 });
    }));

    return () => unsubs.forEach((u) => u());
  }, []);

  return null;
}

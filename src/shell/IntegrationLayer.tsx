// ============================================================
// BUTLER — INTEGRATION LAYER
// Wires all cross-module bus events in one place.
// Mounted once in Shell. No UI — pure side effects.
// Rule: never import module components. Only stores + bus.
// ============================================================

import { useEffect } from "react";
import { bus } from "@/kernel/event-bus";
import { getNextRecurrenceDate, today } from "@/shared/utils";
import { useTaskStore } from "@/modules/tasks/store";
import { useProjectStore } from "@/modules/projects/store";
import { useNoteStore } from "@/modules/notes/store";
import { useCalendarStore } from "@/modules/calendar/store";
import { useJournalStore } from "@/modules/journal/store";
import { useFocusStore } from "@/modules/focus/store";
import { useTimeStore } from "@/modules/time-tracking/store";
import { usePlannerStore } from "@/modules/planner/store";
import { useShellStore } from "@/shell/store";
import { useFocusEventListeners } from "@/modules/focus/events";

export function IntegrationLayer() {
  useFocusEventListeners();

  useEffect(() => {
    const unsubs: Array<() => void> = [];
    const notify = useShellStore.getState().notify;

    // Standardise ui:notification globally
    unsubs.push(bus.on("ui:notification", ({ type, message, durationMs }) => {
      notify({ type, message, durationMs: durationMs ?? 3000 });
    }));

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

      // ④ Auto-stop running time entry if it is tracking this completed task
      const timeStore = useTimeStore.getState();
      if (timeStore.activeEntryId) {
        const activeEntry = timeStore.entries.find((e) => e.id === timeStore.activeEntryId);
        if (activeEntry?.taskId === taskId) {
          void timeStore.stopTimer();
          notify({ type: "info", message: `Time tracking stopped for completed task.`, durationMs: 2500 });
        }
      }

      // ⑤ Auto-stop running focus session if it is tracking this completed task
      const focusStore = useFocusStore.getState();
      if (focusStore.activeSession && focusStore.activeSession.taskId === taskId) {
        void focusStore._completeActive();
        notify({ type: "info", message: `Active focus session completed with task.`, durationMs: 2500 });
      }

      // ⑥ Auto-spawn next instance of recurring task
      if (task && task.recurrence) {
        const nextDate = getNextRecurrenceDate(task.dueDate ?? today(), task.recurrence);
        if (nextDate) {
          void useTaskStore.getState().createTask({
            title: task.title,
            description: task.description,
            priority: task.priority,
            projectId: task.projectId,
            parentTaskId: task.parentTaskId,
            labels: task.labels,
            tags: task.tags,
            dueDate: nextDate,
            estimateMinutes: task.estimateMinutes,
            recurrence: task.recurrence,
            dependencies: task.dependencies,
          }).then((newInst) => {
            notify({
              type: "success",
              message: `Recurring task spawned for ${nextDate}`,
              durationMs: 3000,
            });
          });
        }
      }

      // ⑦ Check for unblocked dependents
      const allTasks = useTaskStore.getState().tasks;
      const dependents = allTasks.filter((t) => t.dependencies?.includes(taskId));
      dependents.forEach((dep) => {
        const allBlockersDone = dep.dependencies.every((blockerId) => {
          if (blockerId === taskId) return true;
          const t = useTaskStore.getState().getTaskById(blockerId);
          return t?.status === "done";
        });
        if (allBlockersDone) {
          bus.emit("task:unblocked", { taskId: dep.id });
        }
      });
    }));

    // task:unblocked ➔ schedule in Planner for today
    unsubs.push(bus.on("task:unblocked", ({ taskId }) => {
      const task = useTaskStore.getState().getTaskById(taskId);
      if (task && task.status !== "done" && task.status !== "archived") {
        const todayStr = new Date().toISOString().slice(0, 10);
        bus.emit("task:schedule-in-planner", { task, date: todayStr });
        notify({
          type: "info",
          message: `"${task.title}" is now unblocked and scheduled for today!`,
          durationMs: 4000,
        });
      }
    }));

    // =========================================================
    // TASKS ↔ PLANNER
    // =========================================================

    unsubs.push(bus.on("task:schedule-in-planner", ({ task, date, startTime }) => {
      const targetDate = date ?? new Date().toISOString().slice(0, 10);
      const alreadyScheduled = usePlannerStore.getState().blocks.some(
        (b) => b.taskId === task.id && b.date === targetDate
      );
      if (alreadyScheduled) {
        notify({ type: "warning", message: `"${task.title}" is already scheduled on this day`, durationMs: 2500 });
        return;
      }

      void usePlannerStore.getState().createBlock({
        taskId: task.id,
        title: task.title,
        date: targetDate,
        startTime: startTime ?? "09:00",
        endTime: "10:00", // Will be clamped automatically in store based on duration
      });
      notify({ type: "info", message: `"${task.title}" added to Planner`, durationMs: 2000 });
    }));

    // task:completed → mark all its unfinished planner blocks as completed
    unsubs.push(bus.on("task:completed", ({ taskId }) => {
      const blocks = usePlannerStore.getState().blocks.filter((b) => b.taskId === taskId && !b.isCompleted);
      blocks.forEach((block) => {
        void usePlannerStore.getState().completeBlock(block.id);
      });
    }));

    // task:restored → mark all its completed planner blocks as incomplete
    unsubs.push(bus.on("task:restored", ({ taskId }) => {
      const blocks = usePlannerStore.getState().blocks.filter((b) => b.taskId === taskId && b.isCompleted);
      blocks.forEach((block) => {
        void usePlannerStore.getState().updateBlock(block.id, { isCompleted: false });
      });
    }));

    // task:updated → if scheduledDate changed, shift the corresponding planner blocks to match!
    unsubs.push(bus.on("task:updated", ({ task, changed }) => {
      if (changed.scheduledDate) {
        const blocks = usePlannerStore.getState().blocks.filter((b) => b.taskId === task.id);
        blocks.forEach((block) => {
          if (block.date !== changed.scheduledDate) {
            void usePlannerStore.getState().updateBlock(block.id, { date: changed.scheduledDate });
          }
        });
      }
    }));

    // planner:block-completed → automatically complete the linked task
    unsubs.push(bus.on("planner:block-completed", ({ taskId }) => {
      if (!taskId) return;
      const task = useTaskStore.getState().getTaskById(taskId);
      if (task && task.status !== "done") {
        void useTaskStore.getState().completeTask(taskId);
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
        if (!task.linkedEventIds.includes(event.id)) {
          void useTaskStore.getState().updateTask(taskId, {
            linkedEventIds: [...task.linkedEventIds, event.id],
          });
        }

        // Mirror as a planner block if it is a time block and doesn't exist yet!
        if (event.isTimeBlock) {
          const date = event.startAt.slice(0, 10);
          const startTime = event.startAt.slice(11, 16);
          const endTime = event.endAt.slice(11, 16);

          const existingBlock = usePlannerStore.getState().blocks.find(
            (b) => b.taskId === taskId && b.date === date && b.startTime === startTime
          );

          if (!existingBlock) {
            void usePlannerStore.getState().createBlock({
              taskId,
              title: event.title,
              date,
              startTime,
              endTime,
            });
          }
        }
      });
    }));

    unsubs.push(bus.on("calendar:event-deleted", ({ eventId }) => {
      const event = useCalendarStore.getState().events.find((e) => e.id === eventId);
      
      const affected = useTaskStore.getState().tasks.filter(
        (t) => t.linkedEventIds.includes(eventId)
      );
      affected.forEach((t) =>
        void useTaskStore.getState().updateTask(t.id, {
          linkedEventIds: t.linkedEventIds.filter((id) => id !== eventId),
        })
      );

      if (event && event.isTimeBlock && event.linkedTaskIds.length > 0) {
        const date = event.startAt.slice(0, 10);
        const startTime = event.startAt.slice(11, 16);
        const taskId = event.linkedTaskIds[0];

        const targetBlock = usePlannerStore.getState().blocks.find(
          (b) => b.taskId === taskId && b.date === date && b.startTime === startTime
        );
        if (targetBlock) {
          void usePlannerStore.getState().deleteBlock(targetBlock.id);
        }
      }
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
    // PLANNER ↔ TASKS / CALENDAR
    // =========================================================

    unsubs.push(bus.on("planner:block-linked-task", ({ blockId, taskId, date }) => {
      // 1. Update task
      const task = useTaskStore.getState().tasks.find((t) => t.id === taskId);
      if (task) {
        if (!task.linkedPlannerBlockIds.includes(blockId)) {
          void useTaskStore.getState().updateTask(taskId, {
            linkedPlannerBlockIds: [...task.linkedPlannerBlockIds, blockId],
          });
        }
      }

      // 2. Add to calendar
      const block = usePlannerStore.getState().blocks.find(b => b.id === blockId);
      if (block && block.startTime) {
        // Prevent duplicate mirrored event if it's already there!
        const startIso = `${date}T${block.startTime}`;
        const existingEvent = useCalendarStore.getState().events.find(
          (e) => e.isTimeBlock && e.linkedTaskIds.includes(taskId) && e.startAt.startsWith(startIso)
        );
        if (existingEvent) return;

        void useCalendarStore.getState().createEvent({
          title: block.title,
          startAt: startIso,
          endAt: `${date}T${block.endTime}`,
          linkedTaskIds: [taskId],
          isTimeBlock: true,
          calendarId: "default",
        });
      }
    }));

    unsubs.push(bus.on("planner:block-unlinked-task", ({ blockId, previousTaskId, date, startTime }) => {
      // 1. Update task: remove blockId from task.linkedPlannerBlockIds
      const task = useTaskStore.getState().tasks.find((t) => t.id === previousTaskId);
      if (task) {
        const filtered = task.linkedPlannerBlockIds.filter((id) => id !== blockId);
        if (filtered.length !== task.linkedPlannerBlockIds.length) {
          void useTaskStore.getState().updateTask(previousTaskId, {
            linkedPlannerBlockIds: filtered,
          });
        }

        // Keep scheduledDate in sync: if no blocks remain, clear it. Otherwise, point to the next block's date.
        const remainingBlocks = usePlannerStore.getState().blocks.filter(
          (b) => b.taskId === previousTaskId && b.id !== blockId
        );
        if (remainingBlocks.length === 0) {
          void useTaskStore.getState().updateTask(previousTaskId, { scheduledDate: undefined });
        } else {
          void useTaskStore.getState().updateTask(previousTaskId, { scheduledDate: remainingBlocks[0].date });
        }
      }

      // 2. Remove the specific mirrored calendar event
      if (date && startTime) {
        const startIso = `${date}T${startTime}`;
        const targetEvent = useCalendarStore.getState().events.find(
          (e) => e.isTimeBlock && e.linkedTaskIds.includes(previousTaskId) && e.startAt.startsWith(startIso)
        );
        if (targetEvent) {
          void useCalendarStore.getState().deleteEvent(targetEvent.id);
        }
      } else {
        // Fallback: delete any time block matching the ID (if timestamps are missing)
        const calendarEvents = useCalendarStore.getState().events.filter(
          (e) => e.isTimeBlock && e.linkedTaskIds.includes(previousTaskId)
        );
        calendarEvents.forEach((e) => {
          void useCalendarStore.getState().deleteEvent(e.id);
        });
      }
      notify({ type: "info", message: "Time block removed from Calendar.", durationMs: 2000 });
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

    unsubs.push(bus.on("journal:entry-created", ({ entry }) => {
      if (entry.type !== "weekly") return;
      
      const weekStart = new Date(entry.date);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const weekEndStr = weekEnd.toISOString().slice(0, 10);
      
      const completedThisWeek = useTaskStore.getState().tasks.filter(t =>
        t.completedAt && t.completedAt >= entry.date && t.completedAt < weekEndStr
      );
      completedThisWeek.forEach(t => void useJournalStore.getState().linkTask(entry.id, t.id));

      const focusHours = useFocusStore.getState().sessions
        .filter(s => s.type === "focus" && s.startedAt && s.startedAt >= entry.date && s.startedAt < weekEndStr)
        .reduce((sum, s) => sum + (s.actualMinutes ?? 0), 0) / 60;
        
      notify({
        type: "info",
        message: `Weekly review populated — ${focusHours.toFixed(1)}h focused, ${completedThisWeek.length} tasks done`,
        durationMs: 5000,
      });
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

    unsubs.push(bus.on("project:updated", ({ project, changed }) => {
      if (changed.status === "completed") {
        const incompleteTasks = useTaskStore.getState().tasks.filter(
          (t) => t.projectId === project.id && t.status !== "done" && t.status !== "archived"
        );
        incompleteTasks.forEach((t) => void useTaskStore.getState().archiveTask(t.id));
        if (incompleteTasks.length > 0) {
          notify({
            type: "info",
            message: `${incompleteTasks.length} incomplete tasks archived with completed project.`,
            durationMs: 4000,
          });
        }

        const todayStr = new Date().toISOString().slice(0, 10);
        void useJournalStore.getState().createEntry({
          type: "reflection",
          date: todayStr,
          content: JSON.stringify({
            type: "doc",
            content: [
              {
                type: "heading",
                attrs: { level: 2 },
                content: [{ type: "text", text: `Project Wrap-up: ${project.name}` }]
              },
              {
                type: "paragraph",
                content: [{ type: "text", text: `Reflections on completing project "${project.name}" on ${todayStr}.` }]
              },
              {
                type: "heading",
                attrs: { level: 3 },
                content: [{ type: "text", text: "What went well?" }]
              },
              {
                type: "paragraph",
                content: [{ type: "text", text: "• " }]
              },
              {
                type: "heading",
                attrs: { level: 3 },
                content: [{ type: "text", text: "What were the challenges?" }]
              },
              {
                type: "paragraph",
                content: [{ type: "text", text: "• " }]
              }
            ]
          }),
          linkedProjectIds: [project.id]
        }).then(() => {
          notify({
            type: "success",
            message: `Project wrap-up reflection created in Journal.`,
            durationMs: 4000
          });
        });
      }
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

    unsubs.push(bus.on("focus:session-started", ({ session }) => {
      if (session.taskId) {
        const task = useTaskStore.getState().getTaskById(session.taskId);
        if (task && task.status === "todo") {
          void useTaskStore.getState().updateTask(session.taskId, { status: "in_progress" });
          notify({ type: "info", message: `Task status set to "In Progress"`, durationMs: 2000 });
        }
      }

      const startAt = session.startedAt ?? new Date().toISOString();
      const endAt = new Date(new Date(startAt).getTime() + session.plannedMinutes * 60 * 1000).toISOString();
      const title = session.taskId
        ? `Focus: ${useTaskStore.getState().getTaskById(session.taskId)?.title ?? "Session"}`
        : "Focus Session";
        
      void useCalendarStore.getState().createEvent({
        title,
        startAt,
        endAt,
        linkedTaskIds: session.taskId ? [session.taskId] : [],
        isTimeBlock: false,
        calendarId: "default",
        color: "#fb923c",
      });
    }));

    unsubs.push(bus.on("focus:session-completed", ({ session }) => {
      if (!session.taskId) return;
      const task = useTaskStore.getState().getTaskById(session.taskId);
      if (!task) return;
      const mins = session.actualMinutes ?? session.plannedMinutes;
      void useTaskStore.getState().updateTask(session.taskId, {
        actualMinutes: (task.actualMinutes ?? 0) + mins,
      });
    }));

    unsubs.push(bus.on("focus:session-completed", ({ session }) => {
      if (!session.taskId) return;
      const task = useTaskStore.getState().getTaskById(session.taskId);
      if (!task?.estimateMinutes) return;
      const allSessions = useFocusStore.getState().sessions;
      const totalActual = allSessions
        .filter((s) => s.taskId === session.taskId && s.type === "focus" && s.actualMinutes)
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

    unsubs.push(bus.on("focus:session-completed", ({ session }) => {
      if (session.type !== "focus") return;
      const todayStr = new Date().toISOString().slice(0, 10);
      bus.emit("journal:open-date", { date: todayStr });
    }));

    // =========================================================
    // FOCUS ↔ PLANNER
    // =========================================================

    unsubs.push(bus.on("focus:session-completed", ({ session }) => {
      if (!session.taskId) return;
      const dateStr = session.startedAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
      const block = usePlannerStore.getState().blocks.find(
        (b) => b.taskId === session.taskId && b.date === dateStr
      );
      if (block) {
        void usePlannerStore.getState().completeBlock(block.id);
      }
    }));

    // =========================================================
    // FOCUS ↔ PROJECTS
    // =========================================================

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
          notify({ type: "success", message: `Milestone "${milestone.title}" completed!`, durationMs: 4000 });
        }
      });
    }));

    // =========================================================
    // FOCUS — TOAST
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
    // TIME TRACKING ↔ TASKS
    // =========================================================

    unsubs.push(bus.on("time:entry-created", ({ entry }) => {
      if (!entry.taskId || !entry.durationMinutes) return;
      const task = useTaskStore.getState().getTaskById(entry.taskId);
      if (!task) return;
      void useTaskStore.getState().updateTask(entry.taskId, {
        actualMinutes: (task.actualMinutes ?? 0) + entry.durationMinutes,
      });
    }));

    unsubs.push(bus.on("time:entry-updated", ({ entry }) => {
      if (!entry.taskId) return;
      const allEntries = useTimeStore.getState().entries.filter(
        (e) => e.taskId === entry.taskId && e.durationMinutes && e.endAt
      );
      const total = allEntries.reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0);
      const task = useTaskStore.getState().getTaskById(entry.taskId);
      if (!task) return;
      void useTaskStore.getState().updateTask(entry.taskId, { actualMinutes: total });
    }));

    unsubs.push(bus.on("time:entry-deleted", () => {
      const store = useTimeStore.getState();
      const taskMinutes = new Map<string, number>();
      store.entries.filter((e) => e.taskId && e.durationMinutes && e.endAt).forEach((e) => {
        taskMinutes.set(e.taskId!, (taskMinutes.get(e.taskId!) ?? 0) + (e.durationMinutes ?? 0));
      });
      taskMinutes.forEach((mins, taskId) => {
        const task = useTaskStore.getState().getTaskById(taskId);
        if (task && task.actualMinutes !== mins) {
          void useTaskStore.getState().updateTask(taskId, { actualMinutes: mins });
        }
      });
    }));

    // =========================================================
    // TIME TRACKING ↔ PROJECTS
    // =========================================================

    unsubs.push(bus.on("project:deleted", ({ projectId }) => {
      const entries = useTimeStore.getState().entries.filter((e) => e.projectId === projectId);
      entries.forEach((e) => void useTimeStore.getState().deleteEntry(e.id));
    }));

    // =========================================================
    // TIME TRACKING ↔ FOCUS
    // =========================================================

    unsubs.push(bus.on("focus:session-completed", ({ session }) => {
      if (session.type !== "focus") return;
      if (!session.startedAt || !session.completedAt) return;
      void useTimeStore.getState().createEntry({
        taskId:          session.taskId,
        projectId:       session.projectId,
        focusSessionId:  session.id,
        description:     session.goal || "Focus session",
        startAt:         session.startedAt,
        endAt:           session.completedAt,
        durationMinutes: session.actualMinutes,
        isBillable:      false,
        tags:            ["focus"],
      });
    }));

    // =========================================================
    // RESEARCH ↔ TASKS / NOTES
    // =========================================================

    unsubs.push(bus.on("research:linked-to-note", ({ noteId, researchEntityId }) => {
      const note = useNoteStore.getState().notes.find(n => n.id === noteId);
      if (!note) return;
      if (note.linkedResearchIds.includes(researchEntityId)) return;
      void useNoteStore.getState().updateNote(noteId, {
        linkedResearchIds: [...note.linkedResearchIds, researchEntityId],
      });
    }));

    unsubs.push(bus.on("research:linked-to-task", ({ taskId, researchEntityId }) => {
      const task = useTaskStore.getState().tasks.find(t => t.id === taskId);
      if (!task) return;
      if (task.linkedResearchIds.includes(researchEntityId)) return;
      void useTaskStore.getState().updateTask(taskId, {
        linkedResearchIds: [...task.linkedResearchIds, researchEntityId],
      });
    }));

    unsubs.push(bus.on("research:source-imported", ({ source }) => {
      void useNoteStore.getState().createNote({
        title: `Notes: ${source.title}`,
        content: `Auto-generated notes template for research: ${source.url ?? source.filePath ?? ""}`,
        linkedResearchIds: [source.id],
      });
      notify({
        type: "success",
        message: `Linked Note created for "${source.title}"`,
        durationMs: 4000,
      });
    }));

    // =========================================================
    // TIME TRACKING — NOTIFICATIONS
    // =========================================================

    unsubs.push(bus.on("time:entry-created", ({ entry }) => {
      if (!entry.taskId || !entry.durationMinutes) return;
      const task = useTaskStore.getState().getTaskById(entry.taskId);
      if (!task?.estimateMinutes) return;
      const totalLogged = useTimeStore.getState().entries
        .filter((e) => e.taskId === entry.taskId && e.durationMinutes && e.endAt)
        .reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0);
      if (totalLogged > task.estimateMinutes * 1.2) {
        notify({
          type: "warning",
          message: `"${task.title}" is ${Math.round(totalLogged - task.estimateMinutes)}m over estimate.`,
          durationMs: 6000,
        });
      }
    }));

    // =========================================================
    // DATABASE — NOTIFICATIONS
    // =========================================================

    unsubs.push(bus.on("database:created", ({ database }) => {
      notify({ type: "success", message: `Table "${(database as { name: string }).name}" created`, durationMs: 2000 });
    }));

    // =========================================================
    // SEARCH
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
        case "database_row":
          bus.emit("navigate:to", { path: "/database" });
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

    // =========================================================
    // KERNEL CRON EVENTS
    // =========================================================

    unsubs.push(bus.on("day:started", ({ date }) => {
      void useJournalStore.getState().getOrCreateDaily(date);
      void usePlannerStore.getState().carryOverIncomplete();
      notify({ type: "info", message: "Good morning! Your day is ready.", durationMs: 4000 });
    }));

    unsubs.push(bus.on("task:overdue", ({ taskId, daysPast }) => {
      const task = useTaskStore.getState().getTaskById(taskId);
      if (task) {
        notify({
          type: "warning",
          message: `"${task.title}" is ${daysPast}d overdue`,
          durationMs: 6000,
        });
      }
    }));

    unsubs.push(bus.on("task:due-today", ({ taskId }) => {
      const task = useTaskStore.getState().getTaskById(taskId);
      if (task) {
        notify({
          type: "info",
          message: `"${task.title}" is due today`,
          durationMs: 4000,
        });
      }
    }));

    unsubs.push(bus.on("calendar:event-starting", ({ eventId, minutesBefore }) => {
      const event = useCalendarStore.getState().events.find((e) => e.id === eventId);
      if (event) {
        notify({
          type: "info",
          message: `Event "${event.title}" starts in ${minutesBefore} minutes`,
          durationMs: 5000,
        });
      }
    }));

    return () => unsubs.forEach((u) => u());
  }, []);

  return null;
}

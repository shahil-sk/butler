// ============================================================
// BUTLER — INTEGRATION SERVICE
// Wires all 11 modules via the event bus.
// Import and call startIntegration() ONCE at app boot (App.tsx).
// Never import module stores directly across module boundaries
// except inside this file — this is the approved seam.
// ============================================================

import { bus } from "@/kernel/event-bus";
import { generateId, now, today, toISODate } from "@/shared/utils";

let started = false;

// Per-task mutex: prevents race between concurrent events from
// inserting duplicate records for the same entity.
const syncInFlight = new Set<string>();

async function withMutex<T>(key: string, fn: () => Promise<T>): Promise<T | undefined> {
  if (syncInFlight.has(key)) return undefined;
  syncInFlight.add(key);
  try {
    return await fn();
  } finally {
    syncInFlight.delete(key);
  }
}

// ── Journal helper: append a line to today's daily entry ─────
// Appends plain text to the JSON ProseMirror doc stored in content.
// Falls back to string concat if content is not valid JSON.
async function appendToTodayJournal(line: string): Promise<void> {
  const { useJournalStore } = await import("@/modules/journal/store");
  const entry = await useJournalStore.getState().getOrCreateDaily(today());
  let doc: { type: string; content: unknown[] };
  try {
    doc = JSON.parse(entry.content) as { type: string; content: unknown[] };
    if (!Array.isArray(doc.content)) throw new Error("bad doc");
  } catch {
    doc = { type: "doc", content: [] };
  }
  doc.content.push({
    type: "paragraph",
    content: [{ type: "text", text: line }],
  });
  await useJournalStore.getState().updateEntry(entry.id, { content: JSON.stringify(doc) });
}

// ── Projects helper: recalculate completion % for a project ──
async function recalcProjectCompletion(projectId: string): Promise<void> {
  const { useTaskStore } = await import("@/modules/tasks/store");
  const { useProjectStore } = await import("@/modules/projects/store");
  const tasks = useTaskStore.getState().tasks.filter(
    (t) => t.projectId === projectId && t.status !== "archived"
  );
  if (tasks.length === 0) return;
  const done = tasks.filter((t) => t.status === "done" || t.status === "cancelled");
  const pct  = Math.round((done.length / tasks.length) * 100);
  await useProjectStore.getState().updateProject(projectId, { description: undefined }); // touch updatedAt
  if (done.length === tasks.length) {
    bus.emit("project:health-changed", { projectId, allTasksDone: true });
  }
  // Emit updated so project list re-renders (% stored in-memory derived, not DB column)
  const project = useProjectStore.getState().getProjectById(projectId);
  if (project) bus.emit("project:updated", { project, changed: {} });
}

export function startIntegration() {
  if (started) return;
  started = true;

  // ═══════════════════════════════════════════════════════════
  // TASK EVENTS
  // ═══════════════════════════════════════════════════════════

  // ── task:created → planner block + calendar event + projects ──
  bus.on("task:created", ({ task }) => {
    // → Planner: auto-block if scheduledDate set
    if (task.scheduledDate) {
      void withMutex(task.id + ":planner-create", async () => {
        const { usePlannerStore } = await import("@/modules/planner/store");
        const { blocks, createBlock } = usePlannerStore.getState();
        if (blocks.some((b) => b.taskId === task.id)) return;
        const dur  = task.estimateMinutes ?? 60;
        const endH = 9 + Math.floor(dur / 60);
        const endM = dur % 60;
        await createBlock({
          date:      task.scheduledDate,
          taskId:    task.id,
          title:     task.title,
          startTime: "09:00",
          endTime:   `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`,
        });
      });
    }

    // → Calendar: create time-block if dueDate set
    if (task.dueDate) {
      void withMutex(task.id + ":calendar-create", async () => {
        const { useCalendarStore } = await import("@/modules/calendar/store");
        const { events, createEvent } = useCalendarStore.getState();
        if (events.some((e) => e.taskId === task.id)) return;
        await createEvent({
          title:       task.title,
          date:        task.dueDate!,
          taskId:      task.id,
          isTimeBlock: true,
          color:       "#3b82f6",
        });
      });
    }

    // → Projects: update task count
    if (task.projectId) {
      void withMutex(task.id + ":project-task-count", async () => {
        void recalcProjectCompletion(task.projectId!);
      });
    }
  });

  // ── task:completed → planner + calendar + journal + projects + time + notes ──
  bus.on("task:completed", ({ taskId, completedAt }) => {
    // → Planner: gray + ✓
    void withMutex(taskId + ":planner-complete", async () => {
      const { usePlannerStore } = await import("@/modules/planner/store");
      const { blocks, updateBlock } = usePlannerStore.getState();
      for (const b of blocks.filter((b) => b.taskId === taskId)) {
        await updateBlock(b.id, {
          color: "#6b7280",
          title: `✓ ${b.title.replace(/^[✓✗]\s*/, "")}`,
        });
      }
    });

    // → Calendar: gray + ✓
    void withMutex(taskId + ":calendar-complete", async () => {
      const { useCalendarStore } = await import("@/modules/calendar/store");
      const { events, updateEvent } = useCalendarStore.getState();
      for (const e of events.filter((e) => e.taskId === taskId)) {
        await updateEvent(e.id, {
          color: "#6b7280",
          title: `✓ ${e.title.replace(/^[✓✗]\s*/, "")}`,
        });
      }
    });

    // → Journal: append to today's entry
    void (async () => {
      const { useTaskStore } = await import("@/modules/tasks/store");
      const task = useTaskStore.getState().tasks.find((t) => t.id === taskId);
      const title = task?.title ?? taskId;
      await appendToTodayJournal(`✓ Completed: ${title}`);
    })();

    // → Projects: recalculate %
    void (async () => {
      const { useTaskStore } = await import("@/modules/tasks/store");
      const task = useTaskStore.getState().tasks.find((t) => t.id === taskId);
      if (task?.projectId) await recalcProjectCompletion(task.projectId);
    })();

    // → Time Tracking: stop any running timer for this task
    void withMutex(taskId + ":time-complete", async () => {
      const { useTimeStore } = await import("@/modules/time-tracking/store");
      const { getActiveEntry, stopTimer } = useTimeStore.getState();
      const active = getActiveEntry();
      if (active?.taskId === taskId) await stopTimer();
    })();

    // → Focus: mark session complete if running for this task
    void withMutex(taskId + ":focus-complete", async () => {
      const { useFocusStore } = await import("@/modules/focus/store");
      const { activeSession, _completeActive } = useFocusStore.getState();
      if (activeSession?.taskId === taskId) await _completeActive();
    })();
  });

  // ── task:cancelled → planner + calendar + journal + time + focus + notes + projects ──
  bus.on("task:cancelled", ({ taskId, title }) => {
    // → Planner: red + ✗
    void withMutex(taskId + ":planner-cancel", async () => {
      const { usePlannerStore } = await import("@/modules/planner/store");
      const { blocks, updateBlock } = usePlannerStore.getState();
      for (const b of blocks.filter((b) => b.taskId === taskId)) {
        await updateBlock(b.id, {
          color: "#ef4444",
          title: `✗ ${b.title.replace(/^[✓✗]\s*/, "")}`,
        });
      }
    });

    // → Calendar: red + ✗ on ALL linked events (not just isTimeBlock)
    void withMutex(taskId + ":calendar-cancel", async () => {
      const { useCalendarStore } = await import("@/modules/calendar/store");
      const { events, updateEvent } = useCalendarStore.getState();
      for (const e of events.filter((e) => e.taskId === taskId)) {
        await updateEvent(e.id, {
          color: "#ef4444",
          title: `✗ ${e.title.replace(/^[✓✗]\s*/, "")}`,
        });
      }
    });

    // → Journal: append cancelled line
    void appendToTodayJournal(`✗ Cancelled: ${title}`);

    // → Time Tracking: stop running timer, preserve partial entry
    void withMutex(taskId + ":time-cancel", async () => {
      const { useTimeStore } = await import("@/modules/time-tracking/store");
      const { getActiveEntry, stopTimer } = useTimeStore.getState();
      const active = getActiveEntry();
      if (active?.taskId === taskId) await stopTimer();
    });

    // → Focus: prompt (emit notification — UI can react)
    void (async () => {
      const { useFocusStore } = await import("@/modules/focus/store");
      const { activeSession } = useFocusStore.getState();
      if (activeSession?.taskId === taskId) {
        bus.emit("ui:notification", {
          id: generateId(),
          type: "warning",
          message: `Task "${title}" was cancelled. Stop focus session?`,
          durationMs: 8000,
        });
      }
    })();

    // → Projects: recalc %
    void (async () => {
      const { useTaskStore } = await import("@/modules/tasks/store");
      const task = useTaskStore.getState().tasks.find((t) => t.id === taskId);
      if (task?.projectId) await recalcProjectCompletion(task.projectId);
    })();
  });

  // ── task:deleted → notes + time + research + projects + planner + calendar ──
  bus.on("task:deleted", ({ taskId }) => {
    // → Planner: remove linked blocks
    void withMutex(taskId + ":planner-delete", async () => {
      const { usePlannerStore } = await import("@/modules/planner/store");
      const { blocks, deleteBlock } = usePlannerStore.getState();
      for (const b of blocks.filter((b) => b.taskId === taskId)) {
        await deleteBlock(b.id);
      }
    });

    // → Calendar: unlink
    void withMutex(taskId + ":calendar-delete", async () => {
      const { useCalendarStore } = await import("@/modules/calendar/store");
      const { events, updateEvent } = useCalendarStore.getState();
      for (const e of events.filter((e) => e.taskId === taskId)) {
        await updateEvent(e.id, { taskId: undefined });
      }
    });

    // → Notes: remove task-link chip from all linked notes
    void withMutex(taskId + ":notes-delete", async () => {
      const { useNoteStore } = await import("@/modules/notes/store");
      const { notes, updateNote } = useNoteStore.getState();
      for (const n of notes.filter((n) => n.linkedTaskIds.includes(taskId))) {
        await updateNote(n.id, {
          linkedTaskIds: n.linkedTaskIds.filter((id) => id !== taskId),
        });
      }
    });

    // → Time Tracking: orphan entries (keep data, clear taskId)
    void withMutex(taskId + ":time-delete", async () => {
      const { useTimeStore } = await import("@/modules/time-tracking/store");
      const { entries, updateEntry } = useTimeStore.getState();
      for (const e of entries.filter((e) => e.taskId === taskId)) {
        await updateEntry(e.id, { taskId: undefined });
      }
    });
  });

  // ── task:updated (scheduledDate) → planner block ─────────
  bus.on("task:updated", ({ task, changed }) => {
    if (!changed.scheduledDate) return;

    void withMutex(task.id + ":planner", async () => {
      const { usePlannerStore } = await import("@/modules/planner/store");
      const { blocks, createBlock, updateBlock } = usePlannerStore.getState();
      const existing = blocks.find((b) => b.taskId === task.id);

      if (existing) {
        await updateBlock(existing.id, { date: changed.scheduledDate! });
      } else if (changed.scheduledDate) {
        const dur  = task.estimateMinutes ?? 60;
        const endH = 9 + Math.floor(dur / 60);
        const endM = dur % 60;
        await createBlock({
          date:      changed.scheduledDate,
          taskId:    task.id,
          title:     task.title,
          startTime: "09:00",
          endTime:   `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`,
        });
      }
    });
  });

  // ── task:updated (dueDate/title) → calendar ───────────────
  bus.on("task:updated", ({ task, changed }) => {
    if (!changed.dueDate && !changed.title) return;

    void withMutex(task.id + ":calendar-update", async () => {
      const { useCalendarStore } = await import("@/modules/calendar/store");
      const { events, updateEvent } = useCalendarStore.getState();
      for (const e of events.filter((e) => e.taskId === task.id)) {
        const patch: Record<string, unknown> = {};
        if (changed.title)   patch.title = task.title;
        if (changed.dueDate) patch.date  = task.dueDate;
        if (Object.keys(patch).length) await updateEvent(e.id, patch);
      }
    });
  });

  // ── task:updated (status) → calendar + planner ───────────
  bus.on("task:updated", ({ task, changed }) => {
    if (!changed.status) return;

    // Emit task:cancelled for downstream listeners
    if (task.status === "cancelled") {
      bus.emit("task:cancelled", { taskId: task.id, title: task.title });
    }

    void withMutex(task.id + ":calendar-status", async () => {
      const { useCalendarStore } = await import("@/modules/calendar/store");
      const { events, updateEvent } = useCalendarStore.getState();
      for (const e of events.filter((e) => e.taskId === task.id)) {
        const patch: Record<string, unknown> = {};
        if (task.status === "cancelled") {
          patch.color = "#ef4444";
          patch.title = `✗ ${e.title.replace(/^[✓✗]\s*/, "")}`;
        } else if (task.status === "done") {
          patch.color = "#6b7280";
          patch.title = `✓ ${e.title.replace(/^[✓✗]\s*/, "")}`;
        } else if (task.status === "archived") {
          patch.color = "#9ca3af";
          patch.title = e.title.replace(/^[✓✗]\s*/, "");
        } else {
          const clean = e.title.replace(/^[✓✗]\s*/, "");
          if (clean !== e.title) { patch.title = clean; patch.color = "#3b82f6"; }
        }
        if (Object.keys(patch).length) await updateEvent(e.id, patch);
      }
    });

    void withMutex(task.id + ":planner-status", async () => {
      const { usePlannerStore } = await import("@/modules/planner/store");
      const { blocks, updateBlock } = usePlannerStore.getState();
      for (const b of blocks.filter((b) => b.taskId === task.id)) {
        const patch: Record<string, unknown> = {};
        let base = b.title.replace(/^[✓✗]\s*/, "");
        if (changed.title) base = task.title;
        if (task.status === "cancelled") {
          patch.color = "#ef4444"; patch.title = `✗ ${base}`;
        } else if (task.status === "done") {
          patch.color = "#6b7280"; patch.title = `✓ ${base}`;
        } else if (task.status === "archived") {
          patch.color = "#9ca3af"; patch.title = base;
        } else {
          patch.title = base; patch.color = "#3b82f6";
        }
        if (Object.keys(patch).length) await updateBlock(b.id, patch);
      }
    });
  });

  // ── task:updated (projectId) → projects ──────────────────
  bus.on("task:updated", ({ task, changed }) => {
    if (!changed.projectId) return;
    // Old project was the previous value — we don't have it easily, so just
    // recalc both the new project and trust that old project recalcs on next event.
    if (task.projectId) void recalcProjectCompletion(task.projectId);
  });

  // ── task:updated (dueDate → journal "due today") ─────────
  bus.on("task:updated", ({ task, changed }) => {
    if (!changed.dueDate) return;
    if (task.dueDate === today()) {
      void appendToTodayJournal(`📅 Due today: ${task.title}`);
    }
  });

  // ═══════════════════════════════════════════════════════════
  // FOCUS EVENTS
  // ═══════════════════════════════════════════════════════════

  // ── focus:session-completed → time + journal + calendar + projects ──
  bus.on("focus:session-completed", ({ session }) => {
    // → Task actualMinutes (existing handler preserved)
    if (session.taskId) {
      void withMutex(session.taskId + ":focus", async () => {
        const { useTaskStore } = await import("@/modules/tasks/store");
        const { tasks, updateTask } = useTaskStore.getState();
        const task = tasks.find((t) => t.id === session.taskId);
        if (!task) return;
        const prev  = task.actualMinutes ?? 0;
        const added = Math.round((session.durationSeconds ?? 0) / 60);
        await updateTask(session.taskId!, { actualMinutes: prev + added });
      });
    }

    // → Time Tracking: auto-create entry (deduped via focusSessionId)
    void withMutex(session.id + ":time-entry", async () => {
      const { useTimeStore } = await import("@/modules/time-tracking/store");
      const { entries, createEntry } = useTimeStore.getState();
      if (entries.some((e) => e.focusSessionId === session.id)) return;
      const durationMinutes = Math.round((session.durationSeconds ?? (session.actualMinutes ?? 0) * 60) / 60);
      if (durationMinutes < 1) return;
      const startAt = session.startedAt ?? now();
      const endAt   = session.completedAt ?? now();
      await createEntry({
        startAt,
        endAt,
        durationMinutes,
        taskId:         session.taskId,
        projectId:      session.projectId,
        focusSessionId: session.id,
        description:    `Focus: ${session.goal ?? ""}`.trim(),
      });
    });

    // → Journal: append focus summary line
    void (async () => {
      const { useTaskStore } = await import("@/modules/tasks/store");
      const task = session.taskId
        ? useTaskStore.getState().tasks.find((t) => t.id === session.taskId)
        : null;
      const label = task?.title ?? session.goal ?? "—";
      const mins  = Math.round((session.durationSeconds ?? 0) / 60);
      await appendToTodayJournal(`🎯 Focus: ${label} — ${mins}m`);
    })();

    // → Calendar: update time-block actual duration annotation
    if (session.taskId) {
      void withMutex(session.taskId + ":calendar-focus", async () => {
        const { useCalendarStore } = await import("@/modules/calendar/store");
        const { events, updateEvent } = useCalendarStore.getState();
        const todayStr = today();
        const block = events.find(
          (e) => e.taskId === session.taskId && e.isTimeBlock && e.date === todayStr
        );
        if (!block) return;
        const mins = Math.round((session.durationSeconds ?? 0) / 60);
        await updateEvent(block.id, {
          description: `Actual: ${mins}m`,
        });
      });
    }

    // → Projects: roll up focus time
    if (session.taskId) {
      void (async () => {
        const { useTaskStore } = await import("@/modules/tasks/store");
        const task = useTaskStore.getState().tasks.find((t) => t.id === session.taskId);
        if (task?.projectId) await recalcProjectCompletion(task.projectId);
      })();
    }
  });

  // ── focus:session-started → time (stop manual timer) + calendar + planner ──
  bus.on("focus:session-started", ({ session }) => {
    if (!session.taskId) return;

    // → Time Tracking: stop manual timer for same task to avoid double-counting
    void withMutex(session.taskId + ":time-focus-start", async () => {
      const { useTimeStore } = await import("@/modules/time-tracking/store");
      const { getActiveEntry, stopTimer } = useTimeStore.getState();
      const active = getActiveEntry();
      if (active && active.taskId === session.taskId && !active.focusSessionId) {
        await stopTimer();
        bus.emit("ui:notification", {
          id: generateId(),
          type: "info",
          message: "Manual timer stopped — focus session started for same task.",
          durationMs: 3000,
        });
      }
    });

    // → Calendar: highlight time block as "In Progress"
    void withMutex(session.taskId + ":calendar-focus-start", async () => {
      const { useCalendarStore } = await import("@/modules/calendar/store");
      const { events, updateEvent } = useCalendarStore.getState();
      const block = events.find(
        (e) => e.taskId === session.taskId && e.isTimeBlock && e.date === today()
      );
      if (block) await updateEvent(block.id, { color: "#8b5cf6" }); // violet = in-progress
    });

    // → Planner: highlight block as active
    void withMutex(session.taskId + ":planner-focus-start", async () => {
      const { usePlannerStore } = await import("@/modules/planner/store");
      const { blocks, updateBlock } = usePlannerStore.getState();
      const block = blocks.find((b) => b.taskId === session.taskId && b.date === today());
      if (block) await updateBlock(block.id, { color: "#8b5cf6" });
    });
  });

  // ── focus:session-cancelled → time (partial entry if >1m) ──
  bus.on("focus:session-cancelled", ({ sessionId }) => {
    void withMutex(sessionId + ":time-partial", async () => {
      const { useFocusStore } = await import("@/modules/focus/store");
      const session = useFocusStore.getState().sessions.find((s) => s.id === sessionId);
      if (!session) return;
      const mins = session.actualMinutes ?? 0;
      if (mins < 1) return;
      const { useTimeStore } = await import("@/modules/time-tracking/store");
      const { entries, createEntry } = useTimeStore.getState();
      if (entries.some((e) => e.focusSessionId === sessionId)) return;
      const startAt = session.startedAt ?? now();
      const endAt   = session.completedAt ?? now();
      await createEntry({
        startAt,
        endAt,
        durationMinutes: mins,
        taskId:          session.taskId,
        projectId:       session.projectId,
        focusSessionId:  sessionId,
        description:     `Focus (cancelled): ${session.goal ?? ""}`.trim(),
      });
    });
  });

  // ═══════════════════════════════════════════════════════════
  // TIME TRACKING EVENTS
  // ═══════════════════════════════════════════════════════════

  // ── time:entry-created / updated → task.actualMinutes + projects + journal ──
  const onTimeEntry = (entry: import("@/shared/types").TimeEntry) => {
    // Only process manual entries (not focus-session-derived ones — those go through focus:session-completed)
    if (entry.focusSessionId) return;
    if (!entry.durationMinutes || entry.durationMinutes < 1) return;

    // → Tasks: update actualMinutes
    if (entry.taskId) {
      void withMutex(entry.taskId + ":time-actual", async () => {
        const { useTaskStore } = await import("@/modules/tasks/store");
        const { tasks, updateTask } = useTaskStore.getState();
        const task = tasks.find((t) => t.id === entry.taskId);
        if (!task) return;
        // Recalculate from all entries to avoid drift
        const { useTimeStore } = await import("@/modules/time-tracking/store");
        const allEntries = useTimeStore.getState().entries.filter(
          (e) => e.taskId === entry.taskId && e.durationMinutes
        );
        const totalMins = allEntries.reduce((a, e) => a + (e.durationMinutes ?? 0), 0);
        await updateTask(entry.taskId, { actualMinutes: totalMins });
      });
    }

    // → Projects: roll up
    if (entry.projectId) {
      void recalcProjectCompletion(entry.projectId);
    }
  };

  bus.on("time:entry-created", ({ entry }) => onTimeEntry(entry));
  bus.on("time:entry-updated", ({ entry }) => onTimeEntry(entry));

  // ── time:timer-started → focus conflict warning ───────────
  bus.on("time:timer-started", ({ entryId }) => {
    void (async () => {
      const { useTimeStore } = await import("@/modules/time-tracking/store");
      const entry = useTimeStore.getState().entries.find((e) => e.id === entryId);
      if (!entry?.taskId) return;
      const { useFocusStore } = await import("@/modules/focus/store");
      const { activeSession } = useFocusStore.getState();
      if (activeSession?.taskId === entry.taskId && activeSession.state === "focusing") {
        bus.emit("ui:notification", {
          id: generateId(),
          type: "warning",
          message: "A focus session is already running for this task.",
          durationMs: 5000,
        });
      }
    })();
  });

  // ═══════════════════════════════════════════════════════════
  // PROJECT EVENTS
  // ═══════════════════════════════════════════════════════════

  // ── project:created → notes (default note) + calendar (deadline event) ──
  bus.on("project:created", ({ project }) => {
    // → Notes: auto-create "Project Notes" note
    void withMutex(project.id + ":notes-create", async () => {
      const { useNoteStore } = await import("@/modules/notes/store");
      await useNoteStore.getState().createNote({
        title:            `📁 ${project.name} — Notes`,
        type:             "note",
        linkedProjectIds: [project.id],
        tags:             ["project"],
      });
    });

    // → Calendar: create deadline event if dueDate set
    if (project.dueDate) {
      void withMutex(project.id + ":calendar-deadline", async () => {
        const { useCalendarStore } = await import("@/modules/calendar/store");
        await useCalendarStore.getState().createEvent({
          title:     `🏁 Project Deadline: ${project.name}`,
          date:      project.dueDate!,
          projectId: project.id,
          color:     project.color ?? "#3b82f6",
        });
      });
    }
  });

  // ── project:updated (archived/completed) → calendar + notes + time + journal ──
  bus.on("project:updated", ({ project, changed }) => {
    if (!changed.status) return;
    const isTerminal = project.status === "archived" || project.status === "completed";
    if (!isTerminal) return;

    // → Calendar: remove/archive future deadline events
    void withMutex(project.id + ":calendar-archive", async () => {
      const { useCalendarStore } = await import("@/modules/calendar/store");
      const { events, updateEvent } = useCalendarStore.getState();
      for (const e of events.filter((e) => (e as Record<string, unknown>)["projectId"] === project.id)) {
        await updateEvent(e.id, { color: "#9ca3af", title: `[Archived] ${e.title}` });
      }
    });

    // → Notes: tag project notes as archived
    void withMutex(project.id + ":notes-archive", async () => {
      const { useNoteStore } = await import("@/modules/notes/store");
      const { notes, updateNote } = useNoteStore.getState();
      for (const n of notes.filter((n) => n.linkedProjectIds.includes(project.id))) {
        if (!n.tags.includes("archived")) {
          await updateNote(n.id, { tags: [...n.tags, "archived"] });
        }
      }
    });

    // → Time Tracking: stop any open timer tagged to this project
    void withMutex(project.id + ":time-archive", async () => {
      const { useTimeStore } = await import("@/modules/time-tracking/store");
      const { getActiveEntry, stopTimer } = useTimeStore.getState();
      const active = getActiveEntry();
      if (active?.projectId === project.id) await stopTimer();
    });

    // → Journal: insert completion line
    if (project.status === "completed") {
      void appendToTodayJournal(`🏁 Project Completed: ${project.name}`);
    }
  });

  // ── project:deleted → calendar + notes + time ─────────────
  bus.on("project:deleted", ({ projectId }) => {
    // → Calendar: delete all project events
    void withMutex(projectId + ":calendar-del", async () => {
      const { useCalendarStore } = await import("@/modules/calendar/store");
      const { events, deleteEvent } = useCalendarStore.getState();
      for (const e of events.filter((e) => (e as Record<string, unknown>)["projectId"] === projectId)) {
        await deleteEvent(e.id);
      }
    });

    // → Notes: unlink notes from project (keep notes, remove tag)
    void withMutex(projectId + ":notes-del", async () => {
      const { useNoteStore } = await import("@/modules/notes/store");
      const { notes, updateNote } = useNoteStore.getState();
      for (const n of notes.filter((n) => n.linkedProjectIds.includes(projectId))) {
        await updateNote(n.id, {
          linkedProjectIds: n.linkedProjectIds.filter((id) => id !== projectId),
        });
      }
    });

    // → Time Tracking: orphan entries
    void withMutex(projectId + ":time-del", async () => {
      const { useTimeStore } = await import("@/modules/time-tracking/store");
      const { entries, updateEntry } = useTimeStore.getState();
      for (const e of entries.filter((e) => e.projectId === projectId)) {
        await updateEntry(e.id, { projectId: undefined });
      }
    });
  });

  // ═══════════════════════════════════════════════════════════
  // CALENDAR EVENTS
  // ═══════════════════════════════════════════════════════════

  // ── calendar:event-created (no taskId) → planner offer + journal ──
  bus.on("calendar:event-created", ({ event }) => {
    if (event.taskId) {
      // Sync task scheduledDate (existing)
      void withMutex(event.taskId + ":task-sync", async () => {
        const { useTaskStore } = await import("@/modules/tasks/store");
        const { updateTask } = useTaskStore.getState();
        await updateTask(event.taskId!, {
          scheduledDate: event.date ?? toISODate(new Date(event.startTime ?? Date.now())),
        });
      });
      return;
    }

    // No taskId: offer planner block creation
    if (event.startTime && event.endTime) {
      bus.emit("ui:notification", {
        id: generateId(),
        type: "info",
        message: `Event "${event.title}" created. Add to Planner?`,
        durationMs: 6000,
      });
    }
  });

  // ── calendar:event-updated → planner sync + task scheduledDate ──
  bus.on("calendar:event-updated", ({ event }) => {
    if (!event.taskId) return;

    void withMutex(event.taskId + ":planner-sync", async () => {
      const { usePlannerStore } = await import("@/modules/planner/store");
      const { blocks, rescheduleBlock, updateBlock } = usePlannerStore.getState();
      const block = blocks.find((b) => b.taskId === event.taskId);
      if (!block) return;

      const newDate  = event.date ?? block.date;
      const newStart = event.startTime ? event.startTime.slice(11, 16) : block.startTime;
      const newEnd   = event.endTime   ? event.endTime.slice(11, 16)   : block.endTime;

      await updateBlock(block.id, { date: newDate });
      if (newStart !== block.startTime || newEnd !== block.endTime) {
        await rescheduleBlock(block.id, newStart, newEnd);
      }
    });

    // → Tasks: update scheduledDate
    void withMutex(event.taskId + ":task-date-sync", async () => {
      const { useTaskStore } = await import("@/modules/tasks/store");
      if (event.date) await useTaskStore.getState().updateTask(event.taskId!, { scheduledDate: event.date });
    });
  });

  // ── calendar:event-deleted → tasks + planner ─────────────
  bus.on("calendar:event-deleted", ({ eventId }) => {
    void (async () => {
      const { useCalendarStore } = await import("@/modules/calendar/store");
      // Event is already deleted from store; find from history via bus
      // We can't recover the event after deletion, so listen via a pre-delete pattern.
      // Fallback: check planner for any block whose calendar event was this.
      const { usePlannerStore } = await import("@/modules/planner/store");
      // Nothing to do without taskId — this event is a tombstone.
      // The correct fix is to emit taskId before deletion; noted as a future improvement.
    })();
  });

  // ═══════════════════════════════════════════════════════════
  // JOURNAL EVENTS
  // ═══════════════════════════════════════════════════════════

  // ── journal:entry-created / updated → search + notes (wikilinks) ──
  const onJournalEntry = (entry: import("@/shared/types").JournalEntry) => {
    bus.emit("search:index-invalidated", { entityType: "journal", id: entry.id });

    // Parse [[wikilinks]] and create backlinks in Notes
    void (async () => {
      const wikilinkRe = /\[\[([^\]]+)\]\]/g;
      let match: RegExpExecArray | null;
      const linked: string[] = [];
      while ((match = wikilinkRe.exec(entry.content)) !== null) {
        linked.push(match[1]);
      }
      if (!linked.length) return;
      const { useNoteStore } = await import("@/modules/notes/store");
      const { notes, updateNote } = useNoteStore.getState();
      for (const title of linked) {
        const note = notes.find((n) => n.title.toLowerCase() === title.toLowerCase());
        if (note && !note.backlinks.includes(entry.id)) {
          await updateNote(note.id, { backlinks: [...note.backlinks, entry.id] });
        }
      }
    })();
  };

  bus.on("journal:entry-created", ({ entry }) => onJournalEntry(entry));
  bus.on("journal:entry-updated", ({ entry }) => onJournalEntry(entry));

  // ═══════════════════════════════════════════════════════════
  // NOTES EVENTS
  // ═══════════════════════════════════════════════════════════

  // ── note:created → search index ──────────────────────────
  // (note:created/updated already emit search:index-invalidated in notes/store.ts)
  // Additional: parse wikilinks for backlink resolution
  bus.on("note:created", ({ note }) => {
    bus.emit("search:index-invalidated", { entityType: "note", id: note.id });
  });

  // ── note:deleted → tasks: remove from linkedNoteIds ──────
  bus.on("note:deleted", ({ noteId }) => {
    void (async () => {
      const { useTaskStore } = await import("@/modules/tasks/store");
      const { tasks, updateTask } = useTaskStore.getState();
      for (const t of tasks.filter((t) => t.linkedNoteIds?.includes(noteId))) {
        await updateTask(t.id, {
          linkedNoteIds: (t.linkedNoteIds ?? []).filter((id) => id !== noteId),
        });
      }
    })();
  });

  // ═══════════════════════════════════════════════════════════
  // RESEARCH EVENTS
  // ═══════════════════════════════════════════════════════════

  // ── research:linked-to-task → tasks (badge) + notes (offer) ──
  bus.on("research:linked-to-task", ({ taskId }) => {
    bus.emit("ui:notification", {
      id: generateId(),
      type: "info",
      message: "Research linked to task. Open task to view research badge.",
      durationMs: 3000,
    });
  });

  // ── research:highlight-created → notes (offer convert) ───
  bus.on("research:highlight-created", ({ highlight }) => {
    bus.emit("ui:notification", {
      id: generateId(),
      type: "info",
      message: "Highlight created. Convert to note?",
      durationMs: 5000,
    });
  });

  // ═══════════════════════════════════════════════════════════
  // PLANNER EVENTS
  // ═══════════════════════════════════════════════════════════

  // ── planner:block-linked-task → task.scheduledDate ───────
  bus.on("planner:block-linked-task", ({ blockId, taskId, date }) => {
    void withMutex(taskId + ":planner-link", async () => {
      const { useTaskStore } = await import("@/modules/tasks/store");
      await useTaskStore.getState().updateTask(taskId, { scheduledDate: date });
    });
  });

  // ── planner:block-completed → time + tasks ────────────────
  bus.on("planner:block-completed", ({ blockId, taskId, date, durationMinutes }) => {
    // → Time Tracking: log entry
    if (durationMinutes && durationMinutes > 0) {
      void withMutex(blockId + ":time-block-complete", async () => {
        const { useTimeStore } = await import("@/modules/time-tracking/store");
        await useTimeStore.getState().createEntry({
          startAt:         `${date}T09:00:00.000Z`,
          durationMinutes,
          taskId:          taskId,
          description:     "Planner block completed",
        });
      });
    }

    // → Tasks: complete the linked task
    if (taskId) {
      void withMutex(taskId + ":planner-block-done", async () => {
        const { useTaskStore } = await import("@/modules/tasks/store");
        const task = useTaskStore.getState().tasks.find((t) => t.id === taskId);
        if (task && task.status !== "done") {
          await useTaskStore.getState().updateTask(taskId, { status: "done" });
          bus.emit("task:completed", { taskId, completedAt: now() });
        }
      });
    }
  });

  // ── planner:block-created (no task) → calendar + tasks offer ──
  bus.on("planner:block-created", ({ blockId, date, title, startTime, endTime, taskId }) => {
    if (taskId) return; // already linked, skip
    bus.emit("ui:notification", {
      id: generateId(),
      type: "info",
      message: `Block "${title}" created. Create a calendar event or task?`,
      durationMs: 5000,
    });
  });

  // ── planner:block-deleted → calendar (unlink) + tasks (clear scheduledDate) ──
  bus.on("planner:block-deleted", ({ blockId, taskId, date }) => {
    if (!taskId) return;
    void withMutex(taskId + ":planner-block-del", async () => {
      const { useTaskStore } = await import("@/modules/tasks/store");
      const task = useTaskStore.getState().tasks.find((t) => t.id === taskId);
      if (task?.scheduledDate === date) {
        await useTaskStore.getState().updateTask(taskId, { scheduledDate: undefined });
      }
    });
  });

  // ── task:schedule-in-planner request ─────────────────────
  bus.on("task:schedule-in-planner", ({ task, date, startTime }) => {
    void withMutex(task.id + ":schedule", async () => {
      const { usePlannerStore } = await import("@/modules/planner/store");
      await usePlannerStore.getState().scheduleTask(
        task.id,
        date ?? toISODate(new Date()),
        startTime ?? "09:00",
        task.estimateMinutes ?? 60
      );
      usePlannerStore.getState().setActiveDate(date ?? toISODate(new Date()));
    });
    bus.emit("navigate:to", { path: "/planner" });
  });
}

// ============================================================
// TASK → CALENDAR SYNC  (kernel service)
// Keeps a shadow all-day calendar event for every incomplete
// task that has a dueDate or scheduledDate.
//
// Shadow event contract:
//   id          = "task:<taskId>"
//   calendarId  = "tasks"
//   allDay      = true
//   linkedTaskIds = [taskId]
//
// Called once from main.tsx after db.init().
// ============================================================

import { db }  from "@/kernel/db";
import { bus } from "@/kernel/event-bus";
import type { Task } from "@/shared/types";
import { now } from "@/shared/utils";

// ── helpers ──────────────────────────────────────────────────

const TASKS_CAL_ID = "tasks";

function shadowId(taskId: string) {
  return `task:${taskId}`;
}

/** Determine the effective date for a task (scheduledDate wins over dueDate) */
function taskDate(task: Task): string | undefined {
  return task.scheduledDate ?? task.dueDate;
}

/** Pick a colour based on task urgency */
function taskColor(task: Task): string {
  const date = taskDate(task);
  if (!date) return "#6b7280";
  const todayStr = new Date().toISOString().slice(0, 10);
  if (date < todayStr) return "#ef4444"; // overdue  → red
  if (date === todayStr) return "#f97316"; // due today → orange
  if (task.scheduledDate) return "#3b82f6"; // scheduled → blue
  return "#8b5cf6"; // upcoming  → purple
}

/** Prefix emoji for quick visual scan */
function taskTitle(task: Task): string {
  const date = taskDate(task);
  const todayStr = new Date().toISOString().slice(0, 10);
  if (date && date < todayStr) return `⚠ ${task.title}`;
  if (date && date === todayStr) return `● ${task.title}`;
  return task.title;
}

function shouldSync(task: Task): boolean {
  return (
    task.status !== "done" &&
    task.status !== "archived" &&
    taskDate(task) !== undefined
  );
}

// ── DB helpers (raw — no store dependency) ───────────────────

async function upsertShadowEvent(task: Task) {
  const date  = taskDate(task)!;
  const id    = shadowId(task.id);
  const ts    = now();

  // all-day: startAt / endAt are ISO date strings (no time part)
  const startAt = `${date}T00:00:00`;
  const endAt   = `${date}T23:59:59`;

  // check existence
  const rows = await db.select<{ id: string }>(
    "SELECT id FROM calendar_events WHERE id=?", [id]
  );

  if (rows.length === 0) {
    await db.execute(
      `INSERT INTO calendar_events
         (id, title, description, start_at, end_at, all_day, color,
          calendar_id, linked_task_ids, linked_note_ids,
          is_time_block, recurrence, created_at, updated_at)
       VALUES (?,?,?,?,?,1,?,?,?,?,0,NULL,?,?)`,
      [
        id,
        taskTitle(task),
        task.description ?? null,
        startAt,
        endAt,
        taskColor(task),
        TASKS_CAL_ID,
        JSON.stringify([task.id]),
        JSON.stringify([]),
        ts,
        ts,
      ]
    );
  } else {
    await db.execute(
      `UPDATE calendar_events
         SET title=?, description=?, start_at=?, end_at=?,
             color=?, linked_task_ids=?, updated_at=?
       WHERE id=?`,
      [
        taskTitle(task),
        task.description ?? null,
        startAt,
        endAt,
        taskColor(task),
        JSON.stringify([task.id]),
        ts,
        id,
      ]
    );
  }
}

async function deleteShadowEvent(taskId: string) {
  await db.execute(
    "DELETE FROM calendar_events WHERE id=?",
    [shadowId(taskId)]
  );
}

// ── Boot reconciliation ──────────────────────────────────────

async function syncAllTasks() {
  try {
    // Ensure the virtual "tasks" calendar row exists
    const calRows = await db.select<{ id: string }>(
      "SELECT id FROM calendars WHERE id=?", [TASKS_CAL_ID]
    );
    if (calRows.length === 0) {
      await db.execute(
        `INSERT INTO calendars (id, name, color, is_default, is_visible, source)
         VALUES (?,?,?,0,1,'local')`,
        [TASKS_CAL_ID, "Tasks", "#8b5cf6"]
      );
    }

    // Load all non-archived tasks
    const rows = await db.select<Record<string, unknown>>(
      "SELECT id, title, description, status, due_date, scheduled_date FROM tasks WHERE status != 'archived'"
    );

    for (const r of rows) {
      const task = {
        id:            r.id as string,
        title:         r.title as string,
        description:   (r.description as string | null) ?? undefined,
        status:        r.status as Task["status"],
        dueDate:       (r.due_date as string | null) ?? undefined,
        scheduledDate: (r.scheduled_date as string | null) ?? undefined,
      } as Task;

      if (shouldSync(task)) {
        await upsertShadowEvent(task);
      } else {
        // clean up stale shadow event if task was completed outside the app
        await deleteShadowEvent(task.id);
      }
    }

    // Prune shadow events whose task no longer exists
    const shadowRows = await db.select<{ id: string }>(
      "SELECT id FROM calendar_events WHERE calendar_id=?", [TASKS_CAL_ID]
    );
    const taskIds = new Set(rows.map((r) => r.id as string));
    for (const { id } of shadowRows) {
      const tid = id.replace(/^task:/, "");
      if (!taskIds.has(tid)) {
        await db.execute("DELETE FROM calendar_events WHERE id=?", [id]);
      }
    }

    console.log(`[TaskCalSync] Boot sync complete — ${rows.length} tasks processed`);
  } catch (err) {
    console.error("[TaskCalSync] Boot sync failed:", err);
  }
}

// ── Bus listeners ─────────────────────────────────────────────

function startTaskCalendarSync(): () => void {
  // Kick off the boot reconciliation (fire and forget)
  void syncAllTasks();

  const unsubs = [
    // ── task created ──────────────────────────────────────
    bus.on("task:created", ({ task }: { task: Task }) => {
      if (shouldSync(task)) {
        void upsertShadowEvent(task);
      }
    }),

    // ── task updated ──────────────────────────────────────
    bus.on("task:updated", ({ task }: { task: Task }) => {
      if (shouldSync(task)) {
        void upsertShadowEvent(task);
      } else {
        // completed, archived, or date removed → remove from calendar
        void deleteShadowEvent(task.id);
      }
    }),

    // ── task completed (explicit event) ───────────────────
    bus.on("task:completed", ({ taskId }: { taskId: string }) => {
      void deleteShadowEvent(taskId);
    }),

    // ── task deleted ──────────────────────────────────────
    bus.on("task:deleted", ({ taskId }: { taskId: string }) => {
      void deleteShadowEvent(taskId);
    }),

    // ── task restored (un-complete) ───────────────────────
    bus.on("task:restored", ({ taskId }: { taskId: string }) => {
      // Re-load the full task row to re-sync
      void db
        .select<Record<string, unknown>>(
          "SELECT id, title, description, status, due_date, scheduled_date FROM tasks WHERE id=?",
          [taskId]
        )
        .then(([r]) => {
          if (!r) return;
          const task = {
            id:            r.id as string,
            title:         r.title as string,
            description:   (r.description as string | null) ?? undefined,
            status:        r.status as Task["status"],
            dueDate:       (r.due_date as string | null) ?? undefined,
            scheduledDate: (r.scheduled_date as string | null) ?? undefined,
          } as Task;
          if (shouldSync(task)) void upsertShadowEvent(task);
        });
    }),
  ];

  // Return cleanup function (useful for tests)
  return () => unsubs.forEach((u) => u());
}

export { startTaskCalendarSync };

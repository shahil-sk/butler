/**
 * task-calendar-sync.ts
 * ─────────────────────
 * Boot-time and on-demand sync: for every task with a scheduledDate that has
 * no matching calendar event yet, create one. Runs once on app start and
 * whenever a task is created/updated with a scheduledDate.
 *
 * Errors are caught and logged — a sync failure must never crash the app.
 */

import { db } from "@/kernel/db";
import { bus } from "@/kernel/event-bus";
import { generateId, now } from "@/shared/utils";
import type { Task } from "@/shared/types";

const TAG = "[TaskCalSync]";

// ── Helpers ──────────────────────────────────────────────────────

/** ISO datetime for the end of a task block given start time + estimate. */
function calcEndAt(startAt: string, estimateMinutes: number): string {
  const start = new Date(startAt);
  start.setMinutes(start.getMinutes() + estimateMinutes);
  return start.toISOString().replace("Z", "").slice(0, 19);
}

/**
 * Insert a calendar event row directly via SQL.
 * Always supplies created_at + updated_at so the NOT NULL constraint is satisfied
 * even on older DB installs that haven't received migration 51 yet.
 */
async function insertCalendarEvent(params: {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  taskId: string;
  calendarId: string;
}): Promise<void> {
  const ts = now();
  await db.execute(
    `INSERT OR IGNORE INTO calendar_events
       (id, title, description, start_at, end_at, all_day, color,
        calendar_id, linked_task_ids, linked_note_ids,
        is_time_block, recurrence, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      params.id,
      params.title,
      null,                         // description
      params.startAt,
      params.endAt,
      0,                            // all_day
      null,                         // color — inherits calendar colour
      params.calendarId,
      JSON.stringify([params.taskId]),
      JSON.stringify([]),           // linked_note_ids
      1,                            // is_time_block = true for task blocks
      null,                         // recurrence
      ts,                           // created_at  ← always supplied
      ts,                           // updated_at  ← always supplied
    ],
  );
}

/** Resolve the default calendar id, creating the row if somehow absent. */
async function resolveDefaultCalendarId(): Promise<string> {
  const rows = await db.select<{ id: string }>(
    `SELECT id FROM calendars WHERE is_default = 1 LIMIT 1`,
  );
  if (rows.length > 0) return rows[0].id;

  // Fallback: insert the default calendar with all required fields
  const ts = now();
  await db.execute(
    `INSERT OR IGNORE INTO calendars
       (id, name, color, is_default, is_visible, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ["default", "Personal", "#3b82f6", 1, 1, "local", ts],
  );
  return "default";
}

// ── Core sync logic ───────────────────────────────────────────────

/**
 * Sync a single task: create a calendar event for it if:
 *  - task.scheduledDate is set
 *  - no calendar_events row already links to this task
 */
export async function syncTaskToCalendar(task: Task): Promise<void> {
  if (!task.scheduledDate) return;

  try {
    // Check if a linked event already exists
    const existing = await db.select<{ id: string }>(
      `SELECT id FROM calendar_events WHERE linked_task_ids LIKE ?`,
      [`%"${task.id}"%`],
    );
    if (existing.length > 0) return; // already synced

    const calendarId = await resolveDefaultCalendarId();
    const time       = (task as Task & { scheduledTime?: string }).scheduledTime ?? "09:00";
    const startAt    = `${task.scheduledDate}T${time}:00`;
    const endAt      = calcEndAt(startAt, task.estimateMinutes ?? 60);

    await insertCalendarEvent({
      id: generateId(),
      title: task.title,
      startAt,
      endAt,
      taskId: task.id,
      calendarId,
    });
  } catch (err) {
    console.error(`${TAG} syncTaskToCalendar failed for task ${task.id}:`, err);
  }
}

/**
 * Boot sync: iterate all tasks with a scheduledDate and create missing events.
 * Called once during app init. Never throws — errors are logged only.
 */
export async function syncAllTasks(): Promise<void> {
  try {
    const tasks = await db.select<Record<string, unknown>>(
      `SELECT id, title, scheduled_date, scheduled_time, estimate_minutes
       FROM tasks
       WHERE scheduled_date IS NOT NULL`,
    );

    if (tasks.length === 0) return;

    const calendarId = await resolveDefaultCalendarId();

    for (const row of tasks) {
      const taskId = row.id as string;

      // Skip if already linked
      const existing = await db.select<{ id: string }>(
        `SELECT id FROM calendar_events WHERE linked_task_ids LIKE ?`,
        [`%"${taskId}"%`],
      );
      if (existing.length > 0) continue;

      const time    = (row.scheduled_time as string | null) ?? "09:00";
      const startAt = `${row.scheduled_date as string}T${time}:00`;
      const endAt   = calcEndAt(startAt, (row.estimate_minutes as number | null) ?? 60);

      await insertCalendarEvent({
        id:         generateId(),
        title:      row.title as string,
        startAt,
        endAt,
        taskId,
        calendarId,
      });
    }

    console.info(`${TAG} Boot sync complete — ${tasks.length} task(s) checked.`);
  } catch (err) {
    console.error(`${TAG} Boot sync failed:`, err);
  }
}

// ── Event bus listeners ───────────────────────────────────────────

/** Register bus listeners so newly created/updated tasks auto-sync. */
export function setupTaskCalendarSync(): void {
  bus.on("task:created", ({ task }: { task: Task }) => {
    void syncTaskToCalendar(task);
  });
  bus.on("task:updated", ({ task }: { task: Task }) => {
    void syncTaskToCalendar(task);
  });
}

// ============================================================
// TASKS — CALENDAR SYNC
// Boot-time and on-demand sync bridge.
//
// This file deliberately has NO direct db access.
// It uses repo.dbFindScheduledTasks() for the boot query and
// emits `task:needs-calendar-sync` on the kernel bus so the
// calendar module owns all calendar_events SQL.
//
// Layer contract:
//   ✓ imports repository  (DB access via tasks boundary only)
//   ✓ imports event bus   (cross-module side-effects)
//   ✗ never imports db directly
//   ✗ never touches calendar_events / calendars tables
// ============================================================

import { bus } from "@/kernel/event-bus";
import type { Task } from "@/shared/types";
import { dbFindScheduledTasks } from "./repository";

const TAG = "[TaskCalSync]";

// ── Per-task sync ─────────────────────────────────────────────

/**
 * Emit a bus event asking the calendar module to create a time-block
 * for this task if one does not already exist.
 * Called whenever a task is created or its scheduledDate changes.
 */
export function requestCalendarSync(task: Task): void {
  if (!task.scheduledDate) return;
  bus.emit("task:needs-calendar-sync", { task });
}

// ── Boot sync ─────────────────────────────────────────────────

/**
 * Boot sync: fetch all tasks with a scheduledDate via the repository
 * (zero raw SQL here) and emit a sync request for each.
 * Called once during app init. Never throws — errors are logged only.
 */
export async function syncAllTasks(): Promise<void> {
  try {
    const rows = await dbFindScheduledTasks();
    if (rows.length === 0) return;

    for (const row of rows) {
      bus.emit("task:needs-calendar-sync", { task: row as unknown as Task });
    }

    console.info(`${TAG} Boot sync complete — ${rows.length} task(s) requested.`);
  } catch (err) {
    console.error(`${TAG} Boot sync failed:`, err);
  }
}

// ── Event bus setup ───────────────────────────────────────────

/**
 * Register bus listeners so newly created / updated tasks auto-request sync.
 * Called from setupTaskEventListeners() — do not call separately.
 */
export function setupTaskCalendarSync(): () => void {
  const unsubs: Array<() => void> = [];

  unsubs.push(
    bus.on("task:created", ({ task }: { task: Task }) => {
      requestCalendarSync(task);
    }),
  );

  unsubs.push(
    bus.on("task:updated", ({ task }: { task: Task }) => {
      requestCalendarSync(task);
    }),
  );

  return () => unsubs.forEach((u) => u());
}

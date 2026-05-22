// ============================================================
// TIME TRACKING — SERVICE
// Business logic only. Calls repository.*; no direct db import.
// focusGuard logic (mutual exclusion with focus sessions) lives
// here — guardStartTimer() is the single entry point.
// ============================================================

import { bus } from "@/kernel/event-bus";
import { now, today } from "@/shared/utils";
import { newEntry, dbInsertEntry, dbUpdateEntry } from "./repository";
import type { TimeEntry, TimeStats, CreateEntryInput } from "./types";

export type { TimeEntry, TimeStats, CreateEntryInput };

// ── Guard: mutual exclusion with focus module ─────────────────
// Returns true if the caller may proceed; false + notifies if not.

export async function guardStartTimer(): Promise<boolean> {
  try {
    const { useFocusStore } = await import("@/modules/focus/store");
    const active = useFocusStore.getState().activeSession;
    if (active && active.type === "focus" && active.state === "focusing") {
      bus.emit("notify", {
        message: "A focus session is running. Stop it before starting a manual timer.",
        type: "warning",
        action: {
          label: "Stop focus",
          onClick: () => void useFocusStore.getState().cancel(),
        },
      } as never);
      return false;
    }
  } catch { /* focus module may not be loaded */ }
  return true;
}

// ── Timer lifecycle ───────────────────────────────────────────

export async function startTimerEntry(
  partial: Partial<TimeEntry> = {}
): Promise<TimeEntry> {
  const entry = newEntry({
    ...partial,
    startAt:         now(),
    endAt:           undefined,
    durationMinutes: undefined,
    description:     partial.description ?? "",
    tags:            partial.tags ?? [],
  });
  await dbInsertEntry(entry);
  bus.emit("time:timer-started", { entryId: entry.id });
  bus.emit("time:entry-created", { entry });
  return entry;
}

export async function stopTimerEntry(entry: TimeEntry): Promise<TimeEntry> {
  const endAt = now();
  const durationMinutes = Math.round(
    (new Date(endAt).getTime() - new Date(entry.startAt).getTime()) / 60000
  );
  const updated: TimeEntry = { ...entry, endAt, durationMinutes, updatedAt: now() };
  await dbUpdateEntry(updated);
  bus.emit("time:timer-stopped", { entryId: entry.id });
  bus.emit("time:entry-updated", { entry: updated });
  return updated;
}

// ── Entry CRUD ────────────────────────────────────────────────

export function buildEntry(input: CreateEntryInput): TimeEntry {
  const startAt = input.startAt ?? (input.date ? `${input.date}T00:00:00.000Z` : now());
  const endAt   = input.endAt;
  const durationMinutes =
    input.durationMinutes ??
    (endAt
      ? Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000)
      : undefined);

  return newEntry({
    taskId:          input.taskId,
    projectId:       input.projectId,
    focusSessionId:  input.focusSessionId,
    description:     input.description ?? "",
    startAt,
    endAt,
    durationMinutes,
    isBillable:      input.isBillable ?? false,
    tags:            input.tags ?? [],
  });
}

export function applyEntryChanges(
  entry: TimeEntry,
  changes: Partial<TimeEntry>
): TimeEntry {
  const updated: TimeEntry = { ...entry, ...changes, updatedAt: now() };
  // Recalculate duration if start/end changed
  if ((changes.startAt || changes.endAt) && updated.endAt) {
    updated.durationMinutes = Math.round(
      (new Date(updated.endAt).getTime() - new Date(updated.startAt).getTime()) / 60000
    );
  }
  return updated;
}

// ── Stats ─────────────────────────────────────────────────────

export function computeStats(entries: TimeEntry[]): TimeStats {
  const todayStr = today();

  const n = new Date();
  const dayOfWeek = (n.getDay() + 6) % 7;
  const weekStart = new Date(n);
  weekStart.setDate(n.getDate() - dayOfWeek);
  weekStart.setHours(0, 0, 0, 0);
  const weekStartStr = weekStart.toISOString().slice(0, 10);

  const completed = entries.filter((e) => e.endAt && e.durationMinutes);
  const todayEntries = completed.filter((e) => e.startAt.startsWith(todayStr));
  const weekEntries  = completed.filter((e) => e.startAt.slice(0, 10) >= weekStartStr);

  return {
    todayMinutes:    todayEntries.reduce((a, e) => a + (e.durationMinutes ?? 0), 0),
    weekMinutes:     weekEntries.reduce((a, e) => a + (e.durationMinutes ?? 0), 0),
    totalMinutes:    completed.reduce((a, e) => a + (e.durationMinutes ?? 0), 0),
    todayEntries:    todayEntries.length,
    billableMinutes: completed.filter((e) => e.isBillable).reduce((a, e) => a + (e.durationMinutes ?? 0), 0),
  };
}

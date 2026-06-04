// ============================================================
// TIME TRACKING — STORE
// ============================================================

import { create } from "zustand";
import { db } from "@/kernel/db";
import { bus } from "@/kernel/event-bus";
import { generateId, now } from "@/shared/utils";
import type { TimeEntry, ID, ISODateTime, TimeTrackingSettings } from "@/shared/types";

// ── Row mappers ──────────────────────────────────────────────

function rowToEntry(row: Record<string, unknown>): TimeEntry {
  return {
    id:              row.id as string,
    taskId:          (row.task_id as string) || undefined,
    projectId:       (row.project_id as string) || undefined,
    focusSessionId:  (row.focus_session_id as string) || undefined,
    description:     (row.description as string) || undefined,
    startAt:         row.start_at as string,
    endAt:           (row.end_at as string) || undefined,
    durationMinutes: (row.duration_minutes as number) || undefined,
    isManual:        Boolean(row.is_manual),
    isBillable:      Boolean(row.is_billable),
    billableRate:    (row.billable_rate as number) || undefined,
    billableAmount:  (row.billable_amount as number) || undefined,
    category:        (row.category as TimeEntry["category"]) || undefined,
    createdBy:       (row.created_by as string) || undefined,
    tags:            JSON.parse((row.tags as string) || "[]"),
    createdAt:       row.created_at as string,
    updatedAt:       row.updated_at as string,
  };
}

const INSERT_SQL = `
  INSERT INTO time_entries
    (id, task_id, project_id, focus_session_id, description,
     start_at, end_at, duration_minutes, is_manual, is_billable,
     billable_rate, billable_amount, category, tags,
     created_at, updated_at, created_by)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
`;

const UPDATE_SQL = `
  UPDATE time_entries
  SET task_id=?, project_id=?, focus_session_id=?, description=?,
      start_at=?, end_at=?, duration_minutes=?, is_manual=?, is_billable=?,
      billable_rate=?, billable_amount=?, category=?, tags=?,
      updated_at=?, created_by=?
  WHERE id=?
`;

function insertParams(e: TimeEntry): unknown[] {
  return [
    e.id,
    e.taskId ?? null,
    e.projectId ?? null,
    e.focusSessionId ?? null,
    e.description ?? null,
    e.startAt,
    e.endAt ?? null,
    e.durationMinutes ?? null,
    e.isManual ? 1 : 0,
    e.isBillable ? 1 : 0,
    e.billableRate ?? null,
    e.billableAmount ?? null,
    e.category ?? null,
    JSON.stringify(e.tags),
    e.createdAt,
    e.updatedAt,
    e.createdBy ?? null,
  ];
}

function updateParams(e: TimeEntry): unknown[] {
  return [
    e.taskId ?? null,
    e.projectId ?? null,
    e.focusSessionId ?? null,
    e.description ?? null,
    e.startAt,
    e.endAt ?? null,
    e.durationMinutes ?? null,
    e.isManual ? 1 : 0,
    e.isBillable ? 1 : 0,
    e.billableRate ?? null,
    e.billableAmount ?? null,
    e.category ?? null,
    JSON.stringify(e.tags),
    e.updatedAt,
    e.createdBy ?? null,
    e.id,          // WHERE last
  ];
}

// ── Store ────────────────────────────────────────────────────

export interface TimeStore {
  entries:        TimeEntry[];
  activeEntryId:  ID | null;
  isLoaded:       boolean;
  settings:       TimeTrackingSettings | null;

  // Actions
  load:           () => Promise<void>;
  updateSettings: (patch: Partial<TimeTrackingSettings>) => Promise<void>;
  startTimer:     (partial?: Partial<TimeEntry>) => Promise<TimeEntry>;
  stopTimer:      () => Promise<void>;
  createEntry:    (partial: Partial<TimeEntry> & { startAt: ISODateTime }) => Promise<TimeEntry>;
  updateEntry:    (id: ID, changes: Partial<TimeEntry>) => Promise<void>;
  deleteEntry:    (id: ID) => Promise<void>;

  // Selectors (derived — call outside render via getState or use in selectors)
  getActiveEntry: () => TimeEntry | null;
  getEntriesForDate: (date: string) => TimeEntry[];
  getEntriesForRange: (from: ISODateTime, to: ISODateTime) => TimeEntry[];
}

export const useTimeStore = create<TimeStore>((set, get) => ({
  entries:       [],
  activeEntryId: null,
  isLoaded:      false,
  settings:      null,

  load: async () => {
    const rows = await db.select<Record<string, unknown>>(
      `SELECT * FROM time_entries ORDER BY start_at DESC LIMIT 500`
    );
    const entries = rows.map(rowToEntry);
    
    // Load settings
    const settingsRows = await db.select<Record<string, unknown>>(`SELECT * FROM time_tracking_settings LIMIT 1`);
    let settings: TimeTrackingSettings | null = null;
    if (settingsRows.length > 0) {
      const s = settingsRows[0];
      settings = {
        id: s.id as string,
        defaultBillable: Boolean(s.default_billable),
        defaultHourlyRate: (s.default_hourly_rate as number) || undefined,
        currency: s.currency as string,
        roundEntries: s.round_entries as any,
        idleDetectionMin: s.idle_detection_min as number,
        reminderIntervalMin: s.reminder_interval_min as number,
        workHoursStart: s.work_hours_start as string,
        workHoursEnd: s.work_hours_end as string,
      };
    } else {
      settings = {
        id: generateId(),
        defaultBillable: false,
        currency: 'USD',
        roundEntries: 'none',
        idleDetectionMin: 0,
        reminderIntervalMin: 0,
        workHoursStart: '09:00',
        workHoursEnd: '17:00',
      };
      await db.execute(`
        INSERT INTO time_tracking_settings (id, default_billable, currency, round_entries, idle_detection_min, reminder_interval_min, work_hours_start, work_hours_end)
        VALUES (?, 0, 'USD', 'none', 0, 0, '09:00', '17:00')
      `, [settings.id]);
    }

    // Detect any running timer (no end_at)
    const active = entries.find((e) => !e.endAt) ?? null;
    set({ entries, activeEntryId: active?.id ?? null, settings, isLoaded: true });
  },

  updateSettings: async (patch) => {
    const current = get().settings;
    if (!current) return;
    const updated = { ...current, ...patch };
    await db.execute(`
      UPDATE time_tracking_settings
      SET default_billable=?, default_hourly_rate=?, currency=?, round_entries=?, idle_detection_min=?, reminder_interval_min=?, work_hours_start=?, work_hours_end=?
      WHERE id=?
    `, [
      updated.defaultBillable ? 1 : 0,
      updated.defaultHourlyRate ?? null,
      updated.currency,
      updated.roundEntries,
      updated.idleDetectionMin,
      updated.reminderIntervalMin,
      updated.workHoursStart,
      updated.workHoursEnd,
      updated.id
    ]);
    set({ settings: updated });
  },

  startTimer: async (partial = {}) => {
    // Stop existing timer first
    const { activeEntryId, stopTimer } = get();
    if (activeEntryId) await stopTimer();

    const entry: TimeEntry = {
      id:              generateId(),
      taskId:          partial.taskId,
      projectId:       partial.projectId,
      focusSessionId:  partial.focusSessionId,
      description:     partial.description ?? "",
      startAt:         now(),
      endAt:           undefined,
      durationMinutes: undefined,
      isManual:        partial.isManual ?? false,
      isBillable:      partial.isBillable ?? false,
      billableRate:    partial.billableRate,
      billableAmount:  undefined,
      category:        partial.category,
      tags:            partial.tags ?? [],
      createdAt:       now(),
      updatedAt:       now(),
      createdBy:       partial.createdBy,
    };

    await db.execute(INSERT_SQL, insertParams(entry));
    set((s) => ({ entries: [entry, ...s.entries], activeEntryId: entry.id }));
    bus.emit("time:timer-started", { entryId: entry.id });
    bus.emit("time:entry-created", { entry });
    return entry;
  },

  stopTimer: async () => {
    const { activeEntryId, entries } = get();
    if (!activeEntryId) return;

    const entry = entries.find((e) => e.id === activeEntryId);
    if (!entry) return;

    const endAt = now();
    const durationMinutes = Math.round(
      (new Date(endAt).getTime() - new Date(entry.startAt).getTime()) / 60000
    );

    const updated: TimeEntry = { ...entry, endAt, durationMinutes, updatedAt: now() };
    await db.execute(UPDATE_SQL, updateParams(updated));
    set((s) => ({
      entries: s.entries.map((e) => (e.id === activeEntryId ? updated : e)),
      activeEntryId: null,
    }));
    bus.emit("time:timer-stopped", { entryId: activeEntryId });
    bus.emit("time:entry-updated", { entry: updated });
  },

  createEntry: async (partial) => {
    const endAt = partial.endAt;
    const durationMinutes =
      partial.durationMinutes ??
      (endAt
        ? Math.round(
            (new Date(endAt).getTime() - new Date(partial.startAt).getTime()) / 60000
          )
        : undefined);

    const entry: TimeEntry = {
      id:              generateId(),
      taskId:          partial.taskId,
      projectId:       partial.projectId,
      focusSessionId:  partial.focusSessionId,
      description:     partial.description ?? "",
      startAt:         partial.startAt,
      endAt:           partial.endAt ?? endAt,
      durationMinutes: durationMinutes,
      isManual:        partial.isManual ?? true,
      isBillable:      partial.isBillable ?? false,
      billableRate:    partial.billableRate,
      billableAmount:  partial.billableAmount,
      category:        partial.category,
      tags:            partial.tags ?? [],
      createdAt:       now(),
      updatedAt:       now(),
      createdBy:       partial.createdBy,
    };

    await db.execute(INSERT_SQL, insertParams(entry));
    set((s) => ({ entries: [entry, ...s.entries] }));
    bus.emit("time:entry-created", { entry });
    return entry;
  },

  updateEntry: async (id, changes) => {
    const entry = get().entries.find((e) => e.id === id);
    if (!entry) return;

    const updated: TimeEntry = { ...entry, ...changes, updatedAt: now() };

    // Recalculate duration if start/end changed
    if ((changes.startAt || changes.endAt) && updated.endAt) {
      updated.durationMinutes = Math.round(
        (new Date(updated.endAt).getTime() - new Date(updated.startAt).getTime()) / 60000
      );
    }

    await db.execute(UPDATE_SQL, updateParams(updated));
    set((s) => ({ entries: s.entries.map((e) => (e.id === id ? updated : e)) }));
    bus.emit("time:entry-updated", { entry: updated });
  },

  deleteEntry: async (id) => {
    await db.execute(`DELETE FROM time_entries WHERE id=?`, [id]);
    set((s) => ({
      entries: s.entries.filter((e) => e.id !== id),
      activeEntryId: s.activeEntryId === id ? null : s.activeEntryId,
    }));
    bus.emit("time:entry-deleted", { entryId: id });
  },

  getActiveEntry: () => {
    const { entries, activeEntryId } = get();
    return entries.find((e) => e.id === activeEntryId) ?? null;
  },

  getEntriesForDate: (date) => {
    return get().entries.filter((e) => e.startAt.startsWith(date));
  },

  getEntriesForRange: (from, to) => {
    return get().entries.filter((e) => e.startAt >= from && e.startAt <= to);
  },
}));

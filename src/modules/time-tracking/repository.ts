// ============================================================
// TIME TRACKING — REPOSITORY
// DB access only — zero business logic.
// Only file in the time-tracking module that imports @/kernel/db.
// ============================================================

import { db } from "@/kernel/db";
import { generateId, now } from "@/shared/utils";
import { timeEntryDbRowSchema, type TimeEntry } from "./types";

// ── SQL ───────────────────────────────────────────────────────

const SELECT_RECENT_SQL = `
  SELECT * FROM time_entries
  ORDER BY start_at DESC
  LIMIT 500
`;

const INSERT_SQL = `
  INSERT INTO time_entries
    (id, task_id, project_id, focus_session_id, description,
     start_at, end_at, duration_minutes, is_billable, tags,
     created_at, updated_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
`;

const UPDATE_SQL = `
  UPDATE time_entries
  SET task_id=?, project_id=?, focus_session_id=?, description=?,
      start_at=?, end_at=?, duration_minutes=?, is_billable=?, tags=?,
      updated_at=?
  WHERE id=?
`;

const DELETE_SQL = `DELETE FROM time_entries WHERE id=?`;

// ── Row mapper — validates at DB boundary ─────────────────────

function rowToEntry(raw: Record<string, unknown>): TimeEntry {
  const row = timeEntryDbRowSchema.parse(raw);
  return {
    id:              row.id,
    taskId:          row.task_id          ?? undefined,
    projectId:       row.project_id       ?? undefined,
    focusSessionId:  row.focus_session_id ?? undefined,
    description:     row.description      ?? undefined,
    startAt:         row.start_at,
    endAt:           row.end_at           ?? undefined,
    durationMinutes: row.duration_minutes ?? undefined,
    isBillable:      Boolean(row.is_billable),
    tags:            JSON.parse(row.tags) as string[],
    createdAt:       row.created_at,
    updatedAt:       row.updated_at,
  };
}

// ── Param builders ────────────────────────────────────────────

function insertParams(e: TimeEntry): unknown[] {
  return [
    e.id,
    e.taskId          ?? null,
    e.projectId       ?? null,
    e.focusSessionId  ?? null,
    e.description     ?? null,
    e.startAt,
    e.endAt           ?? null,
    e.durationMinutes ?? null,
    e.isBillable ? 1 : 0,
    JSON.stringify(e.tags ?? []),
    e.createdAt,
    e.updatedAt,
  ];
}

function updateParams(e: TimeEntry): unknown[] {
  return [
    e.taskId          ?? null,
    e.projectId       ?? null,
    e.focusSessionId  ?? null,
    e.description     ?? null,
    e.startAt,
    e.endAt           ?? null,
    e.durationMinutes ?? null,
    e.isBillable ? 1 : 0,
    JSON.stringify(e.tags ?? []),
    e.updatedAt,
    e.id,
  ];
}

// ── Public API ────────────────────────────────────────────────

export async function dbLoadEntries(): Promise<TimeEntry[]> {
  const rows = await db.select<Record<string, unknown>[]>(SELECT_RECENT_SQL);
  return rows.map(rowToEntry);
}

export async function dbInsertEntry(e: TimeEntry): Promise<void> {
  await db.execute(INSERT_SQL, insertParams(e));
}

export async function dbUpdateEntry(e: TimeEntry): Promise<void> {
  await db.execute(UPDATE_SQL, updateParams(e));
}

export async function dbDeleteEntry(id: string): Promise<void> {
  await db.execute(DELETE_SQL, [id]);
}

// ── Factory ───────────────────────────────────────────────────

export function newEntry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  const t = now();
  return {
    id:             generateId(),
    startAt:        t,
    isBillable:     false,
    tags:           [],
    createdAt:      t,
    updatedAt:      t,
    ...overrides,
  };
}

// ============================================================
// FOCUS — DB
// Migration v70: initial focus_sessions table
// Migration v71: adds goal + interrupt_count columns
// Register BOTH in main.tsx: db.registerMigrations(FOCUS_MIGRATIONS)
// ============================================================

import type { Migration } from "@/kernel/db";
import { db } from "@/kernel/db";
import type { FocusSession } from "@/shared/types";
import { generateId, now } from "@/shared/utils";

// ── Migrations ─────────────────────────────────────────────────

export const FOCUS_MIGRATIONS: Migration[] = [
  {
    version: 70,
    module:  "focus",
    up: `
      CREATE TABLE IF NOT EXISTS focus_sessions (
        id               TEXT PRIMARY KEY,
        task_id          TEXT,
        project_id       TEXT,
        type             TEXT NOT NULL DEFAULT 'focus',
        planned_minutes  INTEGER NOT NULL DEFAULT 25,
        actual_minutes   INTEGER,
        state            TEXT NOT NULL DEFAULT 'idle',
        started_at       TEXT,
        completed_at     TEXT,
        notes            TEXT,
        created_at       TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_focus_sessions_task_id
        ON focus_sessions(task_id);
      CREATE INDEX IF NOT EXISTS idx_focus_sessions_project_id
        ON focus_sessions(project_id);
      CREATE INDEX IF NOT EXISTS idx_focus_sessions_started_at
        ON focus_sessions(started_at);
    `,
    down: `DROP TABLE IF EXISTS focus_sessions;`,
  },
  {
    version: 71,
    module:  "focus",
    up: `
      ALTER TABLE focus_sessions ADD COLUMN goal TEXT;
      ALTER TABLE focus_sessions ADD COLUMN interrupt_count INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE focus_sessions ADD COLUMN mood INTEGER;
    `,
    down: `
      -- SQLite does not support DROP COLUMN before 3.35; handled by full table drop on rollback
    `,
  },
];

// ── SQL ───────────────────────────────────────────────────────

const INSERT_SQL = `
  INSERT INTO focus_sessions
    (id, task_id, project_id, type, planned_minutes, actual_minutes,
     state, started_at, completed_at, notes, goal, interrupt_count, mood, created_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
`;

const UPDATE_SQL = `
  UPDATE focus_sessions
  SET task_id=?, project_id=?, type=?, planned_minutes=?, actual_minutes=?,
      state=?, started_at=?, completed_at=?, notes=?, goal=?,
      interrupt_count=?, mood=?
  WHERE id=?
`;

const SELECT_RECENT_SQL = `
  SELECT * FROM focus_sessions
  ORDER BY created_at DESC
  LIMIT 500
`;

const SELECT_TODAY_SQL = `
  SELECT * FROM focus_sessions
  WHERE date(started_at) = date('now')
  ORDER BY created_at DESC
`;

const SELECT_RANGE_SQL = `
  SELECT * FROM focus_sessions
  WHERE date(started_at) >= ? AND date(started_at) <= ?
  ORDER BY created_at DESC
`;

// ── Param builders — explicit column order, WHERE id last ──────────────────

function insertParams(s: FocusSession): unknown[] {
  return [
    s.id,
    s.taskId          ?? null,
    s.projectId       ?? null,
    s.type,
    s.plannedMinutes,
    s.actualMinutes   ?? null,
    s.state,
    s.startedAt       ?? null,
    s.completedAt     ?? null,
    s.notes           ?? null,
    s.goal            ?? null,
    s.interruptCount  ?? 0,
    s.mood            ?? null,
    s.createdAt,
  ];
}

function updateParams(s: FocusSession): unknown[] {
  return [
    s.taskId          ?? null,
    s.projectId       ?? null,
    s.type,
    s.plannedMinutes,
    s.actualMinutes   ?? null,
    s.state,
    s.startedAt       ?? null,
    s.completedAt     ?? null,
    s.notes           ?? null,
    s.goal            ?? null,
    s.interruptCount  ?? 0,
    s.mood            ?? null,
    s.id, // WHERE last
  ];
}

function rowToSession(row: Record<string, unknown>): FocusSession {
  return {
    id:             row.id as string,
    taskId:         (row.task_id       as string | null) ?? undefined,
    projectId:      (row.project_id    as string | null) ?? undefined,
    type:           row.type as FocusSession["type"],
    plannedMinutes: row.planned_minutes as number,
    actualMinutes:  (row.actual_minutes as number | null) ?? undefined,
    state:          row.state as FocusSession["state"],
    startedAt:      (row.started_at    as string | null) ?? undefined,
    completedAt:    (row.completed_at  as string | null) ?? undefined,
    notes:          (row.notes         as string | null) ?? undefined,
    goal:           (row.goal          as string | null) ?? undefined,
    interruptCount: (row.interrupt_count as number | null) ?? 0,
    mood:           (row.mood          as 1|2|3|4|5 | null) ?? undefined,
    createdAt:      row.created_at as string,
  };
}

// ── Public DB API ──────────────────────────────────────────────

export async function dbLoadSessions(): Promise<FocusSession[]> {
  const rows = await db.select<Record<string, unknown>[]>(SELECT_RECENT_SQL);
  return rows.map(rowToSession);
}

export async function dbLoadTodaySessions(): Promise<FocusSession[]> {
  const rows = await db.select<Record<string, unknown>>(SELECT_TODAY_SQL);
  return rows.map(rowToSession);
}

export async function dbLoadSessionsInRange(from: string, to: string): Promise<FocusSession[]> {
  const rows = await db.select<Record<string, unknown>>(SELECT_RANGE_SQL, [from, to]);
  return rows.map(rowToSession);
}

export async function dbInsertSession(s: FocusSession): Promise<void> {
  await db.execute(INSERT_SQL, insertParams(s));
}

export async function dbUpdateSession(s: FocusSession): Promise<void> {
  await db.execute(UPDATE_SQL, updateParams(s));
}

// ── Factory ───────────────────────────────────────────────────────

export function newSession(overrides: Partial<FocusSession> = {}): FocusSession {
  return {
    id:             generateId(),
    type:           "focus",
    plannedMinutes: 25,
    state:          "idle",
    interruptCount: 0,
    createdAt:      now(),
    ...overrides,
  };
}

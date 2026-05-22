// ============================================================
// FOCUS — REPOSITORY
// DB access only — zero business logic.
// Only file in the focus module that imports @/kernel/db.
// ============================================================

import { db } from "@/kernel/db";
import { generateId, now } from "@/shared/utils";
import { focusSessionDbRowSchema, type FocusSession } from "./types";

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

// ── Row mapper — validates at DB boundary ─────────────────────

function rowToSession(raw: Record<string, unknown>): FocusSession {
  const row = focusSessionDbRowSchema.parse(raw);
  return {
    id:             row.id,
    taskId:         row.task_id         ?? undefined,
    projectId:      row.project_id      ?? undefined,
    type:           row.type,
    plannedMinutes: row.planned_minutes,
    actualMinutes:  row.actual_minutes  ?? undefined,
    state:          row.state,
    startedAt:      row.started_at      ?? undefined,
    completedAt:    row.completed_at    ?? undefined,
    notes:          row.notes           ?? undefined,
    goal:           row.goal            ?? undefined,
    interruptCount: row.interrupt_count ?? 0,
    mood:           row.mood            ?? undefined,
    createdAt:      row.created_at,
  };
}

// ── Param builders ────────────────────────────────────────────

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
    s.id,
  ];
}

// ── Public API ────────────────────────────────────────────────

export async function dbLoadSessions(): Promise<FocusSession[]> {
  const rows = await db.select<Record<string, unknown>[]>(SELECT_RECENT_SQL);
  return rows.map(rowToSession);
}

export async function dbLoadTodaySessions(): Promise<FocusSession[]> {
  const rows = await db.select<Record<string, unknown>[]>(SELECT_TODAY_SQL);
  return rows.map(rowToSession);
}

export async function dbLoadSessionsInRange(from: string, to: string): Promise<FocusSession[]> {
  const rows = await db.select<Record<string, unknown>[]>(SELECT_RANGE_SQL, [from, to]);
  return rows.map(rowToSession);
}

export async function dbInsertSession(s: FocusSession): Promise<void> {
  await db.execute(INSERT_SQL, insertParams(s));
}

export async function dbUpdateSession(s: FocusSession): Promise<void> {
  await db.execute(UPDATE_SQL, updateParams(s));
}

// ── Factory ───────────────────────────────────────────────────

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

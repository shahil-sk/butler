// ============================================================
// PLANNER — REPOSITORY
// DB access only — zero business logic.
// Only file in the planner module that imports @/kernel/db.
// Covers both planner_blocks and planner_templates tables.
// ============================================================

import { db } from "@/kernel/db";
import {
  timeBlockDbRowSchema,
  planTemplateDbRowSchema,
  type TimeBlock,
  type TemplateBlock,
  type PlanTemplate,
} from "./types";

// ── Row mappers ────────────────────────────────────────────────

function rowToBlock(raw: Record<string, unknown>): TimeBlock {
  const row = timeBlockDbRowSchema.parse(raw);
  return {
    id:        row.id,
    date:      row.date,
    taskId:    row.task_id ?? undefined,
    title:     row.title,
    startTime: row.start_time,
    endTime:   row.end_time,
    color:     row.color ?? undefined,
    isBreak:   row.is_break,
    notes:     row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToTemplate(raw: Record<string, unknown>): PlanTemplate {
  const row = planTemplateDbRowSchema.parse(raw);
  return {
    id:        row.id,
    name:      row.name,
    blocks:    row.blocks_json,
    createdAt: row.created_at,
  };
}

// ── SQL constants ───────────────────────────────────────────────

const INSERT_BLOCK_SQL = `
  INSERT INTO planner_blocks
    (id, date, task_id, title, start_time, end_time, color, is_break, notes, created_at, updated_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?)
`;
const UPDATE_BLOCK_SQL = `
  UPDATE planner_blocks SET
    date=?, task_id=?, title=?, start_time=?, end_time=?,
    color=?, is_break=?, notes=?, updated_at=?
  WHERE id=?
`;

function insertBlockParams(b: TimeBlock): unknown[] {
  return [
    b.id, b.date, b.taskId ?? null, b.title, b.startTime, b.endTime,
    b.color ?? null, b.isBreak ? 1 : 0, b.notes ?? null, b.createdAt, b.updatedAt,
  ];
}
function updateBlockParams(b: TimeBlock): unknown[] {
  return [
    b.date, b.taskId ?? null, b.title, b.startTime, b.endTime,
    b.color ?? null, b.isBreak ? 1 : 0, b.notes ?? null, b.updatedAt,
    b.id,
  ];
}

// ── Block DB functions ────────────────────────────────────────────

export async function dbLoadBlocksByDate(date: string): Promise<TimeBlock[]> {
  const rows = await db.select<Record<string, unknown>[]>(
    "SELECT * FROM planner_blocks WHERE date=? ORDER BY start_time ASC",
    [date]
  );
  return rows.map(rowToBlock);
}

export async function dbLoadBlocksByDateRange(
  startDate: string,
  endDateExclusive: string
): Promise<TimeBlock[]> {
  const rows = await db.select<Record<string, unknown>[]>(
    "SELECT * FROM planner_blocks WHERE date >= ? AND date < ? ORDER BY date ASC, start_time ASC",
    [startDate, endDateExclusive]
  );
  return rows.map(rowToBlock);
}

export async function dbInsertBlock(b: TimeBlock): Promise<void> {
  await db.execute(INSERT_BLOCK_SQL, insertBlockParams(b));
}

export async function dbUpdateBlock(b: TimeBlock): Promise<void> {
  await db.execute(UPDATE_BLOCK_SQL, updateBlockParams(b));
}

export async function dbDeleteBlock(id: string): Promise<void> {
  await db.execute("DELETE FROM planner_blocks WHERE id=?", [id]);
}

// ── Template DB functions ─────────────────────────────────────────

export async function dbLoadTemplates(): Promise<PlanTemplate[]> {
  const rows = await db.select<Record<string, unknown>[]>(
    "SELECT * FROM planner_templates ORDER BY created_at DESC",
    []
  );
  return rows.map(rowToTemplate);
}

export async function dbInsertTemplate(
  id: string, name: string, blocks: TemplateBlock[], createdAt: string
): Promise<void> {
  await db.execute(
    "INSERT INTO planner_templates (id, name, blocks_json, created_at) VALUES (?,?,?,?)",
    [id, name, JSON.stringify(blocks), createdAt]
  );
}

export async function dbDeleteTemplate(id: string): Promise<void> {
  await db.execute("DELETE FROM planner_templates WHERE id=?", [id]);
}

// ── Carry-forward DB function ──────────────────────────────────────

export async function dbInsertCarryForward(
  taskId: string, fromDate: string, toDate: string, createdAt: string
): Promise<void> {
  const id = `cf-${taskId}-${toDate}`;
  await db.execute(
    "INSERT OR IGNORE INTO planner_carry_forward (id, task_id, from_date, to_date, created_at) VALUES (?,?,?,?,?)",
    [id, taskId, fromDate, toDate, createdAt]
  );
}

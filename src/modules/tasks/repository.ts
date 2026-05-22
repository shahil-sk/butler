// ============================================================
// TASKS — REPOSITORY
// DB access only. Zero business logic.
// All JSON serialisation / deserialisation happens at this
// boundary. Nothing above this layer ever touches db directly.
// ============================================================

import { db } from "@/kernel/db";
import type { Task, ChecklistItem } from "@/shared/types";
import { taskDbRowSchema } from "./types";

// ── SQL ───────────────────────────────────────────────────────

const SELECT_ACTIVE_SQL =
  "SELECT * FROM tasks WHERE status != 'archived' ORDER BY sort_order ASC, created_at DESC";

const SELECT_BY_ID_SQL = "SELECT * FROM tasks WHERE id=? LIMIT 1";

const SELECT_BY_PROJECT_SQL =
  "SELECT * FROM tasks WHERE project_id=? AND status != 'archived' ORDER BY sort_order ASC";

const SELECT_PURGE_CANDIDATES_SQL = `
  SELECT id FROM tasks
  WHERE (status = 'done' OR status = 'cancelled')
    AND completed_at IS NOT NULL
    AND completed_at < ?
`;

const INSERT_SQL = `
  INSERT INTO tasks (
    id, title, description, status, priority,
    project_id, parent_task_id, labels, tags,
    due_date, start_date, scheduled_date, completed_at,
    estimate_minutes, actual_minutes, recurrence,
    dependencies, checklist_items, linked_note_ids, linked_event_ids,
    sort_order, created_at, updated_at
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
`;

const UPDATE_SQL = `
  UPDATE tasks SET
    title=?, description=?, status=?, priority=?,
    project_id=?, parent_task_id=?, labels=?, tags=?,
    due_date=?, start_date=?, scheduled_date=?, completed_at=?,
    estimate_minutes=?, actual_minutes=?, recurrence=?,
    dependencies=?, checklist_items=?, linked_note_ids=?, linked_event_ids=?,
    sort_order=?, updated_at=?
  WHERE id=?
`;

const DELETE_SQL = "DELETE FROM tasks WHERE id=?";

const REORDER_SQL = "UPDATE tasks SET sort_order=?, updated_at=? WHERE id=?";

// ── Row mapper ────────────────────────────────────────────────

export function rowToTask(raw: Record<string, unknown>): Task {
  // Validate at the DB boundary — throws if schema drifts
  const r = taskDbRowSchema.parse(raw);
  return {
    id:              r.id,
    title:           r.title,
    description:     r.description ?? undefined,
    status:          r.status,
    priority:        r.priority,
    projectId:       r.project_id ?? undefined,
    parentTaskId:    r.parent_task_id ?? undefined,
    labels:          JSON.parse(r.labels),
    tags:            JSON.parse(r.tags),
    dueDate:         r.due_date ?? undefined,
    startDate:       r.start_date ?? undefined,
    scheduledDate:   r.scheduled_date ?? undefined,
    completedAt:     r.completed_at ?? undefined,
    estimateMinutes: r.estimate_minutes ?? undefined,
    actualMinutes:   r.actual_minutes ?? undefined,
    recurrence:      r.recurrence ? JSON.parse(r.recurrence) : undefined,
    dependencies:    JSON.parse(r.dependencies),
    checklistItems:  JSON.parse(r.checklist_items) as ChecklistItem[],
    linkedNoteIds:   JSON.parse(r.linked_note_ids),
    linkedEventIds:  JSON.parse(r.linked_event_ids),
    order:           r.sort_order,
    createdAt:       r.created_at,
    updatedAt:       r.updated_at,
  };
}

// ── Param builders ────────────────────────────────────────────

function insertParams(t: Task): unknown[] {
  return [
    t.id, t.title, t.description ?? null, t.status, t.priority,
    t.projectId ?? null, t.parentTaskId ?? null,
    JSON.stringify(t.labels), JSON.stringify(t.tags),
    t.dueDate ?? null, t.startDate ?? null, t.scheduledDate ?? null, t.completedAt ?? null,
    t.estimateMinutes ?? null, t.actualMinutes ?? null,
    t.recurrence ? JSON.stringify(t.recurrence) : null,
    JSON.stringify(t.dependencies), JSON.stringify(t.checklistItems),
    JSON.stringify(t.linkedNoteIds), JSON.stringify(t.linkedEventIds),
    t.order, t.createdAt, t.updatedAt,
  ];
}

function updateParams(t: Task): unknown[] {
  return [
    t.title, t.description ?? null, t.status, t.priority,
    t.projectId ?? null, t.parentTaskId ?? null,
    JSON.stringify(t.labels), JSON.stringify(t.tags),
    t.dueDate ?? null, t.startDate ?? null, t.scheduledDate ?? null, t.completedAt ?? null,
    t.estimateMinutes ?? null, t.actualMinutes ?? null,
    t.recurrence ? JSON.stringify(t.recurrence) : null,
    JSON.stringify(t.dependencies), JSON.stringify(t.checklistItems),
    JSON.stringify(t.linkedNoteIds), JSON.stringify(t.linkedEventIds),
    t.order, t.updatedAt,
    t.id, // WHERE last
  ];
}

// ── Public API ────────────────────────────────────────────────

export async function dbFindAllActive(): Promise<Task[]> {
  const rows = await db.select<Record<string, unknown>[]>(SELECT_ACTIVE_SQL);
  return rows.map(rowToTask);
}

export async function dbFindById(id: string): Promise<Task | null> {
  const rows = await db.select<Record<string, unknown>[]>(SELECT_BY_ID_SQL, [id]);
  return rows.length ? rowToTask(rows[0]) : null;
}

export async function dbFindByProject(projectId: string): Promise<Task[]> {
  const rows = await db.select<Record<string, unknown>[]>(SELECT_BY_PROJECT_SQL, [projectId]);
  return rows.map(rowToTask);
}

export async function dbFindPurgeCandidates(cutoffIso: string): Promise<{ id: string }[]> {
  return db.select<{ id: string }[]>(SELECT_PURGE_CANDIDATES_SQL, [cutoffIso]);
}

export async function dbInsertTask(task: Task): Promise<void> {
  await db.execute(INSERT_SQL, insertParams(task));
}

export async function dbUpdateTask(task: Task): Promise<void> {
  await db.execute(UPDATE_SQL, updateParams(task));
}

export async function dbDeleteTask(id: string): Promise<void> {
  await db.execute(DELETE_SQL, [id]);
}

export async function dbDeleteTasks(ids: string[]): Promise<void> {
  await db.transaction(async (tx) => {
    for (const id of ids) await tx.execute(DELETE_SQL, [id]);
  });
}

export async function dbReorderTasks(ids: string[], updatedAt: string): Promise<void> {
  await db.transaction(async (tx) => {
    for (let i = 0; i < ids.length; i++) {
      await tx.execute(REORDER_SQL, [i * 1000, updatedAt, ids[i]]);
    }
  });
}

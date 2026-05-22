// ============================================================
// PROJECTS — REPOSITORY
// DB access only — zero business logic.
// Only file in the projects module that imports @/kernel/db.
// ============================================================

import { db } from "@/kernel/db";
import { projectDbRowSchema, type Project } from "./types";

// ── Row mapper — validates at DB boundary ────────────────────

function rowToProject(raw: Record<string, unknown>): Project {
  const row = projectDbRowSchema.parse(raw);
  return {
    id:            row.id,
    name:          row.name,
    description:   row.description ?? undefined,
    status:        row.status,
    color:         row.color,
    icon:          row.icon ?? undefined,
    startDate:     row.start_date ?? undefined,
    dueDate:       row.due_date ?? undefined,
    milestones:    row.milestones,
    linkedNoteIds: row.linked_note_ids,
    order:         row.sort_order,
    createdAt:     row.created_at,
    updatedAt:     row.updated_at,
  };
}

// ── SQL ───────────────────────────────────────────────────────

const INSERT_SQL = `
  INSERT INTO projects (
    id, name, description, status, color, icon,
    start_date, due_date, milestones, linked_note_ids,
    sort_order, created_at, updated_at
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
`;

const UPDATE_SQL = `
  UPDATE projects SET
    name=?, description=?, status=?, color=?, icon=?,
    start_date=?, due_date=?, milestones=?, linked_note_ids=?,
    sort_order=?, updated_at=?
  WHERE id=?
`;

// ── Param builders ────────────────────────────────────────────

function insertParams(p: Project): unknown[] {
  return [
    p.id, p.name, p.description ?? null, p.status, p.color, p.icon ?? null,
    p.startDate ?? null, p.dueDate ?? null,
    JSON.stringify(p.milestones), JSON.stringify(p.linkedNoteIds),
    p.order, p.createdAt, p.updatedAt,
  ];
}

function updateParams(p: Project): unknown[] {
  return [
    p.name, p.description ?? null, p.status, p.color, p.icon ?? null,
    p.startDate ?? null, p.dueDate ?? null,
    JSON.stringify(p.milestones), JSON.stringify(p.linkedNoteIds),
    p.order, p.updatedAt,
    p.id, // WHERE
  ];
}

// ── Public API ────────────────────────────────────────────────

export async function dbLoadAllProjects(): Promise<Project[]> {
  const rows = await db.select<Record<string, unknown>[]>(
    "SELECT * FROM projects ORDER BY sort_order ASC, created_at DESC"
  );
  return rows.map(rowToProject);
}

export async function dbFindProjectById(id: string): Promise<Project | null> {
  const rows = await db.select<Record<string, unknown>[]>(
    "SELECT * FROM projects WHERE id=? LIMIT 1", [id]
  );
  return rows.length > 0 ? rowToProject(rows[0]) : null;
}

export async function dbInsertProject(p: Project): Promise<void> {
  await db.execute(INSERT_SQL, insertParams(p));
}

export async function dbUpdateProject(p: Project): Promise<void> {
  await db.execute(UPDATE_SQL, updateParams(p));
}

export async function dbDeleteProject(id: string): Promise<void> {
  await db.execute("DELETE FROM projects WHERE id=?", [id]);
}

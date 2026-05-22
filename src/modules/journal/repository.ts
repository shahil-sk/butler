// ============================================================
// JOURNAL — REPOSITORY
// DB access only — zero business logic.
// Only file in the journal module that imports @/kernel/db.
// ============================================================

import { db } from "@/kernel/db";
import { journalEntryDbRowSchema, type JournalEntry } from "./types";

// ── Row mapper — validates at DB boundary ─────────────────────

function rowToEntry(raw: Record<string, unknown>): JournalEntry {
  const row = journalEntryDbRowSchema.parse(raw);
  return {
    id:               row.id,
    date:             row.date,
    type:             row.type,
    content:          row.content,
    mood:             row.mood ?? undefined,
    linkedTaskIds:    row.linked_task_ids,
    linkedProjectIds: row.linked_project_ids,
    tags:             row.tags,
    createdAt:        row.created_at,
    updatedAt:        row.updated_at,
  };
}

// ── SQL ───────────────────────────────────────────────────────

const INSERT_SQL = `
  INSERT INTO journal_entries
    (id, date, type, content, mood, linked_task_ids, linked_project_ids, tags, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const UPDATE_SQL = `
  UPDATE journal_entries
  SET date=?, type=?, content=?, mood=?, linked_task_ids=?, linked_project_ids=?, tags=?, updated_at=?
  WHERE id=?
`;

const SELECT_ALL_SQL = `
  SELECT * FROM journal_entries ORDER BY date DESC, created_at DESC
`;

const SELECT_BY_DATE_TYPE_SQL = `
  SELECT * FROM journal_entries WHERE date=? AND type=? LIMIT 1
`;

// ── Param builders ────────────────────────────────────────────

function insertParams(e: JournalEntry): unknown[] {
  return [
    e.id,
    e.date,
    e.type,
    e.content,
    e.mood ?? null,
    JSON.stringify(e.linkedTaskIds),
    JSON.stringify(e.linkedProjectIds),
    JSON.stringify(e.tags),
    e.createdAt,
    e.updatedAt,
  ];
}

function updateParams(e: JournalEntry): unknown[] {
  return [
    e.date,
    e.type,
    e.content,
    e.mood ?? null,
    JSON.stringify(e.linkedTaskIds),
    JSON.stringify(e.linkedProjectIds),
    JSON.stringify(e.tags),
    e.updatedAt,
    e.id,
  ];
}

// ── Public API ────────────────────────────────────────────────

export async function dbLoadAllEntries(): Promise<JournalEntry[]> {
  const rows = await db.select<Record<string, unknown>[]>(SELECT_ALL_SQL);
  return rows.map(rowToEntry);
}

export async function dbFindDailyEntry(date: string): Promise<JournalEntry | null> {
  const rows = await db.select<Record<string, unknown>[]>(SELECT_BY_DATE_TYPE_SQL, [date, "daily"]);
  return rows.length > 0 ? rowToEntry(rows[0]) : null;
}

export async function dbInsertEntry(e: JournalEntry): Promise<void> {
  await db.execute(INSERT_SQL, insertParams(e));
}

export async function dbUpdateEntry(e: JournalEntry): Promise<void> {
  await db.execute(UPDATE_SQL, updateParams(e));
}

export async function dbDeleteEntry(id: string): Promise<void> {
  await db.execute("DELETE FROM journal_entries WHERE id=?", [id]);
}

// src/modules/notes/repository.ts
// DB access only — zero business logic.
// No bus emissions, no store access, no cross-module imports.

import { db } from '@/kernel/db';
import type { Note, NoteFtsResult } from './types';

// ── Row mapper ───────────────────────────────────────────────────

function rowToNote(r: Record<string, unknown>): Note {
  return {
    id:               r.id as string,
    title:            r.title as string,
    content:          r.content as string,
    type:             r.type as Note['type'],
    date:             (r.date as string | null) ?? undefined,
    linkedTaskIds:    JSON.parse((r.linked_task_ids    as string) || '[]'),
    linkedProjectIds: JSON.parse((r.linked_project_ids as string) || '[]'),
    linkedEventIds:   JSON.parse((r.linked_event_ids   as string) || '[]'),
    backlinks:        JSON.parse((r.backlinks           as string) || '[]'),
    tags:             JSON.parse((r.tags                as string) || '[]'),
    isPinned:         Boolean(r.is_pinned),
    createdAt:        r.created_at as string,
    updatedAt:        r.updated_at as string,
  };
}

// ── SQL constants ────────────────────────────────────────────────

const INSERT_SQL = `
  INSERT INTO notes
    (id, title, content, type, date,
     linked_task_ids, linked_project_ids, linked_event_ids,
     backlinks, tags, is_pinned, created_at, updated_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
`;

const UPDATE_SQL = `
  UPDATE notes SET
    title=?, content=?, type=?, date=?,
    linked_task_ids=?, linked_project_ids=?, linked_event_ids=?,
    backlinks=?, tags=?, is_pinned=?, updated_at=?
  WHERE id=?
`;

function insertParams(n: Note): unknown[] {
  return [
    n.id, n.title, n.content, n.type, n.date ?? null,
    JSON.stringify(n.linkedTaskIds), JSON.stringify(n.linkedProjectIds),
    JSON.stringify(n.linkedEventIds), JSON.stringify(n.backlinks),
    JSON.stringify(n.tags), n.isPinned ? 1 : 0,
    n.createdAt, n.updatedAt,
  ];
}

function updateParams(n: Note): unknown[] {
  return [
    n.title, n.content, n.type, n.date ?? null,
    JSON.stringify(n.linkedTaskIds), JSON.stringify(n.linkedProjectIds),
    JSON.stringify(n.linkedEventIds), JSON.stringify(n.backlinks),
    JSON.stringify(n.tags), n.isPinned ? 1 : 0, n.updatedAt,
    n.id,
  ];
}

// ── Reads ──────────────────────────────────────────────────────────

export async function findAllNotes(): Promise<Note[]> {
  const rows = await db.select<Record<string, unknown>>(
    'SELECT * FROM notes ORDER BY is_pinned DESC, updated_at DESC',
  );
  return rows.map(rowToNote);
}

export async function findNoteById(id: string): Promise<Note | undefined> {
  const rows = await db.select<Record<string, unknown>>(
    'SELECT * FROM notes WHERE id = ?', [id],
  );
  return rows[0] ? rowToNote(rows[0]) : undefined;
}

export async function findDailyNote(date: string): Promise<Note | undefined> {
  const rows = await db.select<Record<string, unknown>>(
    `SELECT * FROM notes WHERE type = 'daily' AND date = ? LIMIT 1`, [date],
  );
  return rows[0] ? rowToNote(rows[0]) : undefined;
}

/** Full-text search via FTS5.  Returns id, title, snippet, rank. */
export async function searchNotesFts(query: string): Promise<NoteFtsResult[]> {
  // notes_fts is an FTS5 content table backed by notes.
  // bm25() returns a negative relevance score; ORDER BY rank ASC = best first.
  const rows = await db.select<Record<string, unknown>>(
    `SELECT f.id, n.title,
            snippet(notes_fts, 2, '<mark>', '</mark>', '…', 20) AS snippet,
            bm25(notes_fts) AS rank
     FROM notes_fts f
     JOIN notes n ON n.id = f.id
     WHERE notes_fts MATCH ?
     ORDER BY rank`,
    [query],
  );
  return rows.map((r) => ({
    id:      r.id as string,
    title:   r.title as string,
    snippet: r.snippet as string,
    rank:    r.rank as number,
  }));
}

// ── Writes ──────────────────────────────────────────────────────────

export async function insertNote(note: Note): Promise<void> {
  await db.execute(INSERT_SQL, insertParams(note));
}

export async function updateNote(note: Note): Promise<void> {
  await db.execute(UPDATE_SQL, updateParams(note));
}

export async function deleteNote(id: string): Promise<void> {
  await db.execute('DELETE FROM notes WHERE id = ?', [id]);
}

// ── Cross-module unlink helpers ───────────────────────────────────────

/** Remove taskId from linked_task_ids of every note that references it. */
export async function unlinkTaskFromNotes(taskId: string): Promise<string[]> {
  // Use json_each to find affected notes in SQL rather than loading all notes.
  const rows = await db.select<Record<string, unknown>>(
    `SELECT n.* FROM notes n, json_each(n.linked_task_ids) j WHERE j.value = ?`,
    [taskId],
  );
  const affected = rows.map(rowToNote);
  for (const note of affected) {
    const patched = {
      ...note,
      linkedTaskIds: note.linkedTaskIds.filter((id) => id !== taskId),
    };
    await updateNote(patched);
  }
  return affected.map((n) => n.id);
}

/** Remove projectId from linked_project_ids of every note that references it. */
export async function unlinkProjectFromNotes(projectId: string): Promise<string[]> {
  const rows = await db.select<Record<string, unknown>>(
    `SELECT n.* FROM notes n, json_each(n.linked_project_ids) j WHERE j.value = ?`,
    [projectId],
  );
  const affected = rows.map(rowToNote);
  for (const note of affected) {
    const patched = {
      ...note,
      linkedProjectIds: note.linkedProjectIds.filter((id) => id !== projectId),
    };
    await updateNote(patched);
  }
  return affected.map((n) => n.id);
}

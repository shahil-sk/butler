// src/modules/calendar/repository.ts
// DB access only — zero business logic.
// All functions accept and return plain domain objects (CalendarEvent / Calendar).
// No bus emissions, no store access, no cross-module imports.

import { db } from '@/kernel/db';
import type { CalendarEvent, Calendar } from './types';

// ── Row mappers ──────────────────────────────────────────────────

function rowToEvent(r: Record<string, unknown>): CalendarEvent {
  return {
    id:            r.id as string,
    title:         r.title as string,
    description:   (r.description as string | null) ?? undefined,
    startAt:       r.start_at as string,
    endAt:         r.end_at as string,
    allDay:        Boolean(r.all_day),
    color:         (r.color as string | null) ?? undefined,
    calendarId:    r.calendar_id as string,
    linkedTaskIds: JSON.parse((r.linked_task_ids as string) || '[]'),
    linkedNoteIds: JSON.parse((r.linked_note_ids as string) || '[]'),
    isTimeBlock:   Boolean(r.is_time_block),
    recurrence:    r.recurrence ? JSON.parse(r.recurrence as string) : undefined,
    createdAt:     r.created_at as string,
    updatedAt:     r.updated_at as string,
  };
}

function rowToCalendar(r: Record<string, unknown>): Calendar {
  return {
    id:        r.id as string,
    name:      r.name as string,
    color:     r.color as string,
    isDefault: Boolean(r.is_default),
    isVisible: Boolean(r.is_visible),
    source:    r.source as Calendar['source'],
    sourceUrl: (r.source_url as string | null) ?? undefined,
  };
}

// ── SQL constants ────────────────────────────────────────────────

const INSERT_EVENT_SQL = `
  INSERT INTO calendar_events
    (id, title, description, start_at, end_at, all_day, color,
     calendar_id, linked_task_ids, linked_note_ids, is_time_block, recurrence, created_at, updated_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
`;

const UPDATE_EVENT_SQL = `
  UPDATE calendar_events SET
    title=?, description=?, start_at=?, end_at=?, all_day=?, color=?,
    calendar_id=?, linked_task_ids=?, linked_note_ids=?, is_time_block=?, recurrence=?, updated_at=?
  WHERE id=?
`;

function insertEventParams(e: CalendarEvent): unknown[] {
  return [
    e.id, e.title, e.description ?? null, e.startAt, e.endAt,
    e.allDay ? 1 : 0, e.color ?? null, e.calendarId,
    JSON.stringify(e.linkedTaskIds), JSON.stringify(e.linkedNoteIds),
    e.isTimeBlock ? 1 : 0,
    e.recurrence ? JSON.stringify(e.recurrence) : null,
    e.createdAt, e.updatedAt,
  ];
}

function updateEventParams(e: CalendarEvent): unknown[] {
  return [
    e.title, e.description ?? null, e.startAt, e.endAt,
    e.allDay ? 1 : 0, e.color ?? null, e.calendarId,
    JSON.stringify(e.linkedTaskIds), JSON.stringify(e.linkedNoteIds),
    e.isTimeBlock ? 1 : 0,
    e.recurrence ? JSON.stringify(e.recurrence) : null,
    e.updatedAt,
    e.id,
  ];
}

// ── Calendars ────────────────────────────────────────────────────

export async function findAllCalendars(): Promise<Calendar[]> {
  const rows = await db.select<Record<string, unknown>>(
    'SELECT * FROM calendars ORDER BY is_default DESC',
  );
  return rows.map(rowToCalendar);
}

export async function findCalendarById(id: string): Promise<Calendar | undefined> {
  const rows = await db.select<Record<string, unknown>>(
    'SELECT * FROM calendars WHERE id = ?', [id],
  );
  return rows[0] ? rowToCalendar(rows[0]) : undefined;
}

// ── Events ───────────────────────────────────────────────────────

/** Load events whose time window overlaps [from, to] (ISO datetime strings). */
export async function findEventsInRange(
  from: string,
  to: string,
): Promise<CalendarEvent[]> {
  const rows = await db.select<Record<string, unknown>>(
    `SELECT * FROM calendar_events
     WHERE end_at >= ? AND start_at <= ?
     ORDER BY start_at ASC`,
    [from, to],
  );
  return rows.map(rowToEvent);
}

export async function findEventById(id: string): Promise<CalendarEvent | undefined> {
  const rows = await db.select<Record<string, unknown>>(
    'SELECT * FROM calendar_events WHERE id = ?', [id],
  );
  return rows[0] ? rowToEvent(rows[0]) : undefined;
}

/** Find all events whose linked_task_ids JSON array contains taskId. */
export async function findEventsByTaskId(taskId: string): Promise<CalendarEvent[]> {
  // SQLite JSON function: json_each expands the array so we can filter by value.
  const rows = await db.select<Record<string, unknown>>(
    `SELECT e.* FROM calendar_events e, json_each(e.linked_task_ids) j
     WHERE j.value = ?`,
    [taskId],
  );
  return rows.map(rowToEvent);
}

export async function insertEvent(event: CalendarEvent): Promise<void> {
  await db.execute(INSERT_EVENT_SQL, insertEventParams(event));
}

export async function updateEvent(event: CalendarEvent): Promise<void> {
  await db.execute(UPDATE_EVENT_SQL, updateEventParams(event));
}

export async function deleteEvent(id: string): Promise<void> {
  await db.execute('DELETE FROM calendar_events WHERE id = ?', [id]);
}

/** Remove taskId from linked_task_ids of every event that references it. */
export async function unlinkTaskFromEvents(taskId: string): Promise<string[]> {
  const affected = await findEventsByTaskId(taskId);
  for (const ev of affected) {
    const patched = {
      ...ev,
      linkedTaskIds: ev.linkedTaskIds.filter((t) => t !== taskId),
    };
    await updateEvent(patched);
  }
  return affected.map((e) => e.id);
}

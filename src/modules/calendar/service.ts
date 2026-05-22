// src/modules/calendar/service.ts
// Business logic only.
// Calls repository for all DB access. Emits bus events for cross-module
// reactions. No direct db import, no store import, no UI imports.

import { generateId, now } from '@/shared/utils';
import { bus } from '@/kernel/event-bus';
import * as repo from './repository';
import type { CalendarEvent, Calendar, CreateEventInput, UpdateEventInput } from './types';

// ── Calendars ────────────────────────────────────────────────────

export async function loadCalendars(): Promise<Calendar[]> {
  return repo.findAllCalendars();
}

// ── Events — read ────────────────────────────────────────────────

export async function loadEventsInRange(
  from: string,
  to: string,
): Promise<CalendarEvent[]> {
  return repo.findEventsInRange(from, to);
}

// ── Events — in-memory filters (pure, called from store selectors) ─

/**
 * Returns events from the given list that overlap the window [from, to],
 * filtered to visible calendars only.
 */
export function filterEventsInRange(
  events: CalendarEvent[],
  calendars: Calendar[],
  from: string,
  to: string,
): CalendarEvent[] {
  const visibleIds = new Set(
    calendars.filter((c) => c.isVisible).map((c) => c.id),
  );
  return events.filter(
    (e) => visibleIds.has(e.calendarId) && e.endAt >= from && e.startAt <= to,
  );
}

/**
 * Returns events from the given list that fall on `date` (YYYY-MM-DD),
 * filtered to visible calendars only.
 */
export function filterEventsForDay(
  events: CalendarEvent[],
  calendars: Calendar[],
  date: string,
): CalendarEvent[] {
  const visibleIds = new Set(
    calendars.filter((c) => c.isVisible).map((c) => c.id),
  );
  const dayStart = `${date}T00:00:00.000`;
  const dayEnd   = `${date}T23:59:59.999`;
  return events.filter((e) => {
    if (!visibleIds.has(e.calendarId)) return false;
    if (e.allDay) return e.startAt.startsWith(date) || e.endAt.startsWith(date);
    return e.startAt <= dayEnd && e.endAt >= dayStart;
  });
}

// ── Events — write ───────────────────────────────────────────────

export async function createEvent(
  input: CreateEventInput,
  defaultCalendarId = 'default',
): Promise<CalendarEvent> {
  const ts = now();
  const event: CalendarEvent = {
    id:            generateId(),
    title:         input.title?.trim() || 'New event',
    description:   input.description,
    startAt:       input.startAt,
    endAt:         input.endAt,
    allDay:        input.allDay  ?? false,
    color:         input.color,
    calendarId:    input.calendarId ?? defaultCalendarId,
    linkedTaskIds: input.linkedTaskIds ?? [],
    linkedNoteIds: input.linkedNoteIds ?? [],
    isTimeBlock:   input.isTimeBlock ?? false,
    recurrence:    input.recurrence,
    createdAt:     ts,
    updatedAt:     ts,
  };
  await repo.insertEvent(event);
  bus.emit('calendar:event-created', { event });
  return event;
}

export async function updateEvent(
  existing: CalendarEvent,
  patch: UpdateEventInput,
): Promise<CalendarEvent> {
  const updated: CalendarEvent = { ...existing, ...patch, updatedAt: now() };
  await repo.updateEvent(updated);
  bus.emit('calendar:event-updated', { event: updated });
  return updated;
}

export async function deleteEvent(id: string): Promise<void> {
  await repo.deleteEvent(id);
  bus.emit('calendar:event-deleted', { eventId: id });
}

// ── Cross-module reactions ───────────────────────────────────────

/**
 * Called when a task is deleted.
 * Removes the taskId from linked_task_ids of every referencing event
 * and emits calendar:event-updated for each patched event.
 */
export async function handleTaskDeleted(taskId: string): Promise<void> {
  const affectedIds = await repo.unlinkTaskFromEvents(taskId);
  // Re-fetch updated events and emit so subscribers (time-tracking, planner) stay in sync.
  for (const eventId of affectedIds) {
    const ev = await repo.findEventById(eventId);
    if (ev) bus.emit('calendar:event-updated', { event: ev });
  }
}

/**
 * Called when a task's status or due-date changes.
 * Finds all events linked to the task and emits calendar:event-updated
 * so the UI can re-render without a full reload.
 */
export async function handleTaskUpdated(taskId: string): Promise<void> {
  const events = await repo.findEventsByTaskId(taskId);
  for (const ev of events) {
    bus.emit('calendar:event-updated', { event: ev });
  }
}

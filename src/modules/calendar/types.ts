// src/modules/calendar/types.ts
// Zod schemas for all Calendar module entities.
// Raw SQLite rows never cross this boundary — only validated domain objects
// are passed to the store or UI.

import { z } from 'zod';

// ── Primitives ──────────────────────────────────────────────────

export const calendarViewSchema = z.enum(['month', 'week', 'day', 'agenda']);
export type CalendarView = z.infer<typeof calendarViewSchema>;

export const calendarSourceSchema = z.enum(['local', 'google', 'ical']);

// ── Calendar (container) ────────────────────────────────────────

export const calendarSchema = z.object({
  id:        z.string().min(1),
  name:      z.string().min(1),
  color:     z.string().min(1),
  isDefault: z.boolean(),
  isVisible: z.boolean(),
  source:    calendarSourceSchema,
  sourceUrl: z.string().url().optional(),
});
export type Calendar = z.infer<typeof calendarSchema>;

// ── Recurrence rule ─────────────────────────────────────────────

export const recurrenceRuleSchema = z.object({
  freq:     z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  interval: z.number().int().positive().default(1),
  until:    z.string().optional(),   // ISO date
  count:    z.number().int().positive().optional(),
  byDay:    z.array(z.string()).optional(), // "MO", "TU", ...
});
export type RecurrenceRule = z.infer<typeof recurrenceRuleSchema>;

// ── CalendarEvent ────────────────────────────────────────────────

export const calendarEventSchema = z.object({
  id:            z.string().min(1),
  title:         z.string().min(1),
  description:   z.string().optional(),
  startAt:       z.string().min(1),  // ISO datetime or ISO date for all-day
  endAt:         z.string().min(1),
  allDay:        z.boolean(),
  color:         z.string().optional(),
  calendarId:    z.string().min(1),
  linkedTaskIds: z.array(z.string()),
  linkedNoteIds: z.array(z.string()),
  isTimeBlock:   z.boolean(),
  recurrence:    recurrenceRuleSchema.optional(),
  createdAt:     z.string().min(1),
  updatedAt:     z.string().min(1),
});
export type CalendarEvent = z.infer<typeof calendarEventSchema>;

// ── Create / update inputs ───────────────────────────────────────

export const createEventInputSchema = calendarEventSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .partial()
  .required({ startAt: true, endAt: true });
export type CreateEventInput = z.infer<typeof createEventInputSchema>;

export const updateEventInputSchema = calendarEventSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .partial();
export type UpdateEventInput = z.infer<typeof updateEventInputSchema>;

// ── EventFormState (UI-only, not persisted) ──────────────────────

export interface EventFormState {
  open:      boolean;
  prefill:   Partial<CalendarEvent>;
  editingId: string | undefined;
}

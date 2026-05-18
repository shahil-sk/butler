import { create } from "zustand";
import { db } from "@/kernel/db";
import { bus } from "@/kernel/event-bus";
import { generateId, now, today, toISODate } from "@/shared/utils";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, subMonths, addWeeks, subWeeks } from "date-fns";
import type { CalendarEvent, Calendar, ID } from "@/shared/types";

// ── DB row → entity ─────────────────────────────────────────────

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
    linkedTaskIds: JSON.parse((r.linked_task_ids as string) || "[]"),
    linkedNoteIds: JSON.parse((r.linked_note_ids as string) || "[]"),
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
    source:    r.source as Calendar["source"],
    sourceUrl: (r.source_url as string | null) ?? undefined,
  };
}

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

// ── Types ─────────────────────────────────────────────────

export type CalendarView = "month" | "week" | "day" | "agenda";

interface EventFormState {
  open:      boolean;
  prefill:   Partial<CalendarEvent>;
  editingId: ID | undefined;
}

interface CalendarState {
  events:     CalendarEvent[];
  calendars:  Calendar[];
  loading:    boolean;
  view:       CalendarView;
  activeDate: string;        // ISO date — anchor for current view
  eventForm:  EventFormState;
}

interface CalendarActions {
  loadEvents:     (from: string, to: string) => Promise<void>;
  loadCalendars:  () => Promise<void>;
  createEvent:    (input: Partial<CalendarEvent>) => Promise<CalendarEvent>;
  updateEvent:    (id: ID, patch: Partial<CalendarEvent>) => Promise<void>;
  deleteEvent:    (id: ID) => Promise<void>;
  setView:        (v: CalendarView) => void;
  setActiveDate:  (d: string) => void;
  openEventForm:  (prefill?: Partial<CalendarEvent>, editingId?: ID) => void;
  closeEventForm: () => void;
  goToday:        () => void;
  goNext:         () => void;
  goPrev:         () => void;
  getEventsInRange: (from: string, to: string) => CalendarEvent[];
  getEventsForDay:  (date: string) => CalendarEvent[];
}

export const useCalendarStore = create<CalendarState & CalendarActions>()((set, get) => ({
  events: [], calendars: [], loading: false,
  view: "month", activeDate: today(),
  eventForm: { open: false, prefill: {}, editingId: undefined },

  loadCalendars: async () => {
    try {
      const rows = await db.select<Record<string, unknown>>("SELECT * FROM calendars ORDER BY is_default DESC");
      set({ calendars: rows.map(rowToCalendar) });
    } catch (err) {
      console.error("[Calendar] loadCalendars error:", err);
    }
  },

  loadEvents: async (from, to) => {
    set({ loading: true });
    try {
      const rows = await db.select<Record<string, unknown>>(
        "SELECT * FROM calendar_events WHERE start_at >= ? AND start_at <= ? ORDER BY start_at ASC",
        [from, to]
      );
      set((s) => {
        const outside = s.events.filter((e) => e.startAt < from || e.startAt > to);
        return { events: [...outside, ...rows.map(rowToEvent)], loading: false };
      });
    } catch (err) {
      console.error("[Calendar] loadEvents error:", err);
      set({ loading: false });
    }
  },

  createEvent: async (input) => {
    const defaultCal = get().calendars.find((c) => c.isDefault)?.id ?? "default";
    const event: CalendarEvent = {
      id:            generateId(),
      title:         input.title?.trim() || "New event",
      description:   input.description,
      startAt:       input.startAt ?? now(),
      endAt:         input.endAt   ?? now(),
      allDay:        input.allDay  ?? false,
      color:         input.color,
      calendarId:    input.calendarId ?? defaultCal,
      linkedTaskIds: input.linkedTaskIds ?? [],
      linkedNoteIds: input.linkedNoteIds ?? [],
      isTimeBlock:   input.isTimeBlock ?? false,
      recurrence:    input.recurrence,
      createdAt:     now(),
      updatedAt:     now(),
    };
    await db.execute(INSERT_EVENT_SQL, insertEventParams(event));
    set((s) => ({ events: [...s.events, event] }));
    bus.emit("calendar:event-created", { event });
    return event;
  },

  updateEvent: async (id, patch) => {
    const existing = get().events.find((e) => e.id === id);
    if (!existing) return;
    const updated: CalendarEvent = { ...existing, ...patch, updatedAt: now() };
    await db.execute(UPDATE_EVENT_SQL, updateEventParams(updated));
    set((s) => ({ events: s.events.map((e) => e.id === id ? updated : e) }));
    bus.emit("calendar:event-updated", { event: updated });
  },

  deleteEvent: async (id) => {
    await db.execute("DELETE FROM calendar_events WHERE id=?", [id]);
    set((s) => ({ events: s.events.filter((e) => e.id !== id) }));
    bus.emit("calendar:event-deleted", { eventId: id });
  },

  setView:       (v) => set({ view: v }),
  setActiveDate: (d) => set({ activeDate: d }),

  openEventForm:  (prefill = {}, editingId?: ID) =>
    set({ eventForm: { open: true, prefill, editingId } }),
  closeEventForm: () =>
    set({ eventForm: { open: false, prefill: {}, editingId: undefined } }),

  goToday: () => set({ activeDate: today() }),

  goNext: () => set((s) => {
    const d = new Date(s.activeDate);
    if (s.view === "month") return { activeDate: toISODate(addMonths(d, 1)) };
    if (s.view === "week")  return { activeDate: toISODate(addWeeks(d, 1)) };
    const next = new Date(d); next.setDate(next.getDate() + 1);
    return { activeDate: toISODate(next) };
  }),

  goPrev: () => set((s) => {
    const d = new Date(s.activeDate);
    if (s.view === "month") return { activeDate: toISODate(subMonths(d, 1)) };
    if (s.view === "week")  return { activeDate: toISODate(subWeeks(d, 1)) };
    const prev = new Date(d); prev.setDate(prev.getDate() - 1);
    return { activeDate: toISODate(prev) };
  }),

  getEventsInRange: (from, to) =>
    get().events.filter((e) => {
      const visible = get().calendars.find((c) => c.id === e.calendarId)?.isVisible ?? true;
      return visible && e.startAt >= from && e.startAt <= to;
    }),

  getEventsForDay: (date) => {
    const start = `${date}T00:00:00`;
    const end   = `${date}T23:59:59`;
    return get().getEventsInRange(start, end);
  },
}));

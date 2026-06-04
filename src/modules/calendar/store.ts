import { create } from "zustand";
import { db } from "@/kernel/db";
import { bus } from "@/kernel/event-bus";
import { generateId, now, today, toISODate } from "@/shared/utils";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, subMonths, addWeeks, subWeeks } from "date-fns";
import { useTaskStore } from "@/modules/tasks/store";
import type { CalendarEvent, Calendar, ID } from "@/shared/types";

// ── DB row → entity ─────────────────────────────────────────────

function rowToEvent(r: Record<string, unknown>): CalendarEvent {
  return {
    id:               r.id as string,
    title:            r.title as string,
    description:      (r.description as string | null) ?? undefined,
    startDatetime:    r.start_at as string,
    startAt:          r.start_at as string,
    endDatetime:      r.end_at as string,
    endAt:            r.end_at as string,
    isAllDay:         Boolean(r.all_day),
    allDay:           Boolean(r.all_day),
    color:            (r.color as string | null) ?? undefined,
    calendarId:       r.calendar_id as string,
    isTimeBlock:      Boolean(r.is_time_block),
    recurrenceRule:   (r.recurrence as string | null) ?? undefined,
    createdAt:        r.created_at as string,
    updatedAt:        r.updated_at as string,
    status:           (r.status as any) ?? undefined,
    visibility:       (r.visibility as any) ?? undefined,
    timezone:         (r.timezone as string) || "UTC",
    location:         (r.location as string | null) ?? undefined,
    locationLat:      (r.location_lat as number | null) ?? undefined,
    locationLng:      (r.location_lng as number | null) ?? undefined,
    meetingUrl:       (r.meeting_url as string | null) ?? undefined,
    meetingPassword:  (r.meeting_password as string | null) ?? undefined,
    recurrenceParent: (r.recurrence_parent as string | null) ?? undefined,
    externalId:       (r.external_id as string | null) ?? undefined,
    externalSource:   (r.external_source as any) ?? undefined,
    category:         (r.category as any) ?? undefined,
    taskId:           (r.task_id as string | null) ?? undefined,
    projectId:        (r.project_id as string | null) ?? undefined,
    goalId:           (r.goal_id as string | null) ?? undefined,
    createdBy:        (r.created_by as string | null) ?? undefined,
    linkedTaskIds:    JSON.parse((r.linked_task_ids as string) || "[]"),
    linkedNoteIds:    JSON.parse((r.linked_note_ids as string) || "[]"),
    attachments:      r.attachments ? JSON.parse(r.attachments as string) : [],
  };
}

function rowToCalendar(r: Record<string, unknown>): Calendar {
  return {
    id:           r.id as string,
    name:         r.name as string,
    color:        r.color as string,
    isDefault:    Boolean(r.is_default),
    isVisible:    Boolean(r.is_visible),
    source:       r.source as Calendar["source"],
    icalUrl:      (r.ical_url as string | null) ?? undefined,
    syncToken:    (r.sync_token as string | null) ?? undefined,
    lastSyncedAt: (r.last_synced_at as string | null) ?? undefined,
    createdAt:    r.created_at as string,
  };
}

const INSERT_EVENT_SQL = `
  INSERT INTO calendar_events (
    id, title, description, start_at, end_at, all_day, color, calendar_id, is_time_block, recurrence,
    status, visibility, timezone, location, location_lat, location_lng, meeting_url, meeting_password,
    recurrence_parent, external_id, external_source, category, task_id, project_id, goal_id, created_by, attachments,
    linked_task_ids, linked_note_ids,
    created_at, updated_at
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
`;
const UPDATE_EVENT_SQL = `
  UPDATE calendar_events SET
    title=?, description=?, start_at=?, end_at=?, all_day=?, color=?, calendar_id=?, is_time_block=?, recurrence=?,
    status=?, visibility=?, timezone=?, location=?, location_lat=?, location_lng=?, meeting_url=?, meeting_password=?,
    recurrence_parent=?, external_id=?, external_source=?, category=?, task_id=?, project_id=?, goal_id=?, attachments=?,
    linked_task_ids=?, linked_note_ids=?,
    updated_at=?
  WHERE id=?
`;

function insertEventParams(e: CalendarEvent): unknown[] {
  return [
    e.id, e.title, e.description ?? null, e.startDatetime || e.startAt, e.endDatetime || e.endAt,
    e.isAllDay || e.allDay ? 1 : 0, e.color ?? null, e.calendarId,
    e.isTimeBlock ? 1 : 0,
    e.recurrenceRule ?? (e.recurrence ? JSON.stringify(e.recurrence) : null), e.status ?? null, e.visibility ?? null, e.timezone || "UTC",
    e.location ?? null, e.locationLat ?? null, e.locationLng ?? null, e.meetingUrl ?? null, e.meetingPassword ?? null,
    e.recurrenceParent ?? null, e.externalId ?? null, e.externalSource ?? null, e.category ?? null, e.taskId ?? null, e.projectId ?? null, e.goalId ?? null, e.createdBy ?? null,
    e.attachments ? JSON.stringify(e.attachments) : "[]",
    JSON.stringify(e.linkedTaskIds || []), JSON.stringify(e.linkedNoteIds || []),
    e.createdAt, e.updatedAt,
  ];
}
function updateEventParams(e: CalendarEvent): unknown[] {
  return [
    e.title, e.description ?? null, e.startDatetime || e.startAt, e.endDatetime || e.endAt,
    e.isAllDay || e.allDay ? 1 : 0, e.color ?? null, e.calendarId,
    e.isTimeBlock ? 1 : 0,
    e.recurrenceRule ?? (e.recurrence ? JSON.stringify(e.recurrence) : null), e.status ?? null, e.visibility ?? null, e.timezone || "UTC",
    e.location ?? null, e.locationLat ?? null, e.locationLng ?? null, e.meetingUrl ?? null, e.meetingPassword ?? null,
    e.recurrenceParent ?? null, e.externalId ?? null, e.externalSource ?? null, e.category ?? null, e.taskId ?? null, e.projectId ?? null, e.goalId ?? null,
    e.attachments ? JSON.stringify(e.attachments) : "[]",
    JSON.stringify(e.linkedTaskIds || []), JSON.stringify(e.linkedNoteIds || []),
    e.updatedAt,
    e.id,
  ];
}

// ── Types ─────────────────────────────────────────────────

export type CalendarView = "month" | "week" | "day" | "agenda";


interface CalendarState {
  events:            CalendarEvent[];
  calendars:         Calendar[];
  loading:           boolean;
  view:              CalendarView;
  activeDate:        string;
  showProjectsLayer: boolean;
  eventForm: {
    open:      boolean;
    prefill:   Partial<CalendarEvent>;
    editingId?: ID;
  };
  contextMenu: { x: number; y: number; event: CalendarEvent } | null;
}

interface CalendarActions {
  loadEvents:       (from: string, to: string) => Promise<void>;
  loadCalendars:    () => Promise<void>;
  createEvent:      (input: Partial<CalendarEvent>) => Promise<CalendarEvent>;
  updateEvent:      (id: ID, patch: Partial<CalendarEvent>) => Promise<void>;
  deleteEvent:      (id: ID) => Promise<void>;
  setView:          (v: CalendarView) => void;
  setActiveDate:    (d: string) => void;
  setShowProjectsLayer: (show: boolean) => void;
  openEventForm:    (prefill?: Partial<CalendarEvent>, editingId?: ID) => void;
  closeEventForm:   () => void;
  openContextMenu:  (x: number, y: number, event: CalendarEvent) => void;
  closeContextMenu: () => void;
  goToday:          () => void;
  goNext:           () => void;
  goPrev:           () => void;
  getEventsInRange: (from: string, to: string) => CalendarEvent[];
  getEventsForDay:  (date: string) => CalendarEvent[];
}

export const useCalendarStore = create<CalendarState & CalendarActions>()((set, get) => ({
  events: [], calendars: [], loading: false,
  view: "month", activeDate: today(),
  showProjectsLayer: false,
  eventForm: { open: false, prefill: {}, editingId: undefined },
  contextMenu: null,

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
        const outside = s.events.filter((e) => (e.startDatetime || e.startAt!) < from || (e.startDatetime || e.startAt!) > to);
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
      id:               generateId(),
      title:            input.title?.trim() || "New event",
      description:      input.description,
      startDatetime:    input.startDatetime ?? input.startAt ?? now(),
      startAt:          input.startDatetime ?? input.startAt ?? now(),
      endDatetime:      input.endDatetime ?? input.endAt ?? now(),
      endAt:            input.endDatetime ?? input.endAt ?? now(),
      isAllDay:         input.isAllDay ?? input.allDay ?? false,
      allDay:           input.isAllDay ?? input.allDay ?? false,
      color:            input.color,
      calendarId:       input.calendarId ?? defaultCal,
      timezone:         input.timezone ?? "UTC",
      isTimeBlock:      input.isTimeBlock ?? false,
      recurrenceRule:   input.recurrenceRule,
      status:           input.status,
      visibility:       input.visibility,
      location:         input.location,
      meetingUrl:       input.meetingUrl,
      category:         input.category,
      taskId:           input.taskId,
      projectId:        input.projectId,
      goalId:           input.goalId,
      linkedTaskIds:    input.linkedTaskIds ?? [],
      linkedNoteIds:    input.linkedNoteIds ?? [],
      createdAt:        now(),
      updatedAt:        now(),
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
  setShowProjectsLayer: (show) => set({ showProjectsLayer: show }),

  openEventForm:  (prefill = {}, editingId?: ID) =>
    set({ eventForm: { open: true, prefill, editingId }, contextMenu: null }),
  closeEventForm: () =>
    set({ eventForm: { open: false, prefill: {}, editingId: undefined } }),
  openContextMenu: (x, y, event) =>
    set({ contextMenu: { x, y, event } }),
  closeContextMenu: () =>
    set({ contextMenu: null }),

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

  getEventsInRange: (from, to) => {
    const rawEvents = get().events.filter((e) => {
      if (e.calendarId === "projects" && !get().showProjectsLayer) return false;
      const visible = get().calendars.find((c) => c.id === e.calendarId)?.isVisible ?? true;
      return visible && e.startAt >= from && e.startAt <= to;
    });

    const fromDate = from.slice(0, 10);
    const toDate = to.slice(0, 10);
    const tasks = useTaskStore.getState().tasks.filter(t => t.status !== "archived");
    const taskEvents: CalendarEvent[] = [];

    tasks.forEach(t => {
      const d = t.scheduledDate || t.dueDate;
      if (d && d >= fromDate && d <= toDate) {
        // Prevent duplicate if this task already has a time-block event on this day
        const hasTimeBlock = rawEvents.some(
          (e) => e.isTimeBlock && e.startAt.startsWith(d) && e.linkedTaskIds?.includes(t.id)
        );
        
        if (!hasTimeBlock) {
          taskEvents.push({
            id: `task:${t.id}`,
            title: t.title,
            startAt: `${d}T00:00:00`,
            endAt: `${d}T23:59:59`,
            startDatetime: `${d}T00:00:00`,
            endDatetime: `${d}T23:59:59`,
            isAllDay: true,
            allDay: true,
            calendarId: "tasks",
            isTimeBlock: false,
            linkedTaskIds: [t.id],
            linkedNoteIds: t.linkedNoteIds,
            status: t.status === "done" ? "completed" : undefined,
            color: t.status === "done" ? "#9ca3af" : (t.dueDate && t.dueDate < today() ? "#ef4444" : undefined),
            createdAt: t.createdAt,
            updatedAt: t.updatedAt,
          } as CalendarEvent);
        }
      }
    });

    return [...taskEvents, ...rawEvents];
  },

  getEventsForDay: (date) => {
    const start = `${date}T00:00:00`;
    const end   = `${date}T23:59:59`;
    return get().getEventsInRange(start, end);
  },
}));

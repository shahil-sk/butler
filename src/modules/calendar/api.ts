import { db } from "@/kernel/db";
import { generateId, now, toISODate } from "@/shared/utils";
import { useCalendarStore } from "./store";
import type { CalendarEvent, Calendar, ID, Reminder, FocusSession } from "@/shared/types";
import { useTaskStore } from "@/modules/tasks/store";

export type CalendarItem = CalendarEvent | any; // Any implies Milestones/Goals/Habits which will be typed later

export interface CreateEventInput extends Partial<CalendarEvent> {
  title: string;
  startDatetime: string;
  endDatetime: string;
}

export interface SyncResult {
  added: number;
  updated: number;
  deleted: number;
  syncToken: string;
}

export class CalendarService {
  static async createEvent(input: CreateEventInput): Promise<CalendarEvent> {
    return useCalendarStore.getState().createEvent(input);
  }

  static async updateEvent(id: ID, patch: Partial<CalendarEvent>, scope?: "this" | "future" | "all"): Promise<CalendarEvent> {
    await useCalendarStore.getState().updateEvent(id, patch);
    return useCalendarStore.getState().events.find(e => e.id === id)!;
  }

  static async deleteEvent(id: ID, scope?: "this" | "future" | "all"): Promise<void> {
    await useCalendarStore.getState().deleteEvent(id);
  }

  static async getEventsForDateRange(start: Date, end: Date, calendarIds?: ID[]): Promise<CalendarEvent[]> {
    const startStr = start.toISOString();
    const endStr = end.toISOString();
    let events = useCalendarStore.getState().events.filter(e => {
      const eStart = e.startDatetime || e.startAt!;
      return eStart >= startStr && eStart <= endStr;
    });
    if (calendarIds && calendarIds.length > 0) {
      events = events.filter(e => calendarIds.includes(e.calendarId));
    }
    return events;
  }

  static async getEventsForDay(date: Date): Promise<CalendarItem[]> {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    
    // In a real implementation this would merge Events, Task due dates, Milestones, etc.
    const events = await this.getEventsForDateRange(start, end);
    return events;
  }

  static async detectConflicts(date: Date): Promise<any[]> {
    const events = await this.getEventsForDay(date);
    // basic conflict mock
    return []; 
  }

  static async syncGoogleCalendar(calendarId: ID): Promise<SyncResult> {
    // Stub for actual OAuth / Google Calendar API sync
    return { added: 0, updated: 0, deleted: 0, syncToken: "next_token_mock" };
  }

  static async importFromIcalUrl(url: string): Promise<Calendar> {
    const id = generateId();
    const cal: Calendar = {
      id,
      name: "Imported iCal",
      color: "#8b5cf6",
      isDefault: false,
      isVisible: true,
      source: "ical_url",
      icalUrl: url,
      createdAt: now(),
    };
    await db.execute(
      `INSERT INTO calendars (id, name, color, is_default, is_visible, source, ical_url, created_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      [cal.id, cal.name, cal.color, cal.isDefault ? 1 : 0, cal.isVisible ? 1 : 0, cal.source, cal.icalUrl, cal.createdAt]
    );
    await useCalendarStore.getState().loadCalendars();
    return cal;
  }

  static async exportToIcal(calendarId: ID): Promise<string> {
    return "BEGIN:VCALENDAR\\nVERSION:2.0\\nEND:VCALENDAR";
  }

  static async createReminder(eventId: ID, reminder: Omit<Reminder, "id">): Promise<Reminder> {
    const rem = { ...reminder, id: generateId() };
    await db.execute(
      `INSERT INTO event_reminders (id, event_id, method, minutes) VALUES (?,?,?,?)`,
      [rem.id, rem.eventId, rem.method, rem.minutes]
    );
    return rem as Reminder;
  }

  static async fireReminderNotifications(): Promise<void> {
    // Scheduled job hook
  }
}

export interface CalendarModuleAPI {
  getEventsForDate(date: Date): Promise<CalendarItem[]>;
  getEventsForRange(start: Date, end: Date): Promise<CalendarItem[]>;
  createEventFromTask(taskId: ID): Promise<CalendarEvent>;
  createEventFromMilestone(milestoneId: ID): Promise<CalendarEvent>;
  getUpcomingEvents(limit: number): Promise<CalendarEvent[]>;
  blockTimeForFocusSession(session: FocusSession): Promise<CalendarEvent>;
}

export const calendarApi: CalendarModuleAPI = {
  getEventsForDate: (date) => CalendarService.getEventsForDay(date),
  getEventsForRange: (start, end) => CalendarService.getEventsForDateRange(start, end),
  createEventFromTask: async (taskId) => {
    const task = useTaskStore.getState().tasks.find(t => t.id === taskId);
    if (!task) throw new Error("Task not found");
    const d = new Date();
    d.setHours(d.getHours() + 1);
    return CalendarService.createEvent({
      title: task.title,
      startDatetime: new Date().toISOString(),
      endDatetime: d.toISOString(),
      taskId,
    });
  },
  createEventFromMilestone: async (milestoneId) => {
    return CalendarService.createEvent({
      title: "Milestone",
      startDatetime: new Date().toISOString(),
      endDatetime: new Date().toISOString(),
      projectId: milestoneId,
      allDay: true,
    });
  },
  getUpcomingEvents: async (limit) => {
    const nowStr = new Date().toISOString();
    return useCalendarStore.getState().events
      .filter(e => (e.startDatetime || e.startAt!) >= nowStr)
      .sort((a, b) => (a.startDatetime || a.startAt!).localeCompare(b.startDatetime || b.startAt!))
      .slice(0, limit);
  },
  blockTimeForFocusSession: async (session) => {
    const start = session.startedAt || new Date().toISOString();
    const duration = session.plannedMinutes ?? session.plannedDuration ?? 25;
    const end = new Date(new Date(start).getTime() + duration * 60000).toISOString();
    return CalendarService.createEvent({
      title: `Focus Session`,
      startDatetime: start,
      endDatetime: end,
      taskId: session.taskId,
      projectId: session.projectId,
      category: "focus",
    });
  }
};

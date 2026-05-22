// src/modules/calendar/store.ts
// UI state only. Delegates all persistence to service.ts.
// No raw SQL, no direct db import.

import { create } from 'zustand';
import { today, toISODate } from '@/shared/utils';
import {
  addMonths, subMonths,
  addWeeks,  subWeeks,
} from 'date-fns';
import * as svc from './service';
import type {
  CalendarEvent,
  Calendar,
  CalendarView,
  EventFormState,
  CreateEventInput,
  UpdateEventInput,
} from './types';

// ── Debounce helper (UI concern — lives here, not in service) ────
let _debounceTimer: ReturnType<typeof setTimeout> | null = null;
function debounce(fn: () => void, ms = 150) {
  if (_debounceTimer) clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(fn, ms);
}

// ── State & actions types ────────────────────────────────────────

interface CalendarState {
  events:     CalendarEvent[];
  calendars:  Calendar[];
  loading:    boolean;
  view:       CalendarView;
  activeDate: string;
  eventForm:  EventFormState;
}

interface CalendarActions {
  // Persistence
  loadCalendars:       () => Promise<void>;
  loadEvents:          (from: string, to: string) => Promise<void>;
  scheduledLoadEvents: (from: string, to: string) => void;
  createEvent:         (input: CreateEventInput) => Promise<CalendarEvent>;
  updateEvent:         (id: string, patch: UpdateEventInput) => Promise<void>;
  deleteEvent:         (id: string) => Promise<void>;
  // Navigation
  setView:       (v: CalendarView) => void;
  setActiveDate: (d: string) => void;
  goToday:       () => void;
  goNext:        () => void;
  goPrev:        () => void;
  // Form
  openEventForm:  (prefill?: Partial<CalendarEvent>, editingId?: string) => void;
  closeEventForm: () => void;
  // Selectors (pure, synchronous)
  getEventsInRange: (from: string, to: string) => CalendarEvent[];
  getEventsForDay:  (date: string) => CalendarEvent[];
}

// ── Store ────────────────────────────────────────────────────────

export const useCalendarStore = create<CalendarState & CalendarActions>()(
  (set, get) => ({
    events: [], calendars: [], loading: false,
    view: 'month', activeDate: today(),
    eventForm: { open: false, prefill: {}, editingId: undefined },

    // ── Persistence ───────────────────────────────────────────────

    loadCalendars: async () => {
      try {
        const calendars = await svc.loadCalendars();
        set({ calendars });
      } catch (err) {
        console.error('[Calendar] loadCalendars:', err);
      }
    },

    loadEvents: async (from, to) => {
      set({ loading: true });
      try {
        const loaded = await svc.loadEventsInRange(from, to);
        set((s) => {
          // Keep events outside the window that are already in memory.
          const outside = s.events.filter(
            (e) => e.endAt < from || e.startAt > to,
          );
          return { events: [...outside, ...loaded], loading: false };
        });
      } catch (err) {
        console.error('[Calendar] loadEvents:', err);
        set({ loading: false });
      }
    },

    scheduledLoadEvents: (from, to) => {
      debounce(() => get().loadEvents(from, to));
    },

    createEvent: async (input) => {
      const defaultCalId = get().calendars.find((c) => c.isDefault)?.id ?? 'default';
      const event = await svc.createEvent(input, defaultCalId);
      set((s) => ({ events: [...s.events, event] }));
      return event;
    },

    updateEvent: async (id, patch) => {
      const existing = get().events.find((e) => e.id === id);
      if (!existing) return;
      const updated = await svc.updateEvent(existing, patch);
      set((s) => ({ events: s.events.map((e) => e.id === id ? updated : e) }));
    },

    deleteEvent: async (id) => {
      await svc.deleteEvent(id);
      set((s) => ({ events: s.events.filter((e) => e.id !== id) }));
    },

    // ── Navigation ────────────────────────────────────────────────

    setView:       (v) => set({ view: v }),
    setActiveDate: (d) => set({ activeDate: d }),
    goToday:       () => set({ activeDate: today() }),

    goNext: () => set((s) => {
      const d = new Date(s.activeDate);
      if (s.view === 'month') return { activeDate: toISODate(addMonths(d, 1)) };
      if (s.view === 'week')  return { activeDate: toISODate(addWeeks(d, 1)) };
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      return { activeDate: toISODate(next) };
    }),

    goPrev: () => set((s) => {
      const d = new Date(s.activeDate);
      if (s.view === 'month') return { activeDate: toISODate(subMonths(d, 1)) };
      if (s.view === 'week')  return { activeDate: toISODate(subWeeks(d, 1)) };
      const prev = new Date(d);
      prev.setDate(prev.getDate() - 1);
      return { activeDate: toISODate(prev) };
    }),

    // ── Form ──────────────────────────────────────────────────────

    openEventForm: (prefill = {}, editingId?: string) =>
      set({ eventForm: { open: true, prefill, editingId } }),
    closeEventForm: () =>
      set({ eventForm: { open: false, prefill: {}, editingId: undefined } }),

    // ── Selectors ─────────────────────────────────────────────────

    getEventsInRange: (from, to) =>
      svc.filterEventsInRange(get().events, get().calendars, from, to),

    getEventsForDay: (date) =>
      svc.filterEventsForDay(get().events, get().calendars, date),
  }),
);

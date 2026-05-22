// src/modules/calendar/events.ts
// Typed event emitters and listeners using the kernel event bus.
// All cross-module reactions are wired here so store.ts stays free
// of bus.on() calls.

import { bus } from '@/kernel/event-bus';
import type { CalendarEvent } from './types';
import { handleTaskDeleted, handleTaskUpdated } from './service';
import { useCalendarStore } from './store';

// ── Emitters (called by service.ts — exported here for typing clarity) ─

export const calendarEvents = {
  emit: {
    eventCreated: (e: CalendarEvent) =>
      bus.emit('calendar:event-created', { event: e }),
    eventUpdated: (e: CalendarEvent) =>
      bus.emit('calendar:event-updated', { event: e }),
    eventDeleted: (id: string) =>
      bus.emit('calendar:event-deleted', { eventId: id }),
  },

  // ── Listeners ──────────────────────────────────────────────────
  on: {
    /**
     * When a task is deleted, remove it from linked_task_ids on all
     * calendar events that reference it.
     */
    taskDeleted: () =>
      bus.on('task:deleted', async (p: { taskId: string }) => {
        await handleTaskDeleted(p.taskId);
        // Patch the in-memory store so the UI reflects the change immediately.
        const store = useCalendarStore.getState();
        store.loadEvents(
          store.activeDate + 'T00:00:00',
          store.activeDate + 'T23:59:59',
        );
      }),

    /**
     * When a task's due-date or status changes, re-emit calendar:event-updated
     * for every event linked to that task so subscribers stay in sync.
     */
    taskUpdated: () =>
      bus.on('task:updated', async (p: { taskId: string }) => {
        await handleTaskUpdated(p.taskId);
      }),
  },
};

export function setupCalendarEventListeners(): () => void {
  const offDeleted = calendarEvents.on.taskDeleted();
  const offUpdated = calendarEvents.on.taskUpdated();
  
  return () => {
    offDeleted();
    offUpdated();
  };
}

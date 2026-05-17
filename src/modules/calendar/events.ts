// src/modules/calendar/events.ts

import { bus } from '@/kernel/event-bus'
import type { CalendarEvent } from './db'

export const calendarEvents = {
  emit: {
    eventCreated: (e: CalendarEvent) => bus.emit('calendar:event-created', { event: e }),
    eventUpdated: (e: CalendarEvent) => bus.emit('calendar:event-updated', { event: e }),
    eventDeleted: (id: string)       => bus.emit('calendar:event-deleted', { eventId: id }),
  },

  on: {
    taskScheduled: (cb: (p: { taskId: string; startAt: string; endAt: string }) => void) =>
      bus.on('task:created', (p) => {
        // Future: tasks module emits task:scheduled — wire here when ready
      }),
  },
}

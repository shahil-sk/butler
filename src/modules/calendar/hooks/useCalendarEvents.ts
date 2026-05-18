// src/modules/calendar/hooks/useCalendarEvents.ts
// Derived selectors — keep heavy filtering out of components

import { useMemo } from 'react'
import { useCalendarStore } from '../store'
import type { CalendarEvent } from '@/shared/types'

/** Events visible in the current view range, filtered by visible calendars */
export function useVisibleEvents(): CalendarEvent[] {
  const events    = useCalendarStore(s => s.events)
  const calendars = useCalendarStore(s => s.calendars)
  const view      = useCalendarStore(s => s.view)
  const activeDate = useCalendarStore(s => s.activeDate)

  const visibleCalIds = useMemo(
    () => new Set(calendars.filter(c => c.isVisible).map(c => c.id)),
    [calendars]
  )

  return useMemo(() => {
    return events.filter(e => visibleCalIds.has(e.calendarId))
  }, [events, visibleCalIds, view, activeDate])
}

/** Events for a specific date (YYYY-MM-DD) */
export function useEventsForDate(dateStr: string): CalendarEvent[] {
  const events = useCalendarStore(s => s.events)
  const calendars = useCalendarStore(s => s.calendars)
  const visibleCalIds = useMemo(
    () => new Set(calendars.filter(c => c.isVisible).map(c => c.id)),
    [calendars]
  )
  return useMemo(() => {
    return events.filter(e => {
      if (!visibleCalIds.has(e.calendarId)) return false
      const start = e.startAt.slice(0, 10)
      const end   = e.endAt.slice(0, 10)
      return start <= dateStr && dateStr <= end
    })
  }, [events, visibleCalIds, dateStr])
}

/** Events spanning a specific week (Sun–Sat) */
export function useEventsForWeek(weekStart: Date): Record<string, CalendarEvent[]> {
  const events    = useCalendarStore(s => s.events)
  const calendars = useCalendarStore(s => s.calendars)
  const visibleCalIds = useMemo(
    () => new Set(calendars.filter(c => c.isVisible).map(c => c.id)),
    [calendars]
  )

  return useMemo(() => {
    const result: Record<string, CalendarEvent[]> = {}
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      const key = d.toISOString().slice(0, 10)
      result[key] = []
    }
    events.forEach(e => {
      if (!visibleCalIds.has(e.calendarId)) return
      const start = e.startAt.slice(0, 10)
      const end   = e.endAt.slice(0, 10)
      Object.keys(result).forEach(day => {
        if (start <= day && day <= end) result[day].push(e)
      })
    })
    return result
  }, [events, visibleCalIds, weekStart.toISOString()])
}

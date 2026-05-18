// src/modules/calendar/manifest.ts

import type { ModuleManifest } from '@/shared/types'

export const manifest: ModuleManifest = {
  id:           'calendar',
  name:         'Calendar',
  icon:         'calendar-days',
  sidebarOrder: 3,
  isEnabled:    true,
  routes: [
    { path: '/calendar',              label: 'Calendar' },
    { path: '/calendar/:view',        label: 'Calendar View' },
    { path: '/calendar/event/:id',    label: 'Event' },
  ],
  commands: [
    { id: 'calendar:new-event',      label: 'New Event',     shortcut: 'C N', group: 'calendar', action: 'calendar:new-event' },
    { id: 'calendar:today',          label: 'Go to Today',   shortcut: 'C T', group: 'calendar', action: 'calendar:today' },
    { id: 'calendar:view:month',     label: 'Month View',    shortcut: 'C 1', group: 'calendar', action: 'calendar:view:month' },
    { id: 'calendar:view:week',      label: 'Week View',     shortcut: 'C 2', group: 'calendar', action: 'calendar:view:week' },
    { id: 'calendar:view:day',       label: 'Day View',      shortcut: 'C 3', group: 'calendar', action: 'calendar:view:day' },
    { id: 'calendar:view:agenda',    label: 'Agenda View',   shortcut: 'C 4', group: 'calendar', action: 'calendar:view:agenda' },
    { id: 'calendar:view:year',      label: 'Year View',     shortcut: 'C 5', group: 'calendar', action: 'calendar:view:year' },
    { id: 'calendar:search',         label: 'Search Events', shortcut: 'C F', group: 'calendar', action: 'calendar:search' },
  ],
  shortcuts: [
    { keys: 'C N',        action: 'calendar:new-event',   description: 'New Event',     global: false },
    { keys: 'C T',        action: 'calendar:today',        description: 'Go to Today',   global: false },
    { keys: 'C 1',        action: 'calendar:view:month',   description: 'Month View',    global: false },
    { keys: 'C 2',        action: 'calendar:view:week',    description: 'Week View',     global: false },
    { keys: 'C 3',        action: 'calendar:view:day',     description: 'Day View',      global: false },
    { keys: 'C 4',        action: 'calendar:view:agenda',  description: 'Agenda View',   global: false },
    { keys: 'C 5',        action: 'calendar:view:year',    description: 'Year View',     global: false },
    { keys: 'ArrowLeft',  action: 'calendar:prev',         description: 'Previous',      global: false },
    { keys: 'ArrowRight', action: 'calendar:next',         description: 'Next',          global: false },
  ],
}

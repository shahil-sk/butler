// src/modules/calendar/manifest.ts

import type { ModuleManifest } from '@/shared/types'

export const manifest: ModuleManifest = {
  id: 'calendar',
  name: 'Calendar',
  icon: 'calendar-days',
  routes: [
    { path: '/calendar',              component: () => import('./index') },
    { path: '/calendar/:view',        component: () => import('./index') },
    { path: '/calendar/event/:id',    component: () => import('./index') },
  ],
  commands: [
    { id: 'calendar:new-event',       label: 'New Event',           shortcut: 'C N' },
    { id: 'calendar:today',           label: 'Go to Today',         shortcut: 'C T' },
    { id: 'calendar:view:month',      label: 'Month View',          shortcut: 'C 1' },
    { id: 'calendar:view:week',       label: 'Week View',           shortcut: 'C 2' },
    { id: 'calendar:view:day',        label: 'Day View',            shortcut: 'C 3' },
    { id: 'calendar:view:agenda',     label: 'Agenda View',         shortcut: 'C 4' },
    { id: 'calendar:view:year',       label: 'Year View',           shortcut: 'C 5' },
    { id: 'calendar:search',          label: 'Search Events',       shortcut: 'C F' },
  ],
  shortcuts: {
    'C N':     'calendar:new-event',
    'C T':     'calendar:today',
    'C 1':     'calendar:view:month',
    'C 2':     'calendar:view:week',
    'C 3':     'calendar:view:day',
    'C 4':     'calendar:view:agenda',
    'C 5':     'calendar:view:year',
    'ArrowLeft':  'calendar:prev',
    'ArrowRight': 'calendar:next',
  },
}

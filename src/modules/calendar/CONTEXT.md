# calendar/CONTEXT.md

Module: calendar | Phase: 1b
Stack: Zustand (store.ts) + SQLite via tauri-plugin-sql (db.ts) + eventBus only for cross-module comms (events.ts)

Views: month | week | day | agenda | year
State shape: { calendars[], events{id→event}, view, focusDate, selectedEventId, showEventForm, editingEventId, searchQuery }
Key actions: init(), loadRange(start,end), saveEvent(data,id?), deleteEvent(id), toggleCalendar(id), setView(), setFocusDate()

Cross-module in:  task:scheduled → creates calendar block | note:pinned → pins to date | focus:block:requested → blocks time
Cross-module out: calendar:event:created/updated/deleted | calendar:date:selected | calendar:view:changed

DB tables: calendars, calendar_events (FK cascade). Migrations in db.ts → run on init().
Seed: default calendar 'Personal' (id='default', color='blue') inserted on first run.

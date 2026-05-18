# Time Tracking Module — CONTEXT.md

## What it does
Manual + timer-based time entries. Live timer (one active at a time). Reports by project/day/range. Billable flag per entry. Auto-entry from focus sessions.

## Emits (via bus)
- `time:timer-started` — on startTimer()
- `time:timer-stopped` — on stopTimer()
- `time:entry-created` — on createEntry() + startTimer()
- `time:entry-updated` — on updateEntry() + stopTimer()
- `time:entry-deleted` — on deleteEntry()

## Listens (via bus)
- `focus:session-completed` → auto-creates TimeEntry with focusSessionId

## Key exports
- `TimeTrackingModule` from `@/modules/time-tracking` — mount in Shell.tsx Routes
- `useTimeStore` from `@/modules/time-tracking/store` — full time state

## DB table
`time_entries` — see db.ts. Migration version: **80**.

## Rules for LLM sessions
1. One active timer max — startTimer() stops existing before starting new
2. SQL: explicit column lists, WHERE id=? param always last in UPDATE
3. duration_minutes auto-calculated from start/end on stop or createEntry
4. IntegrationLayer handles task.actualMinutes update (not in this store)

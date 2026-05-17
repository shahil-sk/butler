# Focus Module — CONTEXT.md

- Pomodoro timer: `focusing` / `break` / `paused` / `idle` states via `useFocusStore`.
- Sessions persisted to `focus_sessions` table (migration v70). `FocusSession.type`: `"focus" | "short_break" | "long_break"`.
- Timer: `setInterval` in store `_tick()`; clears on pause/stop/completion via `_clearTimer()`.
- Emits: `focus:session-started`, `focus:session-paused`, `focus:session-resumed`, `focus:session-completed`, `focus:session-cancelled`, `focus:tick`.
- Listens: `task:open` → idle-guard toast prompt to navigate to Focus.
- IntegrationLayer: `focus:session-completed` → success toast + auto-creates `TimeEntry` (full wire-up in time-tracking Phase 1c).
- UI: ring SVG timer, task + project selectors, duration pickers, Pomodoro dot counter, break offer after completion, session history list.

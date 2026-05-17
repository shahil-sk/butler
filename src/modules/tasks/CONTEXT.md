# Tasks Module — CONTEXT.md

## What it does
Task CRUD: list, board, quick-add, detail panel. Subtasks, checklist, priorities, due dates, filters, bulk ops.

## Emits (via bus)
- `task:created` — after createTask()
- `task:updated` — after updateTask()
- `task:deleted` — after deleteTask()
- `task:completed` — after completeTask()
- `task:restored` — after restoreTask()
- `task:moved` — after moveTask()
- `task:open` — when task detail opens
- `search:index-invalidated` — after any mutation

## Listens (via bus)
- `task:quick-add` — opens QuickAdd (with optional prefill)
- `note:link-to-task` — links a note to a task
- `search:result-selected` — opens task if result.type === "task"

## Key exports
- `TasksModule` from `@/modules/tasks` — mount in Shell.tsx Routes
- `useTaskStore` from `@/modules/tasks/store` — full task state

## DB table
`tasks` — see db.ts for schema. Migration version: 10.

## Rules for LLM sessions
1. All DB access through useTaskStore actions only
2. Cross-module comms via bus events — never import other module stores
3. New views (calendar, timeline) → new file in components/, add to index.tsx switch
4. New fields → add to shared/types.ts Task, db.ts migration, taskToRow/rowToTask in store.ts

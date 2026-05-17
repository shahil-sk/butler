# Projects Module — CONTEXT.md

## What it does
Project CRUD: card grid, detail panel with tabs (overview/tasks/milestones), color coding, progress tracking, create modal.

## Emits (via bus)
- `project:created` — after createProject()
- `project:updated` — after updateProject()
- `project:deleted` — after deleteProject()
- `project:open` — when detail panel opens
- `task:quick-add` — with prefill.projectId when adding task from project detail

## Listens (via bus)
- `search:result-selected` — opens project if result.type === "project"

## Key exports
- `ProjectsModule` from `@/modules/projects` — mount in Shell.tsx Routes
- `useProjectStore` from `@/modules/projects/store` — project state

## DB table
`projects` — migration version: 20.

## Rules for LLM sessions
1. Tasks inside project detail read from useTaskStore (cross-module read via store is OK for display only)
2. To create tasks from projects → bus.emit("task:quick-add", { prefill: { projectId } })
3. Never write to tasks table from this module — Tasks module owns that

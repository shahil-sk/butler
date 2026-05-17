# Kernel — CONTEXT.md

## What it does
Foundation layer. DB, event bus, module registry. Never modified after phase 0a ships.

## Emits
- `navigate:to` — shell navigates to path
- `ui:notification` — show toast

## Listens
Nothing. Kernel is passive infrastructure.

## Key exports
- `bus` from `@/kernel/event-bus` — typed pub/sub singleton
- `db` from `@/kernel/db` — SQLite adapter singleton
- `registry` from `@/kernel/router` — module manifest registry
- All entity types from `@/shared/types`
- `generateId`, `now`, `today`, `cn` from `@/shared/utils`

## Rules for LLM sessions
1. Never import from `@/modules/*` in kernel files
2. Cross-module comms = `bus.emit()` only
3. New events go in `ButlerEventMap` in `event-bus/index.ts`
4. New entity shapes go in `shared/types.ts`
5. New migrations go in the module's own `db.ts`, not here

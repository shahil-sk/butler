# AI Handoff Document

This document tracks the current state of development for the Butler application on the `v3` branch to allow future AI sessions to smoothly resume work.

## Current State

The `🟠 High` priority items from the `butler-roadmap.md` have been successfully implemented. The focus of the recent session was **Cross-Module Event Integration**. 

**What has been completed:**
1. **Notes Infrastructure Extracted**: Extracted `manifest.ts`, created `events.ts`, updated `index.tsx`, and documented the module with `CONTEXT.md`.
2. **Notification Standardization**: Replaced local/legacy notification logic with a global `ui:notification` bus event dispatched via `src/shell/IntegrationLayer.tsx`. Updated all store instances (like Planner) to use this standard format.
3. **Journal Autosave**: Standardized autosave to run strictly via the local `RichEditor` debounce instead of global event loops.
4. **Schema Enhancements**: 
   - Extended `src/shared/types.ts` to include `linkedPlannerBlockIds` & `linkedResearchIds` on `Task`, `linkedResearchIds` on `Note`, and an `isCompleted` flag on `TimeBlock`.
   - Updated the SQL schema maps, inserts, updates, and added SQLite schema migrations across `tasks/db.ts`, `notes/db.ts`, and `planner/db.ts`.
5. **IntegrationLayer Syncs**: Wired up robust cross-module handlers inside `src/shell/IntegrationLayer.tsx`:
   - `task:schedule-in-planner`
   - `planner:block-linked-task`
   - `focus:session-completed` (completing time blocks and updating stats)
   - `research:linked-to-note` / `research:linked-to-task`

All changes pass `npm run typecheck` and have been committed to `v3`.

## Next Up

The next AI session should look at the `butler-roadmap.md` file. The immediate goal is to tackle the `🟡 Medium` priority items.

**Key targets for the next session:**
1. **Command Palette (`src/shell/CommandPalette.tsx`)**: Implement or refine the global command palette UI overlay.
2. **Global Search (`src/shell/GlobalSearch.tsx`)**: Implement or refine the global search capabilities and its interface.

## Architecture Guidelines for AI
- **Cross-module logic**: **NEVER** import another module's Zustand store directly to change its state. Always dispatch a pub/sub event via `bus.emit` in `src/kernel/event-bus/index.ts` and handle side effects inside `src/shell/IntegrationLayer.tsx`.
- **Database Migrations**: When changing table schemas, add a new migration block in the respective module's `db.ts` file. Do not forget to update the `rowTo[Type]` mapping logic in the corresponding `store.ts`.
- **Typing**: Make sure to update the shared definitions in `src/shared/types.ts` whenever introducing new shared entities or linking IDs.

Good luck!

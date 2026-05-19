# Database Module — CONTEXT

## Purpose
Notion-style relational tables with multiple views (Grid, Kanban), per-column types, inline editing, filters, sorts, and a per-row detail panel.

## Architecture

```
src/modules/database/
├── manifest.ts          # ModuleManifest — routes, commands, shortcuts
├── db.ts                # Migration v90 — 7 tables
├── events.ts            # setupDatabaseEventListeners()
├── store.ts             # useDatabaseStore (Zustand + immer)
├── index.tsx            # registry.register + module routes (default export)
├── CONTEXT.md
└── components/
    ├── TableList.tsx    # Sidebar: list/create/delete tables
    ├── ViewBar.tsx      # View tabs + add-view dialog
    ├── GridView.tsx     # Spreadsheet grid with inline editing
    ├── KanbanView.tsx   # Lane-based kanban grouped by a Select column
    └── RowDetail.tsx    # Full-screen overlay for per-row field editing
```

## DB Schema (migration v90)

| Table       | Purpose                                     |
|-------------|---------------------------------------------|
| db_tables   | One row per "Notion database"               |
| db_columns  | Column schema for each table                |
| db_rows     | Rows; position tracks manual order          |
| db_cells    | (row_id, column_id) → JSON-serialised value |
| db_views    | Grid / Kanban views per table               |
| db_filters  | Filter rules per view                       |
| db_sorts    | Sort rules per view                         |

## Entity types
All types live in `src/shared/types/database.ts` and are re-exported from `src/shared/types/index.ts`.

## Event contracts

| Event emitted            | Payload                      | Who listens          |
|--------------------------|------------------------------|----------------------|
| `database:created`       | `{ database: DatabaseTable }`| IntegrationLayer     |
| `database:deleted`       | `{ tableId: string }`        | IntegrationLayer     |
| `database:row-created`   | `{ tableId, rowId }`         | —                    |
| `database:row-deleted`   | `{ tableId, rowId }`         | events.ts            |

## Key rules
- SQL uses `?` placeholders, never `$1/$2` or slice tricks
- `db.select()`, `db.execute()`, `db.transaction()` only — no `db.query()`
- `bus.emit()` / `bus.on()` only — never import another module's store to write
- No TypeScript `any` — `unknown` where type is not known
- Files stay under 300 lines
- All entity types in `src/shared/types/`, not local

## Adding new column types
1. Add the type string to `DatabaseColumnType` in `src/shared/types/database.ts`
2. Add render logic to `CellDisplay` + `CellEditor` in `GridView.tsx`
3. Add field input to `FieldRow` in `RowDetail.tsx`

## Column types supported
`text`, `number`, `select`, `multi_select`, `checkbox`, `date`, `url`, `email`, `relation`

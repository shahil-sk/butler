# Database module — CONTEXT

- Notion-style tables: grid view (spreadsheet) + kanban view (group by select column)
- Schema (columns) stored as JSON in `db_tables.schema_json`; rows in `db_rows.cells_json`
- Views (grid/kanban), filters, sorts each in their own SQL tables (`db_views`, `db_filters`, `db_sorts`)
- Store: `useDatabaseStore` — tables, views, rows, filters, sorts, UI state (activeTableId, activeViewId, openRowId)
- Events emitted: `database:created`, `database:deleted`, `database:row:created`, `database:row:deleted`
- Migration version: 90 — register `DATABASE_MIGRATIONS` in `main.tsx` before `db.init()`

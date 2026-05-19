import type { Migration } from "@/kernel/db";

// Migration version 90 — Database module
export const DATABASE_MIGRATIONS: Migration[] = [
  {
    version: 90,
    up: (db) => {
      // Tables (one per "Notion database")
      db.execute(`
        CREATE TABLE IF NOT EXISTS db_tables (
          id          TEXT PRIMARY KEY,
          name        TEXT NOT NULL,
          icon        TEXT,
          description TEXT,
          created_at  TEXT NOT NULL,
          updated_at  TEXT NOT NULL
        )
      `, []);

      // Columns (schema for each table)
      db.execute(`
        CREATE TABLE IF NOT EXISTS db_columns (
          id           TEXT PRIMARY KEY,
          table_id     TEXT NOT NULL REFERENCES db_tables(id) ON DELETE CASCADE,
          name         TEXT NOT NULL,
          type         TEXT NOT NULL,
          options      TEXT NOT NULL DEFAULT '{}',
          position     INTEGER NOT NULL DEFAULT 0,
          is_primary   INTEGER NOT NULL DEFAULT 0,
          created_at   TEXT NOT NULL
        )
      `, []);

      // Rows
      db.execute(`
        CREATE TABLE IF NOT EXISTS db_rows (
          id         TEXT PRIMARY KEY,
          table_id   TEXT NOT NULL REFERENCES db_tables(id) ON DELETE CASCADE,
          position   INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `, []);

      // Cell values — one row per (row_id, column_id)
      db.execute(`
        CREATE TABLE IF NOT EXISTS db_cells (
          id        TEXT PRIMARY KEY,
          row_id    TEXT NOT NULL REFERENCES db_rows(id) ON DELETE CASCADE,
          column_id TEXT NOT NULL REFERENCES db_columns(id) ON DELETE CASCADE,
          value     TEXT NOT NULL DEFAULT '""',
          UNIQUE(row_id, column_id)
        )
      `, []);

      // Views (grid, kanban, …)
      db.execute(`
        CREATE TABLE IF NOT EXISTS db_views (
          id         TEXT PRIMARY KEY,
          table_id   TEXT NOT NULL REFERENCES db_tables(id) ON DELETE CASCADE,
          name       TEXT NOT NULL,
          type       TEXT NOT NULL DEFAULT 'grid',
          config     TEXT NOT NULL DEFAULT '{}',
          position   INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        )
      `, []);

      // Filters (per view)
      db.execute(`
        CREATE TABLE IF NOT EXISTS db_filters (
          id        TEXT PRIMARY KEY,
          view_id   TEXT NOT NULL REFERENCES db_views(id) ON DELETE CASCADE,
          column_id TEXT NOT NULL,
          operator  TEXT NOT NULL,
          value     TEXT NOT NULL DEFAULT '""',
          position  INTEGER NOT NULL DEFAULT 0
        )
      `, []);

      // Sorts (per view)
      db.execute(`
        CREATE TABLE IF NOT EXISTS db_sorts (
          id        TEXT PRIMARY KEY,
          view_id   TEXT NOT NULL REFERENCES db_views(id) ON DELETE CASCADE,
          column_id TEXT NOT NULL,
          direction TEXT NOT NULL DEFAULT 'asc',
          position  INTEGER NOT NULL DEFAULT 0
        )
      `, []);

      // Indexes
      db.execute(`CREATE INDEX IF NOT EXISTS idx_db_columns_table ON db_columns(table_id)`, []);
      db.execute(`CREATE INDEX IF NOT EXISTS idx_db_rows_table    ON db_rows(table_id)`, []);
      db.execute(`CREATE INDEX IF NOT EXISTS idx_db_cells_row     ON db_cells(row_id)`, []);
      db.execute(`CREATE INDEX IF NOT EXISTS idx_db_views_table   ON db_views(table_id)`, []);
    },
  },
];

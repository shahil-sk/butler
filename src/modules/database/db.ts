import type { Migration } from "@/kernel/db";

// Migration version 90 — Database module
export const DATABASE_MIGRATIONS: Migration[] = [
  {
    version: 90,
    module: "database",
    up: `
      CREATE TABLE IF NOT EXISTS db_tables (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        icon        TEXT,
        description TEXT,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS db_columns (
        id          TEXT PRIMARY KEY,
        table_id    TEXT NOT NULL REFERENCES db_tables(id) ON DELETE CASCADE,
        name        TEXT NOT NULL,
        type        TEXT NOT NULL,
        options     TEXT NOT NULL DEFAULT '{}',
        position    INTEGER NOT NULL DEFAULT 0,
        is_primary  INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS db_rows (
        id         TEXT PRIMARY KEY,
        table_id   TEXT NOT NULL REFERENCES db_tables(id) ON DELETE CASCADE,
        position   INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS db_cells (
        id        TEXT PRIMARY KEY,
        row_id    TEXT NOT NULL REFERENCES db_rows(id) ON DELETE CASCADE,
        column_id TEXT NOT NULL REFERENCES db_columns(id) ON DELETE CASCADE,
        value     TEXT NOT NULL DEFAULT '""',
        UNIQUE(row_id, column_id)
      );

      CREATE TABLE IF NOT EXISTS db_views (
        id         TEXT PRIMARY KEY,
        table_id   TEXT NOT NULL REFERENCES db_tables(id) ON DELETE CASCADE,
        name       TEXT NOT NULL,
        type       TEXT NOT NULL DEFAULT 'grid',
        config     TEXT NOT NULL DEFAULT '{}',
        position   INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS db_filters (
        id        TEXT PRIMARY KEY,
        view_id   TEXT NOT NULL REFERENCES db_views(id) ON DELETE CASCADE,
        column_id TEXT NOT NULL,
        operator  TEXT NOT NULL,
        value     TEXT NOT NULL DEFAULT '""',
        position  INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS db_sorts (
        id        TEXT PRIMARY KEY,
        view_id   TEXT NOT NULL REFERENCES db_views(id) ON DELETE CASCADE,
        column_id TEXT NOT NULL,
        direction TEXT NOT NULL DEFAULT 'asc',
        position  INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_db_columns_table ON db_columns(table_id);
      CREATE INDEX IF NOT EXISTS idx_db_rows_table    ON db_rows(table_id);
      CREATE INDEX IF NOT EXISTS idx_db_cells_row     ON db_cells(row_id);
      CREATE INDEX IF NOT EXISTS idx_db_views_table   ON db_views(table_id);
    `,
    down: `
      DROP TABLE IF EXISTS db_sorts;
      DROP TABLE IF EXISTS db_filters;
      DROP TABLE IF EXISTS db_views;
      DROP TABLE IF EXISTS db_cells;
      DROP TABLE IF EXISTS db_rows;
      DROP TABLE IF EXISTS db_columns;
      DROP TABLE IF EXISTS db_tables;
    `,
  },
];

// ============================================================
// DATABASE MODULE — Migrations (version 90)
// Register in main.tsx before db.init()
// ============================================================

import type { Migration } from "@/kernel/db";

export const DATABASE_MIGRATIONS: Migration[] = [
  {
    version: 90,
    up: async (db) => {
      // ── Tables ──────────────────────────────────────────
      await db.execute(`
        CREATE TABLE IF NOT EXISTS db_tables (
          id            TEXT PRIMARY KEY NOT NULL,
          name          TEXT NOT NULL,
          description   TEXT,
          linked_project_id TEXT,
          linked_note_id    TEXT,
          schema_json   TEXT NOT NULL DEFAULT '[]',
          created_at    TEXT NOT NULL,
          updated_at    TEXT NOT NULL
        )
      `);

      // ── Views (grid / kanban per table) ─────────────────
      await db.execute(`
        CREATE TABLE IF NOT EXISTS db_views (
          id          TEXT PRIMARY KEY NOT NULL,
          table_id    TEXT NOT NULL REFERENCES db_tables(id) ON DELETE CASCADE,
          name        TEXT NOT NULL,
          type        TEXT NOT NULL DEFAULT 'grid',
          column_order TEXT NOT NULL DEFAULT '[]',
          hidden_columns TEXT NOT NULL DEFAULT '[]',
          group_by_column_id TEXT,
          created_at  TEXT NOT NULL,
          updated_at  TEXT NOT NULL
        )
      `);

      // ── Rows ─────────────────────────────────────────────
      await db.execute(`
        CREATE TABLE IF NOT EXISTS db_rows (
          id          TEXT PRIMARY KEY NOT NULL,
          table_id    TEXT NOT NULL REFERENCES db_tables(id) ON DELETE CASCADE,
          cells_json  TEXT NOT NULL DEFAULT '{}',
          row_order   REAL NOT NULL DEFAULT 0,
          created_at  TEXT NOT NULL,
          updated_at  TEXT NOT NULL
        )
      `);

      // ── Filters (per view) ───────────────────────────────
      await db.execute(`
        CREATE TABLE IF NOT EXISTS db_filters (
          id          TEXT PRIMARY KEY NOT NULL,
          view_id     TEXT NOT NULL REFERENCES db_views(id) ON DELETE CASCADE,
          column_id   TEXT NOT NULL,
          operator    TEXT NOT NULL,
          value       TEXT,
          filter_order INTEGER NOT NULL DEFAULT 0
        )
      `);

      // ── Sorts (per view) ─────────────────────────────────
      await db.execute(`
        CREATE TABLE IF NOT EXISTS db_sorts (
          id          TEXT PRIMARY KEY NOT NULL,
          view_id     TEXT NOT NULL REFERENCES db_views(id) ON DELETE CASCADE,
          column_id   TEXT NOT NULL,
          direction   TEXT NOT NULL DEFAULT 'asc',
          sort_order  INTEGER NOT NULL DEFAULT 0
        )
      `);

      // ── Indexes ──────────────────────────────────────────
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_db_views_table ON db_views(table_id)`);
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_db_rows_table  ON db_rows(table_id)`);
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_db_filters_view ON db_filters(view_id)`);
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_db_sorts_view   ON db_sorts(view_id)`);
    },
  },
];

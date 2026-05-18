// ============================================================
// TIME TRACKING — DB
// Migration version: 80
// Register in main.tsx: db.registerMigrations(TIME_MIGRATIONS)
// ============================================================

import type { Migration } from "@/kernel/db";

export const TIME_MIGRATIONS: Migration[] = [
  {
    version: 80,
    module: "time-tracking",
    up: `
      CREATE TABLE IF NOT EXISTS time_entries (
        id              TEXT PRIMARY KEY,
        task_id         TEXT,
        project_id      TEXT,
        focus_session_id TEXT,
        description     TEXT,
        start_at        TEXT NOT NULL,
        end_at          TEXT,
        duration_minutes INTEGER,
        is_billable     INTEGER NOT NULL DEFAULT 0,
        tags            TEXT NOT NULL DEFAULT '[]',
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_time_entries_start_at   ON time_entries(start_at);
      CREATE INDEX IF NOT EXISTS idx_time_entries_task_id    ON time_entries(task_id);
      CREATE INDEX IF NOT EXISTS idx_time_entries_project_id ON time_entries(project_id);
    `,
    down: `
      DROP TABLE IF EXISTS time_entries;
    `,
  },
];

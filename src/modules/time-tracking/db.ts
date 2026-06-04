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
  {
    version: 81,
    module: "time-tracking",
    up: `
      ALTER TABLE time_entries ADD COLUMN is_manual INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE time_entries ADD COLUMN billable_rate REAL;
      ALTER TABLE time_entries ADD COLUMN billable_amount REAL;
      ALTER TABLE time_entries ADD COLUMN category TEXT;
      ALTER TABLE time_entries ADD COLUMN created_by TEXT;

      CREATE TABLE IF NOT EXISTS time_tracking_settings (
        id TEXT PRIMARY KEY,
        default_billable INTEGER NOT NULL DEFAULT 0,
        default_hourly_rate REAL,
        currency TEXT NOT NULL DEFAULT 'USD',
        round_entries TEXT NOT NULL DEFAULT 'none',
        idle_detection_min INTEGER NOT NULL DEFAULT 0,
        reminder_interval_min INTEGER NOT NULL DEFAULT 0,
        work_hours_start TEXT NOT NULL DEFAULT '09:00',
        work_hours_end TEXT NOT NULL DEFAULT '17:00'
      );
    `,
    down: `
      DROP TABLE IF EXISTS time_tracking_settings;
    `
  }
];

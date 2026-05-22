// ============================================================
// FOCUS — DB
// Migrations only.  All CRUD lives in repository.ts.
// Register in main.tsx: db.registerMigrations(FOCUS_MIGRATIONS)
// ============================================================

import type { Migration } from "@/kernel/db";

export const FOCUS_MIGRATIONS: Migration[] = [
  {
    version: 70,
    module:  "focus",
    up: `
      CREATE TABLE IF NOT EXISTS focus_sessions (
        id               TEXT PRIMARY KEY,
        task_id          TEXT,
        project_id       TEXT,
        type             TEXT NOT NULL DEFAULT 'focus',
        planned_minutes  INTEGER NOT NULL DEFAULT 25,
        actual_minutes   INTEGER,
        state            TEXT NOT NULL DEFAULT 'idle',
        started_at       TEXT,
        completed_at     TEXT,
        notes            TEXT,
        created_at       TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_focus_sessions_task_id ON focus_sessions(task_id);
      CREATE INDEX IF NOT EXISTS idx_focus_sessions_project_id ON focus_sessions(project_id);
      CREATE INDEX IF NOT EXISTS idx_focus_sessions_started_at ON focus_sessions(started_at);
    `,
    down: `DROP TABLE IF EXISTS focus_sessions;`,
  },
  {
    version: 71,
    module:  "focus",
    up: `
      ALTER TABLE focus_sessions ADD COLUMN goal TEXT;
      ALTER TABLE focus_sessions ADD COLUMN interrupt_count INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE focus_sessions ADD COLUMN mood INTEGER;
    `,
    down: `-- SQLite <3.35 does not support DROP COLUMN; handled by full table drop on rollback`,
  },
];

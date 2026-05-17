// ============================================================
// JOURNAL MODULE — DB
// Migration version: 60
// Register in main.tsx BEFORE db.init()
// ============================================================

import type { Migration } from "@/kernel/db";

export const JOURNAL_MIGRATIONS: Migration[] = [
  {
    version: 60,
    module: "journal",
    down: `
      DROP INDEX IF EXISTS idx_journal_entries_date_type;
      DROP INDEX IF EXISTS idx_journal_entries_date;
      DROP INDEX IF EXISTS idx_journal_entries_type;
      DROP TABLE IF EXISTS journal_entries;
    `,
    up: `
      CREATE TABLE IF NOT EXISTS journal_entries (
        id              TEXT PRIMARY KEY,
        date            TEXT NOT NULL,
        type            TEXT NOT NULL DEFAULT 'daily',
        content         TEXT NOT NULL DEFAULT '{}',
        mood            INTEGER,
        linked_task_ids TEXT NOT NULL DEFAULT '[]',
        linked_project_ids TEXT NOT NULL DEFAULT '[]',
        tags            TEXT NOT NULL DEFAULT '[]',
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_entries_date_type
        ON journal_entries (date, type);

      CREATE INDEX IF NOT EXISTS idx_journal_entries_date
        ON journal_entries (date DESC);

      CREATE INDEX IF NOT EXISTS idx_journal_entries_type
        ON journal_entries (type);
    `,
  },
];

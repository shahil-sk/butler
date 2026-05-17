import type { Migration } from "@/kernel/db";

export const NOTE_MIGRATIONS: Migration[] = [
  {
    version: 40,
    module: "notes",
    up: `
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT 'Untitled',
        content TEXT NOT NULL DEFAULT '{}',
        type TEXT NOT NULL DEFAULT 'note',
        date TEXT,
        linked_task_ids TEXT NOT NULL DEFAULT '[]',
        linked_project_ids TEXT NOT NULL DEFAULT '[]',
        linked_event_ids TEXT NOT NULL DEFAULT '[]',
        backlinks TEXT NOT NULL DEFAULT '[]',
        tags TEXT NOT NULL DEFAULT '[]',
        is_pinned INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_notes_type    ON notes (type);
      CREATE INDEX IF NOT EXISTS idx_notes_date    ON notes (date);
      CREATE INDEX IF NOT EXISTS idx_notes_pinned  ON notes (is_pinned DESC);
      CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes (updated_at DESC);

      CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
        id UNINDEXED,
        title,
        content,
        content='notes',
        content_rowid='rowid'
      );
    `,
    down: `
      DROP TABLE IF EXISTS notes_fts;
      DROP TABLE IF EXISTS notes;
    `,
  },
];

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
  {
    version: 41,
    module: "notes",
    up: `ALTER TABLE notes ADD COLUMN linked_research_ids TEXT NOT NULL DEFAULT '[]';`,
    down: `ALTER TABLE notes DROP COLUMN linked_research_ids;`
  },
  {
    version: 42,
    module: "notes",
    up: `
      ALTER TABLE notes ADD COLUMN content_text TEXT;
      ALTER TABLE notes ADD COLUMN status TEXT DEFAULT 'active';
      ALTER TABLE notes ADD COLUMN note_type TEXT DEFAULT 'note';
      ALTER TABLE notes ADD COLUMN is_daily INTEGER DEFAULT 0;
      ALTER TABLE notes ADD COLUMN daily_date TEXT;
      ALTER TABLE notes ADD COLUMN parent_id TEXT;
      ALTER TABLE notes ADD COLUMN notebook_id TEXT;
      ALTER TABLE notes ADD COLUMN properties TEXT;
      ALTER TABLE notes ADD COLUMN aliases TEXT;
      ALTER TABLE notes ADD COLUMN pinned INTEGER DEFAULT 0;
      ALTER TABLE notes ADD COLUMN starred INTEGER DEFAULT 0;
      ALTER TABLE notes ADD COLUMN word_count INTEGER DEFAULT 0;
      ALTER TABLE notes ADD COLUMN reading_time_min INTEGER DEFAULT 0;
      ALTER TABLE notes ADD COLUMN last_opened_at TEXT;
      ALTER TABLE notes ADD COLUMN created_by TEXT;
      ALTER TABLE notes ADD COLUMN embedding TEXT; -- Vector not natively supported by standard sqlite without extension, so store as JSON text for now
      ALTER TABLE notes ADD COLUMN embedding_updated_at TEXT;

      CREATE TABLE IF NOT EXISTS note_links (
        id TEXT PRIMARY KEY,
        source_note_id TEXT NOT NULL,
        target_note_id TEXT,
        target_raw TEXT NOT NULL,
        block_id TEXT,
        is_embed INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS note_blocks (
        id TEXT PRIMARY KEY,
        note_id TEXT NOT NULL,
        block_id TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        position INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS notebooks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        icon TEXT,
        color TEXT,
        parent_id TEXT,
        position REAL NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS note_versions (
        id TEXT PRIMARY KEY,
        note_id TEXT NOT NULL,
        content TEXT NOT NULL,
        word_count INTEGER NOT NULL,
        saved_at TEXT NOT NULL,
        saved_by TEXT NOT NULL,
        change_summary TEXT
      );
    `,
    down: `
      DROP TABLE IF EXISTS note_versions;
      DROP TABLE IF EXISTS notebooks;
      DROP TABLE IF EXISTS note_blocks;
      DROP TABLE IF EXISTS note_links;
    `
  }
];

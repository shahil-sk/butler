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
  {
    version: 61,
    module: "journal",
    up: `
      ALTER TABLE journal_entries ADD COLUMN note_id TEXT;
      ALTER TABLE journal_entries ADD COLUMN status TEXT DEFAULT 'draft';
      ALTER TABLE journal_entries ADD COLUMN mood_morning INTEGER;
      ALTER TABLE journal_entries ADD COLUMN mood_evening INTEGER;
      ALTER TABLE journal_entries ADD COLUMN energy_morning INTEGER;
      ALTER TABLE journal_entries ADD COLUMN energy_evening INTEGER;
      ALTER TABLE journal_entries ADD COLUMN gratitude TEXT DEFAULT '[]';
      ALTER TABLE journal_entries ADD COLUMN wins TEXT DEFAULT '[]';
      ALTER TABLE journal_entries ADD COLUMN challenges TEXT DEFAULT '[]';
      ALTER TABLE journal_entries ADD COLUMN learnings TEXT DEFAULT '[]';
      ALTER TABLE journal_entries ADD COLUMN morning_intention TEXT;
      ALTER TABLE journal_entries ADD COLUMN evening_reflection TEXT;
      ALTER TABLE journal_entries ADD COLUMN tasks_completed INTEGER DEFAULT 0;
      ALTER TABLE journal_entries ADD COLUMN tasks_deferred INTEGER DEFAULT 0;
      ALTER TABLE journal_entries ADD COLUMN focus_minutes INTEGER DEFAULT 0;
      ALTER TABLE journal_entries ADD COLUMN habit_summary TEXT;
      ALTER TABLE journal_entries ADD COLUMN life_area_ratings TEXT;
      ALTER TABLE journal_entries ADD COLUMN custom_prompts TEXT;
      ALTER TABLE journal_entries ADD COLUMN word_count INTEGER DEFAULT 0;
      ALTER TABLE journal_entries ADD COLUMN write_streak INTEGER DEFAULT 0;
      ALTER TABLE journal_entries ADD COLUMN completed_at TEXT;

      CREATE TABLE IF NOT EXISTS journal_prompt_sets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        prompts TEXT NOT NULL,
        is_default INTEGER NOT NULL DEFAULT 0,
        trigger TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS weekly_reviews (
        id TEXT PRIMARY KEY,
        week_start TEXT NOT NULL,
        note_id TEXT,
        highlight TEXT,
        challenge TEXT,
        learning TEXT,
        intention TEXT,
        habit_consistency TEXT,
        tasks_completed INTEGER NOT NULL DEFAULT 0,
        tasks_deferred INTEGER NOT NULL DEFAULT 0,
        focus_hours REAL NOT NULL DEFAULT 0,
        goal_progress TEXT,
        avg_mood REAL,
        avg_energy REAL,
        life_areas_summary TEXT,
        created_at TEXT NOT NULL,
        completed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS mood_data_points (
        id TEXT PRIMARY KEY,
        recorded_at TEXT NOT NULL,
        mood INTEGER NOT NULL,
        energy INTEGER,
        note TEXT,
        source TEXT NOT NULL
      );
    `,
    down: `
      DROP TABLE IF EXISTS mood_data_points;
      DROP TABLE IF EXISTS weekly_reviews;
      DROP TABLE IF EXISTS journal_prompt_sets;
    `
  }
];

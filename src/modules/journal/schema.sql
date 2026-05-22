-- ============================================================
-- JOURNAL — schema.sql
-- Canonical DDL source. Applied via JOURNAL_MIGRATIONS in db.ts.
-- Do not execute this file directly — use the migration runner.
-- ============================================================

CREATE TABLE IF NOT EXISTS journal_entries (
  id                 TEXT    PRIMARY KEY,
  date               TEXT    NOT NULL,
  type               TEXT    NOT NULL DEFAULT 'daily',
  content            TEXT    NOT NULL DEFAULT '{}',
  mood               INTEGER,                          -- 1-5
  linked_task_ids    TEXT    NOT NULL DEFAULT '[]',    -- JSON array
  linked_project_ids TEXT    NOT NULL DEFAULT '[]',    -- JSON array
  tags               TEXT    NOT NULL DEFAULT '[]',    -- JSON array
  created_at         TEXT    NOT NULL,
  updated_at         TEXT    NOT NULL
);

-- One daily entry per date; other types (reflection, freeform) may share a date
CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_entries_date_type
  ON journal_entries (date, type)
  WHERE type = 'daily';

CREATE INDEX IF NOT EXISTS idx_journal_entries_date
  ON journal_entries (date DESC);

CREATE INDEX IF NOT EXISTS idx_journal_entries_type
  ON journal_entries (type);

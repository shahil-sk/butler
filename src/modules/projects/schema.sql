-- ============================================================
-- PROJECTS — schema.sql
-- Canonical DDL source. Applied via PROJECT_MIGRATIONS in db.ts.
-- Do not execute this file directly — use the migration runner.
-- ============================================================

CREATE TABLE IF NOT EXISTS projects (
  id              TEXT    PRIMARY KEY,
  name            TEXT    NOT NULL,
  description     TEXT,
  status          TEXT    NOT NULL DEFAULT 'active',  -- active | on_hold | completed | archived
  color           TEXT    NOT NULL DEFAULT '#3b82f6',
  icon            TEXT,
  start_date      TEXT,
  due_date        TEXT,
  milestones      TEXT    NOT NULL DEFAULT '[]',       -- JSON array of Milestone
  linked_note_ids TEXT    NOT NULL DEFAULT '[]',       -- JSON array of note IDs
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT    NOT NULL,
  updated_at      TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_status
  ON projects (status);

CREATE INDEX IF NOT EXISTS idx_projects_sort
  ON projects (sort_order ASC, created_at DESC);

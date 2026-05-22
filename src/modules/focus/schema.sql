-- ============================================================
-- FOCUS — schema.sql
-- Canonical DDL source.  Applied via FOCUS_MIGRATIONS in db.ts.
-- Do not execute this file directly — use the migration runner.
-- ============================================================

CREATE TABLE IF NOT EXISTS focus_sessions (
  id               TEXT    PRIMARY KEY,
  task_id          TEXT,
  project_id       TEXT,
  type             TEXT    NOT NULL DEFAULT 'focus',
  planned_minutes  INTEGER NOT NULL DEFAULT 25,
  actual_minutes   INTEGER,
  state            TEXT    NOT NULL DEFAULT 'idle',
  started_at       TEXT,
  completed_at     TEXT,
  notes            TEXT,
  goal             TEXT,
  interrupt_count  INTEGER NOT NULL DEFAULT 0,
  mood             INTEGER,               -- 1-5
  created_at       TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_focus_sessions_task_id
  ON focus_sessions(task_id);

CREATE INDEX IF NOT EXISTS idx_focus_sessions_project_id
  ON focus_sessions(project_id);

CREATE INDEX IF NOT EXISTS idx_focus_sessions_started_at
  ON focus_sessions(started_at);

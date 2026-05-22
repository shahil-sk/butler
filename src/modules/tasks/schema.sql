-- ============================================================
-- TASKS MODULE — SQL SCHEMA
-- Version 10 (initial)
-- Registered via TASK_MIGRATIONS in db.ts.
-- Do NOT run this file directly — it is the source of truth
-- for the migration strings kept in db.ts.
-- ============================================================

CREATE TABLE IF NOT EXISTS tasks (
  id               TEXT    PRIMARY KEY,
  title            TEXT    NOT NULL,
  description      TEXT,
  status           TEXT    NOT NULL DEFAULT 'todo',
  priority         TEXT    NOT NULL DEFAULT 'none',
  project_id       TEXT,
  parent_task_id   TEXT,
  labels           TEXT    NOT NULL DEFAULT '[]',   -- JSON array
  tags             TEXT    NOT NULL DEFAULT '[]',   -- JSON array
  due_date         TEXT,
  start_date       TEXT,
  scheduled_date   TEXT,
  scheduled_time   TEXT,
  completed_at     TEXT,
  estimate_minutes INTEGER,
  actual_minutes   INTEGER,
  recurrence       TEXT,                            -- JSON object
  dependencies     TEXT    NOT NULL DEFAULT '[]',   -- JSON array
  checklist_items  TEXT    NOT NULL DEFAULT '[]',   -- JSON array
  linked_note_ids  TEXT    NOT NULL DEFAULT '[]',   -- JSON array
  linked_event_ids TEXT    NOT NULL DEFAULT '[]',   -- JSON array
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT    NOT NULL,
  updated_at       TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_status    ON tasks (status);
CREATE INDEX IF NOT EXISTS idx_tasks_project   ON tasks (project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent    ON tasks (parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due       ON tasks (due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_scheduled ON tasks (scheduled_date);
CREATE INDEX IF NOT EXISTS idx_tasks_updated   ON tasks (updated_at DESC);

CREATE TABLE IF NOT EXISTS task_labels (
  id         TEXT NOT NULL PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  color      TEXT NOT NULL DEFAULT '#6b7280',
  created_at TEXT NOT NULL
);

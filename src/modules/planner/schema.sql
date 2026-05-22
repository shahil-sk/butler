-- ============================================================
-- PLANNER — schema.sql
-- Canonical DDL for both planner tables.
-- Applied via PLANNER_MIGRATIONS in db.ts.
-- Do not execute this file directly — use the migration runner.
-- ============================================================

-- ── planner_blocks ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS planner_blocks (
  id         TEXT    PRIMARY KEY,
  date       TEXT    NOT NULL,           -- ISO date YYYY-MM-DD
  task_id    TEXT,                       -- nullable FK → tasks.id
  title      TEXT    NOT NULL,
  start_time TEXT    NOT NULL,           -- "HH:MM"
  end_time   TEXT    NOT NULL,           -- "HH:MM"
  color      TEXT,
  is_break   INTEGER NOT NULL DEFAULT 0, -- 0 = focus, 1 = break
  notes      TEXT,
  created_at TEXT    NOT NULL,
  updated_at TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_planner_blocks_date
  ON planner_blocks (date ASC, start_time ASC);

CREATE INDEX IF NOT EXISTS idx_planner_blocks_task
  ON planner_blocks (task_id)
  WHERE task_id IS NOT NULL;

-- ── planner_carry_forward ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS planner_carry_forward (
  id         TEXT PRIMARY KEY,
  task_id    TEXT NOT NULL,
  from_date  TEXT NOT NULL,
  to_date    TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- ── planner_templates ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS planner_templates (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  blocks_json TEXT NOT NULL DEFAULT '[]',  -- JSON array of TemplateBlock
  created_at  TEXT NOT NULL
);

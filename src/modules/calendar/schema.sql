-- src/modules/calendar/schema.sql
-- Module-owned DDL.  Applied by the kernel migration runner via db.ts.
-- Do not import this file directly in TypeScript — it is the canonical
-- source of truth for documentation and tooling; runtime migrations
-- live in db.ts using the string content below.

-- ── Calendars (containers) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS calendars (
  id         TEXT    PRIMARY KEY,
  name       TEXT    NOT NULL,
  color      TEXT    NOT NULL DEFAULT '#3b82f6',
  is_default INTEGER NOT NULL DEFAULT 0,
  is_visible INTEGER NOT NULL DEFAULT 1,
  source     TEXT    NOT NULL DEFAULT 'local',
  source_url TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── Calendar events ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS calendar_events (
  id              TEXT    PRIMARY KEY,
  title           TEXT    NOT NULL,
  description     TEXT,
  start_at        TEXT    NOT NULL,
  end_at          TEXT    NOT NULL,
  all_day         INTEGER NOT NULL DEFAULT 0,
  color           TEXT,
  calendar_id     TEXT    NOT NULL,
  linked_task_ids TEXT    NOT NULL DEFAULT '[]',
  linked_note_ids TEXT    NOT NULL DEFAULT '[]',
  is_time_block   INTEGER NOT NULL DEFAULT 0,
  recurrence      TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (calendar_id) REFERENCES calendars(id) ON DELETE CASCADE
);

-- ── Indexes ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_events_start
  ON calendar_events (start_at);

CREATE INDEX IF NOT EXISTS idx_events_calendar
  ON calendar_events (calendar_id);

CREATE INDEX IF NOT EXISTS idx_events_time_block
  ON calendar_events (is_time_block)
  WHERE is_time_block = 1;

-- ── Seed: default calendar ───────────────────────────────────────
INSERT OR IGNORE INTO calendars (id, name, color, is_default, is_visible, source, created_at, updated_at)
VALUES ('default', 'Personal', '#3b82f6', 1, 1, 'local', datetime('now'), datetime('now'));

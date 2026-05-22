-- src/modules/notes/schema.sql
-- Module-owned DDL.  Applied by the kernel migration runner via db.ts.
-- Do not import this file directly in TypeScript.

-- ── Notes table ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notes (
  id                 TEXT    PRIMARY KEY,
  title              TEXT    NOT NULL DEFAULT 'Untitled',
  content            TEXT    NOT NULL DEFAULT '{}',
  type               TEXT    NOT NULL DEFAULT 'note'
                             CHECK (type IN ('note', 'daily', 'meeting')),
  date               TEXT,
  linked_task_ids    TEXT    NOT NULL DEFAULT '[]',
  linked_project_ids TEXT    NOT NULL DEFAULT '[]',
  linked_event_ids   TEXT    NOT NULL DEFAULT '[]',
  backlinks          TEXT    NOT NULL DEFAULT '[]',
  tags               TEXT    NOT NULL DEFAULT '[]',
  is_pinned          INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT    NOT NULL,
  updated_at         TEXT    NOT NULL
);

-- ── Indexes ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notes_type    ON notes (type);
CREATE INDEX IF NOT EXISTS idx_notes_date    ON notes (date);
CREATE INDEX IF NOT EXISTS idx_notes_pinned  ON notes (is_pinned DESC);
CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes (updated_at DESC);

-- ── FTS5 virtual table ──────────────────────────────────────────
-- content=''notes'' links the FTS index to the backing table so
-- snippet(), highlight(), and bm25() functions work correctly.
CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
  id      UNINDEXED,
  title,
  content,
  content     = 'notes',
  content_rowid = 'rowid'
);

-- ── FTS sync triggers ──────────────────────────────────────────
-- These keep notes_fts in sync with the notes table automatically,
-- removing the need for application-level FTS maintenance.
CREATE TRIGGER IF NOT EXISTS notes_fts_insert
  AFTER INSERT ON notes BEGIN
    INSERT INTO notes_fts (rowid, id, title, content)
    VALUES (new.rowid, new.id, new.title, new.content);
  END;

CREATE TRIGGER IF NOT EXISTS notes_fts_update
  AFTER UPDATE ON notes BEGIN
    INSERT INTO notes_fts (notes_fts, rowid, id, title, content)
    VALUES ('delete', old.rowid, old.id, old.title, old.content);
    INSERT INTO notes_fts (rowid, id, title, content)
    VALUES (new.rowid, new.id, new.title, new.content);
  END;

CREATE TRIGGER IF NOT EXISTS notes_fts_delete
  AFTER DELETE ON notes BEGIN
    INSERT INTO notes_fts (notes_fts, rowid, id, title, content)
    VALUES ('delete', old.rowid, old.id, old.title, old.content);
  END;

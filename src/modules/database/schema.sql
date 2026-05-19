-- ── databases ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS databases (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  icon        TEXT,
  cover       TEXT,
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_databases_is_archived ON databases (is_archived);
CREATE INDEX IF NOT EXISTS idx_databases_updated_at  ON databases (updated_at DESC);

-- ── columns ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS db_columns (
  id                      TEXT PRIMARY KEY,
  database_id             TEXT NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
  name                    TEXT NOT NULL,
  type                    TEXT NOT NULL,
  position                INTEGER NOT NULL DEFAULT 0,
  width                   INTEGER NOT NULL DEFAULT 180,
  is_hidden               INTEGER NOT NULL DEFAULT 0,
  -- JSON array of {id, label, color} for select / multi_select
  options                 TEXT NOT NULL DEFAULT '[]',
  formula_expression      TEXT,
  relation_target_db_id   TEXT,
  rollup_column_id        TEXT,
  rollup_fn               TEXT,
  created_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_db_columns_database_id ON db_columns (database_id, position);

-- ── rows ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS db_rows (
  id          TEXT PRIMARY KEY,
  database_id TEXT NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL DEFAULT 0,
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_db_rows_database_id  ON db_rows (database_id, position);
CREATE INDEX IF NOT EXISTS idx_db_rows_is_archived  ON db_rows (database_id, is_archived);

-- ── cells ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS db_cells (
  id          TEXT PRIMARY KEY,
  row_id      TEXT NOT NULL REFERENCES db_rows(id) ON DELETE CASCADE,
  column_id   TEXT NOT NULL REFERENCES db_columns(id) ON DELETE CASCADE,
  -- Raw value stored as JSON-encoded string; NULL = empty cell
  value       TEXT,
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(row_id, column_id)
);

CREATE INDEX IF NOT EXISTS idx_db_cells_row_id    ON db_cells (row_id);
CREATE INDEX IF NOT EXISTS idx_db_cells_column_id ON db_cells (column_id);

-- ── views ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS db_views (
  id                  TEXT PRIMARY KEY,
  database_id         TEXT NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  type                TEXT NOT NULL DEFAULT 'grid',
  position            INTEGER NOT NULL DEFAULT 0,
  -- JSON arrays / scalars for view config
  filters             TEXT NOT NULL DEFAULT '[]',
  sorts               TEXT NOT NULL DEFAULT '[]',
  hidden_columns      TEXT NOT NULL DEFAULT '[]',
  group_by_column_id  TEXT,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_db_views_database_id ON db_views (database_id, position);

-- ── FTS5 (searches database names + row text values) ──────────
CREATE VIRTUAL TABLE IF NOT EXISTS db_fts USING fts5(
  database_id UNINDEXED,
  row_id      UNINDEXED,
  content,
  content='db_cells',
  content_rowid='rowid'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS db_cells_ai AFTER INSERT ON db_cells BEGIN
  INSERT INTO db_fts (rowid, database_id, row_id, content)
  SELECT new.rowid,
         (SELECT database_id FROM db_rows WHERE id = new.row_id),
         new.row_id,
         new.value
  WHERE new.value IS NOT NULL;
END;

CREATE TRIGGER IF NOT EXISTS db_cells_ad AFTER DELETE ON db_cells BEGIN
  INSERT INTO db_fts (db_fts, rowid, database_id, row_id, content)
  VALUES ('delete', old.rowid,
          (SELECT database_id FROM db_rows WHERE id = old.row_id),
          old.row_id, old.value);
END;

CREATE TRIGGER IF NOT EXISTS db_cells_au AFTER UPDATE ON db_cells BEGIN
  INSERT INTO db_fts (db_fts, rowid, database_id, row_id, content)
  VALUES ('delete', old.rowid,
          (SELECT database_id FROM db_rows WHERE id = old.row_id),
          old.row_id, old.value);
  INSERT INTO db_fts (rowid, database_id, row_id, content)
  SELECT new.rowid,
         (SELECT database_id FROM db_rows WHERE id = new.row_id),
         new.row_id,
         new.value
  WHERE new.value IS NOT NULL;
END;

import type { Migration } from "@/kernel/db";

export const SEARCH_MIGRATIONS: Migration[] = [
  {
    version: 130, // High version to ensure it runs after entity tables
    module: "search",
    up: `
      -- FTS5 Virtual Table for full-text search
      CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
        entity_type UNINDEXED,
        entity_id UNINDEXED,
        title,
        body,
        tags,
        project_id UNINDEXED,
        updated_at UNINDEXED,
        tokenize='porter unicode61'
      );

      CREATE TABLE IF NOT EXISTS search_history (
        id TEXT PRIMARY KEY,
        query TEXT NOT NULL,
        result_count INTEGER NOT NULL,
        selected_entity_type TEXT,
        selected_entity_id TEXT,
        searched_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS recent_items (
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        opened_at TEXT NOT NULL,
        title TEXT NOT NULL,
        PRIMARY KEY (entity_type, entity_id)
      );
    `,
    down: `
      DROP TABLE IF EXISTS search_index;
      DROP TABLE IF EXISTS search_history;
      DROP TABLE IF EXISTS recent_items;
    `
  }
];

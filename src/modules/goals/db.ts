import type { Migration } from "@/kernel/db";

export const GOAL_MIGRATIONS: Migration[] = [
  {
    version: 140, // Run after search/habits
    module: "goals",
    up: `
      CREATE TABLE IF NOT EXISTS goals (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL,
        horizon TEXT NOT NULL,
        parent_goal_id TEXT,
        area TEXT,
        start_date TEXT,
        target_date TEXT,
        achieved_at TEXT,
        abandoned_at TEXT,
        progress_type TEXT NOT NULL,
        progress_percent REAL NOT NULL DEFAULT 0,
        progress_notes TEXT,
        motivation TEXT,
        outcome TEXT,
        obstacles TEXT, -- JSON array
        tags TEXT, -- JSON array
        color TEXT,
        icon TEXT,
        review_cadence TEXT,
        next_review_date TEXT,
        last_reviewed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS key_results (
        id TEXT PRIMARY KEY,
        goal_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        metric_type TEXT NOT NULL,
        start_value REAL,
        target_value REAL NOT NULL,
        current_value REAL NOT NULL,
        unit TEXT,
        confidence TEXT,
        due_date TEXT,
        completed_at TEXT,
        position REAL NOT NULL DEFAULT 0,
        FOREIGN KEY(goal_id) REFERENCES goals(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS goal_check_ins (
        id TEXT PRIMARY KEY,
        goal_id TEXT NOT NULL,
        check_in_date TEXT NOT NULL,
        progress_percent REAL NOT NULL,
        confidence TEXT NOT NULL,
        notes TEXT,
        key_result_updates TEXT NOT NULL, -- JSON
        mood INTEGER,
        calendar_event_id TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(goal_id) REFERENCES goals(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS goal_links (
        goal_id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        link_strength TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (goal_id, entity_type, entity_id),
        FOREIGN KEY(goal_id) REFERENCES goals(id) ON DELETE CASCADE
      );
    `,
    down: `
      DROP TABLE IF EXISTS goal_links;
      DROP TABLE IF EXISTS goal_check_ins;
      DROP TABLE IF EXISTS key_results;
      DROP TABLE IF EXISTS goals;
    `,
  },
];

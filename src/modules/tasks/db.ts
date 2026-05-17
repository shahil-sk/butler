// ============================================================
// TASKS MODULE — DB
// SQLite schema + migrations. Register in main.tsx boot.
// ============================================================

import type { Migration } from "@/kernel/db";

export const TASK_MIGRATIONS: Migration[] = [
  {
    version: 10,
    module: "tasks",
    up: `
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'todo',
        priority TEXT NOT NULL DEFAULT 'none',
        project_id TEXT,
        parent_task_id TEXT,
        labels TEXT NOT NULL DEFAULT '[]',
        tags TEXT NOT NULL DEFAULT '[]',
        due_date TEXT,
        start_date TEXT,
        scheduled_date TEXT,
        completed_at TEXT,
        estimate_minutes INTEGER,
        actual_minutes INTEGER,
        recurrence TEXT,
        dependencies TEXT NOT NULL DEFAULT '[]',
        checklist_items TEXT NOT NULL DEFAULT '[]',
        linked_note_ids TEXT NOT NULL DEFAULT '[]',
        linked_event_ids TEXT NOT NULL DEFAULT '[]',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_status      ON tasks (status);
      CREATE INDEX IF NOT EXISTS idx_tasks_project     ON tasks (project_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_parent      ON tasks (parent_task_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_due         ON tasks (due_date);
      CREATE INDEX IF NOT EXISTS idx_tasks_scheduled   ON tasks (scheduled_date);
      CREATE INDEX IF NOT EXISTS idx_tasks_updated     ON tasks (updated_at DESC);

      CREATE TABLE IF NOT EXISTS task_labels (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        color TEXT NOT NULL DEFAULT '#6b7280',
        created_at TEXT NOT NULL
      );
    `,
    down: `
      DROP TABLE IF EXISTS tasks;
      DROP TABLE IF EXISTS task_labels;
    `,
  },
];

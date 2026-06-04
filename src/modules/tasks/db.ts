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
  {
    version: 11,
    module: "tasks",
    up: `
      ALTER TABLE tasks ADD COLUMN linked_planner_block_ids TEXT NOT NULL DEFAULT '[]';
      ALTER TABLE tasks ADD COLUMN linked_research_ids TEXT NOT NULL DEFAULT '[]';
    `,
    down: `
      -- SQLite doesn't support DROP COLUMN easily in old versions, but modern does.
      ALTER TABLE tasks DROP COLUMN linked_planner_block_ids;
      ALTER TABLE tasks DROP COLUMN linked_research_ids;
    `
  },
  {
    version: 12,
    module: "tasks",
    up: `
      ALTER TABLE tasks ADD COLUMN due_time TEXT;
      ALTER TABLE tasks ADD COLUMN scheduled_at TEXT;
      ALTER TABLE tasks ADD COLUMN scheduled_duration INTEGER;
      ALTER TABLE tasks ADD COLUMN cancelled_at TEXT;
      ALTER TABLE tasks ADD COLUMN goal_id TEXT;
      ALTER TABLE tasks ADD COLUMN assignee_id TEXT;
      ALTER TABLE tasks ADD COLUMN recurrence_rule TEXT;
      ALTER TABLE tasks ADD COLUMN recurrence_parent TEXT;
      ALTER TABLE tasks ADD COLUMN next_occurrence_at TEXT;
      ALTER TABLE tasks ADD COLUMN energy_level TEXT;
      ALTER TABLE tasks ADD COLUMN context TEXT;
      ALTER TABLE tasks ADD COLUMN size TEXT;
      ALTER TABLE tasks ADD COLUMN watchers TEXT NOT NULL DEFAULT '[]';
      ALTER TABLE tasks ADD COLUMN attachments TEXT NOT NULL DEFAULT '[]';
      ALTER TABLE tasks ADD COLUMN depends_on TEXT NOT NULL DEFAULT '[]';
      ALTER TABLE tasks ADD COLUMN blocks TEXT NOT NULL DEFAULT '[]';
      ALTER TABLE tasks ADD COLUMN custom_fields TEXT;
      ALTER TABLE tasks ADD COLUMN position REAL NOT NULL DEFAULT 0;
      ALTER TABLE tasks ADD COLUMN section_id TEXT;
      ALTER TABLE tasks ADD COLUMN created_by TEXT;
      ALTER TABLE tasks ADD COLUMN source TEXT;
      ALTER TABLE tasks ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

      -- Create TaskSection table
      CREATE TABLE IF NOT EXISTS task_sections (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        project_id TEXT,
        color TEXT,
        position REAL NOT NULL,
        collapsed BOOLEAN NOT NULL DEFAULT 0
      );

      -- Create TaskDependency table
      CREATE TABLE IF NOT EXISTS task_dependencies (
        id TEXT PRIMARY KEY,
        predecessor_id TEXT NOT NULL,
        successor_id TEXT NOT NULL,
        type TEXT NOT NULL,
        lag_days INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      -- Create TaskComment table
      CREATE TABLE IF NOT EXISTS task_comments (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        author_id TEXT NOT NULL,
        body TEXT NOT NULL,
        mentions TEXT NOT NULL DEFAULT '[]',
        reactions TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        edited BOOLEAN NOT NULL DEFAULT 0
      );

      -- Create TaskActivity table
      CREATE TABLE IF NOT EXISTS task_activity (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        event TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        occurred_at TEXT NOT NULL
      );
    `,
    down: `
      DROP TABLE IF EXISTS task_sections;
      DROP TABLE IF EXISTS task_dependencies;
      DROP TABLE IF EXISTS task_comments;
      DROP TABLE IF EXISTS task_activity;
    `
  }
];

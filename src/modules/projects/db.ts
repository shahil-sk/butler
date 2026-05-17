import type { Migration } from "@/kernel/db";

export const PROJECT_MIGRATIONS: Migration[] = [
  {
    version: 20,
    module: "projects",
    up: `
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        color TEXT NOT NULL DEFAULT '#6b7280',
        icon TEXT,
        start_date TEXT,
        due_date TEXT,
        milestones TEXT NOT NULL DEFAULT '[]',
        linked_note_ids TEXT NOT NULL DEFAULT '[]',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_projects_status  ON projects (status);
      CREATE INDEX IF NOT EXISTS idx_projects_updated ON projects (updated_at DESC);
    `,
    down: `DROP TABLE IF EXISTS projects;`,
  },
];

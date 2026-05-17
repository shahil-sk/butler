import type { Migration } from "@/kernel/db";

export const PLANNER_MIGRATIONS: Migration[] = [
  {
    version: 30,
    module: "planner",
    up: `
      CREATE TABLE IF NOT EXISTS planner_blocks (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        task_id TEXT,
        title TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        color TEXT,
        is_break INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_planner_date ON planner_blocks (date);
      CREATE INDEX IF NOT EXISTS idx_planner_task ON planner_blocks (task_id);

      CREATE TABLE IF NOT EXISTS planner_carry_forward (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        from_date TEXT NOT NULL,
        to_date TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `,
    down: `
      DROP TABLE IF EXISTS planner_blocks;
      DROP TABLE IF EXISTS planner_carry_forward;
    `,
  },
];

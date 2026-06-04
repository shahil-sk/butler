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
  {
    version: 31,
    module: "planner",
    up: `ALTER TABLE planner_blocks ADD COLUMN is_completed INTEGER NOT NULL DEFAULT 0;`,
    down: `ALTER TABLE planner_blocks DROP COLUMN is_completed;`
  },
  {
    version: 32,
    module: "planner",
    up: `
      ALTER TABLE planner_blocks ADD COLUMN category TEXT;
      ALTER TABLE planner_blocks ADD COLUMN event_id TEXT;
      ALTER TABLE planner_blocks ADD COLUMN is_overflow INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE planner_blocks ADD COLUMN actual_start TEXT;
      ALTER TABLE planner_blocks ADD COLUMN actual_end TEXT;
      ALTER TABLE planner_blocks ADD COLUMN actual_duration INTEGER;
      ALTER TABLE planner_blocks ADD COLUMN focus_session_id TEXT;
      ALTER TABLE planner_blocks ADD COLUMN position REAL NOT NULL DEFAULT 0;
      
      CREATE TABLE IF NOT EXISTS day_plans (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'draft',
        morning_intention TEXT,
        evening_reflection TEXT,
        energy_level TEXT,
        mood_start INTEGER,
        mood_end INTEGER,
        planned_minutes INTEGER NOT NULL DEFAULT 0,
        actual_minutes INTEGER NOT NULL DEFAULT 0,
        tasks_planned INTEGER NOT NULL DEFAULT 0,
        tasks_completed INTEGER NOT NULL DEFAULT 0,
        overflow_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        completed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS planner_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        blocks TEXT NOT NULL,
        is_default INTEGER NOT NULL DEFAULT 0,
        days_of_week TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `,
    down: `
      DROP TABLE IF EXISTS day_plans;
      DROP TABLE IF EXISTS planner_templates;
    `
  }
];

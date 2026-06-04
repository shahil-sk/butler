import type { Migration } from "@/kernel/db";

export const HABIT_MIGRATIONS: Migration[] = [
  {
    version: 120, // Run after research (110)
    module: "habits",
    up: `
      CREATE TABLE IF NOT EXISTS habits (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        icon TEXT,
        color TEXT NOT NULL,
        category TEXT,
        frequency_type TEXT NOT NULL,
        frequency_days TEXT,
        custom_interval_days INTEGER,
        times_per_period INTEGER NOT NULL DEFAULT 1,
        target_value REAL,
        target_unit TEXT,
        reminder_time TEXT,
        reminder_enabled BOOLEAN NOT NULL DEFAULT 0,
        linked_goal_id TEXT,
        routine_id TEXT,
        start_date TEXT NOT NULL,
        end_date TEXT,
        archived_at TEXT,
        difficulty TEXT,
        cue TEXT,
        craving TEXT,
        reward TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS habit_logs (
        id TEXT PRIMARY KEY,
        habit_id TEXT NOT NULL,
        date TEXT NOT NULL,
        status TEXT NOT NULL,
        value REAL,
        note TEXT,
        logged_at TEXT NOT NULL,
        source TEXT NOT NULL,
        FOREIGN KEY(habit_id) REFERENCES habits(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS routines (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        habit_ids TEXT NOT NULL, -- JSON array of UUIDs
        trigger_time TEXT,
        duration_min INTEGER,
        days TEXT NOT NULL, -- JSON array of integers 0-6
        active BOOLEAN NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS habit_streaks (
        habit_id TEXT NOT NULL,
        streak_type TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        start_date TEXT NOT NULL,
        end_date TEXT,
        last_updated TEXT NOT NULL,
        PRIMARY KEY (habit_id, streak_type),
        FOREIGN KEY(habit_id) REFERENCES habits(id) ON DELETE CASCADE
      );
    `,
    down: `
      DROP TABLE IF EXISTS habit_streaks;
      DROP TABLE IF EXISTS routines;
      DROP TABLE IF EXISTS habit_logs;
      DROP TABLE IF EXISTS habits;
    `
  }
];

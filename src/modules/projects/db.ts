import type { Migration } from "@/kernel/db";

export const PROJECT_MIGRATIONS: Migration[] = [
  {
    version: 44,
    module: "projects",
    up: `
      DROP TABLE IF EXISTS projects;

      CREATE TABLE projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL,
        health TEXT,
        priority TEXT NOT NULL,
        visibility TEXT NOT NULL,
        
        goal_id TEXT,
        parent_project_id TEXT,
        
        start_date TEXT,
        target_date TEXT,
        hard_deadline TEXT,
        completed_at TEXT,
        
        owner_id TEXT NOT NULL,
        
        color TEXT NOT NULL,
        icon TEXT,
        cover_image_url TEXT,
        
        budget_hours REAL,
        budget_cost REAL,
        currency TEXT,
        
        tags TEXT NOT NULL DEFAULT '[]',
        labels TEXT NOT NULL DEFAULT '[]',
        custom_fields TEXT NOT NULL DEFAULT '{}',
        
        progress_mode TEXT NOT NULL,
        progress_percent REAL NOT NULL DEFAULT 0,
        
        template_id TEXT,
        is_template INTEGER NOT NULL DEFAULT 0,
        
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by TEXT NOT NULL,
        archived_at TEXT,

        milestones TEXT NOT NULL DEFAULT '[]',
        due_date TEXT,
        linked_note_ids TEXT NOT NULL DEFAULT '[]',
        sort_order INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE project_members (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        person_id TEXT NOT NULL,
        role TEXT NOT NULL,
        joined_at TEXT NOT NULL,
        invited_by TEXT
      );

      CREATE TABLE project_phases (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        color TEXT NOT NULL,
        position REAL NOT NULL
      );

      CREATE TABLE project_notes (
        project_id TEXT NOT NULL,
        note_id TEXT NOT NULL,
        linked_at TEXT NOT NULL,
        linked_by TEXT NOT NULL,
        note_type TEXT NOT NULL,
        PRIMARY KEY (project_id, note_id)
      );

      CREATE TABLE project_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        default_phases TEXT NOT NULL DEFAULT '[]',
        default_milestones TEXT NOT NULL DEFAULT '[]',
        default_task_sections TEXT NOT NULL DEFAULT '[]',
        default_member_roles TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      );

      CREATE TABLE milestones (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        due_date TEXT NOT NULL,
        status TEXT NOT NULL,
        completed_at TEXT,
        tasks TEXT NOT NULL DEFAULT '[]',
        depends_on TEXT NOT NULL DEFAULT '[]',
        calendar_event_id TEXT,
        created_at TEXT NOT NULL,
        linked_task_ids TEXT NOT NULL DEFAULT '[]'
      );
    `,
    down: `
      DROP TABLE IF EXISTS projects;
      DROP TABLE IF EXISTS project_members;
      DROP TABLE IF EXISTS project_phases;
      DROP TABLE IF EXISTS project_notes;
      DROP TABLE IF EXISTS project_templates;
      DROP TABLE IF EXISTS milestones;
    `
  },
  {
    version: 45,
    module: "projects",
    up: `ALTER TABLE projects ADD COLUMN attachments TEXT NOT NULL DEFAULT '[]';`,
    down: `ALTER TABLE projects DROP COLUMN attachments;`
  }
];

use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;

pub struct DbState {
    pub pool: SqlitePool,
}

pub async fn init_db(app_handle: &AppHandle) -> Result<SqlitePool, Box<dyn std::error::Error>> {
    // Resolve app data directory
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("./data"));
    
    // Create directory if it doesn't exist
    if !app_dir.exists() {
        fs::create_dir_all(&app_dir)?;
    }

    let db_path = app_dir.join("butler.db");
    let db_url = format!("sqlite:{}", db_path.to_string_lossy());

    log::info!("Connecting to SQLite database at: {}", db_url);

    // Create database file if not exists
    if !db_path.exists() {
        fs::File::create(&db_path)?;
    }

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await?;

    // Enable WAL mode & foreign keys
    sqlx::query("PRAGMA journal_mode = WAL;")
        .execute(&pool)
        .await?;
    sqlx::query("PRAGMA foreign_keys = ON;")
        .execute(&pool)
        .await?;

    // Create base tables
    create_tables(&pool).await?;

    Ok(pool)
}

async fn create_tables(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    // Entities table
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS entities (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            tags TEXT,
            metadata TEXT
        );"
    )
    .execute(pool)
    .await?;

    // Tasks table (extends entities)
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            status TEXT NOT NULL,
            priority TEXT NOT NULL,
            due_date INTEGER,
            parent_id TEXT,
            project_id TEXT,
            FOREIGN KEY(id) REFERENCES entities(id) ON DELETE CASCADE
        );"
    )
    .execute(pool)
    .await?;

    // Notes table (extends entities)
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            FOREIGN KEY(id) REFERENCES entities(id) ON DELETE CASCADE
        );"
    )
    .execute(pool)
    .await?;

    // Note links table (many-to-many relationships)
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS note_links (
            id TEXT PRIMARY KEY,
            source_id TEXT NOT NULL,
            target_id TEXT NOT NULL,
            FOREIGN KEY(source_id) REFERENCES notes(id) ON DELETE CASCADE,
            FOREIGN KEY(target_id) REFERENCES notes(id) ON DELETE CASCADE
        );"
    )
    .execute(pool)
    .await?;

    // Time blocks table (extends entities)
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS time_blocks (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            start_time INTEGER NOT NULL,
            end_time INTEGER NOT NULL,
            block_type TEXT NOT NULL,
            task_id TEXT,
            FOREIGN KEY(id) REFERENCES entities(id) ON DELETE CASCADE,
            FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE SET NULL
        );"
    )
    .execute(pool)
    .await?;

    // Reflections table (extends entities)
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS reflections (
            id TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            prompt_id TEXT NOT NULL,
            response TEXT NOT NULL,
            FOREIGN KEY(id) REFERENCES entities(id) ON DELETE CASCADE
        );"
    )
    .execute(pool)
    .await?;

    // Events table (extends entities)
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS events (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            start_time INTEGER NOT NULL,
            end_time INTEGER NOT NULL,
            is_all_day INTEGER NOT NULL,
            FOREIGN KEY(id) REFERENCES entities(id) ON DELETE CASCADE
        );"
    )
    .execute(pool)
    .await?;

    // Focus sessions table (extends entities)
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS focus_sessions (
            id TEXT PRIMARY KEY,
            task_id TEXT,
            duration INTEGER NOT NULL,
            session_type TEXT NOT NULL,
            completed_at INTEGER NOT NULL,
            FOREIGN KEY(id) REFERENCES entities(id) ON DELETE CASCADE,
            FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE SET NULL
        );"
    )
    .execute(pool)
    .await?;

    // Time logs table (extends entities)
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS time_logs (
            id TEXT PRIMARY KEY,
            task_id TEXT,
            duration INTEGER NOT NULL,
            description TEXT NOT NULL,
            category TEXT NOT NULL,
            started_at INTEGER NOT NULL,
            FOREIGN KEY(id) REFERENCES entities(id) ON DELETE CASCADE,
            FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE SET NULL
        );"
    )
    .execute(pool)
    .await?;

    // Settings table
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );"
    )
    .execute(pool)
    .await?;

    // Journal entries table (extends entities)
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS journal_entries (
            id TEXT PRIMARY KEY,
            date TEXT NOT NULL UNIQUE,
            mood INTEGER NOT NULL,
            mood_notes TEXT,
            gratitude TEXT NOT NULL,
            life_areas TEXT NOT NULL,
            FOREIGN KEY(id) REFERENCES entities(id) ON DELETE CASCADE
        );"
    )
    .execute(pool)
    .await?;

    // Reviews table (extends entities)
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS reviews (
            id TEXT PRIMARY KEY,
            period TEXT NOT NULL UNIQUE,
            type TEXT NOT NULL,
            responses TEXT NOT NULL,
            FOREIGN KEY(id) REFERENCES entities(id) ON DELETE CASCADE
        );"
    )
    .execute(pool)
    .await?;

    // Habits table (extends entities)
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS habits (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            frequency TEXT NOT NULL,
            frequency_spec TEXT NOT NULL,
            target_streak INTEGER NOT NULL,
            routine_group TEXT,
            FOREIGN KEY(id) REFERENCES entities(id) ON DELETE CASCADE
        );"
    )
    .execute(pool)
    .await?;

    // Habit logs table (extends entities)
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS habit_logs (
            id TEXT PRIMARY KEY,
            habit_id TEXT NOT NULL,
            date TEXT NOT NULL,
            status TEXT NOT NULL,
            FOREIGN KEY(id) REFERENCES entities(id) ON DELETE CASCADE,
            FOREIGN KEY(habit_id) REFERENCES habits(id) ON DELETE CASCADE,
            UNIQUE(habit_id, date)
        );"
    )
    .execute(pool)
    .await?;

    // Projects table (extends entities)
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            status TEXT NOT NULL,
            budget_hours REAL NOT NULL DEFAULT 0.0,
            FOREIGN KEY(id) REFERENCES entities(id) ON DELETE CASCADE
        );"
    )
    .execute(pool)
    .await?;

    // Goals table (extends entities)
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS goals (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            horizon TEXT NOT NULL,
            status TEXT NOT NULL,
            target_date INTEGER,
            FOREIGN KEY(id) REFERENCES entities(id) ON DELETE CASCADE
        );"
    )
    .execute(pool)
    .await?;

    // Key results table (extends entities)
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS key_results (
            id TEXT PRIMARY KEY,
            goal_id TEXT NOT NULL,
            title TEXT NOT NULL,
            target_value REAL NOT NULL,
            current_value REAL NOT NULL DEFAULT 0.0,
            unit TEXT NOT NULL,
            key_result_type TEXT NOT NULL,
            FOREIGN KEY(id) REFERENCES entities(id) ON DELETE CASCADE,
            FOREIGN KEY(goal_id) REFERENCES goals(id) ON DELETE CASCADE
        );"
    )
    .execute(pool)
    .await?;

    // Goal links table
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS goal_links (
            id TEXT PRIMARY KEY,
            goal_id TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            FOREIGN KEY(goal_id) REFERENCES goals(id) ON DELETE CASCADE,
            UNIQUE(goal_id, entity_id, entity_type)
        );"
    )
    .execute(pool)
    .await?;

    // Documents table (extends entities)
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            parent_id TEXT,
            template TEXT NOT NULL DEFAULT 'none',
            project_id TEXT,
            FOREIGN KEY(id) REFERENCES entities(id) ON DELETE CASCADE,
            FOREIGN KEY(parent_id) REFERENCES documents(id) ON DELETE SET NULL
        );"
    )
    .execute(pool)
    .await?;

    // User-defined database schemas (db_tables)
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS db_tables (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            columns TEXT NOT NULL,
            project_id TEXT,
            FOREIGN KEY(id) REFERENCES entities(id) ON DELETE CASCADE
        );"
    )
    .execute(pool)
    .await?;

    // User-defined database records (db_records)
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS db_records (
            id TEXT PRIMARY KEY,
            table_id TEXT NOT NULL,
            values_json TEXT NOT NULL,
            FOREIGN KEY(id) REFERENCES entities(id) ON DELETE CASCADE,
            FOREIGN KEY(table_id) REFERENCES db_tables(id) ON DELETE CASCADE
        );"
    )
    .execute(pool)
    .await?;

    // File attachments (extends entities)
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS files (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            path TEXT NOT NULL,
            mime_type TEXT NOT NULL,
            size_bytes INTEGER NOT NULL,
            FOREIGN KEY(id) REFERENCES entities(id) ON DELETE CASCADE
        );"
    )
    .execute(pool)
    .await?;

    // PDF annotations (extends entities)
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS pdf_annotations (
            id TEXT PRIMARY KEY,
            file_id TEXT NOT NULL,
            page INTEGER NOT NULL,
            text TEXT,
            notes TEXT,
            color TEXT NOT NULL,
            FOREIGN KEY(id) REFERENCES entities(id) ON DELETE CASCADE,
            FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE
        );"
    )
    .execute(pool)
    .await?;

    // FTS5 Virtual Table for Search
    sqlx::query(
        "CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
            id UNINDEXED,
            title,
            tags,
            content
        );"
    )
    .execute(pool)
    .await?;

    // Triggers for syncing search_index
    sqlx::query(
        "CREATE TRIGGER IF NOT EXISTS after_task_insert
         AFTER INSERT ON tasks
         BEGIN
             INSERT INTO search_index (id, title, tags, content)
             SELECT NEW.id, NEW.title, e.tags, 'Priority: ' || NEW.priority || ', Status: ' || NEW.status
             FROM entities e WHERE e.id = NEW.id;
         END;"
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TRIGGER IF NOT EXISTS after_task_update
         AFTER UPDATE ON tasks
         BEGIN
             UPDATE search_index
             SET title = NEW.title,
                 content = 'Priority: ' || NEW.priority || ', Status: ' || NEW.status
             WHERE id = NEW.id;
         END;"
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TRIGGER IF NOT EXISTS after_note_insert
         AFTER INSERT ON notes
         BEGIN
             INSERT INTO search_index (id, title, tags, content)
             SELECT NEW.id, NEW.title, e.tags, NEW.content
             FROM entities e WHERE e.id = NEW.id;
         END;"
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TRIGGER IF NOT EXISTS after_note_update
         AFTER UPDATE ON notes
         BEGIN
             UPDATE search_index
             SET title = NEW.title,
                 content = NEW.content
             WHERE id = NEW.id;
         END;"
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TRIGGER IF NOT EXISTS after_document_insert
         AFTER INSERT ON documents
         BEGIN
             INSERT INTO search_index (id, title, tags, content)
             SELECT NEW.id, NEW.title, e.tags, NEW.content
             FROM entities e WHERE e.id = NEW.id;
         END;"
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TRIGGER IF NOT EXISTS after_document_update
         AFTER UPDATE ON documents
         BEGIN
             UPDATE search_index
             SET title = NEW.title,
                 content = NEW.content
             WHERE id = NEW.id;
         END;"
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TRIGGER IF NOT EXISTS after_file_insert
         AFTER INSERT ON files
         BEGIN
             INSERT INTO search_index (id, title, tags, content)
             SELECT NEW.id, 'File: ' || NEW.name, e.tags, 'Mime: ' || NEW.mime_type || ', Path: ' || NEW.path
             FROM entities e WHERE e.id = NEW.id;
         END;"
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TRIGGER IF NOT EXISTS after_file_update
         AFTER UPDATE ON files
         BEGIN
             UPDATE search_index
             SET title = 'File: ' || NEW.name,
                 content = 'Mime: ' || NEW.mime_type || ', Path: ' || NEW.path
             WHERE id = NEW.id;
         END;"
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TRIGGER IF NOT EXISTS after_pdf_annotation_insert
         AFTER INSERT ON pdf_annotations
         BEGIN
             INSERT INTO search_index (id, title, tags, content)
             SELECT NEW.id, 'Annotation on Page ' || NEW.page, e.tags, 'Highlight: ' || IFNULL(NEW.text, '') || ', Note: ' || IFNULL(NEW.notes, '')
             FROM entities e WHERE e.id = NEW.id;
         END;"
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TRIGGER IF NOT EXISTS after_pdf_annotation_update
         AFTER UPDATE ON pdf_annotations
         BEGIN
             UPDATE search_index
             SET title = 'Annotation on Page ' || NEW.page,
                 content = 'Highlight: ' || IFNULL(NEW.text, '') || ', Note: ' || IFNULL(NEW.notes, '')
             WHERE id = NEW.id;
         END;"
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TRIGGER IF NOT EXISTS after_db_record_insert
         AFTER INSERT ON db_records
         BEGIN
             INSERT INTO search_index (id, title, tags, content)
             SELECT NEW.id, 'Record in Table: ' || t.name, e.tags, NEW.values_json
             FROM db_tables t
             JOIN entities e ON e.id = NEW.id
             WHERE t.id = NEW.table_id;
         END;"
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TRIGGER IF NOT EXISTS after_db_record_update
         AFTER UPDATE ON db_records
         BEGIN
             UPDATE search_index
             SET content = NEW.values_json
             WHERE id = NEW.id;
         END;"
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TRIGGER IF NOT EXISTS after_journal_insert
         AFTER INSERT ON journal_entries
         BEGIN
             INSERT INTO search_index (id, title, tags, content)
             SELECT NEW.id, 'Journal: ' || NEW.date, e.tags, 'Mood: ' || NEW.mood || ', Notes: ' || IFNULL(NEW.mood_notes, '') || ', Gratitude: ' || NEW.gratitude
             FROM entities e WHERE e.id = NEW.id;
         END;"
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TRIGGER IF NOT EXISTS after_journal_update
         AFTER UPDATE ON journal_entries
         BEGIN
             UPDATE search_index
             SET title = 'Journal: ' || NEW.date,
                 content = 'Mood: ' || NEW.mood || ', Notes: ' || IFNULL(NEW.mood_notes, '') || ', Gratitude: ' || NEW.gratitude
             WHERE id = NEW.id;
         END;"
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TRIGGER IF NOT EXISTS after_review_insert
         AFTER INSERT ON reviews
         BEGIN
             INSERT INTO search_index (id, title, tags, content)
             SELECT NEW.id, NEW.type || ' Review: ' || NEW.period, e.tags, NEW.responses
             FROM entities e WHERE e.id = NEW.id;
         END;"
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TRIGGER IF NOT EXISTS after_review_update
         AFTER UPDATE ON reviews
         BEGIN
             UPDATE search_index
             SET title = NEW.type || ' Review: ' || NEW.period,
                 content = NEW.responses
             WHERE id = NEW.id;
         END;"
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TRIGGER IF NOT EXISTS after_habit_insert
         AFTER INSERT ON habits
         BEGIN
             INSERT INTO search_index (id, title, tags, content)
             SELECT NEW.id, NEW.title, e.tags, IFNULL(NEW.description, '') || ', Routine: ' || IFNULL(NEW.routine_group, 'none')
             FROM entities e WHERE e.id = NEW.id;
         END;"
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TRIGGER IF NOT EXISTS after_habit_update
         AFTER UPDATE ON habits
         BEGIN
             UPDATE search_index
             SET title = NEW.title,
                 content = IFNULL(NEW.description, '') || ', Routine: ' || IFNULL(NEW.routine_group, 'none')
             WHERE id = NEW.id;
         END;"
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TRIGGER IF NOT EXISTS after_project_insert
         AFTER INSERT ON projects
         BEGIN
             INSERT INTO search_index (id, title, tags, content)
             SELECT NEW.id, NEW.name, e.tags, IFNULL(NEW.description, '') || ', Status: ' || NEW.status
             FROM entities e WHERE e.id = NEW.id;
         END;"
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TRIGGER IF NOT EXISTS after_project_update
         AFTER UPDATE ON projects
         BEGIN
             UPDATE search_index
             SET title = NEW.name,
                 content = IFNULL(NEW.description, '') || ', Status: ' || NEW.status
             WHERE id = NEW.id;
         END;"
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TRIGGER IF NOT EXISTS after_goal_insert
         AFTER INSERT ON goals
         BEGIN
             INSERT INTO search_index (id, title, tags, content)
             SELECT NEW.id, NEW.title, e.tags, IFNULL(NEW.description, '') || ', Horizon: ' || NEW.horizon || ', Status: ' || NEW.status
             FROM entities e WHERE e.id = NEW.id;
         END;"
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TRIGGER IF NOT EXISTS after_goal_update
         AFTER UPDATE ON goals
         BEGIN
             UPDATE search_index
             SET title = NEW.title,
                 content = IFNULL(NEW.description, '') || ', Horizon: ' || NEW.horizon || ', Status: ' || NEW.status
             WHERE id = NEW.id;
         END;"
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TRIGGER IF NOT EXISTS after_entity_update
         AFTER UPDATE ON entities
         BEGIN
             UPDATE search_index
             SET tags = NEW.tags
             WHERE id = NEW.id;
         END;"
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TRIGGER IF NOT EXISTS after_entity_delete
         AFTER DELETE ON entities
         BEGIN
             DELETE FROM search_index WHERE id = OLD.id;
         END;"
    )
    .execute(pool)
    .await?;

    Ok(())
}

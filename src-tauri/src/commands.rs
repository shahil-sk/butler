use serde::{Deserialize, Serialize};
use tauri::State;
use crate::db::DbState;
use uuid::Uuid;
use chrono::Utc;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Task {
    pub id: String,
    pub title: String,
    pub status: String,
    pub priority: String,
    pub due_date: Option<i64>,
    pub parent_id: Option<String>,
    pub project_id: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub tags: Vec<String>,
    pub metadata: String,
}

#[tauri::command]
pub async fn get_setting(state: State<'_, DbState>, key: String) -> Result<Option<String>, String> {
    let row: Option<(String,)> = sqlx::query_as("SELECT value FROM settings WHERE key = ?")
        .bind(key)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(row.map(|r| r.0))
}

#[tauri::command]
pub async fn set_setting(state: State<'_, DbState>, key: String, value: String) -> Result<(), String> {
    sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
        .bind(key)
        .bind(value)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub async fn create_task(
    state: State<'_, DbState>,
    title: String,
    status: String,
    priority: String,
    due_date: Option<i64>,
    parent_id: Option<String>,
    project_id: Option<String>,
    tags: Vec<String>,
    metadata: String,
) -> Result<Task, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().timestamp_millis();
    let tags_str = tags.join(",");

    let mut tx = state.pool.begin().await.map_err(|e| e.to_string())?;

    // 1. Insert into entities
    sqlx::query(
        "INSERT INTO entities (id, type, created_at, updated_at, tags, metadata) VALUES (?, 'task', ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(now)
    .bind(now)
    .bind(&tags_str)
    .bind(&metadata)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    // 2. Insert into tasks
    sqlx::query(
        "INSERT INTO tasks (id, title, status, priority, due_date, parent_id, project_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&title)
    .bind(&status)
    .bind(&priority)
    .bind(due_date)
    .bind(&parent_id)
    .bind(&project_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;

    Ok(Task {
        id,
        title,
        status,
        priority,
        due_date,
        parent_id,
        project_id,
        created_at: now,
        updated_at: now,
        tags,
        metadata,
    })
}

#[tauri::command]
pub async fn list_tasks(state: State<'_, DbState>) -> Result<Vec<Task>, String> {
    let rows: Vec<(
        String, String, String, String, Option<i64>, Option<String>, Option<String>, i64, i64, Option<String>, Option<String>
    )> = sqlx::query_as(
        "SELECT t.id, t.title, t.status, t.priority, t.due_date, t.parent_id, t.project_id, e.created_at, e.updated_at, e.tags, e.metadata 
         FROM tasks t 
         JOIN entities e ON t.id = e.id"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    let tasks = rows.into_iter().map(|r| {
        let tags = r.9.map(|t| t.split(',').map(|s| s.to_string()).filter(|s| !s.is_empty()).collect()).unwrap_or_default();
        Task {
            id: r.0,
            title: r.1,
            status: r.2,
            priority: r.3,
            due_date: r.4,
            parent_id: r.5,
            project_id: r.6,
            created_at: r.7,
            updated_at: r.8,
            tags,
            metadata: r.10.unwrap_or_default(),
        }
    }).collect();

    Ok(tasks)
}

#[tauri::command]
pub async fn update_task_status(
    state: State<'_, DbState>,
    id: String,
    status: String,
) -> Result<(), String> {
    let now = Utc::now().timestamp_millis();
    let mut tx = state.pool.begin().await.map_err(|e| e.to_string())?;

    sqlx::query("UPDATE tasks SET status = ? WHERE id = ?")
        .bind(&status)
        .bind(&id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query("UPDATE entities SET updated_at = ? WHERE id = ?")
        .bind(now)
        .bind(&id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn update_task_details(
    state: State<'_, DbState>,
    id: String,
    title: String,
    priority: String,
    due_date: Option<i64>,
    project_id: Option<String>,
    tags: Vec<String>,
) -> Result<(), String> {
    let now = Utc::now().timestamp_millis();
    let tags_str = tags.join(",");
    let mut tx = state.pool.begin().await.map_err(|e| e.to_string())?;

    sqlx::query("UPDATE tasks SET title = ?, priority = ?, due_date = ?, project_id = ? WHERE id = ?")
        .bind(&title)
        .bind(&priority)
        .bind(due_date)
        .bind(project_id)
        .bind(&id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query("UPDATE entities SET updated_at = ?, tags = ? WHERE id = ?")
        .bind(now)
        .bind(&tags_str)
        .bind(&id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn delete_task(
    state: State<'_, DbState>,
    id: String,
) -> Result<(), String> {
    sqlx::query("DELETE FROM entities WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn search_tasks(
    state: State<'_, DbState>,
    query: String,
) -> Result<Vec<Task>, String> {
    if query.trim().is_empty() {
        return list_tasks(state).await;
    }

    let search_query = format!("{}*", query);
    let rows: Vec<(
        String, String, String, String, Option<i64>, Option<String>, Option<String>, i64, i64, Option<String>, Option<String>
    )> = sqlx::query_as(
        "SELECT t.id, t.title, t.status, t.priority, t.due_date, t.parent_id, t.project_id, e.created_at, e.updated_at, e.tags, e.metadata 
         FROM search_index s
         JOIN tasks t ON s.id = t.id
         JOIN entities e ON t.id = e.id
         WHERE search_index MATCH ?"
    )
    .bind(&search_query)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    let tasks = rows.into_iter().map(|r| {
        let tags = r.9.map(|t| t.split(',').map(|s| s.to_string()).filter(|s| !s.is_empty()).collect()).unwrap_or_default();
        Task {
            id: r.0,
            title: r.1,
            status: r.2,
            priority: r.3,
            due_date: r.4,
            parent_id: r.5,
            project_id: r.6,
            created_at: r.7,
            updated_at: r.8,
            tags,
            metadata: r.10.unwrap_or_default(),
        }
    }).collect();

    Ok(tasks)
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TimeBlock {
    pub id: String,
    pub title: String,
    pub start_time: i64,
    pub end_time: i64,
    pub block_type: String,
    pub task_id: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[tauri::command]
pub async fn create_time_block(
    state: State<'_, DbState>,
    title: String,
    start_time: i64,
    end_time: i64,
    block_type: String,
    task_id: Option<String>,
) -> Result<TimeBlock, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().timestamp_millis();
    let mut tx = state.pool.begin().await.map_err(|e| e.to_string())?;

    sqlx::query(
        "INSERT INTO entities (id, type, created_at, updated_at, tags, metadata) VALUES (?, 'time_block', ?, ?, '', '{}')"
    )
    .bind(&id)
    .bind(now)
    .bind(now)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query(
        "INSERT INTO time_blocks (id, title, start_time, end_time, block_type, task_id) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&title)
    .bind(start_time)
    .bind(end_time)
    .bind(&block_type)
    .bind(&task_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;

    Ok(TimeBlock {
        id,
        title,
        start_time,
        end_time,
        block_type,
        task_id,
        created_at: now,
        updated_at: now,
    })
}

#[tauri::command]
pub async fn list_time_blocks(state: State<'_, DbState>) -> Result<Vec<TimeBlock>, String> {
    let rows: Vec<(
        String, String, i64, i64, String, Option<String>, i64, i64
    )> = sqlx::query_as(
        "SELECT tb.id, tb.title, tb.start_time, tb.end_time, tb.block_type, tb.task_id, e.created_at, e.updated_at 
         FROM time_blocks tb 
         JOIN entities e ON tb.id = e.id
         ORDER BY tb.start_time ASC"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    let blocks = rows.into_iter().map(|r| TimeBlock {
        id: r.0,
        title: r.1,
        start_time: r.2,
        end_time: r.3,
        block_type: r.4,
        task_id: r.5,
        created_at: r.6,
        updated_at: r.7,
    }).collect();

    Ok(blocks)
}

#[tauri::command]
pub async fn delete_time_block(state: State<'_, DbState>, id: String) -> Result<(), String> {
    sqlx::query("DELETE FROM entities WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Reflection {
    pub id: String,
    pub date: String,
    pub prompt_id: String,
    pub response: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[tauri::command]
pub async fn save_reflection(
    state: State<'_, DbState>,
    date: String,
    prompt_id: String,
    response: String,
) -> Result<Reflection, String> {
    let now = Utc::now().timestamp_millis();
    let mut tx = state.pool.begin().await.map_err(|e| e.to_string())?;

    let existing: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM reflections WHERE date = ? AND prompt_id = ?"
    )
    .bind(&date)
    .bind(&prompt_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    let id = match existing {
        Some(row) => {
            let id = row.0;
            sqlx::query("UPDATE entities SET updated_at = ? WHERE id = ?")
                .bind(now)
                .bind(&id)
                .execute(&mut *tx)
                .await
                .map_err(|e| e.to_string())?;

            sqlx::query("UPDATE reflections SET response = ? WHERE id = ?")
                .bind(&response)
                .bind(&id)
                .execute(&mut *tx)
                .await
                .map_err(|e| e.to_string())?;

            id
        }
        None => {
            let id = Uuid::new_v4().to_string();
            sqlx::query(
                "INSERT INTO entities (id, type, created_at, updated_at, tags, metadata) VALUES (?, 'reflection', ?, ?, '', '{}')"
            )
            .bind(&id)
            .bind(now)
            .bind(now)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;

            sqlx::query(
                "INSERT INTO reflections (id, date, prompt_id, response) VALUES (?, ?, ?, ?)"
            )
            .bind(&id)
            .bind(&date)
            .bind(&prompt_id)
            .bind(&response)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;

            id
        }
    };

    tx.commit().await.map_err(|e| e.to_string())?;

    Ok(Reflection {
        id,
        date,
        prompt_id,
        response,
        created_at: now,
        updated_at: now,
    })
}

#[tauri::command]
pub async fn get_reflections_for_date(
    state: State<'_, DbState>,
    date: String,
) -> Result<Vec<Reflection>, String> {
    let rows: Vec<(
        String, String, String, String, i64, i64
    )> = sqlx::query_as(
        "SELECT r.id, r.date, r.prompt_id, r.response, e.created_at, e.updated_at 
         FROM reflections r 
         JOIN entities e ON r.id = e.id
         WHERE r.date = ?"
    )
    .bind(date)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    let reflections = rows.into_iter().map(|r| Reflection {
        id: r.0,
        date: r.1,
        prompt_id: r.2,
        response: r.3,
        created_at: r.4,
        updated_at: r.5,
    }).collect();

    Ok(reflections)
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CalendarEvent {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub start_time: i64,
    pub end_time: i64,
    pub is_all_day: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

#[tauri::command]
pub async fn create_event(
    state: State<'_, DbState>,
    title: String,
    description: Option<String>,
    start_time: i64,
    end_time: i64,
    is_all_day: bool,
) -> Result<CalendarEvent, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().timestamp_millis();
    let is_all_day_int = if is_all_day { 1 } else { 0 };
    let mut tx = state.pool.begin().await.map_err(|e| e.to_string())?;

    sqlx::query(
        "INSERT INTO entities (id, type, created_at, updated_at, tags, metadata) VALUES (?, 'event', ?, ?, '', '{}')"
    )
    .bind(&id)
    .bind(now)
    .bind(now)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query(
        "INSERT INTO events (id, title, description, start_time, end_time, is_all_day) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&title)
    .bind(&description)
    .bind(start_time)
    .bind(end_time)
    .bind(is_all_day_int)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;

    Ok(CalendarEvent {
        id,
        title,
        description,
        start_time,
        end_time,
        is_all_day,
        created_at: now,
        updated_at: now,
    })
}

#[tauri::command]
pub async fn list_events(state: State<'_, DbState>) -> Result<Vec<CalendarEvent>, String> {
    let rows: Vec<(
        String, String, Option<String>, i64, i64, i32, i64, i64
    )> = sqlx::query_as(
        "SELECT ev.id, ev.title, ev.description, ev.start_time, ev.end_time, ev.is_all_day, e.created_at, e.updated_at 
         FROM events ev 
         JOIN entities e ON ev.id = e.id
         ORDER BY ev.start_time ASC"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    let events = rows.into_iter().map(|r| CalendarEvent {
        id: r.0,
        title: r.1,
        description: r.2,
        start_time: r.3,
        end_time: r.4,
        is_all_day: r.5 == 1,
        created_at: r.6,
        updated_at: r.7,
    }).collect();

    Ok(events)
}

#[tauri::command]
pub async fn update_event(
    state: State<'_, DbState>,
    id: String,
    title: String,
    description: Option<String>,
    start_time: i64,
    end_time: i64,
    is_all_day: bool,
) -> Result<(), String> {
    let now = Utc::now().timestamp_millis();
    let is_all_day_int = if is_all_day { 1 } else { 0 };
    let mut tx = state.pool.begin().await.map_err(|e| e.to_string())?;

    sqlx::query("UPDATE events SET title = ?, description = ?, start_time = ?, end_time = ?, is_all_day = ? WHERE id = ?")
        .bind(&title)
        .bind(&description)
        .bind(start_time)
        .bind(end_time)
        .bind(is_all_day_int)
        .bind(&id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query("UPDATE entities SET updated_at = ? WHERE id = ?")
        .bind(now)
        .bind(&id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn delete_event(state: State<'_, DbState>, id: String) -> Result<(), String> {
    sqlx::query("DELETE FROM entities WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FocusSession {
    pub id: String,
    pub task_id: Option<String>,
    pub duration: i32,
    pub session_type: String,
    pub completed_at: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

#[tauri::command]
pub async fn log_focus_session(
    state: State<'_, DbState>,
    task_id: Option<String>,
    duration: i32,
    session_type: String,
) -> Result<FocusSession, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().timestamp_millis();
    let mut tx = state.pool.begin().await.map_err(|e| e.to_string())?;

    sqlx::query(
        "INSERT INTO entities (id, type, created_at, updated_at, tags, metadata) VALUES (?, 'focus_session', ?, ?, '', '{}')"
    )
    .bind(&id)
    .bind(now)
    .bind(now)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query(
        "INSERT INTO focus_sessions (id, task_id, duration, session_type, completed_at) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&task_id)
    .bind(duration)
    .bind(&session_type)
    .bind(now)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;

    Ok(FocusSession {
        id,
        task_id,
        duration,
        session_type,
        completed_at: now,
        created_at: now,
        updated_at: now,
    })
}

#[tauri::command]
pub async fn list_focus_sessions(state: State<'_, DbState>) -> Result<Vec<FocusSession>, String> {
    let rows: Vec<(
        String, Option<String>, i32, String, i64, i64, i64
    )> = sqlx::query_as(
        "SELECT fs.id, fs.task_id, fs.duration, fs.session_type, fs.completed_at, e.created_at, e.updated_at 
         FROM focus_sessions fs 
         JOIN entities e ON fs.id = e.id
         ORDER BY fs.completed_at DESC"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    let sessions = rows.into_iter().map(|r| FocusSession {
        id: r.0,
        task_id: r.1,
        duration: r.2,
        session_type: r.3,
        completed_at: r.4,
        created_at: r.5,
        updated_at: r.6,
    }).collect();

    Ok(sessions)
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TimeLog {
    pub id: String,
    pub task_id: Option<String>,
    pub duration: i32,
    pub description: String,
    pub category: String,
    pub started_at: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

#[tauri::command]
pub async fn log_time(
    state: State<'_, DbState>,
    task_id: Option<String>,
    duration: i32,
    description: String,
    category: String,
) -> Result<TimeLog, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().timestamp_millis();
    let mut tx = state.pool.begin().await.map_err(|e| e.to_string())?;

    sqlx::query(
        "INSERT INTO entities (id, type, created_at, updated_at, tags, metadata) VALUES (?, 'time_log', ?, ?, '', '{}')"
    )
    .bind(&id)
    .bind(now)
    .bind(now)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query(
        "INSERT INTO time_logs (id, task_id, duration, description, category, started_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&task_id)
    .bind(duration)
    .bind(&description)
    .bind(&category)
    .bind(now)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;

    Ok(TimeLog {
        id,
        task_id,
        duration,
        description,
        category,
        started_at: now,
        created_at: now,
        updated_at: now,
    })
}

#[tauri::command]
pub async fn list_time_logs(state: State<'_, DbState>) -> Result<Vec<TimeLog>, String> {
    let rows: Vec<(
        String, Option<String>, i32, String, String, i64, i64, i64
    )> = sqlx::query_as(
        "SELECT tl.id, tl.task_id, tl.duration, tl.description, tl.category, tl.started_at, e.created_at, e.updated_at 
         FROM time_logs tl 
         JOIN entities e ON tl.id = e.id
         ORDER BY tl.started_at DESC"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    let logs = rows.into_iter().map(|r| TimeLog {
        id: r.0,
        task_id: r.1,
        duration: r.2,
        description: r.3,
        category: r.4,
        started_at: r.5,
        created_at: r.6,
        updated_at: r.7,
    }).collect();

    Ok(logs)
}

#[tauri::command]
pub async fn delete_time_log(state: State<'_, DbState>, id: String) -> Result<(), String> {
    sqlx::query("DELETE FROM entities WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

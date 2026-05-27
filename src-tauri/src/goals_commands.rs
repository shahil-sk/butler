use serde::{Deserialize, Serialize};
use tauri::State;
use crate::db::DbState;
use uuid::Uuid;
use chrono::Utc;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Goal {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub horizon: String,
    pub status: String,
    pub target_date: Option<i64>,
    pub created_at: i64,
    pub updated_at: i64,
    pub tags: Vec<String>,
    pub metadata: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct KeyResult {
    pub id: String,
    pub goal_id: String,
    pub title: String,
    pub target_value: f64,
    pub current_value: f64,
    pub unit: String,
    pub key_result_type: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub tags: Vec<String>,
    pub metadata: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GoalLink {
    pub id: String,
    pub goal_id: String,
    pub entity_id: String,
    pub entity_type: String,
}

#[tauri::command]
pub async fn create_goal(
    state: State<'_, DbState>,
    title: String,
    description: Option<String>,
    horizon: String,
    status: String,
    target_date: Option<i64>,
    tags: Vec<String>,
    metadata: String,
) -> Result<Goal, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().timestamp_millis();
    let tags_str = tags.join(",");

    let mut tx = state.pool.begin().await.map_err(|e| e.to_string())?;

    // 1. Insert into entities
    sqlx::query(
        "INSERT INTO entities (id, type, created_at, updated_at, tags, metadata) VALUES (?, 'goal', ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(now)
    .bind(now)
    .bind(&tags_str)
    .bind(&metadata)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    // 2. Insert into goals
    sqlx::query(
        "INSERT INTO goals (id, title, description, horizon, status, target_date) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&title)
    .bind(&description)
    .bind(&horizon)
    .bind(&status)
    .bind(target_date)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;

    Ok(Goal {
        id,
        title,
        description,
        horizon,
        status,
        target_date,
        created_at: now,
        updated_at: now,
        tags,
        metadata,
    })
}

#[tauri::command]
pub async fn list_goals(state: State<'_, DbState>) -> Result<Vec<Goal>, String> {
    let rows: Vec<(
        String,
        String,
        Option<String>,
        String,
        String,
        Option<i64>,
        i64,
        i64,
        Option<String>,
        Option<String>,
    )> = sqlx::query_as(
        "SELECT g.id, g.title, g.description, g.horizon, g.status, g.target_date, e.created_at, e.updated_at, e.tags, e.metadata 
         FROM goals g 
         JOIN entities e ON g.id = e.id"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    let goals = rows.into_iter().map(|r| {
        let tags = r.8.map(|t| t.split(',').map(|s| s.to_string()).filter(|s| !s.is_empty()).collect()).unwrap_or_default();
        Goal {
            id: r.0,
            title: r.1,
            description: r.2,
            horizon: r.3,
            status: r.4,
            target_date: r.5,
            created_at: r.6,
            updated_at: r.7,
            tags,
            metadata: r.9.unwrap_or_default(),
        }
    }).collect();

    Ok(goals)
}

#[tauri::command]
pub async fn update_goal(
    state: State<'_, DbState>,
    id: String,
    title: String,
    description: Option<String>,
    horizon: String,
    status: String,
    target_date: Option<i64>,
    tags: Vec<String>,
) -> Result<(), String> {
    let now = Utc::now().timestamp_millis();
    let tags_str = tags.join(",");
    let mut tx = state.pool.begin().await.map_err(|e| e.to_string())?;

    sqlx::query("UPDATE goals SET title = ?, description = ?, horizon = ?, status = ?, target_date = ? WHERE id = ?")
        .bind(&title)
        .bind(&description)
        .bind(&horizon)
        .bind(&status)
        .bind(target_date)
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
pub async fn delete_goal(state: State<'_, DbState>, id: String) -> Result<(), String> {
    sqlx::query("DELETE FROM entities WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn create_key_result(
    state: State<'_, DbState>,
    goal_id: String,
    title: String,
    target_value: f64,
    current_value: f64,
    unit: String,
    key_result_type: String,
) -> Result<KeyResult, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().timestamp_millis();

    let mut tx = state.pool.begin().await.map_err(|e| e.to_string())?;

    // 1. Insert into entities
    sqlx::query(
        "INSERT INTO entities (id, type, created_at, updated_at, tags, metadata) VALUES (?, 'key_result', ?, ?, '', '{}')"
    )
    .bind(&id)
    .bind(now)
    .bind(now)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    // 2. Insert into key_results
    sqlx::query(
        "INSERT INTO key_results (id, goal_id, title, target_value, current_value, unit, key_result_type) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&goal_id)
    .bind(&title)
    .bind(target_value)
    .bind(current_value)
    .bind(&unit)
    .bind(&key_result_type)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;

    Ok(KeyResult {
        id,
        goal_id,
        title,
        target_value,
        current_value,
        unit,
        key_result_type,
        created_at: now,
        updated_at: now,
        tags: vec![],
        metadata: "{}".to_string(),
    })
}

#[tauri::command]
pub async fn list_key_results(state: State<'_, DbState>, goal_id: String) -> Result<Vec<KeyResult>, String> {
    let rows: Vec<(
        String,
        String,
        String,
        f64,
        f64,
        String,
        String,
        i64,
        i64,
        Option<String>,
        Option<String>,
    )> = sqlx::query_as(
        "SELECT k.id, k.goal_id, k.title, k.target_value, k.current_value, k.unit, k.key_result_type, e.created_at, e.updated_at, e.tags, e.metadata 
         FROM key_results k 
         JOIN entities e ON k.id = e.id 
         WHERE k.goal_id = ?"
    )
    .bind(&goal_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    let krs = rows.into_iter().map(|r| {
        let tags = r.9.map(|t| t.split(',').map(|s| s.to_string()).filter(|s| !s.is_empty()).collect()).unwrap_or_default();
        KeyResult {
            id: r.0,
            goal_id: r.1,
            title: r.2,
            target_value: r.3,
            current_value: r.4,
            unit: r.5,
            key_result_type: r.6,
            created_at: r.7,
            updated_at: r.8,
            tags,
            metadata: r.10.unwrap_or_default(),
        }
    }).collect();

    Ok(krs)
}

#[tauri::command]
pub async fn update_key_result_value(
    state: State<'_, DbState>,
    id: String,
    current_value: f64,
) -> Result<(), String> {
    let now = Utc::now().timestamp_millis();
    let mut tx = state.pool.begin().await.map_err(|e| e.to_string())?;

    sqlx::query("UPDATE key_results SET current_value = ? WHERE id = ?")
        .bind(current_value)
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
pub async fn delete_key_result(state: State<'_, DbState>, id: String) -> Result<(), String> {
    sqlx::query("DELETE FROM entities WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn link_entity_to_goal(
    state: State<'_, DbState>,
    goal_id: String,
    entity_id: String,
    entity_type: String,
) -> Result<(), String> {
    let id = Uuid::new_v4().to_string();
    sqlx::query("INSERT OR IGNORE INTO goal_links (id, goal_id, entity_id, entity_type) VALUES (?, ?, ?, ?)")
        .bind(id)
        .bind(goal_id)
        .bind(entity_id)
        .bind(entity_type)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn unlink_entity_from_goal(
    state: State<'_, DbState>,
    goal_id: String,
    entity_id: String,
    entity_type: String,
) -> Result<(), String> {
    sqlx::query("DELETE FROM goal_links WHERE goal_id = ? AND entity_id = ? AND entity_type = ?")
        .bind(goal_id)
        .bind(entity_id)
        .bind(entity_type)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn list_goal_links(state: State<'_, DbState>, goal_id: String) -> Result<Vec<GoalLink>, String> {
    let rows: Vec<(String, String, String, String)> = sqlx::query_as(
        "SELECT id, goal_id, entity_id, entity_type FROM goal_links WHERE goal_id = ?"
    )
    .bind(goal_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    let links = rows.into_iter().map(|r| GoalLink {
        id: r.0,
        goal_id: r.1,
        entity_id: r.2,
        entity_type: r.3,
    }).collect();

    Ok(links)
}

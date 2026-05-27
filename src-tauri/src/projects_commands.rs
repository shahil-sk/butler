use serde::{Deserialize, Serialize};
use tauri::State;
use crate::db::DbState;
use uuid::Uuid;
use chrono::Utc;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub status: String,
    pub budget_hours: f64,
    pub created_at: i64,
    pub updated_at: i64,
    pub tags: Vec<String>,
    pub metadata: String,
}

#[tauri::command]
pub async fn create_project(
    state: State<'_, DbState>,
    name: String,
    description: Option<String>,
    status: String,
    budget_hours: f64,
    tags: Vec<String>,
    metadata: String,
) -> Result<Project, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().timestamp_millis();
    let tags_str = tags.join(",");

    let mut tx = state.pool.begin().await.map_err(|e| e.to_string())?;

    // 1. Insert into entities
    sqlx::query(
        "INSERT INTO entities (id, type, created_at, updated_at, tags, metadata) VALUES (?, 'project', ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(now)
    .bind(now)
    .bind(&tags_str)
    .bind(&metadata)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    // 2. Insert into projects
    sqlx::query(
        "INSERT INTO projects (id, name, description, status, budget_hours) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&name)
    .bind(&description)
    .bind(&status)
    .bind(budget_hours)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;

    Ok(Project {
        id,
        name,
        description,
        status,
        budget_hours,
        created_at: now,
        updated_at: now,
        tags,
        metadata,
    })
}

#[tauri::command]
pub async fn list_projects(state: State<'_, DbState>) -> Result<Vec<Project>, String> {
    let rows: Vec<(
        String,
        String,
        Option<String>,
        String,
        f64,
        i64,
        i64,
        Option<String>,
        Option<String>,
    )> = sqlx::query_as(
        "SELECT p.id, p.name, p.description, p.status, p.budget_hours, e.created_at, e.updated_at, e.tags, e.metadata 
         FROM projects p 
         JOIN entities e ON p.id = e.id"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    let projects = rows.into_iter().map(|r| {
        let tags = r.7.map(|t| t.split(',').map(|s| s.to_string()).filter(|s| !s.is_empty()).collect()).unwrap_or_default();
        Project {
            id: r.0,
            name: r.1,
            description: r.2,
            status: r.3,
            budget_hours: r.4,
            created_at: r.5,
            updated_at: r.6,
            tags,
            metadata: r.8.unwrap_or_default(),
        }
    }).collect();

    Ok(projects)
}

#[tauri::command]
pub async fn update_project(
    state: State<'_, DbState>,
    id: String,
    name: String,
    description: Option<String>,
    status: String,
    budget_hours: f64,
    tags: Vec<String>,
) -> Result<(), String> {
    let now = Utc::now().timestamp_millis();
    let tags_str = tags.join(",");
    let mut tx = state.pool.begin().await.map_err(|e| e.to_string())?;

    sqlx::query("UPDATE projects SET name = ?, description = ?, status = ?, budget_hours = ? WHERE id = ?")
        .bind(&name)
        .bind(&description)
        .bind(&status)
        .bind(budget_hours)
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
pub async fn delete_project(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let mut tx = state.pool.begin().await.map_err(|e| e.to_string())?;

    // Unlink tasks associated with this project (set project_id to NULL)
    sqlx::query("UPDATE tasks SET project_id = NULL WHERE project_id = ?")
        .bind(&id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    // Delete project from entities (cascade deletes from projects table)
    sqlx::query("DELETE FROM entities WHERE id = ?")
        .bind(&id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn assign_task_to_project(
    state: State<'_, DbState>,
    task_id: String,
    project_id: Option<String>,
) -> Result<(), String> {
    sqlx::query("UPDATE tasks SET project_id = ? WHERE id = ?")
        .bind(project_id)
        .bind(task_id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

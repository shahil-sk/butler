use serde::{Deserialize, Serialize};
use tauri::State;
use crate::db::DbState;
use uuid::Uuid;
use chrono::Utc;
use std::fs;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Document {
    pub id: String,
    pub title: String,
    pub content: String,
    pub parent_id: Option<String>,
    pub template: String,
    pub project_id: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub tags: Vec<String>,
    pub metadata: String,
}

#[tauri::command]
pub async fn create_document(
    state: State<'_, DbState>,
    title: String,
    content: String,
    parent_id: Option<String>,
    template: String,
    project_id: Option<String>,
    tags: Vec<String>,
    metadata: String,
) -> Result<Document, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().timestamp_millis();
    let tags_str = tags.join(",");

    let mut tx = state.pool.begin().await.map_err(|e| e.to_string())?;

    // 1. Insert into entities
    sqlx::query(
        "INSERT INTO entities (id, type, created_at, updated_at, tags, metadata) VALUES (?, 'document', ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(now)
    .bind(now)
    .bind(&tags_str)
    .bind(&metadata)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    // 2. Insert into documents
    sqlx::query(
        "INSERT INTO documents (id, title, content, parent_id, template, project_id) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&title)
    .bind(&content)
    .bind(&parent_id)
    .bind(&template)
    .bind(&project_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;

    Ok(Document {
        id,
        title,
        content,
        parent_id,
        template,
        project_id,
        created_at: now,
        updated_at: now,
        tags,
        metadata,
    })
}

#[tauri::command]
pub async fn list_documents(state: State<'_, DbState>) -> Result<Vec<Document>, String> {
    let rows: Vec<(
        String,
        String,
        String,
        Option<String>,
        String,
        Option<String>,
        i64,
        i64,
        Option<String>,
        Option<String>,
    )> = sqlx::query_as(
        "SELECT d.id, d.title, d.content, d.parent_id, d.template, d.project_id, e.created_at, e.updated_at, e.tags, e.metadata 
         FROM documents d 
         JOIN entities e ON d.id = e.id"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    let documents = rows.into_iter().map(|r| {
        let tags = r.8.map(|t| t.split(',').map(|s| s.to_string()).filter(|s| !s.is_empty()).collect()).unwrap_or_default();
        Document {
            id: r.0,
            title: r.1,
            content: r.2,
            parent_id: r.3,
            template: r.4,
            project_id: r.5,
            created_at: r.6,
            updated_at: r.7,
            tags,
            metadata: r.9.unwrap_or_else(|| "{}".to_string()),
        }
    }).collect();

    Ok(documents)
}

#[tauri::command]
pub async fn get_document(state: State<'_, DbState>, id: String) -> Result<Document, String> {
    let r: (
        String,
        String,
        String,
        Option<String>,
        String,
        Option<String>,
        i64,
        i64,
        Option<String>,
        Option<String>,
    ) = sqlx::query_as(
        "SELECT d.id, d.title, d.content, d.parent_id, d.template, d.project_id, e.created_at, e.updated_at, e.tags, e.metadata 
         FROM documents d 
         JOIN entities e ON d.id = e.id
         WHERE d.id = ?"
    )
    .bind(&id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    let tags = r.8.map(|t| t.split(',').map(|s| s.to_string()).filter(|s| !s.is_empty()).collect()).unwrap_or_default();
    Ok(Document {
        id: r.0,
        title: r.1,
        content: r.2,
        parent_id: r.3,
        template: r.4,
        project_id: r.5,
        created_at: r.6,
        updated_at: r.7,
        tags,
        metadata: r.9.unwrap_or_else(|| "{}".to_string()),
    })
}

#[tauri::command]
pub async fn update_document(
    state: State<'_, DbState>,
    id: String,
    title: String,
    content: String,
    parent_id: Option<String>,
    template: String,
    project_id: Option<String>,
    tags: Vec<String>,
) -> Result<(), String> {
    let now = Utc::now().timestamp_millis();
    let tags_str = tags.join(",");
    let mut tx = state.pool.begin().await.map_err(|e| e.to_string())?;

    sqlx::query(
        "UPDATE documents SET title = ?, content = ?, parent_id = ?, template = ?, project_id = ? WHERE id = ?"
    )
    .bind(&title)
    .bind(&content)
    .bind(&parent_id)
    .bind(&template)
    .bind(&project_id)
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
pub async fn delete_document(state: State<'_, DbState>, id: String) -> Result<(), String> {
    sqlx::query("DELETE FROM entities WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn write_text_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(())
}

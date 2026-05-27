use serde::{Deserialize, Serialize};
use tauri::State;
use tauri::Manager;
use crate::db::DbState;
use uuid::Uuid;
use chrono::Utc;
use std::fs;
use std::path::Path;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FileAttachment {
    pub id: String,
    pub name: String,
    pub path: String,
    pub mime_type: String,
    pub size_bytes: i64,
    pub created_at: i64,
    pub updated_at: i64,
    pub tags: Vec<String>,
    pub metadata: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PdfAnnotation {
    pub id: String,
    pub file_id: String,
    pub page: i32,
    pub text: Option<String>,
    pub notes: Option<String>,
    pub color: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[tauri::command]
pub async fn add_file_attachment(
    app_handle: tauri::AppHandle,
    state: State<'_, DbState>,
    name: String,
    source_path: String,
    mime_type: String,
    size_bytes: i64,
) -> Result<FileAttachment, String> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("./data"));
    let attachments_dir = app_dir.join("attachments");
    if !attachments_dir.exists() {
        fs::create_dir_all(&attachments_dir).map_err(|e| e.to_string())?;
    }

    let file_uuid = Uuid::new_v4().to_string();
    let file_extension = Path::new(&source_path)
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("");

    let target_filename = if file_extension.is_empty() {
        file_uuid.clone()
    } else {
        format!("{}.{}", file_uuid, file_extension)
    };

    let target_path = attachments_dir.join(&target_filename);
    fs::copy(&source_path, &target_path).map_err(|e| e.to_string())?;

    let target_path_str = target_path.to_string_lossy().to_string();
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().timestamp_millis();

    let mut tx = state.pool.begin().await.map_err(|e| e.to_string())?;

    sqlx::query(
        "INSERT INTO entities (id, type, created_at, updated_at, tags, metadata) VALUES (?, 'file', ?, ?, '', '{}')"
    )
    .bind(&id)
    .bind(now)
    .bind(now)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query(
        "INSERT INTO files (id, name, path, mime_type, size_bytes) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&name)
    .bind(&target_path_str)
    .bind(&mime_type)
    .bind(size_bytes)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;

    Ok(FileAttachment {
        id,
        name,
        path: target_path_str,
        mime_type,
        size_bytes,
        created_at: now,
        updated_at: now,
        tags: vec![],
        metadata: "{}".to_string(),
    })
}

#[tauri::command]
pub async fn list_file_attachments(state: State<'_, DbState>) -> Result<Vec<FileAttachment>, String> {
    let rows: Vec<(
        String,
        String,
        String,
        String,
        i64,
        i64,
        i64,
        Option<String>,
        Option<String>,
    )> = sqlx::query_as(
        "SELECT f.id, f.name, f.path, f.mime_type, f.size_bytes, e.created_at, e.updated_at, e.tags, e.metadata 
         FROM files f 
         JOIN entities e ON f.id = e.id"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    let files = rows.into_iter().map(|r| {
        let tags = r.7.map(|t| t.split(',').map(|s| s.to_string()).filter(|s| !s.is_empty()).collect()).unwrap_or_default();
        FileAttachment {
            id: r.0,
            name: r.1,
            path: r.2,
            mime_type: r.3,
            size_bytes: r.4,
            created_at: r.5,
            updated_at: r.6,
            tags,
            metadata: r.8.unwrap_or_else(|| "{}".to_string()),
        }
    }).collect();

    Ok(files)
}

#[tauri::command]
pub async fn delete_file_attachment(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let row: (String,) = sqlx::query_as("SELECT path FROM files WHERE id = ?")
        .bind(&id)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    let path = Path::new(&row.0);
    if path.exists() {
        let _ = fs::remove_file(path);
    }

    sqlx::query("DELETE FROM entities WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn create_pdf_annotation(
    state: State<'_, DbState>,
    file_id: String,
    page: i32,
    text: Option<String>,
    notes: Option<String>,
    color: String,
) -> Result<PdfAnnotation, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().timestamp_millis();

    let mut tx = state.pool.begin().await.map_err(|e| e.to_string())?;

    sqlx::query(
        "INSERT INTO entities (id, type, created_at, updated_at, tags, metadata) VALUES (?, 'pdf_annotation', ?, ?, '', '{}')"
    )
    .bind(&id)
    .bind(now)
    .bind(now)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query(
        "INSERT INTO pdf_annotations (id, file_id, page, text, notes, color) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&file_id)
    .bind(page)
    .bind(&text)
    .bind(&notes)
    .bind(&color)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;

    Ok(PdfAnnotation {
        id,
        file_id,
        page,
        text,
        notes,
        color,
        created_at: now,
        updated_at: now,
    })
}

#[tauri::command]
pub async fn list_pdf_annotations(state: State<'_, DbState>, file_id: String) -> Result<Vec<PdfAnnotation>, String> {
    let rows: Vec<(
        String,
        String,
        i32,
        Option<String>,
        Option<String>,
        String,
        i64,
        i64,
    )> = sqlx::query_as(
        "SELECT a.id, a.file_id, a.page, a.text, a.notes, a.color, e.created_at, e.updated_at 
         FROM pdf_annotations a
         JOIN entities e ON a.id = e.id
         WHERE a.file_id = ?"
    )
    .bind(&file_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    let annotations = rows.into_iter().map(|r| PdfAnnotation {
        id: r.0,
        file_id: r.1,
        page: r.2,
        text: r.3,
        notes: r.4,
        color: r.5,
        created_at: r.6,
        updated_at: r.7,
    }).collect();

    Ok(annotations)
}

#[tauri::command]
pub async fn delete_pdf_annotation(state: State<'_, DbState>, id: String) -> Result<(), String> {
    sqlx::query("DELETE FROM entities WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

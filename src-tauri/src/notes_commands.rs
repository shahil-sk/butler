use serde::{Deserialize, Serialize};
use tauri::State;
use crate::db::DbState;
use uuid::Uuid;
use chrono::Utc;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Note {
    pub id: String,
    pub title: String,
    pub content: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub tags: Vec<String>,
    pub metadata: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct NoteLink {
    pub id: String,
    pub source_id: String,
    pub target_id: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Backlink {
    pub id: String,
    pub title: String,
}

#[tauri::command]
pub async fn create_note(
    state: State<'_, DbState>,
    title: String,
    content: String,
    tags: Vec<String>,
    metadata: String,
) -> Result<Note, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().timestamp_millis();
    let tags_str = tags.join(",");

    let mut tx = state.pool.begin().await.map_err(|e| e.to_string())?;

    sqlx::query(
        "INSERT INTO entities (id, type, created_at, updated_at, tags, metadata) VALUES (?, 'note', ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(now)
    .bind(now)
    .bind(&tags_str)
    .bind(&metadata)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query(
        "INSERT INTO notes (id, title, content) VALUES (?, ?, ?)"
    )
    .bind(&id)
    .bind(&title)
    .bind(&content)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;

    Ok(Note {
        id,
        title,
        content,
        created_at: now,
        updated_at: now,
        tags,
        metadata,
    })
}

#[tauri::command]
pub async fn get_note(state: State<'_, DbState>, id: String) -> Result<Option<Note>, String> {
    let row: Option<(
        String, String, String, i64, i64, Option<String>, Option<String>
    )> = sqlx::query_as(
        "SELECT n.id, n.title, n.content, e.created_at, e.updated_at, e.tags, e.metadata 
         FROM notes n 
         JOIN entities e ON n.id = e.id 
         WHERE n.id = ?"
    )
    .bind(&id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    if let Some(r) = row {
        let tags = r.5.map(|t| t.split(',').map(|s| s.to_string()).filter(|s| !s.is_empty()).collect()).unwrap_or_default();
        Ok(Some(Note {
            id: r.0,
            title: r.1,
            content: r.2,
            created_at: r.3,
            updated_at: r.4,
            tags,
            metadata: r.6.unwrap_or_default(),
        }))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub async fn update_note(
    state: State<'_, DbState>,
    id: String,
    title: String,
    content: String,
    tags: Vec<String>,
    metadata: String,
) -> Result<(), String> {
    let now = Utc::now().timestamp_millis();
    let tags_str = tags.join(",");
    let mut tx = state.pool.begin().await.map_err(|e| e.to_string())?;

    sqlx::query("UPDATE entities SET updated_at = ?, tags = ?, metadata = ? WHERE id = ?")
        .bind(now)
        .bind(&tags_str)
        .bind(&metadata)
        .bind(&id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query("UPDATE notes SET title = ?, content = ? WHERE id = ?")
        .bind(&title)
        .bind(&content)
        .bind(&id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn delete_note(state: State<'_, DbState>, id: String) -> Result<(), String> {
    sqlx::query("DELETE FROM entities WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn list_notes(state: State<'_, DbState>) -> Result<Vec<Note>, String> {
    let rows: Vec<(
        String, String, String, i64, i64, Option<String>, Option<String>
    )> = sqlx::query_as(
        "SELECT n.id, n.title, n.content, e.created_at, e.updated_at, e.tags, e.metadata 
         FROM notes n 
         JOIN entities e ON n.id = e.id 
         ORDER BY e.updated_at DESC"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    let notes = rows.into_iter().map(|r| {
        let tags = r.5.map(|t| t.split(',').map(|s| s.to_string()).filter(|s| !s.is_empty()).collect()).unwrap_or_default();
        Note {
            id: r.0,
            title: r.1,
            content: r.2,
            created_at: r.3,
            updated_at: r.4,
            tags,
            metadata: r.6.unwrap_or_default(),
        }
    }).collect();

    Ok(notes)
}

#[tauri::command]
pub async fn sync_note_links(
    state: State<'_, DbState>,
    source_id: String,
    target_titles: Vec<String>,
) -> Result<(), String> {
    let mut tx = state.pool.begin().await.map_err(|e| e.to_string())?;

    // 1. Delete old links
    sqlx::query("DELETE FROM note_links WHERE source_id = ?")
        .bind(&source_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    for title in target_titles {
        let trimmed_title = title.trim();
        if trimmed_title.is_empty() {
            continue;
        }

        // Check if note exists with title (case-insensitive)
        let row: Option<(String,)> = sqlx::query_as("SELECT id FROM notes WHERE LOWER(title) = LOWER(?) LIMIT 1")
            .bind(trimmed_title)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;

        let target_id = if let Some(r) = row {
            r.0
        } else {
            // Create stub note
            let new_id = Uuid::new_v4().to_string();
            let now = Utc::now().timestamp_millis();

            // Insert into entities
            sqlx::query(
                "INSERT INTO entities (id, type, created_at, updated_at, tags, metadata) VALUES (?, 'note', ?, ?, '', '{}')"
            )
            .bind(&new_id)
            .bind(now)
            .bind(now)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;

            // Insert into notes
            sqlx::query(
                "INSERT INTO notes (id, title, content) VALUES (?, ?, '')"
            )
            .bind(&new_id)
            .bind(trimmed_title)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;

            new_id
        };

        // Insert new note link (only if source != target, avoid self-reference links)
        if source_id != target_id {
            let link_id = Uuid::new_v4().to_string();
            sqlx::query(
                "INSERT INTO note_links (id, source_id, target_id) VALUES (?, ?, ?)"
            )
            .bind(&link_id)
            .bind(&source_id)
            .bind(&target_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
        }
    }

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_backlinks(
    state: State<'_, DbState>,
    note_id: String,
) -> Result<Vec<Backlink>, String> {
    let rows: Vec<(String, String)> = sqlx::query_as(
        "SELECT n.id, n.title 
         FROM note_links nl 
         JOIN notes n ON nl.source_id = n.id 
         WHERE nl.target_id = ?"
    )
    .bind(&note_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    let backlinks = rows.into_iter().map(|r| Backlink {
        id: r.0,
        title: r.1,
    }).collect();

    Ok(backlinks)
}

#[tauri::command]
pub async fn search_notes(
    state: State<'_, DbState>,
    query: String,
) -> Result<Vec<Note>, String> {
    if query.trim().is_empty() {
        return list_notes(state).await;
    }

    let search_query = format!("{}*", query);
    let rows: Vec<(
        String, String, String, i64, i64, Option<String>, Option<String>
    )> = sqlx::query_as(
        "SELECT n.id, n.title, n.content, e.created_at, e.updated_at, e.tags, e.metadata 
         FROM search_index s
         JOIN notes n ON s.id = n.id
         JOIN entities e ON n.id = e.id
         WHERE search_index MATCH ?
         ORDER BY e.updated_at DESC"
    )
    .bind(&search_query)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    let notes = rows.into_iter().map(|r| {
        let tags = r.5.map(|t| t.split(',').map(|s| s.to_string()).filter(|s| !s.is_empty()).collect()).unwrap_or_default();
        Note {
            id: r.0,
            title: r.1,
            content: r.2,
            created_at: r.3,
            updated_at: r.4,
            tags,
            metadata: r.6.unwrap_or_default(),
        }
    }).collect();

    Ok(notes)
}

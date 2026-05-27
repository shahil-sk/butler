use serde::{Deserialize, Serialize};
use tauri::State;
use crate::db::DbState;
use uuid::Uuid;
use chrono::Utc;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DatabaseTable {
    pub id: String,
    pub name: String,
    pub columns: String,
    pub project_id: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub tags: Vec<String>,
    pub metadata: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DatabaseRecord {
    pub id: String,
    pub table_id: String,
    pub values_json: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub tags: Vec<String>,
    pub metadata: String,
}

#[tauri::command]
pub async fn create_database_table(
    state: State<'_, DbState>,
    name: String,
    columns: String,
    project_id: Option<String>,
    tags: Vec<String>,
) -> Result<DatabaseTable, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().timestamp_millis();
    let tags_str = tags.join(",");

    let mut tx = state.pool.begin().await.map_err(|e| e.to_string())?;

    sqlx::query(
        "INSERT INTO entities (id, type, created_at, updated_at, tags, metadata) VALUES (?, 'db_table', ?, ?, ?, '{}')"
    )
    .bind(&id)
    .bind(now)
    .bind(now)
    .bind(&tags_str)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query(
        "INSERT INTO db_tables (id, name, columns, project_id) VALUES (?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&name)
    .bind(&columns)
    .bind(&project_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;

    Ok(DatabaseTable {
        id,
        name,
        columns,
        project_id,
        created_at: now,
        updated_at: now,
        tags,
        metadata: "{}".to_string(),
    })
}

#[tauri::command]
pub async fn list_database_tables(state: State<'_, DbState>) -> Result<Vec<DatabaseTable>, String> {
    let rows: Vec<(
        String,
        String,
        String,
        Option<String>,
        i64,
        i64,
        Option<String>,
        Option<String>,
    )> = sqlx::query_as(
        "SELECT t.id, t.name, t.columns, t.project_id, e.created_at, e.updated_at, e.tags, e.metadata 
         FROM db_tables t 
         JOIN entities e ON t.id = e.id"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    let tables = rows.into_iter().map(|r| {
        let tags = r.6.map(|t| t.split(',').map(|s| s.to_string()).filter(|s| !s.is_empty()).collect()).unwrap_or_default();
        DatabaseTable {
            id: r.0,
            name: r.1,
            columns: r.2,
            project_id: r.3,
            created_at: r.4,
            updated_at: r.5,
            tags,
            metadata: r.7.unwrap_or_else(|| "{}".to_string()),
        }
    }).collect();

    Ok(tables)
}

#[tauri::command]
pub async fn update_database_table(
    state: State<'_, DbState>,
    id: String,
    name: String,
    columns: String,
    project_id: Option<String>,
    tags: Vec<String>,
) -> Result<(), String> {
    let now = Utc::now().timestamp_millis();
    let tags_str = tags.join(",");
    let mut tx = state.pool.begin().await.map_err(|e| e.to_string())?;

    sqlx::query(
        "UPDATE db_tables SET name = ?, columns = ?, project_id = ? WHERE id = ?"
    )
    .bind(&name)
    .bind(&columns)
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
pub async fn delete_database_table(state: State<'_, DbState>, id: String) -> Result<(), String> {
    sqlx::query("DELETE FROM entities WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn create_database_record(
    state: State<'_, DbState>,
    table_id: String,
    values_json: String,
    tags: Vec<String>,
) -> Result<DatabaseRecord, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().timestamp_millis();
    let tags_str = tags.join(",");

    let mut tx = state.pool.begin().await.map_err(|e| e.to_string())?;

    sqlx::query(
        "INSERT INTO entities (id, type, created_at, updated_at, tags, metadata) VALUES (?, 'db_record', ?, ?, ?, '{}')"
    )
    .bind(&id)
    .bind(now)
    .bind(now)
    .bind(&tags_str)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query(
        "INSERT INTO db_records (id, table_id, values_json) VALUES (?, ?, ?)"
    )
    .bind(&id)
    .bind(&table_id)
    .bind(&values_json)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;

    Ok(DatabaseRecord {
        id,
        table_id,
        values_json,
        created_at: now,
        updated_at: now,
        tags,
        metadata: "{}".to_string(),
    })
}

#[tauri::command]
pub async fn list_database_records(state: State<'_, DbState>, table_id: String) -> Result<Vec<DatabaseRecord>, String> {
    let rows: Vec<(
        String,
        String,
        String,
        i64,
        i64,
        Option<String>,
        Option<String>,
    )> = sqlx::query_as(
        "SELECT r.id, r.table_id, r.values_json, e.created_at, e.updated_at, e.tags, e.metadata 
         FROM db_records r 
         JOIN entities e ON r.id = e.id
         WHERE r.table_id = ?"
    )
    .bind(&table_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    let records = rows.into_iter().map(|r| {
        let tags = r.5.map(|t| t.split(',').map(|s| s.to_string()).filter(|s| !s.is_empty()).collect()).unwrap_or_default();
        DatabaseRecord {
            id: r.0,
            table_id: r.1,
            values_json: r.2,
            created_at: r.3,
            updated_at: r.4,
            tags,
            metadata: r.6.unwrap_or_else(|| "{}".to_string()),
        }
    }).collect();

    Ok(records)
}

#[tauri::command]
pub async fn update_database_record(
    state: State<'_, DbState>,
    id: String,
    values_json: String,
    tags: Vec<String>,
) -> Result<(), String> {
    let now = Utc::now().timestamp_millis();
    let tags_str = tags.join(",");
    let mut tx = state.pool.begin().await.map_err(|e| e.to_string())?;

    sqlx::query(
        "UPDATE db_records SET values_json = ? WHERE id = ?"
    )
    .bind(&values_json)
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
pub async fn delete_database_record(state: State<'_, DbState>, id: String) -> Result<(), String> {
    sqlx::query("DELETE FROM entities WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

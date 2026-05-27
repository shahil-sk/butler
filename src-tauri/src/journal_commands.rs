use serde::{Deserialize, Serialize};
use tauri::State;
use crate::db::DbState;
use uuid::Uuid;
use chrono::Utc;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct JournalEntry {
    pub id: String,
    pub date: String,
    pub mood: i32,
    pub mood_notes: Option<String>,
    pub gratitude: Vec<String>,
    pub life_areas: String, // JSON string
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Review {
    pub id: String,
    pub period: String,
    #[serde(rename = "type")]
    pub review_type: String,
    pub responses: String, // JSON string
    pub created_at: i64,
    pub updated_at: i64,
}

#[tauri::command]
pub async fn get_journal_entry(
    state: State<'_, DbState>,
    date: String,
) -> Result<Option<JournalEntry>, String> {
    let row: Option<(
        String, String, i32, Option<String>, String, String, i64, i64
    )> = sqlx::query_as(
        "SELECT j.id, j.date, j.mood, j.mood_notes, j.gratitude, j.life_areas, e.created_at, e.updated_at 
         FROM journal_entries j 
         JOIN entities e ON j.id = e.id 
         WHERE j.date = ?"
    )
    .bind(&date)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    if let Some(r) = row {
        let gratitude = serde_json::from_str(&r.4).unwrap_or_default();
        Ok(Some(JournalEntry {
            id: r.0,
            date: r.1,
            mood: r.2,
            mood_notes: r.3,
            gratitude,
            life_areas: r.5,
            created_at: r.6,
            updated_at: r.7,
        }))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub async fn save_journal_entry(
    state: State<'_, DbState>,
    date: String,
    mood: i32,
    mood_notes: Option<String>,
    gratitude: Vec<String>,
    life_areas: String,
) -> Result<JournalEntry, String> {
    let now = Utc::now().timestamp_millis();
    let gratitude_json = serde_json::to_string(&gratitude).unwrap_or_else(|_| "[]".to_string());

    let mut tx = state.pool.begin().await.map_err(|e| e.to_string())?;

    // Check if entry already exists
    let existing: Option<(String, i64)> = sqlx::query_as(
        "SELECT j.id, e.created_at FROM journal_entries j JOIN entities e ON j.id = e.id WHERE j.date = ?"
    )
    .bind(&date)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    let (id, created_at) = if let Some(ext) = existing {
        // Update entities
        sqlx::query("UPDATE entities SET updated_at = ? WHERE id = ?")
            .bind(now)
            .bind(&ext.0)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;

        // Update journal_entries
        sqlx::query("UPDATE journal_entries SET mood = ?, mood_notes = ?, gratitude = ?, life_areas = ? WHERE id = ?")
            .bind(mood)
            .bind(&mood_notes)
            .bind(&gratitude_json)
            .bind(&life_areas)
            .bind(&ext.0)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;

        (ext.0, ext.1)
    } else {
        let new_id = Uuid::new_v4().to_string();
        // Insert entities
        sqlx::query("INSERT INTO entities (id, type, created_at, updated_at, tags, metadata) VALUES (?, 'journal', ?, ?, '', '{}')")
            .bind(&new_id)
            .bind(now)
            .bind(now)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;

        // Insert journal_entries
        sqlx::query("INSERT INTO journal_entries (id, date, mood, mood_notes, gratitude, life_areas) VALUES (?, ?, ?, ?, ?, ?)")
            .bind(&new_id)
            .bind(&date)
            .bind(mood)
            .bind(&mood_notes)
            .bind(&gratitude_json)
            .bind(&life_areas)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;

        (new_id, now)
    };

    tx.commit().await.map_err(|e| e.to_string())?;

    Ok(JournalEntry {
        id,
        date,
        mood,
        mood_notes,
        gratitude,
        life_areas,
        created_at,
        updated_at: now,
    })
}

#[tauri::command]
pub async fn get_review(
    state: State<'_, DbState>,
    period: String,
    review_type: String,
) -> Result<Option<Review>, String> {
    let row: Option<(
        String, String, String, String, i64, i64
    )> = sqlx::query_as(
        "SELECT r.id, r.period, r.type, r.responses, e.created_at, e.updated_at 
         FROM reviews r 
         JOIN entities e ON r.id = e.id 
         WHERE r.period = ? AND r.type = ?"
    )
    .bind(&period)
    .bind(&review_type)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    if let Some(r) = row {
        Ok(Some(Review {
            id: r.0,
            period: r.1,
            review_type: r.2,
            responses: r.3,
            created_at: r.4,
            updated_at: r.5,
        }))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub async fn save_review(
    state: State<'_, DbState>,
    period: String,
    review_type: String,
    responses: String,
) -> Result<Review, String> {
    let now = Utc::now().timestamp_millis();
    let mut tx = state.pool.begin().await.map_err(|e| e.to_string())?;

    // Check if review exists
    let existing: Option<(String, i64)> = sqlx::query_as(
        "SELECT r.id, e.created_at FROM reviews r JOIN entities e ON r.id = e.id WHERE r.period = ? AND r.type = ?"
    )
    .bind(&period)
    .bind(&review_type)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    let (id, created_at) = if let Some(ext) = existing {
        // Update entities
        sqlx::query("UPDATE entities SET updated_at = ? WHERE id = ?")
            .bind(now)
            .bind(&ext.0)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;

        // Update reviews
        sqlx::query("UPDATE reviews SET responses = ? WHERE id = ?")
            .bind(&responses)
            .bind(&ext.0)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;

        (ext.0, ext.1)
    } else {
        let new_id = Uuid::new_v4().to_string();
        // Insert entities
        sqlx::query("INSERT INTO entities (id, type, created_at, updated_at, tags, metadata) VALUES (?, 'review', ?, ?, '', '{}')")
            .bind(&new_id)
            .bind(now)
            .bind(now)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;

        // Insert reviews
        sqlx::query("INSERT INTO reviews (id, period, type, responses) VALUES (?, ?, ?, ?)")
            .bind(&new_id)
            .bind(&period)
            .bind(&review_type)
            .bind(&responses)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;

        (new_id, now)
    };

    tx.commit().await.map_err(|e| e.to_string())?;

    Ok(Review {
        id,
        period,
        review_type,
        responses,
        created_at,
        updated_at: now,
    })
}

#[tauri::command]
pub async fn list_journal_entries(
    state: State<'_, DbState>,
) -> Result<Vec<JournalEntry>, String> {
    let rows: Vec<(
        String, String, i32, Option<String>, String, String, i64, i64
    )> = sqlx::query_as(
        "SELECT j.id, j.date, j.mood, j.mood_notes, j.gratitude, j.life_areas, e.created_at, e.updated_at 
         FROM journal_entries j 
         JOIN entities e ON j.id = e.id 
         ORDER BY j.date DESC"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    let entries = rows.into_iter().map(|r| {
        let gratitude = serde_json::from_str(&r.4).unwrap_or_default();
        JournalEntry {
            id: r.0,
            date: r.1,
            mood: r.2,
            mood_notes: r.3,
            gratitude,
            life_areas: r.5,
            created_at: r.6,
            updated_at: r.7,
        }
    }).collect();

    Ok(entries)
}

#[tauri::command]
pub async fn list_reviews(
    state: State<'_, DbState>,
) -> Result<Vec<Review>, String> {
    let rows: Vec<(
        String, String, String, String, i64, i64
    )> = sqlx::query_as(
        "SELECT r.id, r.period, r.type, r.responses, e.created_at, e.updated_at 
         FROM reviews r 
         JOIN entities e ON r.id = e.id 
         ORDER BY r.period DESC"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    let reviews = rows.into_iter().map(|r| {
        Review {
            id: r.0,
            period: r.1,
            review_type: r.2,
            responses: r.3,
            created_at: r.4,
            updated_at: r.5,
        }
    }).collect();

    Ok(reviews)
}

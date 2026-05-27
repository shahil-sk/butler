use serde::{Deserialize, Serialize};
use tauri::State;
use crate::db::DbState;
use uuid::Uuid;
use chrono::{Utc, NaiveDate};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Habit {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub frequency: String,
    pub frequency_spec: String, // JSON
    pub target_streak: i32,
    pub routine_group: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub tags: Vec<String>,
    pub metadata: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct HabitLog {
    pub id: String,
    pub habit_id: String,
    pub date: String,
    pub status: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct StreakStats {
    pub current_streak: i32,
    pub longest_streak: i32,
}

#[tauri::command]
pub async fn create_habit(
    state: State<'_, DbState>,
    title: String,
    description: Option<String>,
    frequency: String,
    frequency_spec: String,
    target_streak: i32,
    routine_group: Option<String>,
    tags: Vec<String>,
    metadata: String,
) -> Result<Habit, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().timestamp_millis();
    let tags_str = tags.join(",");

    let mut tx = state.pool.begin().await.map_err(|e| e.to_string())?;

    sqlx::query(
        "INSERT INTO entities (id, type, created_at, updated_at, tags, metadata) VALUES (?, 'habit', ?, ?, ?, ?)"
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
        "INSERT INTO habits (id, title, description, frequency, frequency_spec, target_streak, routine_group) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&title)
    .bind(&description)
    .bind(&frequency)
    .bind(&frequency_spec)
    .bind(target_streak)
    .bind(&routine_group)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;

    Ok(Habit {
        id,
        title,
        description,
        frequency,
        frequency_spec,
        target_streak,
        routine_group,
        created_at: now,
        updated_at: now,
        tags,
        metadata,
    })
}

#[tauri::command]
pub async fn list_habits(state: State<'_, DbState>) -> Result<Vec<Habit>, String> {
    let rows: Vec<(
        String, String, Option<String>, String, String, i32, Option<String>, i64, i64, Option<String>, Option<String>
    )> = sqlx::query_as(
        "SELECT h.id, h.title, h.description, h.frequency, h.frequency_spec, h.target_streak, h.routine_group, e.created_at, e.updated_at, e.tags, e.metadata 
         FROM habits h 
         JOIN entities e ON h.id = e.id 
         ORDER BY e.created_at DESC"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    let habits = rows.into_iter().map(|r| {
        let tags = r.9.map(|t| t.split(',').map(|s| s.to_string()).filter(|s| !s.is_empty()).collect()).unwrap_or_default();
        Habit {
            id: r.0,
            title: r.1,
            description: r.2,
            frequency: r.3,
            frequency_spec: r.4,
            target_streak: r.5,
            routine_group: r.6,
            created_at: r.7,
            updated_at: r.8,
            tags,
            metadata: r.10.unwrap_or_default(),
        }
    }).collect();

    Ok(habits)
}

#[tauri::command]
pub async fn update_habit(
    state: State<'_, DbState>,
    id: String,
    title: String,
    description: Option<String>,
    frequency: String,
    frequency_spec: String,
    target_streak: i32,
    routine_group: Option<String>,
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

    sqlx::query("UPDATE habits SET title = ?, description = ?, frequency = ?, frequency_spec = ?, target_streak = ?, routine_group = ? WHERE id = ?")
        .bind(&title)
        .bind(&description)
        .bind(&frequency)
        .bind(&frequency_spec)
        .bind(target_streak)
        .bind(&routine_group)
        .bind(&id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn delete_habit(state: State<'_, DbState>, id: String) -> Result<(), String> {
    sqlx::query("DELETE FROM entities WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn log_habit_status(
    state: State<'_, DbState>,
    habit_id: String,
    date: String,
    status: String,
) -> Result<HabitLog, String> {
    let now = Utc::now().timestamp_millis();
    let mut tx = state.pool.begin().await.map_err(|e| e.to_string())?;

    // Check if log already exists
    let existing: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM habit_logs WHERE habit_id = ? AND date = ?"
    )
    .bind(&habit_id)
    .bind(&date)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    if status == "none" {
        if let Some(ext) = existing {
            sqlx::query("DELETE FROM entities WHERE id = ?")
                .bind(&ext.0)
                .execute(&mut *tx)
                .await
                .map_err(|e| e.to_string())?;
        }
        tx.commit().await.map_err(|e| e.to_string())?;
        return Ok(HabitLog {
            id: "".to_string(),
            habit_id,
            date,
            status,
        });
    }

    let id = if let Some(ext) = existing {
        sqlx::query("UPDATE entities SET updated_at = ? WHERE id = ?")
            .bind(now)
            .bind(&ext.0)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;

        sqlx::query("UPDATE habit_logs SET status = ? WHERE id = ?")
            .bind(&status)
            .bind(&ext.0)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;

        ext.0
    } else {
        let new_id = Uuid::new_v4().to_string();
        sqlx::query("INSERT INTO entities (id, type, created_at, updated_at, tags, metadata) VALUES (?, 'habit_log', ?, ?, '', '{}')")
            .bind(&new_id)
            .bind(now)
            .bind(now)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;

        sqlx::query("INSERT INTO habit_logs (id, habit_id, date, status) VALUES (?, ?, ?, ?)")
            .bind(&new_id)
            .bind(&habit_id)
            .bind(&date)
            .bind(&status)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;

        new_id
    };

    tx.commit().await.map_err(|e| e.to_string())?;

    Ok(HabitLog {
        id,
        habit_id,
        date,
        status,
    })
}

#[tauri::command]
pub async fn get_habit_logs(
    state: State<'_, DbState>,
    habit_id: String,
) -> Result<Vec<HabitLog>, String> {
    let rows: Vec<(String, String, String, String)> = sqlx::query_as(
        "SELECT id, habit_id, date, status FROM habit_logs WHERE habit_id = ? ORDER BY date DESC"
    )
    .bind(&habit_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    let logs = rows.into_iter().map(|r| HabitLog {
        id: r.0,
        habit_id: r.1,
        date: r.2,
        status: r.3,
    }).collect();

    Ok(logs)
}

#[tauri::command]
pub async fn get_habit_streak_stats(
    state: State<'_, DbState>,
    habit_id: String,
) -> Result<StreakStats, String> {
    let rows: Vec<(String,)> = sqlx::query_as(
        "SELECT date FROM habit_logs WHERE habit_id = ? AND status = 'completed' ORDER BY date DESC"
    )
    .bind(&habit_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    if rows.is_empty() {
        return Ok(StreakStats {
            current_streak: 0,
            longest_streak: 0,
        });
    }

    let mut dates: Vec<NaiveDate> = rows
        .into_iter()
        .filter_map(|r| NaiveDate::parse_from_str(&r.0, "%Y-%m-%d").ok())
        .collect();

    dates.dedup();

    let today = Utc::now().with_timezone(&chrono::Local).date_naive();
    let yesterday = today.pred_opt().unwrap_or(today);

    let mut current_streak = 0;
    if !dates.is_empty() {
        let first_date = dates[0];
        if first_date == today || first_date == yesterday {
            current_streak = 1;
            let mut last_date = first_date;
            for &d in dates.iter().skip(1) {
                if last_date.pred_opt().unwrap_or(last_date) == d {
                    current_streak += 1;
                    last_date = d;
                } else {
                    break;
                }
            }
        }
    }

    let mut longest_streak = 0;
    if !dates.is_empty() {
        let mut temp_streak = 1;
        let mut last_date = dates[0];
        longest_streak = 1;
        for &d in dates.iter().skip(1) {
            if last_date.pred_opt().unwrap_or(last_date) == d {
                temp_streak += 1;
                last_date = d;
            } else {
                if temp_streak > longest_streak {
                    longest_streak = temp_streak;
                }
                temp_streak = 1;
                last_date = d;
            }
        }
        if temp_streak > longest_streak {
            longest_streak = temp_streak;
        }
    }

    Ok(StreakStats {
        current_streak,
        longest_streak,
    })
}

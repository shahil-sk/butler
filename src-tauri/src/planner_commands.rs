use serde::{Deserialize, Serialize};
use tauri::State;
use crate::db::DbState;
use uuid::Uuid;
use chrono::Utc;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DayPlan {
    pub id: String,
    pub date: String,
    pub status: String,
    pub morning_intention: Option<String>,
    pub evening_reflection: Option<String>,
    pub energy_level: Option<String>,
    pub mood_start: Option<i32>,
    pub mood_end: Option<i32>,
    pub planned_minutes: i32,
    pub actual_minutes: i32,
    pub tasks_planned: i32,
    pub tasks_completed: i32,
    pub overflow_count: i32,
    pub created_at: i64,
    pub completed_at: Option<i64>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PlannerTemplate {
    pub id: String,
    pub name: String,
    pub blocks: String, // JSON string
    pub is_default: bool,
    pub days_of_week: String, // JSON array string
    pub created_at: i64,
}

#[tauri::command]
pub async fn get_day_plan(state: State<'_, DbState>, date: String) -> Result<Option<DayPlan>, String> {
    let row: Option<(
        String, String, String, Option<String>, Option<String>, Option<String>, 
        Option<i32>, Option<i32>, i32, i32, i32, i32, i32, i64, Option<i64>
    )> = sqlx::query_as(
        "SELECT id, date, status, morning_intention, evening_reflection, energy_level, mood_start, mood_end, planned_minutes, actual_minutes, tasks_planned, tasks_completed, overflow_count, created_at, completed_at FROM day_plans WHERE date = ?"
    )
    .bind(&date)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(row.map(|r| DayPlan {
        id: r.0, date: r.1, status: r.2, morning_intention: r.3, evening_reflection: r.4, energy_level: r.5,
        mood_start: r.6, mood_end: r.7, planned_minutes: r.8, actual_minutes: r.9, tasks_planned: r.10, tasks_completed: r.11,
        overflow_count: r.12, created_at: r.13, completed_at: r.14,
    }))
}

#[tauri::command]
pub async fn create_or_update_day_plan(
    state: State<'_, DbState>,
    date: String,
    status: String,
    morning_intention: Option<String>,
    evening_reflection: Option<String>,
    energy_level: Option<String>,
    mood_start: Option<i32>,
    mood_end: Option<i32>,
    planned_minutes: i32,
    actual_minutes: i32,
    tasks_planned: i32,
    tasks_completed: i32,
    overflow_count: i32,
    completed_at: Option<i64>,
) -> Result<DayPlan, String> {
    let mut tx = state.pool.begin().await.map_err(|e| e.to_string())?;

    let existing: Option<(String, i64)> = sqlx::query_as("SELECT id, created_at FROM day_plans WHERE date = ?")
        .bind(&date).fetch_optional(&mut *tx).await.map_err(|e| e.to_string())?;

    let (id, created_at) = match existing {
        Some(r) => (r.0, r.1),
        None => (Uuid::new_v4().to_string(), Utc::now().timestamp_millis()),
    };

    sqlx::query(
        "INSERT INTO day_plans (id, date, status, morning_intention, evening_reflection, energy_level, mood_start, mood_end, planned_minutes, actual_minutes, tasks_planned, tasks_completed, overflow_count, created_at, completed_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(date) DO UPDATE SET 
            status=excluded.status, morning_intention=excluded.morning_intention, evening_reflection=excluded.evening_reflection,
            energy_level=excluded.energy_level, mood_start=excluded.mood_start, mood_end=excluded.mood_end,
            planned_minutes=excluded.planned_minutes, actual_minutes=excluded.actual_minutes, tasks_planned=excluded.tasks_planned,
            tasks_completed=excluded.tasks_completed, overflow_count=excluded.overflow_count, completed_at=excluded.completed_at"
    )
    .bind(&id).bind(&date).bind(&status).bind(&morning_intention).bind(&evening_reflection).bind(&energy_level)
    .bind(mood_start).bind(mood_end).bind(planned_minutes).bind(actual_minutes).bind(tasks_planned).bind(tasks_completed)
    .bind(overflow_count).bind(created_at).bind(completed_at)
    .execute(&mut *tx).await.map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;

    Ok(DayPlan {
        id, date, status, morning_intention, evening_reflection, energy_level, mood_start, mood_end,
        planned_minutes, actual_minutes, tasks_planned, tasks_completed, overflow_count, created_at, completed_at
    })
}

// Planner Templates commands...
#[tauri::command]
pub async fn list_planner_templates(state: State<'_, DbState>) -> Result<Vec<PlannerTemplate>, String> {
    let rows: Vec<(String, String, String, i32, String, i64)> = sqlx::query_as(
        "SELECT id, name, blocks, is_default, days_of_week, created_at FROM planner_templates"
    )
    .fetch_all(&state.pool).await.map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(|r| PlannerTemplate {
        id: r.0, name: r.1, blocks: r.2, is_default: r.3 != 0, days_of_week: r.4, created_at: r.5
    }).collect())
}

#[tauri::command]
pub async fn create_planner_template(
    state: State<'_, DbState>,
    name: String,
    blocks: String,
    is_default: bool,
    days_of_week: String,
) -> Result<PlannerTemplate, String> {
    let id = Uuid::new_v4().to_string();
    let created_at = Utc::now().timestamp_millis();
    let def_int = if is_default { 1 } else { 0 };

    if is_default {
        sqlx::query("UPDATE planner_templates SET is_default = 0").execute(&state.pool).await.map_err(|e| e.to_string())?;
    }

    sqlx::query(
        "INSERT INTO planner_templates (id, name, blocks, is_default, days_of_week, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(&id).bind(&name).bind(&blocks).bind(def_int).bind(&days_of_week).bind(created_at)
    .execute(&state.pool).await.map_err(|e| e.to_string())?;

    Ok(PlannerTemplate { id, name, blocks, is_default, days_of_week, created_at })
}

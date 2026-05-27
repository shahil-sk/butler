// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;
mod commands;
mod notes_commands;
mod journal_commands;
mod habits_commands;
mod projects_commands;
mod goals_commands;
mod documents_commands;
mod database_commands;
mod media_commands;

use tauri::Manager;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

fn setup_logger(app_handle: &tauri::AppHandle) -> Result<(), fern::InitError> {
    let app_dir = app_handle
        .path()
        .app_log_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("./logs"));
    
    if !app_dir.exists() {
        std::fs::create_dir_all(&app_dir)?;
    }
    
    let log_path = app_dir.join("app.log");

    fern::Dispatch::new()
        .format(|out, message, record| {
            out.finish(format_args!(
                "{}[{}][{}] {}",
                chrono::Local::now().format("[%Y-%m-%d][%H:%M:%S]"),
                record.target(),
                record.level(),
                message
            ))
        })
        .level(log::LevelFilter::Info)
        .chain(std::io::stdout())
        .chain(fern::log_file(log_path)?)
        .apply()?;
    
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle().clone();
            
            // Set up logger
            if let Err(e) = setup_logger(&handle) {
                eprintln!("Failed to initialize logger: {}", e);
            } else {
                log::info!("Logger initialized successfully.");
            }

            // Set up database
            let pool = tauri::async_runtime::block_on(async {
                db::init_db(&handle).await.expect("Failed to initialize database")
            });

            // Register DbState managed resource
            app.manage(db::DbState { pool });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            commands::get_setting,
            commands::set_setting,
            commands::create_task,
            commands::list_tasks,
            commands::update_task_status,
            commands::update_task_details,
            commands::delete_task,
            commands::search_tasks,
            commands::create_time_block,
            commands::list_time_blocks,
            commands::delete_time_block,
            commands::save_reflection,
            commands::get_reflections_for_date,
            commands::create_event,
            commands::list_events,
            commands::update_event,
            commands::delete_event,
            commands::log_focus_session,
            commands::list_focus_sessions,
            commands::log_time,
            commands::list_time_logs,
            commands::delete_time_log,
            notes_commands::create_note,
            notes_commands::get_note,
            notes_commands::update_note,
            notes_commands::delete_note,
            notes_commands::list_notes,
            notes_commands::sync_note_links,
            notes_commands::get_backlinks,
            notes_commands::search_notes,
            journal_commands::get_journal_entry,
            journal_commands::save_journal_entry,
            journal_commands::get_review,
            journal_commands::save_review,
            journal_commands::list_journal_entries,
            journal_commands::list_reviews,
            habits_commands::create_habit,
            habits_commands::list_habits,
            habits_commands::update_habit,
            habits_commands::delete_habit,
            habits_commands::log_habit_status,
            habits_commands::get_habit_logs,
            habits_commands::get_habit_streak_stats,
            projects_commands::create_project,
            projects_commands::list_projects,
            projects_commands::update_project,
            projects_commands::delete_project,
            projects_commands::assign_task_to_project,
            goals_commands::create_goal,
            goals_commands::list_goals,
            goals_commands::update_goal,
            goals_commands::delete_goal,
            goals_commands::create_key_result,
            goals_commands::list_key_results,
            goals_commands::update_key_result_value,
            goals_commands::delete_key_result,
            goals_commands::link_entity_to_goal,
            goals_commands::unlink_entity_from_goal,
            goals_commands::list_goal_links,
            documents_commands::create_document,
            documents_commands::list_documents,
            documents_commands::get_document,
            documents_commands::update_document,
            documents_commands::delete_document,
            documents_commands::write_text_file,
            database_commands::create_database_table,
            database_commands::list_database_tables,
            database_commands::update_database_table,
            database_commands::delete_database_table,
            database_commands::create_database_record,
            database_commands::list_database_records,
            database_commands::update_database_record,
            database_commands::delete_database_record,
            media_commands::add_file_attachment,
            media_commands::list_file_attachments,
            media_commands::delete_file_attachment,
            media_commands::create_pdf_annotation,
            media_commands::list_pdf_annotations,
            media_commands::delete_pdf_annotation
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

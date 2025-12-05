// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod database;
mod audio_processor;

use database::Database;
use audio_processor::{AudioProcessor, ProcessedAudio};
use std::sync::Mutex;
use tauri::{Manager, State};

// Application state
pub struct AppState {
    db: Mutex<Database>,
    audio_processor: Mutex<AudioProcessor>,
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Initialize database
            let app_dir = app
                .path_resolver()
                .app_data_dir()
                .expect("Failed to get app data directory");
            
            std::fs::create_dir_all(&app_dir).expect("Failed to create app data directory");
            
            let db_path = app_dir.join("realtime_voice_translation.db");
            let db = Database::new(db_path.to_str().unwrap())
                .expect("Failed to initialize database");
            
            let audio_processor = AudioProcessor::new()
                .expect("Failed to initialize audio processor");
            
            app.manage(AppState {
                db: Mutex::new(db),
                audio_processor: Mutex::new(audio_processor),
            });
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_sessions,
            create_session,
            get_session_messages,
            save_message,
            initialize_audio_input,
            initialize_audio_output,
            process_audio,
            get_input_devices,
            get_output_devices,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// Tauri commands
#[tauri::command]
fn get_sessions(state: State<AppState>) -> Result<Vec<database::Session>, String> {
    let db = state.db.lock().unwrap();
    db.get_sessions().map_err(|e| e.to_string())
}

#[tauri::command]
fn create_session(
    mode: String,
    user_id: String,
    state: State<AppState>,
) -> Result<database::Session, String> {
    let db = state.db.lock().unwrap();
    db.create_session(&mode, &user_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_session_messages(
    session_id: String,
    limit: Option<i32>,
    state: State<AppState>,
) -> Result<Vec<database::Message>, String> {
    let db = state.db.lock().unwrap();
    db.get_session_messages(&session_id, limit)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn save_message(
    session_id: String,
    speaker_id: String,
    original_text: String,
    original_language: String,
    translated_text: Option<String>,
    target_language: Option<String>,
    state: State<AppState>,
) -> Result<(), String> {
    let db = state.db.lock().unwrap();
    db.save_message(
        &session_id,
        &speaker_id,
        &original_text,
        &original_language,
        translated_text.as_deref(),
        target_language.as_deref(),
    )
    .map_err(|e| e.to_string())
}

// Audio processing commands
#[tauri::command]
fn initialize_audio_input(state: State<AppState>) -> Result<(), String> {
    let mut processor = state.audio_processor.lock().unwrap();
    processor.initialize_input()
}

#[tauri::command]
fn initialize_audio_output(state: State<AppState>) -> Result<(), String> {
    let mut processor = state.audio_processor.lock().unwrap();
    processor.initialize_output()
}

#[tauri::command]
fn process_audio(
    audio_data: Vec<f32>,
    sample_rate: u32,
    channels: u16,
    state: State<AppState>,
) -> Result<ProcessedAudio, String> {
    let processor = state.audio_processor.lock().unwrap();
    Ok(processor.process(&audio_data, sample_rate, channels))
}

#[tauri::command]
fn get_input_devices(state: State<AppState>) -> Result<Vec<String>, String> {
    let processor = state.audio_processor.lock().unwrap();
    processor.get_input_devices()
}

#[tauri::command]
fn get_output_devices(state: State<AppState>) -> Result<Vec<String>, String> {
    let processor = state.audio_processor.lock().unwrap();
    processor.get_output_devices()
}

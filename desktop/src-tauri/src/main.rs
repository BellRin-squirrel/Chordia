#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod types;
mod utils;
mod cmd_window;
mod cmd_settings;
mod cmd_add_music;
mod cmd_playlist;
mod cmd_library;
mod cmd_history;
mod cmd_export;
mod cmd_extensions;
mod server;
mod cmd_api;

use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::{Manager, Emitter, AppHandle};
use utils::{load_db, load_playlists_master};

const APP_VERSION: &str = "v3.1.0";

pub struct AppState {
    pub db: std::sync::Mutex<Vec<serde_json::Map<String, serde_json::Value>>>,
    pub playlists: std::sync::Mutex<Vec<serde_json::Value>>,
}

#[tauri::command]
fn resolve_path(rel_path: String) -> Result<String, String> {
    // ★ 修正：共通正規化関数を用いてパスを解決
    let normalized = crate::utils::normalize_rel_path(&rel_path);
    let abs_path = crate::utils::get_base_dir().join(&normalized);
    Ok(abs_path.to_string_lossy().to_string())
}

#[tauri::command]
fn get_app_version() -> &'static str {
    APP_VERSION
}

#[tauri::command]
fn restart_app(app: AppHandle) {
    app.restart();
}

#[cfg(target_os = "windows")]
fn set_app_user_model_id() {
    use std::os::windows::ffi::OsStrExt;
    
    let app_id: Vec<u16> = std::ffi::OsStr::new("BellRin.Chordia")
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    
    extern "system" {
        fn SetCurrentProcessExplicitAppUserModelID(app_id: *const u16) -> i32;
    }
    
    unsafe {
        let _ = SetCurrentProcessExplicitAppUserModelID(app_id.as_ptr());
    }
}

fn main() {
    #[cfg(target_os = "windows")]
    set_app_user_model_id();

    let initial_db = load_db();
    let initial_playlists = load_playlists_master();
    
    let auth_state = Arc::new(Mutex::new(server::AuthState::new()));
    let auth_state_for_task = auth_state.clone();

    tauri::Builder::default()
        .manage(AppState {
            db: std::sync::Mutex::new(initial_db),
            playlists: std::sync::Mutex::new(initial_playlists),
        })
        .manage(auth_state.clone()) 
        .setup(|app| {
            let app_handle_for_timer = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                use rand::{rng, Rng};
                loop {
                    tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                    let mut state = auth_state_for_task.lock().await;
                    if state.window_open {
                        let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs_f64();
                        if now >= state.code_expires_at {
                            let new_code: String = (0..6).map(|_| rng().random_range(b'0'..=b'9') as char).collect();
                            state.current_code = Some(new_code.clone());
                            state.code_expires_at = now + 30.0;
                            let _ = app_handle_for_timer.emit("update_auth_code", new_code);
                        }
                    }
                }
            });

            let _window = app.get_webview_window("main").unwrap();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            cmd_window::open_new_window, cmd_window::set_mini_player_mode, cmd_window::close_mini_player, cmd_window::make_window_square, cmd_window::minimize_mini_player, cmd_window::show_in_explorer,
            cmd_settings::get_app_settings, cmd_settings::save_app_settings, cmd_settings::get_custom_themes, cmd_settings::save_custom_theme, cmd_settings::delete_custom_theme,
            cmd_add_music::get_default_art_url, cmd_add_music::update_default_artwork, cmd_add_music::reset_default_artwork, cmd_add_music::get_available_tags, cmd_add_music::get_autocomplete_lists, cmd_add_music::check_duplicate_songs, cmd_add_music::save_music_data, cmd_add_music::download_and_save_music, cmd_add_music::check_tools_status, cmd_add_music::fetch_video_info, cmd_add_music::fetch_youtube_playlist, cmd_add_music::fetch_and_crop_thumbnail, cmd_add_music::fetch_and_crop_image_url, cmd_add_music::extract_artwork_from_local_file, cmd_add_music::download_original_thumbnail, cmd_add_music::search_lyrics_online,
            cmd_playlist::get_playlist_summaries, cmd_playlist::get_playlist_details, cmd_playlist::get_album_list, cmd_playlist::get_artist_list, cmd_playlist::get_virtual_playlist_details, cmd_playlist::create_playlist, cmd_playlist::update_playlist_by_id, cmd_playlist::delete_playlist_by_id, cmd_playlist::duplicate_playlist_by_id, cmd_playlist::add_songs_to_playlist, cmd_playlist::remove_songs_from_playlist, cmd_playlist::create_smart_playlist, cmd_playlist::update_smart_playlist, cmd_playlist::convert_smart_to_normal_and_remove_songs,
            cmd_library::get_library_count, cmd_library::get_library_chunk, cmd_library::update_song_by_id, cmd_library::update_song_artwork_by_id, cmd_library::delete_song_by_id, cmd_library::get_common_values_for_selected, cmd_library::update_multiple_songs, cmd_library::delete_multiple_songs, cmd_library::parse_list_import, cmd_library::execute_final_list_import, cmd_library::check_import_duplicates, cmd_library::scan_zip_import, cmd_library::execute_zip_import,
            cmd_history::record_playback, cmd_history::get_playback_history,
            cmd_export::get_default_export_path, cmd_export::ask_save_path, cmd_export::ask_import_path, cmd_export::execute_export, cmd_export::execute_migration_import, get_app_version,
            cmd_extensions::check_tool_updates, cmd_extensions::install_tool,
            cmd_api::start_sync_server, cmd_api::stop_sync_server, cmd_api::respond_to_request, cmd_api::get_active_sessions, cmd_api::force_disconnect_session,
            resolve_path, restart_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
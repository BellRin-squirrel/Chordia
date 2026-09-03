#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod types;
mod utils;
mod cmd_window;
mod cmd_settings;
mod cmd_add_music;
mod cmd_playlist;
mod cmd_lib_lufs;
mod cmd_lib_query;
mod cmd_lib_mutate;
mod cmd_lib_import;
mod cmd_history;
mod cmd_export;
mod cmd_extensions;
mod cmd_integrity;
mod cmd_i18n;
mod i18n_japanese;
mod i18n_english;
mod server;
mod cmd_mobile_sync;
mod cmd_cloud_sync;

use std::sync::Arc;
use tokio::sync::{Mutex, Semaphore};
use tauri::{Manager, Emitter, AppHandle, WebviewUrl, WebviewWindowBuilder};
use std::collections::HashMap;
use utils::{load_playlists_master, load_lufs_cache, save_lufs_cache, get_base_dir, load_db_with_progress};

#[cfg(target_os = "macos")]
use tauri::menu::{MenuBuilder, SubmenuBuilder, PredefinedMenuItem};

pub const APP_VERSION: &str = "v5.0.0";

pub struct AppState {
    pub db: std::sync::Mutex<Vec<serde_json::Map<String, serde_json::Value>>>,
    pub playlists: std::sync::Mutex<Vec<serde_json::Value>>,
    pub lufs_cache: std::sync::Mutex<HashMap<String, f32>>,
}

#[tauri::command]
fn resolve_path(rel_path: String) -> Result<String, String> {
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
    extern "system" { fn SetCurrentProcessExplicitAppUserModelID(app_id: *const u16) -> i32; }
    unsafe { let _ = SetCurrentProcessExplicitAppUserModelID(app_id.as_ptr()); }
}

#[cfg(target_os = "macos")]
fn create_japanese_mac_menu(app: &AppHandle) -> Result<tauri::menu::Menu<tauri::Wry>, Box<dyn std::error::Error>> {
    let app_menu = SubmenuBuilder::new(app, "Chordia")
        .item(&PredefinedMenuItem::about(app, Some("Chordia について"), None)?)
        .separator()
        .item(&PredefinedMenuItem::hide(app, Some("Chordia を非表示"))?)
        .item(&PredefinedMenuItem::hide_others(app, Some("ほかを非表示"))?)
        .item(&PredefinedMenuItem::show_all(app, Some("すべてを表示"))?)
        .separator()
        .item(&PredefinedMenuItem::quit(app, Some("Chordia を終了"))?)
        .build()?;

    let edit_menu = SubmenuBuilder::new(app, "編集")
        .item(&PredefinedMenuItem::undo(app, Some("元に戻す"))?)
        .item(&PredefinedMenuItem::redo(app, Some("やり直す"))?)
        .separator()
        .item(&PredefinedMenuItem::cut(app, Some("切り取り"))?)
        .item(&PredefinedMenuItem::copy(app, Some("コピー"))?)
        .item(&PredefinedMenuItem::paste(app, Some("貼り付け"))?)
        .item(&PredefinedMenuItem::select_all(app, Some("すべてを選択"))?)
        .build()?;

    let window_menu = SubmenuBuilder::new(app, "ウィンドウ")
        .item(&PredefinedMenuItem::minimize(app, Some("最小化"))?)
        .item(&PredefinedMenuItem::maximize(app, Some("拡大"))?)
        .build()?;

    let menu = MenuBuilder::new(app)
        .items(&[&app_menu, &edit_menu, &window_menu])
        .build()?;

    Ok(menu)
}

fn main() {
    #[cfg(target_os = "windows")]
    set_app_user_model_id();

    cmd_i18n::init_default_languages();

    let auth_state = Arc::new(Mutex::new(server::AuthState::new()));
    let auth_state_for_task = auth_state.clone();

    tauri::Builder::default()
        .manage(AppState {
            db: std::sync::Mutex::new(Vec::new()),
            playlists: std::sync::Mutex::new(Vec::new()),
            lufs_cache: std::sync::Mutex::new(HashMap::new()),
        })
        .manage(auth_state.clone()) 
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } | tauri::WindowEvent::Destroyed = event {
                let label = window.label().to_string();
                if label == "sync_window" || label == "main" {
                    let is_sync_window = label == "sync_window";
                    let auth_state = window.state::<server::SharedAuthState>();
                    let auth_clone = auth_state.inner().clone();
                    tauri::async_runtime::spawn(async move {
                        let mut state = auth_clone.lock().await;
                        if is_sync_window {
                            state.window_open = false;
                            state.pending_requests.clear();
                        }
                        if let Some(child) = state.tunnel_process.take() {
                            cmd_mobile_sync::kill_child_process(child).await;
                        }
                        if is_sync_window {
                            if let Some(tx) = state.shutdown_tx.take() {
                                let _ = tx.send(());
                            }
                            state.wan_url = None;
                        }
                    });
                }
            }
        })
        .setup(|app| {
            #[cfg(target_os = "macos")]
            {
                if let Ok(menu) = create_japanese_mac_menu(app.handle()) {
                    let _ = app.set_menu(menu);
                }
            }

            if let Some(main_win) = app.get_webview_window("main") {
                let _ = main_win.hide();
            }

            let _splash_win = WebviewWindowBuilder::new(
                app,
                "splashscreen",
                WebviewUrl::App("splashscreen.html".into()),
            )
            .title("Chordia")
            .inner_size(450.0, 320.0)
            .decorations(false)
            .center()
            .always_on_top(true)
            .build();

            let app_handle_for_init = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(std::time::Duration::from_millis(150)).await;

                let initial_db = load_db_with_progress(&app_handle_for_init);

                let _ = app_handle_for_init.emit("splash_progress", serde_json::json!({
                    "message": "プレイリストとキャッシュをロード中...",
                    "percent": 90
                }));
                let initial_playlists = load_playlists_master();
                let initial_lufs_cache = load_lufs_cache();

                {
                    let state = app_handle_for_init.state::<AppState>();
                    *state.db.lock().unwrap() = initial_db;
                    *state.playlists.lock().unwrap() = initial_playlists;
                    *state.lufs_cache.lock().unwrap() = initial_lufs_cache;
                }

                let _ = app_handle_for_init.emit("splash_progress", serde_json::json!({
                    "message": "起動完了",
                    "percent": 100
                }));

                tokio::time::sleep(std::time::Duration::from_millis(250)).await;

                if let Some(main_win) = app_handle_for_init.get_webview_window("main") {
                    let _ = main_win.show();
                    let _ = main_win.set_focus();
                }
                if let Some(splash_win) = app_handle_for_init.get_webview_window("splashscreen") {
                    let _ = splash_win.close();
                }
            });

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

            let app_handle_for_lufs = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let ext = if cfg!(target_os = "windows") { ".exe" } else { "" };
                let ffmpeg_path = get_base_dir().join(format!("userfiles/bin/ffmpeg{}", ext));
                let semaphore = Arc::new(Semaphore::new(2)); 
                
                loop {
                    tokio::time::sleep(std::time::Duration::from_secs(10)).await;
                    if !ffmpeg_path.exists() { continue; } 
                    
                    let settings = cmd_settings::get_app_settings();
                    if !settings.normalize_volume { continue; }

                    let mut targets_to_calc = Vec::new();
                    
                    {
                        let state = app_handle_for_lufs.state::<AppState>();
                        let db = state.db.lock().unwrap();
                        let cache = state.lufs_cache.lock().unwrap();
                        
                        for song in db.iter() {
                            if let Some(rel_path) = song.get("musicFilename").and_then(|v| v.as_str()) {
                                if !cache.contains_key(rel_path) {
                                    targets_to_calc.push(rel_path.to_string());
                                }
                            }
                        }
                    }

                    if targets_to_calc.is_empty() { continue; }

                    let mut handles = Vec::new();

                    for rel_path in targets_to_calc {
                        let semaphore_clone = semaphore.clone();
                        let ffmpeg = ffmpeg_path.clone();
                        let abs_path = get_base_dir().join(crate::utils::normalize_rel_path(&rel_path));
                        let path_key = rel_path.clone();

                        handles.push(tokio::spawn(async move {
                            let _permit = semaphore_clone.acquire_owned().await.unwrap();
                            let mut lufs_val: Option<f32> = None;
                            
                            if abs_path.exists() {
                                let mut std_cmd = std::process::Command::new(&ffmpeg);
                                std_cmd.args(&["-hide_banner", "-nostdin", "-i", abs_path.to_str().unwrap(), "-af", "ebur128", "-f", "null", "-"]);
                                #[cfg(target_os = "windows")]
                                {
                                    use std::os::windows::process::CommandExt;
                                    std_cmd.creation_flags(0x08000000);
                                }
                                let mut cmd = tokio::process::Command::from(std_cmd);
                                if let Ok(output) = cmd.output().await {
                                    let stderr = String::from_utf8_lossy(&output.stderr);
                                    for line in stderr.lines() {
                                        if line.contains("I:") && line.contains("LUFS") {
                                            let parts: Vec<&str> = line.split_whitespace().collect();
                                            if parts.len() >= 2 {
                                                if let Ok(val) = parts[1].parse::<f32>() {
                                                    lufs_val = Some(val);
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            (path_key, lufs_val)
                        }));
                    }

                    let mut newly_calculated = false;
                    for handle in handles {
                        if let Ok((path_key, Some(lufs))) = handle.await {
                            let state = app_handle_for_lufs.state::<AppState>();
                            let mut cache = state.lufs_cache.lock().unwrap();
                            cache.insert(path_key, lufs);
                            newly_calculated = true;
                        }
                    }

                    if newly_calculated {
                        let state = app_handle_for_lufs.state::<AppState>();
                        let cache = state.lufs_cache.lock().unwrap();
                        save_lufs_cache(&cache);
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            cmd_window::open_new_window, cmd_window::set_mini_player_mode, cmd_window::close_mini_player, cmd_window::close_lufs_calc_window, cmd_window::make_window_square, cmd_window::minimize_mini_player, cmd_window::show_in_explorer,
            cmd_window::open_url,
            cmd_settings::get_app_settings, cmd_settings::save_app_settings, cmd_settings::get_custom_themes, cmd_settings::save_custom_theme, cmd_settings::delete_custom_theme,
            cmd_add_music::get_default_art_url, cmd_add_music::update_default_artwork, cmd_add_music::reset_default_artwork, cmd_add_music::get_available_tags, cmd_add_music::get_autocomplete_lists, cmd_add_music::check_duplicate_songs, cmd_add_music::save_music_data, cmd_add_music::download_and_save_music, cmd_add_music::check_tools_status, cmd_add_music::fetch_video_info, cmd_add_music::fetch_youtube_playlist, cmd_add_music::fetch_and_crop_thumbnail, cmd_add_music::fetch_and_crop_image_url, cmd_add_music::extract_artwork_from_local_file, cmd_add_music::download_original_thumbnail, cmd_add_music::search_lyrics_online,
            cmd_playlist::get_playlist_summaries, cmd_playlist::get_playlist_details, cmd_playlist::get_album_list, cmd_playlist::get_artist_list, cmd_playlist::get_virtual_playlist_details, cmd_playlist::create_playlist, cmd_playlist::update_playlist_by_id, cmd_playlist::delete_playlist_by_id, cmd_playlist::duplicate_playlist_by_id, cmd_playlist::add_songs_to_playlist, cmd_playlist::remove_songs_from_playlist, cmd_playlist::create_smart_playlist, cmd_playlist::update_smart_playlist, cmd_playlist::convert_smart_to_normal_and_remove_songs, cmd_playlist::convert_smart_to_normal_and_add_songs,
            cmd_playlist::get_playlist_cover, cmd_playlist::save_playlist_cover_image, cmd_playlist::set_playlist_cover_from_song,
            cmd_lib_query::get_library_count, 
            cmd_lib_query::get_library_chunk, 
            cmd_lib_query::get_common_values_for_selected, 
            cmd_lib_mutate::update_song_by_id, 
            cmd_lib_mutate::update_song_artwork_by_id, 
            cmd_lib_mutate::delete_song_by_id, 
            cmd_lib_mutate::update_multiple_songs, 
            cmd_lib_mutate::delete_multiple_songs, 
            cmd_lib_import::parse_list_import, 
            cmd_lib_import::execute_final_list_import, 
            cmd_lib_import::check_import_duplicates, 
            cmd_lib_import::scan_zip_import, 
            cmd_lib_import::execute_zip_import, 
            cmd_lib_lufs::start_lufs_calculation_all, 
            cmd_lib_lufs::get_song_lufs,
            cmd_lib_lufs::check_lufs_status,
            cmd_history::record_playback, cmd_history::get_playback_history,
            cmd_export::get_default_export_path, cmd_export::ask_save_path, cmd_export::ask_import_path, cmd_export::execute_export, cmd_export::execute_migration_import, get_app_version,
            cmd_extensions::check_tool_updates, cmd_extensions::install_tool,
            cmd_integrity::check_system_integrity,
            cmd_i18n::get_available_languages, cmd_i18n::get_language_pack, cmd_i18n::check_language_packs_status,
            cmd_mobile_sync::start_sync_server, cmd_mobile_sync::toggle_wan_mode, cmd_mobile_sync::stop_sync_server, cmd_mobile_sync::respond_to_request, cmd_mobile_sync::get_active_sessions, cmd_mobile_sync::force_disconnect_session,
            cmd_cloud_sync::register_auth_code_to_cloud,
            cmd_cloud_sync::check_cloud_login_status,
            cmd_cloud_sync::fetch_cloud_play_history,
            cmd_cloud_sync::fetch_cloud_work_history,
            cmd_cloud_sync::get_local_play_statistics,
            cmd_cloud_sync::get_cloud_auth_info,
            cmd_cloud_sync::logout_cloud_auth,
            cmd_cloud_sync::add_play_history_to_cloud,
            cmd_cloud_sync::sync_all_local_history_to_cloud,
            resolve_path, restart_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
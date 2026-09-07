use serde_json::Value;
use tauri::Manager;
use tauri::{AppHandle, State};
use crate::server::SharedAuthState;
use std::fs;
use std::io::Write;
use std::time::Instant;
use crate::utils::{get_base_dir, check_and_reload_db_if_needed, check_and_reload_playlists_if_needed, load_playlists_master};
use crate::AppState;
use crate::cmd_cloud_sync::auth::get_saved_cloud_sid;

// 曲一覧送信API (registerMusicList)
#[tauri::command]
pub async fn sync_all_local_music_list_to_cloud(
    state: State<'_, AppState>,
    auth: State<'_, SharedAuthState>,
) -> Result<usize, String> {
    let sid = match get_saved_cloud_sid(&auth).await {
        Some(s) if !s.is_empty() => s,
        _ => {
            eprintln!("[Chordia Sync] registerMusicList skipped: Not logged in.");
            return Err("ログインしていません。".to_string());
        }
    };

    check_and_reload_db_if_needed(&state);

    let music_list: Vec<Value> = {
        let db = state.db.lock().unwrap();
        db.iter().map(|song| {
            let title = song.get("title").and_then(|v| v.as_str()).unwrap_or("");
            let artist = song.get("artist").and_then(|v| v.as_str()).unwrap_or("");
            let album = song.get("album").and_then(|v| v.as_str()).unwrap_or("");
            let lyric = song.get("lyric").and_then(|v| v.as_str()).unwrap_or("");
            serde_json::json!({
                "title": title,
                "artist": artist,
                "album": album,
                "lyric": lyric
            })
        }).collect()
    };

    let total = music_list.len();

    let payload = serde_json::json!({
        "operation": "registerMusicList",
        "SID": sid,
        "musicList": music_list
    });

    let body_json = serde_json::to_string(&payload)
        .map_err(|e| format!("JSON構築エラー: {}", e))?;

    let client = reqwest::Client::builder().timeout(std::time::Duration::from_secs(20)).build().map_err(|e| e.to_string())?;
    let response = client
        .post("https://chordia.bellrin.f5.si/api/")
        .header("X-ACCESS-KEY", "ucbancmuvmczvlxgycbvuwfasdyowwap")
        .header("HTTP_X_ACCESS_KEY", "ucbancmuvmczvlxgycbvuwfasdyowwap")
        .header("Content-Type", "application/json")
        .body(body_json)
        .send()
        .await
        .map_err(|e| {
            eprintln!("[Chordia Sync Error] registerMusicList request failed: {}", e);
            format!("通信エラー: {}", e)
        })?;

    let res_text = response.text().await.map_err(|e| format!("レスポンス読み取りエラー: {}", e))?;

    let json_res: Value = serde_json::from_str(&res_text).map_err(|_| format!("不正なJSONレスポンス: {}", res_text))?;

    if let Some(err) = json_res.get("error").and_then(|v| v.as_str()) {
        return Err(err.to_string());
    }

    Ok(total)
}

// プレイリスト送信API (registerPlaylist)
#[tauri::command]
pub async fn sync_all_local_playlists_to_cloud(
    state: State<'_, AppState>,
    auth: State<'_, SharedAuthState>,
) -> Result<usize, String> {
    let sid = match get_saved_cloud_sid(&auth).await {
        Some(s) if !s.is_empty() => s,
        _ => {
            eprintln!("[Chordia Sync] registerPlaylist skipped: Not logged in.");
            return Err("ログインしていません。".to_string());
        }
    };

    check_and_reload_db_if_needed(&state);
    check_and_reload_playlists_if_needed(&state);

    let master = load_playlists_master();
    let base = get_base_dir();

    let playlist_data: Vec<Value> = {
        let db = state.db.lock().unwrap();
        let mut list = Vec::new();

        for pl in master {
            let pl_id = pl.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let pl_name = pl.get("playlistName").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let pl_type = pl.get("type").and_then(|v| v.as_str()).unwrap_or("normal").to_string();
            let sort_by = pl.get("sortBy").and_then(|v| v.as_str()).unwrap_or("title").to_string();
            let sort_desc = pl.get("sortDesc").and_then(|v| v.as_bool()).unwrap_or(false);

            if pl_type == "smart" {
                let conditions = pl.get("conditions").cloned().unwrap_or(serde_json::json!({
                    "items": [],
                    "match": "all",
                    "type": "group"
                }));
                list.push(serde_json::json!({
                    "id": pl_id,
                    "playlistName": pl_name,
                    "sortBy": sort_by,
                    "sortDesc": sort_desc,
                    "type": "smart",
                    "conditions": conditions
                }));
            } else {
                let mut musics = Vec::new();
                let p_file = base.join(format!("userfiles/playlist/{}.json", pl_id));
                if p_file.exists() {
                    if let Ok(data) = fs::read_to_string(&p_file) {
                        if let Ok(file_list) = serde_json::from_str::<Vec<String>>(&data) {
                            for target_path in file_list {
                                let norm_target = crate::utils::normalize_rel_path(&target_path);
                                let target_fname = std::path::Path::new(&target_path).file_name().and_then(|n| n.to_str()).unwrap_or("");
                                
                                if let Some(song) = db.iter().find(|s| {
                                    let s_path = s.get("musicFilename").and_then(|v| v.as_str()).unwrap_or("");
                                    let s_norm = crate::utils::normalize_rel_path(s_path);
                                    let s_fname = std::path::Path::new(s_path).file_name().and_then(|n| n.to_str()).unwrap_or("");
                                    s_norm == norm_target || s_path == norm_target || s_fname == target_fname
                                }) {
                                    let title = song.get("title").and_then(|v| v.as_str()).unwrap_or("Unknown");
                                    let artist = song.get("artist").and_then(|v| v.as_str()).unwrap_or("Unknown");
                                    musics.push(serde_json::json!({
                                        "title": title,
                                        "artist": artist
                                    }));
                                }
                            }
                        }
                    }
                }

                list.push(serde_json::json!({
                    "id": pl_id,
                    "playlistName": pl_name,
                    "sortBy": sort_by,
                    "sortDesc": sort_desc,
                    "type": "normal",
                    "musics": musics
                }));
            }
        }
        list
    };

    let total = playlist_data.len();

    let payload = serde_json::json!({
        "operation": "registerPlaylist",
        "SID": sid,
        "playlist": playlist_data
    });

    let body_json = serde_json::to_string(&payload)
        .map_err(|e| format!("JSON構築エラー: {}", e))?;

    let client = reqwest::Client::builder().timeout(std::time::Duration::from_secs(20)).build().map_err(|e| e.to_string())?;
    let response = client
        .post("https://chordia.bellrin.f5.si/api/")
        .header("X-ACCESS-KEY", "ucbancmuvmczvlxgycbvuwfasdyowwap")
        .header("HTTP_X_ACCESS_KEY", "ucbancmuvmczvlxgycbvuwfasdyowwap")
        .header("Content-Type", "application/json")
        .body(body_json)
        .send()
        .await
        .map_err(|e| {
            eprintln!("[Chordia Sync Error] registerPlaylist request failed: {}", e);
            format!("通信エラー: {}", e)
        })?;

    let res_text = response.text().await.map_err(|e| format!("レスポンス読み取りエラー: {}", e))?;

    let json_res: Value = serde_json::from_str(&res_text).map_err(|_| format!("不正なJSONレスポンス: {}", res_text))?;

    if let Some(err) = json_res.get("error").and_then(|v| v.as_str()) {
        return Err(err.to_string());
    }

    Ok(total)
}

// 楽曲再生位置送信API (registerNowPlaying)
#[tauri::command]
pub async fn send_now_playing_to_cloud(
    payload: Value,
    auth: State<'_, SharedAuthState>,
) -> Result<(), String> {
    let sid = match get_saved_cloud_sid(&auth).await {
        Some(s) if !s.is_empty() => s,
        _ => return Ok(()),
    };

    let mut body_map = match payload.as_object() {
        Some(m) => m.clone(),
        None => return Err("Invalid payload".to_string()),
    };

    body_map.insert("operation".to_string(), Value::String("registerNowPlaying".to_string()));
    body_map.insert("SID".to_string(), Value::String(sid));

    let body_json = serde_json::to_string(&body_map)
        .map_err(|e| format!("JSON構築エラー: {}", e))?;

    println!("{}", body_json);
    let _ = std::io::stdout().flush();
    eprintln!("{}", body_json);
    let _ = std::io::stderr().flush();

    let client = reqwest::Client::builder().timeout(std::time::Duration::from_secs(4)).build().map_err(|e| e.to_string())?;
    let request_start_time = Instant::now();

    let response = client
        .post("https://chordia.bellrin.f5.si/api/")
        .header("X-ACCESS-KEY", "ucbancmuvmczvlxgycbvuwfasdyowwap")
        .header("HTTP_X_ACCESS_KEY", "ucbancmuvmczvlxgycbvuwfasdyowwap")
        .header("Content-Type", "application/json")
        .body(body_json)
        .send()
        .await
        .map_err(|e| format!("通信エラー: {}", e))?;

    let res_text = response.text().await.map_err(|e| format!("レスポンス読み取りエラー: {}", e))?;
    let elapsed_ms = request_start_time.elapsed().as_millis();

    println!("{}", res_text);
    let _ = std::io::stdout().flush();
    eprintln!("{}", res_text);
    let _ = std::io::stderr().flush();

    println!("[Chordia Relay] API Response Time: {} ms", elapsed_ms);
    let _ = std::io::stdout().flush();
    eprintln!("[Chordia Relay] API Response Time: {} ms", elapsed_ms);
    let _ = std::io::stderr().flush();

    let json_res: Value = serde_json::from_str(&res_text).map_err(|_| format!("不正なJSON: {}", res_text))?;

    if let Some(err) = json_res.get("error").and_then(|v| v.as_str()) {
        return Err(err.to_string());
    }

    Ok(())
}

// ★ Chordia Relay: 他デバイスの再生情報一覧取得API (getNowPlaying)
#[tauri::command]
pub async fn fetch_relay_devices_from_cloud(
    auth: State<'_, SharedAuthState>,
) -> Result<Value, String> {
    let sid = match get_saved_cloud_sid(&auth).await {
        Some(s) if !s.is_empty() => s,
        _ => return Ok(serde_json::json!([])), // 未ログイン時は空配列
    };

    let payload = serde_json::json!({
        "operation": "getNowPlaying",
        "SID": sid
    });

    let body_json = serde_json::to_string(&payload)
        .map_err(|e| format!("JSON構築エラー: {}", e))?;

    let client = reqwest::Client::builder().timeout(std::time::Duration::from_secs(6)).build().map_err(|e| e.to_string())?;
    let response = client
        .post("https://chordia.bellrin.f5.si/api/")
        .header("X-ACCESS-KEY", "ucbancmuvmczvlxgycbvuwfasdyowwap")
        .header("HTTP_X_ACCESS_KEY", "ucbancmuvmczvlxgycbvuwfasdyowwap")
        .header("Content-Type", "application/json")
        .body(body_json)
        .send()
        .await
        .map_err(|e| format!("通信エラー: {}", e))?;

    let res_text = response.text().await.map_err(|e| format!("レスポンス読み取りエラー: {}", e))?;

    let json_res: Value = serde_json::from_str(&res_text).map_err(|_| format!("不正なJSON: {}", res_text))?;

    if let Some(err) = json_res.get("error").and_then(|v| v.as_str()) {
        return Err(err.to_string());
    }

    // 成功時は response キー内のデバイス配列を返却
    Ok(json_res.get("response").cloned().unwrap_or(serde_json::json!([])))
}

pub fn trigger_background_sync(app_handle: AppHandle, sync_music: bool, sync_playlists: bool) {
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;

        let auth_file_path = get_base_dir().join("userfiles/sync_auth.json");
        let mut is_logged_in = false;
        if auth_file_path.exists() {
            if let Ok(content) = fs::read_to_string(&auth_file_path) {
                if let Ok(json) = serde_json::from_str::<Value>(&content) {
                    is_logged_in = json.get("logged_in").and_then(|v| v.as_bool()).unwrap_or(false);
                }
            }
        }

        if is_logged_in {
            let state = app_handle.state::<AppState>();
            let auth = app_handle.state::<SharedAuthState>();

            if sync_music {
                if let Err(e) = sync_all_local_music_list_to_cloud(state.clone(), auth.clone()).await {
                    eprintln!("[Chordia Sync Background Error] Music list sync failed: {}", e);
                }
            }
            if sync_playlists {
                if let Err(e) = sync_all_local_playlists_to_cloud(state.clone(), auth.clone()).await {
                    eprintln!("[Chordia Sync Background Error] Playlist sync failed: {}", e);
                }
            }
        }
    });
}
use serde_json::Value;
use std::fs;
use chrono::Local;
use tauri::State;

use crate::AppState;
use crate::server::SharedAuthState;
use crate::utils::{get_base_dir, get_asset_url};

#[tauri::command]
pub async fn record_playback(
    song: Value, 
    state: State<'_, AppState>, 
    auth: State<'_, SharedAuthState>
) -> Result<(), String> {
    let filename = song.get("musicFilename")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .split(&['/', '\\'][..])
        .last()
        .unwrap_or("")
        .to_string();

    if filename.is_empty() { 
        return Ok(()); 
    }

    let base = get_base_dir();

    // 1. 再生回数の更新 (played_times.json)
    let pt_path = base.join("userfiles/played_times.json");
    let mut pt: serde_json::Map<String, Value> = fs::read_to_string(&pt_path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();
    let count = pt.get(&filename).and_then(|v| v.as_i64()).unwrap_or(0);
    pt.insert(filename.clone(), (count + 1).into());
    let _ = fs::write(&pt_path, serde_json::to_string_pretty(&pt).unwrap_or_default());

    let title = song.get("title").and_then(|v| v.as_str()).unwrap_or("Unknown").to_string();
    let artist = song.get("artist").and_then(|v| v.as_str()).unwrap_or("Unknown").to_string();
    
    // アルバム名を song から取得（空の場合は DB から自動補完）
    let mut album = song.get("album").and_then(|v| v.as_str()).unwrap_or("").to_string();
    if album.is_empty() {
        let db = state.db.lock().unwrap();
        for s in db.iter() {
            let s_fname = s.get("musicFilename").and_then(|v| v.as_str()).unwrap_or("").split(&['/', '\\'][..]).last().unwrap_or("");
            if s_fname == filename {
                if let Some(al) = s.get("album").and_then(|v| v.as_str()) {
                    album = al.to_string();
                    break;
                }
            }
        }
    }

    let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    // ★ Chordia Sync にログインしているか確認
    let sid_opt = crate::cmd_cloud_sync::auth::get_saved_cloud_sid(&auth).await;

    if let Some(sid) = sid_opt {
        // ★ Chordia Sync 接続中: ローカルには保存せず、API を叩くだけ
        let client = reqwest::Client::builder().timeout(std::time::Duration::from_secs(8)).build();
        if let Ok(c) = client {
            let res = crate::cmd_cloud_sync::send_single_play_history_to_cloud(
                &c, 
                &sid, 
                &title, 
                &artist, 
                &album, 
                Some(&timestamp)
            ).await;

            if let Err(e) = res {
                eprintln!("[Chordia Sync Error] Failed to sync play history: {}", e);
            }
        }
    } else {
        // ★ 未接続の場合のみ: ローカルの history.json へ保存
        let h_path = base.join("userfiles/history.json");
        let mut h: Vec<Value> = fs::read_to_string(&h_path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default();
        
        h.push(serde_json::json!({
            "title": title,
            "artist": artist,
            "album": album,
            "filename": filename,
            "timestamp": timestamp
        }));

        let _ = fs::write(&h_path, serde_json::to_string_pretty(&h).unwrap_or_default());
    }

    Ok(())
}

#[tauri::command]
pub fn get_playback_history(state: State<'_, AppState>) -> Vec<Value> {
    let h_path = get_base_dir().join("userfiles/history.json");
    if let Ok(data) = fs::read_to_string(&h_path) {
        if let Ok(mut history) = serde_json::from_str::<Vec<Value>>(&data) {
            history.reverse();
            let db = state.db.lock().unwrap();
            
            for h in history.iter_mut() {
                let fname = h.get("filename").and_then(|v| v.as_str()).unwrap_or("");
                let mut found_img = "".to_string();
                
                for song in db.iter() {
                    let s_fname = song.get("musicFilename").and_then(|v| v.as_str()).unwrap_or("").split(&['/', '\\'][..]).last().unwrap_or("");
                    if s_fname == fname {
                        found_img = get_asset_url(song.get("imageFilename").and_then(|v| v.as_str()).unwrap_or(""));
                        break;
                    }
                }
                
                if found_img.is_empty() {
                    found_img = get_asset_url("app/icon/Chordia.png");
                }
                
                if let Some(obj) = h.as_object_mut() {
                    obj.insert("imageData".to_string(), Value::String(found_img));
                }
            }
            return history;
        }
    }
    Vec::new()
}
use serde_json::Value;
use tauri::State;
use crate::server::SharedAuthState;
use std::fs;
use std::collections::HashMap;
use chrono::Local;
use crate::utils::{get_base_dir, safe_write_file, check_and_reload_db_if_needed};
use crate::AppState;
use super::auth::{get_saved_cloud_sid, get_system_model_and_os};
use super::api::send_single_work_history_to_cloud;

#[tauri::command]
pub async fn record_work_session(
    time: String,
    seconds: u64,
    auth: State<'_, SharedAuthState>,
) -> Result<(), String> {
    if seconds == 0 {
        return Ok(());
    }

    let base = get_base_dir();
    let w_path = base.join("userfiles/work_history.json");
    let mut w_list: Vec<Value> = fs::read_to_string(&w_path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();

    let end_str = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let (model, _) = get_system_model_and_os();
    let device = if !model.is_empty() { model } else { "Desktop".to_string() };

    // ローカル保存用データ（保存形式はそのまま保持）
    w_list.push(serde_json::json!({
        "time": time,
        "seconds": seconds,
        "device": device,
        "end": end_str
    }));

    let _ = safe_write_file(&w_path, serde_json::to_string_pretty(&w_list).unwrap_or_default().as_bytes());

    // ★ API送信用に作業終了時刻と作業時間を指定フォーマットに変換
    // end: 年(4桁).月(2桁).日(2桁).時(2桁24時間表記).分(2桁)
    let api_end_str = Local::now().format("%Y.%m.%d.%H.%M").to_string();
    
    // time: 時間(2桁):分(2桁):秒(2桁)
    let hours = seconds / 3600;
    let mins = (seconds % 3600) / 60;
    let secs = seconds % 60;
    let api_time_str = format!("{:02}:{:02}:{:02}", hours, mins, secs);

    // Chordia Sync にログインしている場合は API でクラウドに追記
    let sid_opt = get_saved_cloud_sid(&auth).await;
    if let Some(sid) = sid_opt {
        let client = reqwest::Client::builder().timeout(std::time::Duration::from_secs(8)).build();
        if let Ok(c) = client {
            let res = send_single_work_history_to_cloud(&c, &sid, &api_end_str, &api_time_str).await;
            if let Err(e) = res {
                eprintln!("[Chordia Sync Error] Failed to sync work session: {}", e);
            }
        }
    }

    Ok(())
}

#[tauri::command]
pub fn get_local_work_history() -> Value {
    let w_path = get_base_dir().join("userfiles/work_history.json");
    if let Ok(data) = fs::read_to_string(&w_path) {
        if let Ok(mut list) = serde_json::from_str::<Vec<Value>>(&data) {
            list.reverse();
            return Value::Array(list);
        }
    }
    Value::Array(Vec::new())
}

#[tauri::command]
pub fn get_local_play_statistics(state: State<'_, AppState>) -> Value {
    check_and_reload_db_if_needed(&state);

    let h_path = get_base_dir().join("userfiles/history.json");
    let mut history_list = Vec::new();
    if let Ok(data) = fs::read_to_string(&h_path) {
        if let Ok(mut h) = serde_json::from_str::<Vec<Value>>(&data) {
            h.reverse();
            let db = state.db.lock().unwrap();

            for item in h.iter_mut() {
                if let Some(obj) = item.as_object_mut() {
                    let current_album = obj.get("album").and_then(|v| v.as_str()).unwrap_or("");
                    if current_album.is_empty() {
                        let fname = obj.get("filename").and_then(|v| v.as_str()).unwrap_or("");
                        let title = obj.get("title").and_then(|v| v.as_str()).unwrap_or("");
                        let artist = obj.get("artist").and_then(|v| v.as_str()).unwrap_or("");
                        for song in db.iter() {
                            let s_fname = song.get("musicFilename").and_then(|v| v.as_str()).unwrap_or("").split(&['/', '\\'][..]).last().unwrap_or("");
                            let s_title = song.get("title").and_then(|v| v.as_str()).unwrap_or("");
                            let s_artist = song.get("artist").and_then(|v| v.as_str()).unwrap_or("");
                            if (!fname.is_empty() && s_fname == fname) || (s_title == title && s_artist == artist) {
                                if let Some(al) = song.get("album").and_then(|v| v.as_str()) {
                                    if !al.is_empty() {
                                        obj.insert("album".to_string(), Value::String(al.to_string()));
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
            }

            history_list = h;
        }
    }

    let mut play_counts: HashMap<String, (String, String, usize)> = HashMap::new();
    for item in &history_list {
        let title = item.get("title").and_then(|v| v.as_str()).unwrap_or("Unknown").to_string();
        let artist = item.get("artist").and_then(|v| v.as_str()).unwrap_or("Unknown").to_string();
        let key = format!("{}___{}", title, artist);
        let entry = play_counts.entry(key).or_insert((title, artist, 0));
        entry.2 += 1;
    }

    let mut ranking: Vec<(String, String, usize)> = play_counts.into_values().collect();
    ranking.sort_by(|a, b| b.2.cmp(&a.2));
    let top5: Vec<Value> = ranking.into_iter().take(5).map(|(t, a, count)| {
        serde_json::json!({
            "title": t,
            "artist": a,
            "count": count
        })
    }).collect();

    serde_json::json!({
        "ranking": top5,
        "history": history_list
    })
}
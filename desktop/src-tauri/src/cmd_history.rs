use serde_json::Value;
use std::fs;
use chrono::Local;
use tauri::State;

use crate::AppState;
use crate::utils::{get_base_dir, get_asset_url};

#[tauri::command]
pub fn record_playback(song: Value) {
    let filename = song.get("musicFilename").and_then(|v| v.as_str()).unwrap_or("").split(&['/', '\\'][..]).last().unwrap_or("").to_string();
    if filename.is_empty() { return; }
    let base = get_base_dir();
    let pt_path = base.join("userfiles/played_times.json");
    let mut pt: serde_json::Map<String, Value> = fs::read_to_string(&pt_path).ok().and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default();
    let count = pt.get(&filename).and_then(|v| v.as_i64()).unwrap_or(0);
    pt.insert(filename.clone(), (count + 1).into());
    let _ = fs::write(&pt_path, serde_json::to_string_pretty(&pt).unwrap_or_default());
    let h_path = base.join("userfiles/history.json");
    let mut h: Vec<Value> = fs::read_to_string(&h_path).ok().and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default();
    h.push(serde_json::json!({"title": song.get("title"), "artist": song.get("artist"), "filename": filename, "timestamp": Local::now().format("%Y-%m-%d %H:%M:%S").to_string()}));
    if h.len() > 1000 { h.remove(0); }
    let _ = fs::write(&h_path, serde_json::to_string_pretty(&h).unwrap_or_default());
}

// ★ 修正: DBと突き合わせてアートワークURLを付与する
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
                    found_img = get_asset_url("library/images/default.png");
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
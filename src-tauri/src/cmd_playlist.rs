use serde_json::Value;
use std::path::Path;
use std::fs;
use rand::{rng, Rng};
use rand::distr::Alphanumeric;
use std::collections::HashSet;
use tauri::State;

use crate::AppState;
use crate::utils::*;

#[tauri::command]
pub fn get_playlist_summaries(state: State<'_, AppState>) -> Vec<Value> {
    state.playlists.lock().unwrap().clone()
}

#[tauri::command]
pub fn get_playlist_details(pl_id: String, state: State<'_, AppState>) -> Option<Value> {
    let playlists = state.playlists.lock().unwrap();
    let mut pl = playlists.iter().find(|p| p.get("id").and_then(|v| v.as_str()) == Some(&pl_id))?.clone();
    
    let db = state.db.lock().unwrap();
    let mut songs = Vec::new();
    let mut music_list = Vec::new();

    if pl.get("type").and_then(|v| v.as_str()) == Some("smart") {
        if let Some(conds) = pl.get("conditions") {
            for song in db.iter() {
                if evaluate_smart_rules(song, conds) {
                    songs.push(song.clone());
                    if let Some(fname) = song.get("musicFilename").and_then(|v| v.as_str()) {
                        let base_name = Path::new(fname).file_name().unwrap_or_default().to_str().unwrap_or("");
                        music_list.push(Value::String(base_name.to_string()));
                    }
                }
            }
        }
    } else {
        let base = get_base_dir();
        let path = base.join(format!("userfiles/playlist/{}.json", pl_id));
        if path.exists() {
            if let Ok(data) = fs::read_to_string(&path) {
                if let Ok(list) = serde_json::from_str::<Vec<String>>(&data) {
                    for fname in &list {
                        if let Some(song) = db.iter().find(|s| {
                            Path::new(s.get("musicFilename").and_then(|v| v.as_str()).unwrap_or("")).file_name().unwrap_or_default().to_str().unwrap_or("") == fname
                        }) {
                            songs.push(song.clone());
                            music_list.push(Value::String(fname.to_string()));
                        }
                    }
                }
            }
        }
    }

    if let Some(obj) = pl.as_object_mut() {
        obj.insert("songs".to_string(), Value::Array(songs.into_iter().map(Value::Object).collect()));
        obj.insert("music".to_string(), Value::Array(music_list));
    }
    Some(pl)
}

#[tauri::command]
pub fn get_album_list(state: State<'_, AppState>) -> Vec<String> {
    let db = state.db.lock().unwrap();
    let mut list = HashSet::new();
    for item in db.iter() {
        if let Some(al) = item.get("album").and_then(|v| v.as_str()) {
            if !al.trim().is_empty() { list.insert(al.trim().to_string()); }
        }
    }
    let mut vec: Vec<_> = list.into_iter().collect();
    vec.sort();
    vec
}

#[tauri::command]
pub fn get_artist_list(state: State<'_, AppState>) -> Vec<String> {
    let db = state.db.lock().unwrap();
    let mut list = HashSet::new();
    for item in db.iter() {
        if let Some(ar) = item.get("artist").and_then(|v| v.as_str()) {
            if !ar.trim().is_empty() { list.insert(ar.trim().to_string()); }
        }
    }
    let mut vec: Vec<_> = list.into_iter().collect();
    vec.sort();
    vec
}

#[tauri::command]
pub fn get_virtual_playlist_details(field: String, value: String, state: State<'_, AppState>) -> Value {
    let db = state.db.lock().unwrap();
    let mut songs = Vec::new();
    let mut music_list = Vec::new();
    for song in db.iter() {
        if song.get(&field).and_then(|v| v.as_str()) == Some(&value) {
            songs.push(song.clone());
            if let Some(fname) = song.get("musicFilename").and_then(|v| v.as_str()) {
                music_list.push(Value::String(Path::new(fname).file_name().unwrap_or_default().to_str().unwrap_or("").to_string()));
            }
        }
    }
    serde_json::json!({
        "id": format!("virtual_{}_{}", field, value),
        "playlistName": value,
        "type": "virtual",
        "sortBy": "title",
        "sortDesc": false,
        "songs": songs,
        "music": music_list
    })
}

#[tauri::command]
pub fn create_playlist(name: String, pl_type: String, state: State<'_, AppState>) -> Option<Value> {
    let id: String = rng().sample_iter(&Alphanumeric).take(32).map(char::from).collect();
    let mut new_pl = serde_json::json!({
        "id": id,
        "playlistName": name,
        "type": pl_type,
        "sortBy": "title",
        "sortDesc": false
    });
    
    if pl_type == "smart" {
        new_pl.as_object_mut()?.insert("conditions".to_string(), Value::Array(Vec::new()));
    } else {
        let base = get_base_dir();
        let _ = fs::create_dir_all(base.join("userfiles/playlist"));
        let _ = fs::write(base.join(format!("userfiles/playlist/{}.json", id)), "[]");
    }

    let mut master = state.playlists.lock().unwrap();
    master.push(new_pl);
    save_playlists_master(&master);
    Some(master.last().unwrap().clone())
}

#[tauri::command]
pub fn update_playlist_by_id(pl_id: String, field: String, value: Value, state: State<'_, AppState>) -> Option<Value> {
    let mut result_pl = None;
    let mut needs_save = false;

    {
        let mut master = state.playlists.lock().unwrap();
        if let Some(pl) = master.iter_mut().find(|p| p.get("id").and_then(|v| v.as_str()) == Some(&pl_id)) {
            if field == "music" && pl.get("type").and_then(|v| v.as_str()) != Some("smart") {
                let base = get_base_dir();
                let _ = fs::create_dir_all(base.join("userfiles/playlist"));
                let _ = fs::write(base.join(format!("userfiles/playlist/{}.json", pl_id)), serde_json::to_string_pretty(&value).unwrap_or_default());
            } else {
                if let Some(obj) = pl.as_object_mut() {
                    obj.insert(field, value);
                }
                needs_save = true;
            }
            result_pl = Some(pl.clone());
        }
        
        if needs_save {
            save_playlists_master(&master);
        }
    }
    
    result_pl
}

#[tauri::command]
pub fn delete_playlist_by_id(pl_id: String, state: State<'_, AppState>) -> bool {
    let mut master = state.playlists.lock().unwrap();
    if let Some(pos) = master.iter().position(|p| p.get("id").and_then(|v| v.as_str()) == Some(&pl_id)) {
        master.remove(pos);
        save_playlists_master(&master);
        let path = get_base_dir().join(format!("userfiles/playlist/{}.json", pl_id));
        if path.exists() { let _ = fs::remove_file(path); }
        return true;
    }
    false
}

#[tauri::command]
pub fn duplicate_playlist_by_id(pl_id: String, state: State<'_, AppState>) -> Option<Value> {
    let mut new_pl_result = None;
    
    {
        let mut master = state.playlists.lock().unwrap();
        let src_pl = master.iter().find(|p| p.get("id").and_then(|v| v.as_str()) == Some(&pl_id)).cloned();
        
        if let Some(src_pl) = src_pl {
            let new_id: String = rng().sample_iter(&Alphanumeric).take(32).map(char::from).collect();
            let mut new_pl = src_pl.clone();
            
            if let Some(obj) = new_pl.as_object_mut() {
                obj.insert("id".to_string(), Value::String(new_id.clone()));
                let old_name = obj.get("playlistName").and_then(|v| v.as_str()).unwrap_or("Untitled");
                obj.insert("playlistName".to_string(), Value::String(format!("{} - コピー", old_name)));
            }
            
            if src_pl.get("type").and_then(|v| v.as_str()) != Some("smart") {
                let base = get_base_dir();
                let src_path = base.join(format!("userfiles/playlist/{}.json", pl_id));
                let dst_path = base.join(format!("userfiles/playlist/{}.json", new_id));
                if src_path.exists() { let _ = fs::copy(src_path, dst_path); }
                else { let _ = fs::write(dst_path, "[]"); }
            }
            
            master.push(new_pl.clone());
            save_playlists_master(&master);
            new_pl_result = Some(new_pl);
        }
    }
    
    new_pl_result
}

#[tauri::command]
pub fn add_songs_to_playlist(pl_id: String, filenames: Vec<String>, state: State<'_, AppState>) -> Option<Value> {
    let master = state.playlists.lock().unwrap();
    let pl = master.iter().find(|p| p.get("id").and_then(|v| v.as_str()) == Some(&pl_id))?;
    if pl.get("type").and_then(|v| v.as_str()) == Some("smart") { return None; }
    
    let path = get_base_dir().join(format!("userfiles/playlist/{}.json", pl_id));
    let mut current: Vec<String> = if path.exists() {
        serde_json::from_str(&fs::read_to_string(&path).unwrap_or_default()).unwrap_or_default()
    } else { Vec::new() };
    
    for f in filenames { if !current.contains(&f) { current.push(f); } }
    let _ = fs::write(path, serde_json::to_string_pretty(&current).unwrap_or_default());
    
    Some(pl.clone())
}

#[tauri::command]
pub fn remove_songs_from_playlist(pl_id: String, filenames: Vec<String>, state: State<'_, AppState>) -> Option<Value> {
    let master = state.playlists.lock().unwrap();
    let pl = master.iter().find(|p| p.get("id").and_then(|v| v.as_str()) == Some(&pl_id))?;
    if pl.get("type").and_then(|v| v.as_str()) == Some("smart") { return None; }
    
    let path = get_base_dir().join(format!("userfiles/playlist/{}.json", pl_id));
    if path.exists() {
        let mut current: Vec<String> = serde_json::from_str(&fs::read_to_string(&path).unwrap_or_default()).unwrap_or_default();
        current.retain(|f| !filenames.contains(f));
        let _ = fs::write(path, serde_json::to_string_pretty(&current).unwrap_or_default());
    }
    Some(pl.clone())
}

#[tauri::command]
pub fn create_smart_playlist(name: String, conditions: Value, state: State<'_, AppState>) -> Option<Value> {
    let id: String = rng().sample_iter(&Alphanumeric).take(32).map(char::from).collect();
    let new_pl = serde_json::json!({
        "id": id,
        "playlistName": name,
        "type": "smart",
        "sortBy": "title",
        "sortDesc": false,
        "conditions": conditions
    });
    let mut master = state.playlists.lock().unwrap();
    master.push(new_pl);
    save_playlists_master(&master);
    Some(master.last().unwrap().clone())
}

#[tauri::command]
pub fn update_smart_playlist(pl_id: String, name: String, conditions: Value, state: State<'_, AppState>) -> Option<Value> {
    let mut result_pl = None;
    {
        let mut master = state.playlists.lock().unwrap();
        if let Some(pl) = master.iter_mut().find(|p| p.get("id").and_then(|v| v.as_str()) == Some(&pl_id)) {
            if let Some(obj) = pl.as_object_mut() {
                obj.insert("playlistName".to_string(), Value::String(name));
                obj.insert("conditions".to_string(), conditions);
            }
            result_pl = Some(pl.clone());
        }
        if result_pl.is_some() {
            save_playlists_master(&master);
        }
    }
    result_pl
}

#[tauri::command]
pub fn convert_smart_to_normal_and_remove_songs(pl_id: String, filenames: Vec<String>, state: State<'_, AppState>) -> Option<Value> {
    let mut current_music = Vec::new();
    let mut pl_clone = None;
    
    {
        let mut master = state.playlists.lock().unwrap();
        
        // 条件を取得して合致する曲を抽出（mutable borrow の回避）
        let mut conditions_opt = None;
        if let Some(pl) = master.iter().find(|p| p.get("id").and_then(|v| v.as_str()) == Some(&pl_id)) {
            conditions_opt = pl.get("conditions").cloned();
        }

        if let Some(conds) = conditions_opt {
            let db = state.db.lock().unwrap();
            for song in db.iter() {
                if evaluate_smart_rules(song, &conds) {
                    if let Some(fname) = song.get("musicFilename").and_then(|v| v.as_str()) {
                        current_music.push(Path::new(fname).file_name().unwrap_or_default().to_str().unwrap_or("").to_string());
                    }
                }
            }
        }
        
        // プレイリスト自体を更新
        if let Some(pl) = master.iter_mut().find(|p| p.get("id").and_then(|v| v.as_str()) == Some(&pl_id)) {
            if let Some(obj) = pl.as_object_mut() {
                obj.insert("type".to_string(), Value::String("normal".to_string()));
                obj.remove("conditions");
            }
            pl_clone = Some(pl.clone());
        }

        if pl_clone.is_some() {
            save_playlists_master(&master);
        }
    }
    
    if pl_clone.is_some() {
        current_music.retain(|f| !filenames.contains(f));
        let base = get_base_dir();
        let _ = fs::create_dir_all(base.join("userfiles/playlist"));
        let _ = fs::write(base.join(format!("userfiles/playlist/{}.json", pl_id)), serde_json::to_string_pretty(&current_music).unwrap_or_default());
        return pl_clone;
    }
    None
}
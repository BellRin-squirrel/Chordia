use serde_json::Value;
use std::path::Path;
use std::fs;
use rand::{rng, Rng};
use rand::distr::Alphanumeric;
use std::collections::HashSet;
use tauri::State;
use base64::{Engine as _, engine::general_purpose};

use crate::AppState;
use crate::utils::*;

fn load_playlist_covers() -> serde_json::Map<String, Value> {
    let path = get_base_dir().join("userfiles/playlist_covers.json");
    if !path.exists() { return serde_json::Map::new(); }
    fs::read_to_string(&path)
        .ok()
        .and_then(|d| serde_json::from_str(&d).ok())
        .unwrap_or_default()
}

fn save_playlist_covers(covers: &serde_json::Map<String, Value>) {
    let path = get_base_dir().join("userfiles/playlist_covers.json");
    if let Ok(data) = serde_json::to_string_pretty(covers) {
        let _ = safe_write_file(&path, data.as_bytes());
    }
}

#[tauri::command]
pub fn get_playlist_cover(pl_id: String, first_song_image: Option<String>) -> Result<String, String> {
    let mut covers = load_playlist_covers();
    if let Some(path) = covers.get(&pl_id).and_then(|v| v.as_str()) {
        if !path.is_empty() {
            let asset_url = get_asset_url(path);
            if !asset_url.is_empty() {
                return Ok(asset_url);
            }
        }
    }

    let target_path = if let Some(ref img) = first_song_image {
        if !img.is_empty() {
            img.clone()
        } else {
            "app/icon/Chordia.png".to_string()
        }
    } else {
        "app/icon/Chordia.png".to_string()
    };

    covers.insert(pl_id, Value::String(target_path.clone()));
    save_playlist_covers(&covers);

    let url = get_asset_url(&target_path);
    if url.is_empty() {
        Ok("icon/Chordia.png".to_string())
    } else {
        Ok(url)
    }
}

#[tauri::command]
pub fn save_playlist_cover_image(pl_id: String, b64_data: String) -> Result<String, String> {
    let base = get_base_dir();
    let f_id: String = rng().sample_iter(&Alphanumeric).take(32).map(char::from).collect();
    let rel_path = format!("library/cover_image/{}.png", f_id);

    let b64_clean = if b64_data.contains(',') { b64_data.split(',').nth(1).unwrap() } else { &b64_data };
    let bytes = general_purpose::STANDARD.decode(b64_clean).map_err(|e| e.to_string())?;

    if force_save_as_png(&bytes, &base.join(&rel_path)) {
        let mut covers = load_playlist_covers();
        covers.insert(pl_id, Value::String(rel_path.clone()));
        save_playlist_covers(&covers);

        Ok(get_asset_url(&rel_path))
    } else {
        Err("画像の保存に失敗しました".to_string())
    }
}

#[tauri::command]
pub fn set_playlist_cover_from_song(pl_id: String, song_image_path: String) -> Result<String, String> {
    let mut covers = load_playlist_covers();
    covers.insert(pl_id, Value::String(song_image_path.clone()));
    save_playlist_covers(&covers);

    Ok(get_asset_url(&song_image_path))
}

#[tauri::command]
pub fn get_playlist_summaries(state: State<'_, AppState>) -> Vec<Value> {
    state.playlists.lock().unwrap().clone()
}

#[tauri::command]
pub fn get_playlist_details(pl_id: String, state: State<'_, AppState>) -> Option<Value> {
    let playlists = state.playlists.lock().unwrap();
    let mut pl = match playlists.iter().find(|p| p.get("id").and_then(|v| v.as_str()) == Some(&pl_id)) {
        Some(p) => p.clone(),
        None => return None,
    };
    
    let db = state.db.lock().unwrap();
    let mut songs = Vec::new();
    let mut music_list = Vec::new();

    if pl.get("type").and_then(|v| v.as_str()) == Some("smart") {
        if let Some(conds) = pl.get("conditions") {
            for song in db.iter() {
                if evaluate_smart_rules(song, conds) {
                    songs.push(song.clone());
                    if let Some(fname) = song.get("musicFilename").and_then(|v| v.as_str()) {
                        music_list.push(Value::String(normalize_rel_path(fname)));
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
                    for fname_or_path in &list {
                        let norm_target = normalize_rel_path(fname_or_path);
                        
                        if let Some(song) = db.iter().find(|s| {
                            let db_path = s.get("musicFilename").and_then(|v| v.as_str()).unwrap_or("");
                            let db_norm = normalize_rel_path(db_path);
                            let db_fname = Path::new(db_path).file_name().unwrap_or_default().to_str().unwrap_or("");
                            db_norm == norm_target || db_path == norm_target || db_fname == norm_target
                        }) {
                            songs.push(song.clone());
                            music_list.push(Value::String(norm_target.clone()));
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
                music_list.push(Value::String(normalize_rel_path(fname)));
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
    
    let base = get_base_dir();
    let target_file = base.join(format!("userfiles/playlist/{}.json", id));

    if pl_type == "smart" {
        if let Some(obj) = new_pl.as_object_mut() {
            obj.insert("conditions".to_string(), Value::Array(Vec::new()));
        }
    } else {
        let _ = safe_write_file(&target_file, b"[]");
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
                let target_path = get_base_dir().join(format!("userfiles/playlist/{}.json", pl_id));
                let data = serde_json::to_string_pretty(&value).unwrap_or_default();
                let _ = safe_write_file(&target_path, data.as_bytes());
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
        
        let mut covers = load_playlist_covers();
        covers.remove(&pl_id);
        save_playlist_covers(&covers);

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
            
            let settings = crate::cmd_settings::get_app_settings();
            let copy_suffix = if settings.language == "Japanese.ini" { " - コピー" } else { " - Copy" };

            if let Some(obj) = new_pl.as_object_mut() {
                obj.insert("id".to_string(), Value::String(new_id.clone()));
                let old_name = obj.get("playlistName").and_then(|v| v.as_str()).unwrap_or("Untitled");
                obj.insert("playlistName".to_string(), Value::String(format!("{}{}", old_name, copy_suffix)));
            }
            
            if src_pl.get("type").and_then(|v| v.as_str()) != Some("smart") {
                let base = get_base_dir();
                let src_path = base.join(format!("userfiles/playlist/{}.json", pl_id));
                let dst_path = base.join(format!("userfiles/playlist/{}.json", new_id));
                
                let content = if src_path.exists() {
                    fs::read_to_string(&src_path).unwrap_or_else(|_| "[]".to_string())
                } else {
                    "[]".to_string()
                };
                let _ = safe_write_file(&dst_path, content.as_bytes());
            }
            
            master.push(new_pl.clone());
            save_playlists_master(&master);

            let mut covers = load_playlist_covers();
            if let Some(cover_path) = covers.get(&pl_id).cloned() {
                covers.insert(new_id, cover_path);
                save_playlist_covers(&covers);
            }

            new_pl_result = Some(new_pl);
        }
    }
    
    new_pl_result
}

#[tauri::command]
pub fn add_songs_to_playlist(pl_id: String, filenames: Vec<String>, state: State<'_, AppState>) -> Result<Value, String> {
    let master = state.playlists.lock().unwrap();
    let pl = master.iter().find(|p| p.get("id").and_then(|v| v.as_str()) == Some(&pl_id))
        .ok_or_else(|| format!("プレイリストが見つかりません: ID={}", pl_id))?;
    
    if pl.get("type").and_then(|v| v.as_str()) == Some("smart") {
        return Err("スマートプレイリストには直接追加できません".to_string());
    }
    
    if filenames.is_empty() {
        return Err("追加対象の楽曲がありません".to_string());
    }

    let path = get_base_dir().join(format!("userfiles/playlist/{}.json", pl_id));

    let mut current: Vec<String> = if path.exists() {
        match fs::read_to_string(&path) {
            Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
            Err(_) => Vec::new()
        }
    } else {
        Vec::new()
    };
    
    for f in filenames { 
        let norm = normalize_rel_path(&f);
        if !norm.is_empty() && !current.contains(&norm) { 
            current.push(norm); 
        } 
    }

    let data = serde_json::to_string_pretty(&current).map_err(|e| e.to_string())?;
    safe_write_file(&path, data.as_bytes())?;

    Ok(pl.clone())
}

#[tauri::command]
pub fn remove_songs_from_playlist(pl_id: String, filenames: Vec<String>, state: State<'_, AppState>) -> Result<Value, String> {
    let master = state.playlists.lock().unwrap();
    let pl = master.iter().find(|p| p.get("id").and_then(|v| v.as_str()) == Some(&pl_id))
        .ok_or_else(|| format!("プレイリストが見つかりません: ID={}", pl_id))?;
    
    if pl.get("type").and_then(|v| v.as_str()) == Some("smart") {
        return Err("スマートプレイリストから直接削除できません".to_string());
    }
    
    let path = get_base_dir().join(format!("userfiles/playlist/{}.json", pl_id));
    if path.exists() {
        let mut current: Vec<String> = serde_json::from_str(&fs::read_to_string(&path).unwrap_or_default()).unwrap_or_default();
        let norms: Vec<String> = filenames.into_iter().map(|f| normalize_rel_path(&f)).collect();
        current.retain(|f| !norms.contains(&normalize_rel_path(f)));
        let data = serde_json::to_string_pretty(&current).map_err(|e| e.to_string())?;
        safe_write_file(&path, data.as_bytes())?;
    }
    Ok(pl.clone())
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
        let mut conditions_opt = None;
        if let Some(pl) = master.iter().find(|p| p.get("id").and_then(|v| v.as_str()) == Some(&pl_id)) {
            conditions_opt = pl.get("conditions").cloned();
        }

        if let Some(conds) = conditions_opt {
            let db = state.db.lock().unwrap();
            for song in db.iter() {
                if evaluate_smart_rules(song, &conds) {
                    if let Some(fname) = song.get("musicFilename").and_then(|v| v.as_str()) {
                        current_music.push(normalize_rel_path(fname));
                    }
                }
            }
        }
        
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
        let norms: Vec<String> = filenames.into_iter().map(|f| normalize_rel_path(&f)).collect();
        current_music.retain(|f| !norms.contains(&normalize_rel_path(f)));
        
        let path = get_base_dir().join(format!("userfiles/playlist/{}.json", pl_id));
        let _ = safe_write_file(&path, serde_json::to_string_pretty(&current_music).unwrap_or_default().as_bytes());
        return pl_clone;
    }
    None
}

#[tauri::command]
pub fn convert_smart_to_normal_and_add_songs(pl_id: String, filenames: Vec<String>, state: State<'_, AppState>) -> Option<Value> {
    let mut current_music = Vec::new();
    let mut pl_clone = None;
    
    {
        let mut master = state.playlists.lock().unwrap();
        let mut conditions_opt = None;
        if let Some(pl) = master.iter().find(|p| p.get("id").and_then(|v| v.as_str()) == Some(&pl_id)) {
            conditions_opt = pl.get("conditions").cloned();
        }

        if let Some(conds) = conditions_opt {
            let db = state.db.lock().unwrap();
            for song in db.iter() {
                if evaluate_smart_rules(song, &conds) {
                    if let Some(fname) = song.get("musicFilename").and_then(|v| v.as_str()) {
                        current_music.push(normalize_rel_path(fname));
                    }
                }
            }
        }
        
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
        for f in filenames {
            let norm = normalize_rel_path(&f);
            if !current_music.contains(&norm) {
                current_music.push(norm);
            }
        }
        let path = get_base_dir().join(format!("userfiles/playlist/{}.json", pl_id));
        let _ = safe_write_file(&path, serde_json::to_string_pretty(&current_music).unwrap_or_default().as_bytes());
        return pl_clone;
    }
    None
}
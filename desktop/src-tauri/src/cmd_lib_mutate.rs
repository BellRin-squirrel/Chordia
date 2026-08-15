use serde_json::Value;
use std::fs;
use rand::{rng, Rng};
use rand::distr::Alphanumeric;
use base64::{Engine as _, engine::general_purpose};
use tauri::State;

use crate::AppState;
use crate::utils::{get_base_dir, normalize_rel_path, get_asset_url, force_save_as_png, save_db, save_lufs_cache, update_mp3_tags_from_song_map};

#[tauri::command]
pub fn update_song_by_id(music_filename: String, field: String, value: String, state: State<'_, AppState>) -> bool {
    let mut db = state.db.lock().unwrap();
    if let Some(i) = db.iter_mut().find(|i| i.get("musicFilename").and_then(|v| v.as_str()) == Some(&music_filename)) {
        if field == "lyric" {
            let clean_val = value.replace("\r\n", "\n").replace("\r", "\n");
            i.insert(field, clean_val.into());
        } else {
            i.insert(field, value.into()); 
        }

        update_mp3_tags_from_song_map(i);
        save_db(&db).is_ok()
    } else { false }
}

#[tauri::command]
pub fn update_song_artwork_by_id(music_filename: String, new_art_base64: Option<String>, remove: bool, state: State<'_, AppState>) -> bool {
    let mut db = state.db.lock().unwrap();
    if let Some(target) = db.iter_mut().find(|i| i.get("musicFilename").and_then(|v| v.as_str()) == Some(&music_filename)) {
        if let Some(old) = target.get("imageFilename").and_then(|v| v.as_str()) { 
            if !old.contains("Chordia.png") && !old.contains("default.png") { 
                let _ = fs::remove_file(get_base_dir().join(normalize_rel_path(old))); 
            } 
        }
        if remove {
            target.insert("imageFilename".into(), "app/icon/Chordia.png".into());
            target.insert("imageData".into(), get_asset_url("app/icon/Chordia.png").into());
        }
        else if let Some(b64) = new_art_base64 {
            let f_id: String = rng().sample_iter(&Alphanumeric).take(32).map(char::from).collect();
            let path = format!("library/images/{}.png", f_id);
            let b64c = if b64.contains(',') { b64.split(',').nth(1).unwrap() } else { &b64 };
            if let Ok(bytes) = general_purpose::STANDARD.decode(b64c) {
                if force_save_as_png(&bytes, &get_base_dir().join(&path)) { 
                    target.insert("imageFilename".into(), path.clone().into());
                    target.insert("imageData".into(), get_asset_url(&path).into());
                } else { return false; }
            } else { return false; }
        }

        update_mp3_tags_from_song_map(target);
        save_db(&db).is_ok()
    } else { false }
}

#[tauri::command]
pub fn delete_song_by_id(music_filename: String, state: State<'_, AppState>) -> bool {
    let mut db = state.db.lock().unwrap();
    if let Some(pos) = db.iter().position(|i| i.get("musicFilename").and_then(|v| v.as_str()) == Some(&music_filename)) {
        let i = db.remove(pos);
        if let Some(p) = i.get("musicFilename").and_then(|v| v.as_str()) { 
            let _ = fs::remove_file(get_base_dir().join(normalize_rel_path(p))); 
            let mut cache = state.lufs_cache.lock().unwrap();
            cache.remove(p);
            save_lufs_cache(&cache);
        }
        if let Some(p) = i.get("imageFilename").and_then(|v| v.as_str()) {
            if !p.contains("Chordia.png") && !p.contains("default.png") {
                let _ = fs::remove_file(get_base_dir().join(normalize_rel_path(p)));
            }
        }
        save_db(&db).is_ok()
    } else { false }
}

#[tauri::command]
pub fn update_multiple_songs(filenames: Vec<String>, updates: serde_json::Map<String, Value>, state: State<'_, AppState>) -> Value {
    let mut db = state.db.lock().unwrap();
    let mut count = 0;
    
    let mut artwork_b64 = None;
    let mut up_map = updates.clone();
    if let Some(art) = up_map.remove("artworkBase64") {
        if art.as_str() != Some("< 維持 >") {
            artwork_b64 = art.as_str().map(|s| s.to_string());
        }
    }
    
    let up: Vec<_> = up_map.into_iter().filter(|(_, v)| v.as_str() != Some("< 維持 >")).collect();
    let base = get_base_dir();
    
    for i in db.iter_mut() {
        let file_name_only = i.get("musicFilename").and_then(|v| v.as_str()).unwrap_or("").split(&['/', '\\'][..]).last().unwrap_or("");
        if filenames.contains(&file_name_only.to_string()) {
            for (k, v) in &up {
                if k == "lyric" {
                    let clean_val = v.as_str().unwrap_or("").replace("\r\n", "\n").replace("\r", "\n");
                    i.insert(k.clone(), Value::String(clean_val));
                } else {
                    i.insert(k.clone(), v.clone());
                }
            }
            
            if let Some(ref b64) = artwork_b64 {
                if let Some(old) = i.get("imageFilename").and_then(|v| v.as_str()) {
                    if !old.contains("Chordia.png") && !old.contains("default.png") {
                        let _ = fs::remove_file(base.join(normalize_rel_path(old)));
                    }
                }
                
                if b64 == "REMOVE" {
                    i.insert("imageFilename".into(), "app/icon/Chordia.png".into());
                    i.insert("imageData".into(), get_asset_url("app/icon/Chordia.png").into());
                } else {
                    let f_id: String = rng().sample_iter(&Alphanumeric).take(32).map(char::from).collect();
                    let path = format!("library/images/{}.png", f_id);
                    let b64c = if b64.contains(',') { b64.split(',').nth(1).unwrap() } else { b64 };
                    if let Ok(bytes) = general_purpose::STANDARD.decode(b64c) {
                        if force_save_as_png(&bytes, &base.join(&path)) { 
                            i.insert("imageFilename".into(), path.clone().into());
                            i.insert("imageData".into(), get_asset_url(&path).into());
                        }
                    }
                }
            }

            update_mp3_tags_from_song_map(i);
            count += 1;
        }
    }
    if count > 0 { let _ = save_db(&db); }
    serde_json::json!({"success": true, "count": count})
}

#[tauri::command]
pub fn delete_multiple_songs(filenames: Vec<String>, state: State<'_, AppState>) -> Value {
    let mut db = state.db.lock().unwrap();
    let mut count = 0;
    let mut removed_paths = Vec::new();

    db.retain(|i| {
        if filenames.contains(&i.get("musicFilename").and_then(|v| v.as_str()).unwrap_or("").split(&['/', '\\'][..]).last().unwrap_or("").into()) {
            if let Some(p) = i.get("musicFilename").and_then(|v| v.as_str()) { 
                let _ = fs::remove_file(get_base_dir().join(normalize_rel_path(p))); 
                removed_paths.push(p.to_string());
            }
            if let Some(p) = i.get("imageFilename").and_then(|v| v.as_str()) {
                if !p.contains("Chordia.png") && !p.contains("default.png") {
                    let _ = fs::remove_file(get_base_dir().join(normalize_rel_path(p)));
                }
            }
            count += 1; false
        } else { true }
    });

    if count > 0 { 
        let _ = save_db(&db); 
        let mut cache = state.lufs_cache.lock().unwrap();
        for p in removed_paths {
            cache.remove(&p);
        }
        save_lufs_cache(&cache);
    }
    serde_json::json!({"success": true, "count": count})
}
use serde_json::Value;
use std::fs;
use rand::{rng, Rng};
use rand::distr::Alphanumeric;
use base64::{Engine as _, engine::general_purpose};
use tauri::{State, AppHandle, Emitter};
use std::io::{Cursor, Read};
use id3::TagLike;

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use tokio::sync::Semaphore;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use crate::AppState;
use crate::utils::*;

#[tauri::command]
pub fn get_song_lufs(filename: String, state: State<'_, AppState>) -> Option<f32> {
    let cache = state.lufs_cache.lock().unwrap();
    cache.get(&filename).copied()
}

#[tauri::command]
pub async fn start_lufs_calculation_all(state: State<'_, AppState>, app: AppHandle) -> Result<(), String> {
    let mut targets_to_calc = Vec::new();

    {
        let db = state.db.lock().unwrap();
        let cache = state.lufs_cache.lock().unwrap();
        for song in db.iter() {
            if let Some(rel_path) = song.get("musicFilename").and_then(|v| v.as_str()) {
                if !cache.contains_key(rel_path) {
                    let title = song.get("title").and_then(|v| v.as_str()).unwrap_or("Unknown").to_string();
                    targets_to_calc.push((rel_path.to_string(), title));
                }
            }
        }
    }

    let total = targets_to_calc.len();
    if total == 0 {
        let _ = app.emit("lufs_calc_progress", serde_json::json!({
            "current": 0, "total": 0, "message": "すべての楽曲の音量解析は完了しています"
        }));
        return Ok(());
    }

    let base_dir = get_base_dir();
    let ext = if cfg!(target_os = "windows") { ".exe" } else { "" };
    let ffmpeg_path = base_dir.join(format!("userfiles/bin/ffmpeg{}", ext));

    if !ffmpeg_path.exists() {
        return Err("FFmpegが見つかりません。".to_string());
    }

    let semaphore = Arc::new(Semaphore::new(4));
    let mut handles = Vec::new();
    let current_counter = Arc::new(AtomicUsize::new(0));

    for (rel_path, title) in targets_to_calc {
        let semaphore_clone = semaphore.clone();
        let ffmpeg = ffmpeg_path.clone();
        let abs_path = base_dir.join(normalize_rel_path(&rel_path));
        let path_key = rel_path.clone();
        let app_clone = app.clone();
        let counter_clone = current_counter.clone();

        handles.push(tokio::spawn(async move {
            let _permit = semaphore_clone.acquire_owned().await.unwrap();
            
            let mut lufs_val: Option<f32> = None;
            if abs_path.exists() {
                let mut std_cmd = std::process::Command::new(&ffmpeg);
                std_cmd.args(&["-hide_banner", "-nostdin", "-i", abs_path.to_str().unwrap(), "-af", "ebur128", "-f", "null", "-"]);
                
                #[cfg(target_os = "windows")]
                std_cmd.creation_flags(0x08000000);
                
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
            
            let current = counter_clone.fetch_add(1, Ordering::SeqCst) + 1;
            let _ = app_clone.emit("lufs_calc_progress", serde_json::json!({
                "current": current,
                "total": total,
                "message": format!("{} を解析中...", title)
            }));

            (path_key, lufs_val)
        }));
    }

    let mut newly_calculated = false;

    for handle in handles {
        if let Ok((path_key, lufs_opt)) = handle.await {
            if let Some(lufs) = lufs_opt {
                let mut cache = state.lufs_cache.lock().unwrap();
                cache.insert(path_key, lufs);
                newly_calculated = true;
            }
        }
    }

    if newly_calculated {
        let cache = state.lufs_cache.lock().unwrap();
        save_lufs_cache(&cache);
    }

    let _ = app.emit("lufs_calc_progress", serde_json::json!({
        "current": total, "total": total, "message": "すべての解析が完了しました！"
    }));

    Ok(())
}

#[tauri::command]
pub fn get_library_count(
    search_query: String,
    advanced_conditions: Option<Value>, 
    state: State<'_, AppState>
) -> usize {
    let db = state.db.lock().unwrap();
    db.iter().filter(|i| {
        let match_search_query = if search_query.is_empty() { true } else { match_search(i, &search_query) };
        let match_advanced = if let Some(ref conds) = advanced_conditions {
            evaluate_smart_rules(i, conds)
        } else {
            true
        };
        match_search_query && match_advanced
    }).count()
}

#[tauri::command]
pub fn get_library_chunk(
    page: usize,
    limit: usize,
    sort_field: Option<String>,
    sort_desc: bool,
    search_query: String,
    advanced_conditions: Option<Value>, 
    state: State<'_, AppState>
) -> Vec<serde_json::Map<String, Value>> {
    let mut db = state.db.lock().unwrap().clone();
    
    db.retain(|i| {
        let match_search_query = if search_query.is_empty() { true } else { match_search(i, &search_query) };
        let match_advanced = if let Some(ref conds) = advanced_conditions {
            evaluate_smart_rules(i, conds)
        } else {
            true
        };
        match_search_query && match_advanced
    });

    if let Some(f) = sort_field {
        db.sort_by(|a, b| {
            let (va, vb) = (a.get(&f).and_then(|v| v.as_str()).unwrap_or("").to_lowercase(), b.get(&f).and_then(|v| v.as_str()).unwrap_or("").to_lowercase());
            let res = if ["track", "disc", "year", "bpm"].contains(&f.as_str()) {
                va.parse::<i32>().unwrap_or(0).cmp(&vb.parse::<i32>().unwrap_or(0))
            } else { va.cmp(&vb) };
            if sort_desc { res.reverse() } else { res }
        });
    }
    if limit > 0 { let start = (page.saturating_sub(1)) * limit; db.into_iter().skip(start).take(limit).collect() } else { db }
}

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

        // ★ 追加：変更後の情報をMP3ファイル本体へ保存
        update_mp3_tags_from_song_map(i);

        save_db(&db).is_ok()
    } else { false }
}

#[tauri::command]
pub fn update_song_artwork_by_id(music_filename: String, new_art_base64: Option<String>, remove: bool, state: State<'_, AppState>) -> bool {
    let mut db = state.db.lock().unwrap();
    if let Some(target) = db.iter_mut().find(|i| i.get("musicFilename").and_then(|v| v.as_str()) == Some(&music_filename)) {
        if let Some(old) = target.get("imageFilename").and_then(|v| v.as_str()) { 
            if !old.contains("default.png") { 
                let _ = fs::remove_file(get_base_dir().join(normalize_rel_path(old))); 
            } 
        }
        if remove {
            target.insert("imageFilename".into(), "library/images/default.png".into());
            target.insert("imageData".into(), get_asset_url("library/images/default.png").into());
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

        // ★ 追加：変更後のカバーアートをMP3ファイル本体へ埋め込み
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
        if let Some(p) = i.get("imageFilename").and_then(|v| v.as_str()) { if !p.contains("default.png") { let _ = fs::remove_file(get_base_dir().join(normalize_rel_path(p))); } }
        save_db(&db).is_ok()
    } else { false }
}

#[tauri::command]
pub fn get_common_values_for_selected(filenames: Vec<String>, state: State<'_, AppState>) -> serde_json::Map<String, Value> {
    let db = state.db.lock().unwrap();
    let sel: Vec<_> = db.iter().filter(|i| filenames.contains(&i.get("musicFilename").and_then(|v| v.as_str()).unwrap_or("").split(&['/', '\\'][..]).last().unwrap_or("").into())).collect();
    let mut res = serde_json::Map::new();
    if sel.is_empty() { return res; }
    for k in ["title", "artist", "album", "genre", "year", "track", "disc", "bpm", "composer", "comment", "lyric"] {
        let first = sel[0].get(k).and_then(|v| v.as_str()).unwrap_or("");
        res.insert(k.into(), if sel.iter().all(|i| i.get(k).and_then(|v| v.as_str()).unwrap_or("") == first) { first.into() } else { "< 維持 >".into() });
    }

    let first_img = sel[0].get("imageFilename").and_then(|v| v.as_str()).unwrap_or("");
    let common_img = if sel.iter().all(|i| i.get("imageFilename").and_then(|v| v.as_str()).unwrap_or("") == first_img) {
        first_img
    } else {
        "< 維持 >"
    };
    res.insert("imageFilename".into(), common_img.into());

    let first_data = sel[0].get("imageData").and_then(|v| v.as_str()).unwrap_or("");
    let common_data = if sel.iter().all(|i| i.get("imageData").and_then(|v| v.as_str()).unwrap_or("") == first_data) {
        first_data
    } else {
        "< 維持 >"
    };
    res.insert("imageData".into(), common_data.into());
    
    res
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
                    if !old.contains("default.png") {
                        let _ = fs::remove_file(base.join(normalize_rel_path(old)));
                    }
                }
                
                if b64 == "REMOVE" {
                    i.insert("imageFilename".into(), "library/images/default.png".into());
                    i.insert("imageData".into(), get_asset_url("library/images/default.png").into());
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

            // ★ 追加：一括変更された各MP3ファイル本体へタグを反映・保存
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
            if let Some(p) = i.get("imageFilename").and_then(|v| v.as_str()) { if !p.contains("default.png") { let _ = fs::remove_file(get_base_dir().join(normalize_rel_path(p))); } }
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

#[tauri::command]
pub fn parse_list_import(content: String, file_type: String) -> Result<serde_json::Value, String> {
    if file_type == "json" {
        let parsed: Vec<serde_json::Map<String, Value>> = serde_json::from_str(&content).map_err(|e| e.to_string())?;
        let data: Vec<Value> = parsed.into_iter().map(|mut item| {
            item.insert("status".to_string(), Value::String("スキャン完了".to_string()));
            Value::Object(item)
        }).collect();
        Ok(serde_json::json!({"status": "success", "data": data}))
    } else {
        let lines: Vec<&str> = content.lines().collect();
        if lines.is_empty() {
            return Ok(serde_json::json!({"status": "success", "data": []}));
        }
        let headers: Vec<&str> = lines[0].split(',').map(|s| s.trim()).collect();
        let mut data = Vec::new();
        for line in lines.iter().skip(1) {
            if line.trim().is_empty() { continue; }
            let values: Vec<&str> = line.split(',').map(|s| s.trim()).collect();
            let mut item = serde_json::Map::new();
            for (i, &header) in headers.iter().enumerate() {
                if i < values.len() {
                    item.insert(header.to_string(), Value::String(values[i].to_string()));
                }
            }
            item.insert("status".to_string(), Value::String("スキャン完了".to_string()));
            data.push(Value::Object(item));
        }
        Ok(serde_json::json!({"status": "success", "data": data}))
    }
}

#[tauri::command]
pub fn execute_final_list_import(import_data_list: Vec<serde_json::Map<String, Value>>, state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let mut db = state.db.lock().unwrap();
    let mut count = 0;
    
    let base = get_base_dir();
    let _ = fs::create_dir_all(base.join("library/music"));
    let _ = fs::create_dir_all(base.join("library/images"));

    for mut item in import_data_list {
        item.remove("status"); 
        
        let rel_music_path = item.get("musicFilename").and_then(|v| v.as_str()).unwrap_or("").to_string();
        if !rel_music_path.is_empty() {
            let duration_str = get_duration_str(Some(&Value::String(rel_music_path.clone())));
            item.insert("duration".to_string(), Value::String(duration_str));
            item.insert("streamUrl".to_string(), Value::String(get_asset_url(&rel_music_path)));
        }
        
        let mut img_saved = false;
        if let Some(art_b64) = item.get("artworkBase64").and_then(|v| v.as_str()) {
            if !art_b64.is_empty() {
                let b64c = if art_b64.contains(',') { art_b64.split(',').nth(1).unwrap() } else { art_b64 };
                if let Ok(bytes) = general_purpose::STANDARD.decode(b64c) {
                    let f_id: String = rng().sample_iter(&Alphanumeric).take(32).map(char::from).collect();
                    let ir = format!("library/images/{}.png", f_id);
                    if force_save_as_png(&bytes, &base.join(&ir)) {
                        item.insert("imageFilename".to_string(), Value::String(ir.clone()));
                        item.insert("imageData".to_string(), Value::String(get_asset_url(&ir)));
                        img_saved = true;
                    }
                }
            }
        }
        
        if !img_saved {
            let rel_img_path = item.get("imageFilename").and_then(|v| v.as_str()).unwrap_or("library/images/default.png").to_string();
            item.insert("imageData".to_string(), Value::String(get_asset_url(&rel_img_path)));
        }
        item.remove("artworkBase64");
        
        // ★ 追加：リストインポート時にも対象ファイル本体へタグを書き込み
        update_mp3_tags_from_song_map(&item);

        db.push(item);
        count += 1;
    }
    
    if count > 0 { let _ = save_db(&db); }
    Ok(serde_json::json!({"status": "success", "count": count}))
}

#[tauri::command]
pub fn check_import_duplicates(import_list: Vec<serde_json::Map<String, Value>>, state: State<'_, AppState>) -> Vec<serde_json::Map<String, Value>> {
    let db = state.db.lock().unwrap();
    let mut duplicates = Vec::new();
    
    for item in import_list {
        let t = item.get("title").and_then(|v| v.as_str()).unwrap_or("").trim().to_lowercase();
        let ar = item.get("artist").and_then(|v| v.as_str()).unwrap_or("").trim().to_lowercase();
        
        if t.is_empty() || ar.is_empty() { continue; }
        
        let is_dup = db.iter().any(|s| {
            let s_t = s.get("title").and_then(|v| v.as_str()).unwrap_or("").trim().to_lowercase();
            let s_ar = s.get("artist").and_then(|v| v.as_str()).unwrap_or("").trim().to_lowercase();
            s_t == t && s_ar == ar
        });
        
        if is_dup { duplicates.push(item); }
    }
    duplicates
}

#[tauri::command]
pub fn scan_zip_import(zip_data_b64: String, password: Option<String>) -> Result<serde_json::Value, String> {
    if let Some(ref pass) = password {
        if pass.chars().count() > 128 {
            return Err("パスワードは128文字以内にしてください".to_string());
        }
    }

    let bytes = general_purpose::STANDARD.decode(zip_data_b64).map_err(|e| e.to_string())?;
    let cursor = Cursor::new(bytes);
    let mut archive = zip::ZipArchive::new(cursor).map_err(|e| e.to_string())?;
    
    let mut needs_password = false;
    for i in 0..archive.len() {
        match archive.by_index(i) {
            Ok(file) => {
                if file.is_file() && file.encrypted() {
                    needs_password = true;
                    break;
                }
            }
            Err(zip::result::ZipError::UnsupportedArchive(msg)) => {
                if msg.contains("Password required") {
                    needs_password = true;
                    break;
                }
            }
            _ => {}
        }
    }

    if needs_password {
        if password.is_none() || password.as_deref().unwrap_or("").is_empty() {
            return Ok(serde_json::json!({"status": "password_required"}));
        }
        let pass = password.as_deref().unwrap_or("");
        if pass.chars().count() > 128 {
            return Err("パスワードは128文字以内にしてください".to_string());
        }
    }

    let mut data_list = Vec::new();
    
    for i in 0..archive.len() {
        let mut file = match password {
            Some(ref p) if !p.is_empty() && needs_password => {
                match archive.by_index_decrypt(i, p.as_bytes()) {
                    Ok(f) => f,
                    Err(zip::result::ZipError::InvalidPassword) => return Err("パスワードが間違っています".to_string()),
                    Err(e) => return Err(e.to_string()),
                }
            },
            _ => archive.by_index(i).map_err(|e| e.to_string())?
        };

        if file.is_file() {
            let name = file.name().to_string();
            if name.to_lowercase().ends_with(".mp3") || name.to_lowercase().ends_with(".m4a") || name.to_lowercase().ends_with(".mp4") {
                let mut buffer = Vec::new();
                let _ = file.read_to_end(&mut buffer);
                
                let normalized_name = normalize_rel_path(&name);
                let mut title = normalized_name.split('/').last().unwrap_or(&name).to_string();
                let mut artist = String::new();
                let mut album = String::new();
                let mut artwork_base64 = String::new();
                
                if let Ok(tag) = id3::Tag::read_from2(&mut Cursor::new(&buffer)) {
                    if let Some(t) = tag.title() { title = t.to_string(); }
                    if let Some(a) = tag.artist() { artist = a.to_string(); }
                    if let Some(al) = tag.album() { album = al.to_string(); }
                    
                    if let Some(pic) = tag.pictures().next() {
                        if let Ok(img) = image::load_from_memory(&pic.data) {
                            let s_size = std::cmp::min(img.width(), img.height());
                            let mut ic = img.crop_imm((img.width()-s_size)/2, (img.height()-s_size)/2, s_size, s_size);
                            if ic.color().has_alpha() {
                                let mut bg = image::DynamicImage::ImageRgba8(image::RgbaImage::from_pixel(s_size, s_size, image::Rgba([255, 255, 255, 255])));
                                image::imageops::overlay(&mut bg, &ic, 0, 0); 
                                ic = bg;
                            }
                            let mut buf = std::io::Cursor::new(Vec::new()); 
                            if ic.write_to(&mut buf, image::ImageFormat::Png).is_ok() {
                                artwork_base64 = format!("data:image/png;base64,{}", general_purpose::STANDARD.encode(buf.into_inner()));
                            }
                        }
                    }
                }
                
                data_list.push(serde_json::json!({
                    "relPath": normalized_name,
                    "title": title,
                    "artist": artist,
                    "album": album,
                    "artworkBase64": artwork_base64,
                    "status": "スキャン完了"
                }));
            }
        }
    }
    
    Ok(serde_json::json!({"status": "success", "data": data_list}))
}

#[tauri::command]
pub fn execute_zip_import(zip_data_b64: String, import_data_list: Vec<serde_json::Map<String, Value>>, password: Option<String>, state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let bytes = general_purpose::STANDARD.decode(zip_data_b64).map_err(|e| e.to_string())?;
    let cursor = Cursor::new(bytes);
    let mut archive = zip::ZipArchive::new(cursor).map_err(|e| e.to_string())?;
    
    let base = get_base_dir();
    let _ = fs::create_dir_all(base.join("library/music"));
    let _ = fs::create_dir_all(base.join("library/images"));
    
    let mut db = state.db.lock().unwrap();
    let mut count = 0;
    
    for mut item in import_data_list {
        let rel_path = item.get("relPath").and_then(|v| v.as_str()).unwrap_or("").to_string();
        if rel_path.is_empty() { continue; }
        
        let mut found_file = None;
        for i in 0..archive.len() {
            let file_res = match password {
                Some(ref p) if !p.is_empty() => archive.by_index_decrypt(i, p.as_bytes()),
                _ => archive.by_index(i)
            };
            if let Ok(file) = file_res {
                let archive_name = normalize_rel_path(file.name());
                if archive_name == rel_path {
                    found_file = Some(i);
                    break;
                }
            }
        }
        
        if let Some(idx) = found_file {
            let mut file = match password {
                Some(ref p) if !p.is_empty() => {
                    match archive.by_index_decrypt(idx, p.as_bytes()) {
                        Ok(f) => f,
                        Err(zip::result::ZipError::InvalidPassword) => return Err("パスワードが間違っています".to_string()),
                        Err(e) => return Err(e.to_string()),
                    }
                },
                _ => archive.by_index(idx).map_err(|e| e.to_string())?
            };

            let f_id: String = rng().sample_iter(&Alphanumeric).take(32).map(char::from).collect();
            let mut ext = "mp3".to_string();
            if let Some(e) = std::path::Path::new(&rel_path).extension().and_then(|e| e.to_str()) { ext = e.to_string(); }
            let m_rel = format!("library/music/{}.{}", f_id, ext);
            
            let mut buffer = Vec::new();
            let _ = file.read_to_end(&mut buffer);
            
            if fs::write(base.join(&m_rel), &buffer).is_ok() {
                item.insert("musicFilename".to_string(), Value::String(m_rel.clone()));
                item.insert("streamUrl".to_string(), Value::String(get_asset_url(&m_rel)));
                
                let duration_str = get_duration_str(Some(&Value::String(m_rel.clone())));
                item.insert("duration".to_string(), Value::String(duration_str));
                
                let mut img_saved = false;
                if let Some(art_b64) = item.get("artworkBase64").and_then(|v| v.as_str()) {
                    if !art_b64.is_empty() {
                        let b64c = if art_b64.contains(',') { art_b64.split(',').nth(1).unwrap() } else { art_b64 };
                        if let Ok(by) = general_purpose::STANDARD.decode(b64c) {
                            let ir = format!("library/images/{}.png", f_id);
                            if force_save_as_png(&by, &base.join(&ir)) {
                                item.insert("imageFilename".to_string(), Value::String(ir.clone()));
                                item.insert("imageData".to_string(), Value::String(get_asset_url(&ir)));
                                img_saved = true;
                            }
                        }
                    }
                }
                
                if !img_saved {
                    item.insert("imageFilename".to_string(), Value::String("library/images/default.png".to_string()));
                    item.insert("imageData".to_string(), Value::String(get_asset_url("library/images/default.png")));
                }
                
                item.remove("artworkBase64");
                item.remove("relPath");
                item.remove("status");

                // ★ 追加：ZIP解凍インポート後のファイルへID3タグを埋め込み
                update_mp3_tags_from_song_map(&item);

                db.push(item);
                count += 1;
            }
        }
    }
    
    if count > 0 { let _ = save_db(&db); }
    Ok(serde_json::json!({"status": "success", "count": count}))
}
use std::path::PathBuf;
use std::fs;
use serde_json::Value;
use image::load_from_memory;
use std::collections::HashMap;

use id3::{Tag, TagLike};
use id3::frame::{Picture, PictureType, Comment, Lyrics};

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

use crate::AppState;

pub fn get_base_dir() -> PathBuf {
    let mut path = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    if cfg!(debug_assertions) {
        let mut temp = path.clone();
        loop {
            if temp.join("app").exists() {
                path = temp;
                break;
            }
            if !temp.pop() {
                break;
            }
        }
    } else if let Ok(exe_path) = std::env::current_exe() {
        if let Some(parent) = exe_path.parent() { return parent.to_path_buf(); }
    }
    path
}

pub fn ensure_dir_writable<P: AsRef<std::path::Path>>(path: P) -> std::io::Result<()> {
    let p = path.as_ref();
    if !p.exists() {
        fs::create_dir_all(p)?;
    }
    #[cfg(unix)]
    {
        if let Ok(metadata) = fs::metadata(p) {
            let mut perms = metadata.permissions();
            perms.set_mode(0o777);
            let _ = fs::set_permissions(p, perms);
        }
    }
    Ok(())
}

pub fn ensure_file_writable<P: AsRef<std::path::Path>>(path: P) {
    let p = path.as_ref();
    if p.exists() {
        #[cfg(unix)]
        {
            if let Ok(metadata) = fs::metadata(p) {
                let mut perms = metadata.permissions();
                perms.set_mode(0o666);
                let _ = fs::set_permissions(p, perms);
            }
        }
    }
}

pub fn safe_write_file<P: AsRef<std::path::Path>, C: AsRef<[u8]>>(path: P, contents: C) -> Result<(), String> {
    let p = path.as_ref();
    if let Some(parent) = p.parent() {
        ensure_dir_writable(parent).map_err(|e| format!("ディレクトリ権限付与失敗 ({:?}): {}", parent, e))?;
    }
    ensure_file_writable(p);

    fs::write(p, contents).map_err(|e| format!("ファイル書き込み失敗 ({:?}): {}", p, e))?;

    ensure_file_writable(p);
    Ok(())
}

pub fn normalize_rel_path(rel_path: &str) -> String {
    if rel_path.is_empty() { return "".to_string(); }
    let clean = rel_path.replace('\\', "/");
    clean.split('/').filter(|s| !s.is_empty()).collect::<Vec<_>>().join("/")
}

pub fn get_asset_url(rel_path: &str) -> String {
    if rel_path.is_empty() { return "".to_string(); }
    let normalized_path = normalize_rel_path(rel_path);
    let path = get_base_dir().join(&normalized_path);
    if !path.exists() { return "".to_string(); }
    let abs_path = path.to_string_lossy().to_string();
    let encoded = urlencoding::encode(&abs_path);
    #[cfg(target_os = "windows")]
    { format!("http://asset.localhost/{}", encoded) }
    #[cfg(not(target_os = "windows"))]
    { format!("asset://localhost/{}", encoded) }
}

pub fn load_db() -> Vec<serde_json::Map<String, Value>> {
    let base = get_base_dir();
    let path = base.join("userfiles/music.json");
    if !path.exists() { return Vec::new(); }
    let data = fs::read_to_string(&path).unwrap_or_default();
    let mut db: Vec<serde_json::Map<String, Value>> = serde_json::from_str(&data).unwrap_or_else(|_| Vec::new());
    
    for item in db.iter_mut() {
        if let Some(m_path) = item.get("musicFilename").and_then(|v| v.as_str()) {
            let norm = normalize_rel_path(m_path);
            item.insert("musicFilename".to_string(), Value::String(norm));
        }
        if let Some(i_path) = item.get("imageFilename").and_then(|v| v.as_str()) {
            let norm = normalize_rel_path(i_path);
            item.insert("imageFilename".to_string(), Value::String(norm));
        }

        item.insert("duration".to_string(), Value::String(get_duration_str(item.get("musicFilename"))));
        let img_path = item.get("imageFilename").and_then(|v| v.as_str()).unwrap_or("");
        item.insert("imageData".to_string(), Value::String(get_asset_url(img_path)));
        let music_path = item.get("musicFilename").and_then(|v| v.as_str()).unwrap_or("");
        item.insert("streamUrl".to_string(), Value::String(get_asset_url(music_path)));
    }
    db
}

pub fn load_db_with_progress(app: &tauri::AppHandle) -> Vec<serde_json::Map<String, Value>> {
    use tauri::Emitter;
    
    let _ = app.emit("splash_progress", serde_json::json!({
        "message": "データベースを読み込んでいます...",
        "percent": 10
    }));

    let base = get_base_dir();
    let path = base.join("userfiles/music.json");
    if !path.exists() {
        let _ = app.emit("splash_progress", serde_json::json!({
            "message": "初期データベースの準備完了",
            "percent": 80
        }));
        return Vec::new(); 
    }
    
    let data = fs::read_to_string(&path).unwrap_or_default();
    let mut db: Vec<serde_json::Map<String, Value>> = serde_json::from_str(&data).unwrap_or_else(|_| Vec::new());
    
    let total = db.len();
    let _ = app.emit("splash_progress", serde_json::json!({
        "message": format!("楽曲データを解析中 (0 / {})", total),
        "percent": 20
    }));

    for (idx, item) in db.iter_mut().enumerate() {
        if let Some(m_path) = item.get("musicFilename").and_then(|v| v.as_str()) {
            let norm = normalize_rel_path(m_path);
            item.insert("musicFilename".to_string(), Value::String(norm));
        }
        if let Some(i_path) = item.get("imageFilename").and_then(|v| v.as_str()) {
            let norm = normalize_rel_path(i_path);
            item.insert("imageFilename".to_string(), Value::String(norm));
        }

        item.insert("duration".to_string(), Value::String(get_duration_str(item.get("musicFilename"))));
        let img_path = item.get("imageFilename").and_then(|v| v.as_str()).unwrap_or("");
        item.insert("imageData".to_string(), Value::String(get_asset_url(img_path)));
        let music_path = item.get("musicFilename").and_then(|v| v.as_str()).unwrap_or("");
        item.insert("streamUrl".to_string(), Value::String(get_asset_url(music_path)));

        if total > 0 && (idx % 5 == 0 || idx == total - 1) {
            let current = idx + 1;
            let percent = 20 + (((current as f32) / (total as f32)) * 65.0) as u32;
            let _ = app.emit("splash_progress", serde_json::json!({
                "message": format!("楽曲データを解析中 ({} / {})", current, total),
                "percent": percent
            }));
        }
    }

    let _ = app.emit("splash_progress", serde_json::json!({
        "message": "データベースの解析が完了しました",
        "percent": 85
    }));

    db
}

pub fn save_db(db: &Vec<serde_json::Map<String, Value>>) -> Result<(), String> {
    let mut db_to_save = db.clone();
    for item in db_to_save.iter_mut() {
        item.remove("duration"); item.remove("imageData"); item.remove("streamUrl");
    }
    let path = get_base_dir().join("userfiles/music.json");
    let data = serde_json::to_string_pretty(&db_to_save).map_err(|e| e.to_string())?;
    safe_write_file(&path, data.as_bytes())
}

// ★ 外部変更検知と自動リロード用関数
pub fn check_and_reload_db_if_needed(state: &AppState) {
    let base = get_base_dir();
    let path = base.join("userfiles/music.json");
    if let Ok(meta) = fs::metadata(&path) {
        if let Ok(mtime) = meta.modified() {
            let mut last_mtime_guard = state.db_mtime.lock().unwrap();
            let should_reload = match *last_mtime_guard {
                Some(last) => mtime > last,
                None => true,
            };
            if should_reload {
                *last_mtime_guard = Some(mtime);
                drop(last_mtime_guard);
                let new_db = load_db();
                let mut db_guard = state.db.lock().unwrap();
                *db_guard = new_db;
            }
        }
    }
}

pub fn check_and_reload_playlists_if_needed(state: &AppState) {
    let base = get_base_dir();
    let path = base.join("userfiles/playlist.json");
    if let Ok(meta) = fs::metadata(&path) {
        if let Ok(mtime) = meta.modified() {
            let mut last_mtime_guard = state.playlists_mtime.lock().unwrap();
            let should_reload = match *last_mtime_guard {
                Some(last) => mtime > last,
                None => true,
            };
            if should_reload {
                *last_mtime_guard = Some(mtime);
                drop(last_mtime_guard);
                let new_pl = load_playlists_master();
                let mut pl_guard = state.playlists.lock().unwrap();
                *pl_guard = new_pl;
            }
        }
    }
}

pub fn update_db_mtime(state: &AppState) {
    let base = get_base_dir();
    let path = base.join("userfiles/music.json");
    if let Ok(meta) = fs::metadata(&path) {
        if let Ok(mtime) = meta.modified() {
            let mut last_mtime_guard = state.db_mtime.lock().unwrap();
            *last_mtime_guard = Some(mtime);
        }
    }
}

pub fn update_playlists_mtime(state: &AppState) {
    let base = get_base_dir();
    let path = base.join("userfiles/playlist.json");
    if let Ok(meta) = fs::metadata(&path) {
        if let Ok(mtime) = meta.modified() {
            let mut last_mtime_guard = state.playlists_mtime.lock().unwrap();
            *last_mtime_guard = Some(mtime);
        }
    }
}

pub fn update_mp3_tags_from_song_map(song: &serde_json::Map<String, Value>) {
    let rel_music_path = match song.get("musicFilename").and_then(|v| v.as_str()) {
        Some(p) if !p.is_empty() => p,
        _ => return,
    };

    let norm_path = normalize_rel_path(rel_music_path);
    let abs_music_path = get_base_dir().join(&norm_path);

    if !abs_music_path.exists() {
        return;
    }

    if abs_music_path.extension().and_then(|e| e.to_str()).map(|e| e.to_lowercase()) != Some("mp3".to_string()) {
        return;
    }

    ensure_file_writable(&abs_music_path);

    let mut tag = Tag::read_from_path(&abs_music_path).unwrap_or_else(|_| Tag::new());

    if let Some(v) = song.get("title").and_then(|v| v.as_str()) {
        if !v.is_empty() { tag.set_title(v); } else { tag.remove_title(); }
    }
    if let Some(v) = song.get("artist").and_then(|v| v.as_str()) {
        if !v.is_empty() { tag.set_artist(v); } else { tag.remove_artist(); }
    }
    if let Some(v) = song.get("album").and_then(|v| v.as_str()) {
        if !v.is_empty() { tag.set_album(v); } else { tag.remove_album(); }
    }
    if let Some(v) = song.get("genre").and_then(|v| v.as_str()) {
        if !v.is_empty() { tag.set_genre(v); } else { tag.remove_genre(); }
    }
    if let Some(v) = song.get("track").and_then(|v| v.as_str()) {
        if let Ok(num) = v.parse::<u32>() { tag.set_track(num); } else { tag.remove_track(); }
    }
    if let Some(v) = song.get("year").and_then(|v| v.as_str()) {
        if let Ok(num) = v.parse::<i32>() { tag.set_year(num); } else { tag.remove_year(); }
    }
    if let Some(v) = song.get("album_artist").and_then(|v| v.as_str()) {
        if !v.is_empty() { tag.set_album_artist(v); } else { tag.remove_album_artist(); }
    }
    if let Some(v) = song.get("disc").and_then(|v| v.as_str()) {
        if let Ok(num) = v.parse::<u32>() { tag.set_disc(num); } else { tag.remove_disc(); }
    }
    if let Some(v) = song.get("bpm").and_then(|v| v.as_str()) {
        if !v.is_empty() { tag.set_text("TBPM", v); } else { tag.remove("TBPM"); }
    }
    if let Some(v) = song.get("composer").and_then(|v| v.as_str()) {
        if !v.is_empty() { tag.set_text("TCOM", v); } else { tag.remove("TCOM"); }
    }
    if let Some(v) = song.get("comment").and_then(|v| v.as_str()) {
        tag.remove("COMM");
        if !v.is_empty() {
            tag.add_frame(Comment {
                lang: "eng".to_string(),
                description: "".to_string(),
                text: v.to_string(),
            });
        }
    }
    if let Some(v) = song.get("lyric").and_then(|v| v.as_str()) {
        tag.remove("USLT");
        if !v.is_empty() {
            tag.add_frame(Lyrics {
                lang: "eng".to_string(),
                description: "".to_string(),
                text: v.to_string(),
            });
        }
    }

    if let Some(rel_img_path) = song.get("imageFilename").and_then(|v| v.as_str()) {
        if !rel_img_path.is_empty() && !rel_img_path.contains("Chordia.png") && !rel_img_path.contains("default.png") {
            let norm_img = normalize_rel_path(rel_img_path);
            let abs_img_path = get_base_dir().join(&norm_img);
            if abs_img_path.exists() {
                if let Ok(img_bytes) = fs::read(&abs_img_path) {
                    tag.remove("APIC");
                    let mime = if norm_img.ends_with(".png") { "image/png" } else { "image/jpeg" };
                    tag.add_frame(Picture {
                        mime_type: mime.to_string(),
                        picture_type: PictureType::CoverFront,
                        description: "Cover".to_string(),
                        data: img_bytes,
                    });
                }
            }
        }
    }

    let _ = tag.write_to_path(&abs_music_path, id3::Version::Id3v24);
}

pub fn load_playlists_master() -> Vec<Value> {
    let path = get_base_dir().join("userfiles/playlist.json");
    if !path.exists() { return Vec::new(); }
    fs::read_to_string(&path).ok().and_then(|d| serde_json::from_str(&d).ok()).unwrap_or_default()
}

pub fn save_playlists_master(playlists: &[Value]) {
    let path = get_base_dir().join("userfiles/playlist.json");
    if let Ok(data) = serde_json::to_string_pretty(playlists) {
        let _ = safe_write_file(&path, data.as_bytes());
    }
}

pub fn load_lufs_cache() -> HashMap<String, f32> {
    let path = get_base_dir().join("userfiles/lufs_cache.json");
    if !path.exists() { return HashMap::new(); }
    fs::read_to_string(&path)
        .ok()
        .and_then(|d| serde_json::from_str(&d).ok())
        .unwrap_or_default()
}

pub fn save_lufs_cache(cache: &HashMap<String, f32>) {
    let path = get_base_dir().join("userfiles/lufs_cache.json");
    if let Ok(data) = serde_json::to_string_pretty(cache) {
        let _ = safe_write_file(&path, data.as_bytes());
    }
}

pub fn force_save_as_png(image_bytes: &[u8], target_path: &std::path::PathBuf) -> bool {
    if let Some(parent) = target_path.parent() {
        let _ = ensure_dir_writable(parent);
    }
    ensure_file_writable(target_path);

    if let Ok(img) = load_from_memory(image_bytes) {
        let mut final_img = img;
        if final_img.color().has_alpha() {
            let bg = image::RgbaImage::from_pixel(final_img.width(), final_img.height(), image::Rgba([255, 255, 255, 255]));
            let mut bg_dynamic = image::DynamicImage::ImageRgba8(bg);
            let _ = image::imageops::overlay(&mut bg_dynamic, &final_img, 0, 0);
            final_img = bg_dynamic;
        }
        let res = final_img.into_rgb8().save_with_format(target_path, image::ImageFormat::Png).is_ok();
        ensure_file_writable(target_path);
        return res;
    }
    false
}

pub fn match_search(item: &serde_json::Map<String, Value>, query: &str) -> bool {
    let q = query.to_lowercase();
    ["title", "artist", "album", "genre", "year", "composer"].iter().any(|k| {
        item.get(*k).and_then(|v| v.as_str()).map(|s| s.to_lowercase().contains(&q)).unwrap_or(false)
    })
}

pub fn get_duration_str(path_val: Option<&Value>) -> String {
    if let Some(rel_path) = path_val.and_then(|v| v.as_str()) {
        let normalized = normalize_rel_path(rel_path);
        let abs_path = get_base_dir().join(&normalized);
        if let Ok(duration) = mp3_duration::from_path(&abs_path) {
            let secs = duration.as_secs();
            return format!("{}:{:02}", secs / 60, secs % 60);
        }
    }
    "--:--".to_string()
}

pub fn evaluate_smart_rules(song: &serde_json::Map<String, Value>, rule: &Value) -> bool {
    if let Some(obj) = rule.as_object() {
        if let Some(r_type) = obj.get("type").and_then(|v| v.as_str()) {
            if r_type == "group" {
                let match_type = obj.get("match").and_then(|v| v.as_str()).unwrap_or("all");
                if let Some(arr) = obj.get("items").and_then(|v| v.as_array()) {
                    if arr.is_empty() { return true; }
                    let mut results = arr.iter().map(|child| evaluate_smart_rules(song, child));
                    if match_type == "all" { return results.all(|b| b); } else { return results.any(|b| b); }
                }
                return true;
            } else if r_type == "filter" {
                let tag = obj.get("tag").and_then(|v| v.as_str()).unwrap_or("");
                let op = obj.get("op").and_then(|v| v.as_str()).unwrap_or("");
                let target_val = obj.get("val").unwrap_or(&Value::Null);
                let song_val = song.get(tag).and_then(|v| {
                    if v.is_string() { Some(v.as_str().unwrap().to_lowercase()) }
                    else if v.is_number() { Some(v.to_string()) }
                    else { None }
                }).unwrap_or_default();
                if ["track", "year", "disc", "bpm"].contains(&tag) {
                    let s_num: f64 = song_val.parse().unwrap_or(0.0);
                    if op == "range" {
                        if let Some(arr) = target_val.as_array() {
                            if arr.len() == 2 {
                                let min = arr[0].as_f64().unwrap_or(0.0);
                                let max = arr[1].as_f64().unwrap_or(0.0);
                                return s_num >= min && s_num <= max;
                            }
                        }
                    } else {
                        let v_num: f64 = if target_val.is_number() { target_val.as_f64().unwrap_or(0.0) } 
                                         else if target_val.is_string() { target_val.as_str().unwrap().parse().unwrap_or(0.0) }
                                         else { 0.0 };
                        return match op { "equals" => s_num == v_num, "not_equals" => s_num != v_num, "greater" => s_num > v_num, "less" => s_num < v_num, _ => false };
                    }
                } else {
                    let target_str = if target_val.is_string() { target_val.as_str().unwrap().to_lowercase() } else { target_val.to_string() };
                    return match op { "contains" => song_val.contains(&target_str), "not_contains" => !song_val.contains(&target_str), "equals" => song_val == target_str, "not_equals" => song_val != target_str, "startswith" => song_val.starts_with(&target_str), "endswith" => song_val.ends_with(&target_str), _ => false };
                }
            }
        }
    }
    false
}
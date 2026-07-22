use std::path::PathBuf;
use std::fs;
use serde_json::Value;
use image::load_from_memory;

pub fn get_base_dir() -> PathBuf {
    let mut path = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    if cfg!(debug_assertions) {
        // 開発時はカレントディレクトリから上に遡り、"app" フォルダが存在するプロジェクトルートを全自動で探索する
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

// ★ 追加：バックスラッシュ（\ や \\）や重複スラッシュ（//）など、混在したパス表記をクロスプラットフォームで安全な単一スラッシュ "/" へ正規化する関数
pub fn normalize_rel_path(rel_path: &str) -> String {
    if rel_path.is_empty() { return "".to_string(); }
    let clean = rel_path.replace('\\', "/");
    clean.split('/').filter(|s| !s.is_empty()).collect::<Vec<_>>().join("/")
}

pub fn get_asset_url(rel_path: &str) -> String {
    if rel_path.is_empty() { return "".to_string(); }
    
    // パスを標準形式に正規化
    let normalized_path = normalize_rel_path(rel_path);
    let path = get_base_dir().join(&normalized_path);
    
    if !path.exists() { return "".to_string(); }
    let abs_path = path.to_string_lossy().to_string();
    let encoded = urlencoding::encode(&abs_path);

    // Windowsビルド時は http://asset.localhost/ 形式にバインド
    #[cfg(target_os = "windows")]
    {
        format!("http://asset.localhost/{}", encoded)
    }

    // macOS / Linux (Unix) ビルド時は、WebKitがセキュリティ検証をパスしてファイルをレンダリング可能な asset://localhost/ 形式にバインド
    #[cfg(not(target_os = "windows"))]
    {
        format!("asset://localhost/{}", encoded)
    }
}

pub fn load_db() -> Vec<serde_json::Map<String, Value>> {
    let base = get_base_dir();
    let path = base.join("userfiles/music.json");
    if !path.exists() { return Vec::new(); }
    let data = fs::read_to_string(&path).unwrap_or_default();
    let mut db: Vec<serde_json::Map<String, Value>> = serde_json::from_str(&data).unwrap_or_else(|_| Vec::new());
    
    for item in db.iter_mut() {
        // ★ 修正：DBロード時に全楽曲の相対パス（musicFilename, imageFilename）を正規化クレンジング
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

pub fn save_db(db: &Vec<serde_json::Map<String, Value>>) -> Result<(), String> {
    let mut db_to_save = db.clone();
    for item in db_to_save.iter_mut() {
        item.remove("duration"); item.remove("imageData"); item.remove("streamUrl");
    }
    let path = get_base_dir().join("userfiles/music.json");
    let data = serde_json::to_string_pretty(&db_to_save).map_err(|e| e.to_string())?;
    fs::write(path, data).map_err(|e| e.to_string())
}

pub fn load_playlists_master() -> Vec<Value> {
    let path = get_base_dir().join("userfiles/playlist.json");
    if !path.exists() { return Vec::new(); }
    fs::read_to_string(&path).ok().and_then(|d| serde_json::from_str(&d).ok()).unwrap_or_default()
}

pub fn save_playlists_master(playlists: &[Value]) {
    let path = get_base_dir().join("userfiles/playlist.json");
    if let Ok(data) = serde_json::to_string_pretty(playlists) { let _ = fs::write(path, data); }
}

pub fn force_save_as_png(image_bytes: &[u8], target_path: &std::path::PathBuf) -> bool {
    if let Ok(img) = load_from_memory(image_bytes) {
        let mut final_img = img;
        if final_img.color().has_alpha() {
            let bg = image::RgbaImage::from_pixel(final_img.width(), final_img.height(), image::Rgba([255, 255, 255, 255]));
            let mut bg_dynamic = image::DynamicImage::ImageRgba8(bg);
            let _ = image::imageops::overlay(&mut bg_dynamic, &final_img, 0, 0);
            final_img = bg_dynamic;
        }
        return final_img.into_rgb8().save_with_format(target_path, image::ImageFormat::Png).is_ok();
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
        // パスの正規化
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
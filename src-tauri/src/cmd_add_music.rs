use serde_json::Value;
use std::fs;
use std::path::Path;
use rand::{rng, Rng};
use rand::distr::Alphanumeric;
use base64::{Engine as _, engine::general_purpose};
use std::collections::HashSet;
use std::os::windows::process::CommandExt;
use tauri::State;

use crate::AppState;
use crate::types::*;
use crate::utils::*;

fn verify_tool_executable(tool: &str) -> Result<(), String> {
    let b = crate::utils::get_base_dir().join("userfiles/bin");
    
    let allowed_files = ["yt-dlp.exe", "ffmpeg.exe", "deno.exe"];
    if let Ok(entries) = std::fs::read_dir(&b) {
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.is_file() {
                if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                    if !allowed_files.contains(&file_name) {
                        let _ = std::fs::remove_file(path);
                    }
                }
            } else if path.is_dir() {
                let _ = std::fs::remove_dir_all(path);
            }
        }
    }

    let exe = b.join(format!("{}.exe", tool));
    if !exe.exists() {
        return Err(format!("{} が見つかりません。拡張機能画面でインストールしてください。", tool));
    }
    
    let is_valid = if let Ok(m) = std::fs::metadata(&exe) {
        if m.len() < 10240 {
            false 
        } else {
            let (arg, keyword) = match tool {
                "yt-dlp" => ("--help", "yt-dlp"),
                "ffmpeg" => ("-version", "ffmpeg"),
                "deno" => ("--version", "deno"),
                _ => ("--version", tool),
            };
            if let Ok(out) = std::process::Command::new(&exe).arg(arg).creation_flags(0x08000000).output() {
                let stdout = String::from_utf8_lossy(&out.stdout).to_lowercase();
                let stderr = String::from_utf8_lossy(&out.stderr).to_lowercase();
                stdout.contains(keyword) || stderr.contains(keyword)
            } else { 
                false 
            }
        }
    } else { 
        false 
    };

    if !is_valid {
        return Err(format!("{} が不正なファイルです。拡張機能画面で正しいものをインストールしなおしてください。", tool));
    }
    
    Ok(())
}


#[tauri::command]
pub fn get_default_art_url() -> String { get_asset_url("library/images/default.png") }

#[tauri::command]
pub fn update_default_artwork(b64_data: String) -> bool {
    let b64 = if b64_data.contains(',') { b64_data.split(',').nth(1).unwrap() } else { &b64_data };
    general_purpose::STANDARD.decode(b64).ok().map(|bytes| force_save_as_png(&bytes, &get_base_dir().join("library/images/default.png"))).unwrap_or(false)
}

#[tauri::command]
pub fn reset_default_artwork() -> bool {
    let base = get_base_dir();
    fs::copy(base.join("app/icon/Chordia.png"), base.join("library/images/default.png")).is_ok()
}

#[tauri::command]
pub fn get_available_tags() -> Vec<TagInfo> {
    vec![
        TagInfo { key: "title".into(), label: "タイトル".into() }, TagInfo { key: "artist".into(), label: "アーティスト".into() },
        TagInfo { key: "album".into(), label: "アルバム".into() }, TagInfo { key: "genre".into(), label: "ジャンル".into() },
        TagInfo { key: "track".into(), label: "トラック".into() }, TagInfo { key: "year".into(), label: "年/日付".into() },
        TagInfo { key: "album_artist".into(), label: "アルバムアーティスト".into() }, TagInfo { key: "disc".into(), label: "ディスクNo".into() },
        TagInfo { key: "bpm".into(), label: "BPM".into() }, TagInfo { key: "composer".into(), label: "作曲者".into() },
        TagInfo { key: "comment".into(), label: "コメント".into() },
    ]
}

#[tauri::command]
pub fn get_autocomplete_lists(state: State<'_, AppState>) -> AutocompleteLists {
    let db = state.db.lock().unwrap();
    let (mut t, mut ar, mut al) = (HashSet::new(), HashSet::new(), HashSet::new());
    for item in db.iter() {
        if let Some(s) = item.get("title").and_then(|v| v.as_str()) { if !s.trim().is_empty() { t.insert(s.trim().into()); } }
        if let Some(s) = item.get("artist").and_then(|v| v.as_str()) { if !s.trim().is_empty() { ar.insert(s.trim().into()); } }
        if let Some(s) = item.get("album").and_then(|v| v.as_str()) { if !s.trim().is_empty() { al.insert(s.trim().into()); } }
    }
    let mut tv: Vec<_> = t.into_iter().collect(); tv.sort();
    let mut arv: Vec<_> = ar.into_iter().collect(); arv.sort();
    let mut alv: Vec<_> = al.into_iter().collect(); alv.sort();
    AutocompleteLists { title: tv, artist: arv, album: alv }
}

#[tauri::command]
pub fn check_duplicate_songs(title: String, artist: String, state: State<'_, AppState>) -> Vec<DuplicateSong> {
    let db = state.db.lock().unwrap();
    let (q_t, q_ar) = (title.trim().to_lowercase(), artist.trim().to_lowercase());
    if q_t.is_empty() || q_ar.is_empty() { return vec![]; }
    db.iter().filter(|i| {
        i.get("title").and_then(|v| v.as_str()).map(|s| s.trim().to_lowercase()) == Some(q_t.clone()) &&
        i.get("artist").and_then(|v| v.as_str()).map(|s| s.trim().to_lowercase()) == Some(q_ar.clone())
    }).map(|i| DuplicateSong {
        title: i.get("title").and_then(|v| v.as_str()).unwrap_or("").into(),
        artist: i.get("artist").and_then(|v| v.as_str()).unwrap_or("").into(),
        album: i.get("album").and_then(|v| v.as_str()).unwrap_or("").into(),
        filename: Path::new(i.get("musicFilename").and_then(|v| v.as_str()).unwrap_or("")).file_name().and_then(|n| n.to_str()).unwrap_or("").into(),
        image_data: get_asset_url(i.get("imageFilename").and_then(|v| v.as_str()).unwrap_or("")),
    }).collect()
}

// ★ 修正：非同期コマンド化し、重いプロセス起動を spawn_blocking に移譲
#[tauri::command]
pub async fn check_tools_status() -> Result<Value, String> {
    tokio::task::spawn_blocking(|| {
        Ok(serde_json::json!({
            "yt-dlp": verify_tool_executable("yt-dlp").is_ok(),
            "ffmpeg": verify_tool_executable("ffmpeg").is_ok(),
            "deno": verify_tool_executable("deno").is_ok()
        }))
    }).await.map_err(|e| format!("ステータス確認スレッドエラー: {}", e))?
}

#[tauri::command]
pub fn fetch_video_info(url: String) -> Value {
    if let Err(msg) = verify_tool_executable("yt-dlp") {
        return serde_json::json!({"status": "error", "message": msg});
    }

    let exe = get_base_dir().join("userfiles/bin/yt-dlp.exe");
    let out = std::process::Command::new(exe).args(&["--dump-json", "--no-playlist", "--skip-download", &url]).creation_flags(0x08000000).output();
    match out {
        Ok(o) if o.status.success() => serde_json::from_str::<Value>(&String::from_utf8_lossy(&o.stdout)).map(|i| serde_json::json!({
            "status": "success", "title": i["title"], "duration": i["duration"], "thumbnail": i["thumbnail"], "uploader": i["uploader"]
        })).unwrap_or(serde_json::json!({"status": "error", "message": "JSON error"})),
        Ok(o) => serde_json::json!({"status": "error", "message": String::from_utf8_lossy(&o.stderr).trim()}),
        Err(e) => serde_json::json!({"status": "error", "message": e.to_string()}),
    }
}

#[tauri::command]
pub fn fetch_youtube_playlist(url: String) -> Value {
    if let Err(msg) = verify_tool_executable("yt-dlp") {
        return serde_json::json!({"status": "error", "message": msg});
    }

    let exe = get_base_dir().join("userfiles/bin/yt-dlp.exe");
    let out = std::process::Command::new(exe).args(&["--dump-json", "--flat-playlist", &url]).creation_flags(0x08000000).output();
    match out {
        Ok(o) if o.status.success() => {
            let v: Vec<_> = String::from_utf8_lossy(&o.stdout).lines().filter_map(|l| serde_json::from_str::<Value>(l).ok())
                .filter(|i| i["title"] != "[Private video]" && i["title"] != "[Deleted video]")
                .map(|i| {
                    let id = i["id"].as_str().unwrap_or("");
                    let thumb_url = if let Some(t) = i["thumbnail"].as_str() {
                        t.to_string()
                    } else if !id.is_empty() {
                        format!("https://img.youtube.com/vi/{}/hqdefault.jpg", id)
                    } else {
                        "".to_string()
                    };
                    
                    serde_json::json!({
                        "title": i["title"], "uploader": i["uploader"], "duration": i["duration"], "thumbnail": thumb_url,
                        "url": i["url"].as_str().map(|s| s.into()).unwrap_or(format!("https://www.youtube.com/watch?v={}", id))
                    })
                }).collect();
            serde_json::json!({"status": "success", "videos": v})
        },
        Ok(o) => serde_json::json!({"status": "error", "message": String::from_utf8_lossy(&o.stderr).trim()}),
        Err(e) => serde_json::json!({"status": "error", "message": e.to_string()}),
    }
}

#[tauri::command]
pub fn fetch_and_crop_thumbnail(url: String) -> Option<String> {
    let u = if url.starts_with("//") { format!("https:{}", url) } else { url };
    let c = reqwest::blocking::Client::builder().timeout(std::time::Duration::from_secs(10)).user_agent("Mozilla/5.0").build().ok()?;
    let b = c.get(&u).send().ok()?.bytes().ok()?;
    let i = image::load_from_memory(&b).ok()?;
    
    let (width, height) = (i.width(), i.height());
    let (eff_w, eff_h, off_x, off_y) = if (width as f32 / height as f32 - 1.333).abs() < 0.05 {
        let real_h = (width as f32 * 9.0 / 16.0) as u32;
        (width, real_h, 0, (height - real_h) / 2) 
    } else {
        (width, height, 0, 0)
    };

    let s = std::cmp::min(eff_w, eff_h);
    let mut ic = i.crop_imm(off_x + (eff_w - s) / 2, off_y + (eff_h - s) / 2, s, s);
    
    if ic.color().has_alpha() {
        let mut bg = image::DynamicImage::ImageRgba8(image::RgbaImage::from_pixel(s, s, image::Rgba([255, 255, 255, 255])));
        image::imageops::overlay(&mut bg, &ic, 0, 0); 
        ic = bg;
    }
    
    let mut buf = std::io::Cursor::new(Vec::new()); 
    ic.write_to(&mut buf, image::ImageFormat::Png).ok()?;
    Some(format!("data:image/png;base64,{}", general_purpose::STANDARD.encode(buf.into_inner())))
}

#[tauri::command]
pub fn fetch_and_crop_image_url(url: String) -> Value {
    fetch_and_crop_thumbnail(url).map(|b| serde_json::json!({"status": "success", "data": b})).unwrap_or(serde_json::json!({"status": "error", "message": "Failed"}))
}

#[tauri::command]
pub fn extract_artwork_from_local_file(b64_music: String) -> Option<String> {
    let b64c = if b64_music.contains(',') { b64_music.split(',').nth(1).unwrap() } else { &b64_music };
    let b = general_purpose::STANDARD.decode(b64c).ok()?;
    let t = id3::Tag::read_from2(&mut std::io::Cursor::new(&b)).ok()?;
    let p = t.pictures().next()?;
    let i = image::load_from_memory(&p.data).ok()?;
    let s = std::cmp::min(i.width(), i.height());
    let mut ic = i.crop_imm((i.width()-s)/2, (i.height()-s)/2, s, s);
    if ic.color().has_alpha() {
        let mut bg = image::DynamicImage::ImageRgba8(image::RgbaImage::from_pixel(s, s, image::Rgba([255, 255, 255, 255])));
        image::imageops::overlay(&mut bg, &ic, 0, 0); ic = bg;
    }
    let mut buf = std::io::Cursor::new(Vec::new()); ic.write_to(&mut buf, image::ImageFormat::Png).ok()?;
    Some(format!("data:image/png;base64,{}", general_purpose::STANDARD.encode(buf.into_inner())))
}

#[tauri::command]
pub fn download_original_thumbnail(url: String) -> Value {
    if let Some(p) = rfd::FileDialog::new().set_title("Save Thumbnail").add_filter("Image", &["png", "jpg"]).save_file() {
        let u = if url.starts_with("//") { format!("https:{}", url) } else { url };
        let c = reqwest::blocking::Client::builder().timeout(std::time::Duration::from_secs(10)).user_agent("Mozilla/5.0").build().ok().and_then(|c| c.get(&u).send().ok()).and_then(|r| r.bytes().ok());
        if let Some(b) = c { if fs::write(p, b).is_ok() { return serde_json::json!({"status": "success", "message": "Saved"}); } }
        serde_json::json!({"status": "error", "message": "Failed"})
    } else { serde_json::json!({"status": "cancel", "message": "Canceled"}) }
}

#[tauri::command]
pub fn download_and_save_music(mut data: serde_json::Map<String, Value>, state: State<'_, AppState>) -> Result<bool, String> {
    verify_tool_executable("yt-dlp")?;
    verify_tool_executable("ffmpeg")?;

    let base = get_base_dir();
    let bin = base.join("userfiles/bin");
    let url = data.get("video_url").and_then(|v| v.as_str()).ok_or("No URL")?.to_string();
    let f_id: String = rng().sample_iter(&Alphanumeric).take(32).map(char::from).collect();
    let _ = fs::create_dir_all(base.join("library/music")); let _ = fs::create_dir_all(base.join("library/images"));
    
    let out = std::process::Command::new(bin.join("yt-dlp.exe"))
        .args(&["--no-playlist", "--extract-audio", "--audio-format", "mp3", "--audio-quality", "0", "-o", base.join(format!("library/music/{}.%(ext)s", f_id)).to_str().unwrap(), &url])
        .creation_flags(0x08000000)
        .output()
        .map_err(|e| e.to_string())?;
        
    if !out.status.success() { return Err(String::from_utf8_lossy(&out.stderr).into()); }
    
    let mut i_rel = "library/images/default.png".to_string();
    if let Some(art) = data.get("artwork_data").and_then(|v| v.as_str()) {
        if !art.is_empty() {
            let bc = if art.contains(',') { art.split(',').nth(1).unwrap() } else { art };
            if let Ok(by) = general_purpose::STANDARD.decode(bc) {
                let ir = format!("library/images/{}.png", f_id);
                if force_save_as_png(&by, &base.join(&ir)) { i_rel = ir; }
            }
        }
    }
    
    let mut db = state.db.lock().unwrap();
    data.remove("video_url"); data.remove("artwork_data");
    
    if let Some(l) = data.get("lyric").and_then(|v| v.as_str()) {
        let clean = l.replace("\r\n", "\n").replace("\r", "\n");
        data.insert("lyric".to_string(), Value::String(clean));
    }
    
    let m_rel = format!("library/music/{}.mp3", f_id);
    data.insert("musicFilename".into(), m_rel.clone().into());
    data.insert("streamUrl".into(), get_asset_url(&m_rel).into());
    
    data.insert("imageFilename".into(), i_rel.clone().into());
    data.insert("imageData".into(), get_asset_url(&i_rel).into());

    let duration_str = get_duration_str(Some(&Value::String(m_rel)));
    data.insert("duration".to_string(), Value::String(duration_str));
    
    db.push(data.clone()); 
    let _ = save_db(&db); 
    Ok(true)
}

#[tauri::command]
pub fn save_music_data(mut data: serde_json::Map<String, Value>, state: State<'_, AppState>) -> Result<bool, String> {
    let base = get_base_dir();
    let _ = fs::create_dir_all(base.join("library/music"));
    let _ = fs::create_dir_all(base.join("library/images"));
    let _ = fs::create_dir_all(base.join("userfiles"));

    let f_id: String = rng().sample_iter(&Alphanumeric).take(32).map(char::from).collect();
    let mut ext = "mp3".to_string();

    if let Some(music_data_b64) = data.get("music_data").and_then(|v| v.as_str()) {
        let b64_clean = if music_data_b64.contains(',') { music_data_b64.split(',').nth(1).unwrap() } else { music_data_b64 };
        let bytes = general_purpose::STANDARD.decode(b64_clean).map_err(|e| e.to_string())?;
        if let Some(name) = data.get("music_name").and_then(|v| v.as_str()) {
            if let Some(e) = std::path::Path::new(name).extension().and_then(|e| e.to_str()) { ext = e.to_string(); }
        }
        let rel_music_path = format!("library/music/{}.{}", f_id, ext);
        fs::write(base.join(&rel_music_path), bytes).map_err(|e| e.to_string())?;
        data.insert("musicFilename".to_string(), Value::String(rel_music_path.clone()));
        data.insert("streamUrl".to_string(), Value::String(get_asset_url(&rel_music_path)));

        let duration_str = get_duration_str(Some(&Value::String(rel_music_path)));
        data.insert("duration".to_string(), Value::String(duration_str));
    }

    if let Some(artwork_data) = data.get("artwork_data").and_then(|v| v.as_str()) {
        let b64_clean = if artwork_data.contains(',') { artwork_data.split(',').nth(1).unwrap() } else { artwork_data };
        if let Ok(bytes) = general_purpose::STANDARD.decode(b64_clean) {
            let rel_img_path = format!("library/images/{}.png", f_id);
            if force_save_as_png(&bytes, &base.join(&rel_img_path)) {
                data.insert("imageFilename".to_string(), Value::String(rel_img_path.clone()));
                data.insert("imageData".to_string(), Value::String(get_asset_url(&rel_img_path)));
            }
        }
    } else {
        data.insert("imageFilename".to_string(), Value::String("library/images/default.png".to_string()));
        data.insert("imageData".to_string(), Value::String(get_asset_url("library/images/default.png")));
    }

    let mut db_guard = state.db.lock().unwrap();
    data.remove("music_data"); data.remove("music_name"); data.remove("artwork_data"); data.remove("artwork_type");
    
    if let Some(l) = data.get("lyric").and_then(|v| v.as_str()) {
        let clean = l.replace("\r\n", "\n").replace("\r", "\n");
        data.insert("lyric".to_string(), Value::String(clean));
    }

    db_guard.push(data);
    let _ = save_db(&db_guard);
    Ok(true)
}

#[tauri::command]
pub async fn search_lyrics_online(title: String, artist: String) -> Result<Value, String> {
    let url = format!("https://lrclib.net/api/search?track_name={}&artist_name={}", urlencoding::encode(&title), urlencoding::encode(&artist));
    let client = reqwest::Client::builder().user_agent("Chordia/1.0").build().map_err(|e| e.to_string())?;
    let res = client.get(url).send().await.map_err(|e| e.to_string())?;
    let json: Value = res.json().await.map_err(|e| e.to_string())?;
    Ok(json)
}
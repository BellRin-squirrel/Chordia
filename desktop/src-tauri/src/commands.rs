use serde_json::Value;
use ini::Ini;
use std::path::Path;
use std::fs;
use rand::{rng, Rng};
use rand::distr::Alphanumeric;
use base64::{Engine as _, engine::general_purpose};
use std::collections::HashSet;
use std::os::windows::process::CommandExt;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder, State};
use chrono::Local;

use crate::AppState;
use crate::types::*;
use crate::utils::*;

// ==========================================
// ウィンドウ管理
// ==========================================

#[tauri::command]
pub async fn open_new_window(app: AppHandle, label: String, url: String, title: String, width: f64, height: f64) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&label) { 
        let _ = window.set_focus(); 
        return Ok(()); 
    }
    
    let mut builder = WebviewWindowBuilder::new(&app, label.clone(), WebviewUrl::App(url.into()))
        .title(title)
        .inner_size(width, height)
        .resizable(true);

    if label == "mini_player_window" {
        builder = builder.decorations(false).transparent(true);
    }

    builder.build().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn set_mini_player_mode(app: tauri::AppHandle, mode: String) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("mini_player_window") {
        match mode.as_str() {
            "large" => { let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize { width: 450.0, height: 750.0 })); }
            "medium" => { let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize { width: 320.0, height: 550.0 })); }
            "small" => { let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize { width: 250.0, height: 250.0 })); }
            _ => {}
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn close_mini_player(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("mini_player_window") { let _ = window.close(); }
    Ok(())
}

#[tauri::command]
pub async fn make_window_square(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("mini_player_window") {
        if let Ok(size) = window.outer_size() {
            let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize { width: size.width, height: size.width }));
        }
    }
    Ok(())
}

// ==========================================
// 設定・テーマ管理
// ==========================================

#[tauri::command]
pub fn get_app_settings() -> AppSettings {
    let base = get_base_dir();
    let path = base.join("userfiles/settings.ini");
    let conf = Ini::load_from_file(&path).unwrap_or_else(|_| Ini::new());
    let get_bool = |s, k, d| conf.section(Some(s)).and_then(|sec| sec.get(k)).map(|v| v.to_lowercase() == "true").unwrap_or(d);
    let get_str = |s, k, d: &str| conf.section(Some(s)).and_then(|sec| sec.get(k)).unwrap_or(d).to_string();
    let get_int = |s, k, d| conf.section(Some(s)).and_then(|sec| sec.get(k)).and_then(|v| v.parse().ok()).unwrap_or(d);

    AppSettings {
        items_per_page: get_int("Database", "items_per_page", 50),
        open_player_new_window: get_bool("Database", "open_player_new_window", false),
        open_manage_new_window: get_bool("Database", "open_manage_new_window", false),
        developer_mode: get_bool("Database", "developer_mode", false),
        lazy_load_playlists: false,
        primary_color: get_str("Theme", "primary_color", "#4f46e5"),
        background_color: get_str("Theme", "background_color", "#f3f4f6"),
        sub_background_color: get_str("Theme", "sub_background_color", "#ffffff"),
        text_color: get_str("Theme", "text_color", "#1f2937"),
        theme_mode: get_str("Theme", "theme_mode", "light"),
        active_tags: get_str("Tags", "active_tags", "title,artist,album,genre,track").split(',').map(|s| s.trim().to_string()).collect(),
        player_visible_tags: get_str("Tags", "player_visible_tags", "title,artist,album,track").split(',').map(|s| s.trim().to_string()).collect(),
    }
}

#[tauri::command]
pub fn save_app_settings(settings: AppSettings) -> bool {
    let path = get_base_dir().join("userfiles/settings.ini");
    let mut conf = Ini::load_from_file(&path).unwrap_or_else(|_| Ini::new());
    conf.with_section(Some("Database")).set("items_per_page", settings.items_per_page.to_string()).set("open_player_new_window", settings.open_player_new_window.to_string()).set("open_manage_new_window", settings.open_manage_new_window.to_string()).set("developer_mode", settings.developer_mode.to_string()).set("lazy_load_playlists", settings.lazy_load_playlists.to_string());
    conf.with_section(Some("Theme")).set("primary_color", settings.primary_color).set("background_color", settings.background_color).set("sub_background_color", settings.sub_background_color).set("text_color", settings.text_color).set("theme_mode", settings.theme_mode);
    conf.with_section(Some("Tags")).set("active_tags", settings.active_tags.join(",")).set("player_visible_tags", settings.player_visible_tags.join(","));
    conf.write_to_file(path).is_ok()
}

#[tauri::command]
pub fn get_custom_themes() -> Value {
    let path = get_base_dir().join("userfiles/custom_themes.json");
    fs::read_to_string(&path).ok().and_then(|d| serde_json::from_str(&d).ok()).unwrap_or(serde_json::json!({}))
}

#[tauri::command]
pub fn save_custom_theme(name: String, colors: Value) -> bool {
    let path = get_base_dir().join("userfiles/custom_themes.json");
    let mut themes: serde_json::Map<String, Value> = fs::read_to_string(&path).ok().and_then(|d| serde_json::from_str(&d).ok()).unwrap_or_default();
    themes.insert(name, colors);
    serde_json::to_string_pretty(&themes).ok().and_then(|s| fs::write(path, s).ok()).is_some()
}

#[tauri::command]
pub fn delete_custom_theme(name: String) -> bool {
    let path = get_base_dir().join("userfiles/custom_themes.json");
    let mut themes: serde_json::Map<String, Value> = fs::read_to_string(&path).ok().and_then(|d| serde_json::from_str(&d).ok()).unwrap_or_default();
    if themes.remove(&name).is_some() { serde_json::to_string_pretty(&themes).ok().and_then(|s| fs::write(path, s).ok()).is_some() } else { false }
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

// ==========================================
// プレイリスト関連
// ==========================================

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
    let mut pl_clone = None;
    {
        let master = state.playlists.lock().unwrap();
        if let Some(pl) = master.iter().find(|p| p.get("id").and_then(|v| v.as_str()) == Some(&pl_id)) {
            pl_clone = Some(pl.clone());
        }
    }

    if let Some(mut pl) = pl_clone {
        if field == "music" && pl.get("type").and_then(|v| v.as_str()) != Some("smart") {
            let base = get_base_dir();
            let _ = fs::create_dir_all(base.join("userfiles/playlist"));
            let _ = fs::write(base.join(format!("userfiles/playlist/{}.json", pl_id)), serde_json::to_string_pretty(&value).unwrap_or_default());
        } else {
            if let Some(obj) = pl.as_object_mut() {
                obj.insert(field, value);
            }
            let mut master = state.playlists.lock().unwrap();
            if let Some(target) = master.iter_mut().find(|p| p.get("id").and_then(|v| v.as_str()) == Some(&pl_id)) {
                *target = pl.clone();
            }
            save_playlists_master(&master);
        }
        return Some(pl);
    }
    None
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
    let mut pl_clone = None;
    {
        let master = state.playlists.lock().unwrap();
        if let Some(src_pl) = master.iter().find(|p| p.get("id").and_then(|v| v.as_str()) == Some(&pl_id)).cloned() {
            pl_clone = Some(src_pl);
        }
    }

    if let Some(src_pl) = pl_clone {
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
        
        let mut master = state.playlists.lock().unwrap();
        master.push(new_pl.clone());
        save_playlists_master(&master);
        return Some(new_pl);
    }
    None
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
    let mut pl_clone = None;
    {
        let master = state.playlists.lock().unwrap();
        if let Some(pl) = master.iter().find(|p| p.get("id").and_then(|v| v.as_str()) == Some(&pl_id)) {
            pl_clone = Some(pl.clone());
        }
    }
    if let Some(mut pl) = pl_clone {
        if let Some(obj) = pl.as_object_mut() {
            obj.insert("playlistName".to_string(), Value::String(name));
            obj.insert("conditions".to_string(), conditions);
        }
        let mut master = state.playlists.lock().unwrap();
        if let Some(target) = master.iter_mut().find(|p| p.get("id").and_then(|v| v.as_str()) == Some(&pl_id)) {
            *target = pl.clone();
        }
        save_playlists_master(&master);
        return Some(pl);
    }
    None
}

#[tauri::command]
pub fn convert_smart_to_normal_and_remove_songs(pl_id: String, filenames: Vec<String>, state: State<'_, AppState>) -> Option<Value> {
    let mut current_music = Vec::new();
    let mut pl_clone = None;
    
    {
        let mut master = state.playlists.lock().unwrap();
        if let Some(pl) = master.iter_mut().find(|p| p.get("id").and_then(|v| v.as_str()) == Some(&pl_id)) {
            if let Some(conds) = pl.get("conditions").cloned() {
                let db = state.db.lock().unwrap();
                for song in db.iter() {
                    if evaluate_smart_rules(song, &conds) {
                        if let Some(fname) = song.get("musicFilename").and_then(|v| v.as_str()) {
                            current_music.push(Path::new(fname).file_name().unwrap_or_default().to_str().unwrap_or("").to_string());
                        }
                    }
                }
            }
            if let Some(obj) = pl.as_object_mut() {
                obj.insert("type".to_string(), Value::String("normal".to_string()));
                obj.remove("conditions");
            }
            save_playlists_master(&master);
            pl_clone = Some(pl.clone());
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

// ==========================================
// データベース管理
// ==========================================

#[tauri::command]
pub fn get_library_count(search_query: String, state: State<'_, AppState>) -> usize {
    let db = state.db.lock().unwrap();
    db.iter().filter(|i| if search_query.is_empty() { true } else { match_search(i, &search_query) }).count()
}

#[tauri::command]
pub fn get_library_chunk(page: usize, limit: usize, sort_field: Option<String>, sort_desc: bool, search_query: String, state: State<'_, AppState>) -> Vec<serde_json::Map<String, Value>> {
    let mut db = state.db.lock().unwrap().clone();
    db.retain(|i| search_query.is_empty() || match_search(i, &search_query));
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
        save_db(&db).is_ok()
    } else { false }
}

#[tauri::command]
pub fn update_song_artwork_by_id(music_filename: String, new_art_base64: Option<String>, remove: bool, state: State<'_, AppState>) -> bool {
    let mut db = state.db.lock().unwrap();
    if let Some(target) = db.iter_mut().find(|i| i.get("musicFilename").and_then(|v| v.as_str()) == Some(&music_filename)) {
        if let Some(old) = target.get("imageFilename").and_then(|v| v.as_str()) { if !old.contains("default.png") { let _ = fs::remove_file(get_base_dir().join(old)); } }
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
        save_db(&db).is_ok()
    } else { false }
}

#[tauri::command]
pub fn delete_song_by_id(music_filename: String, state: State<'_, AppState>) -> bool {
    let mut db = state.db.lock().unwrap();
    if let Some(pos) = db.iter().position(|i| i.get("musicFilename").and_then(|v| v.as_str()) == Some(&music_filename)) {
        let i = db.remove(pos);
        if let Some(p) = i.get("musicFilename").and_then(|v| v.as_str()) { let _ = fs::remove_file(get_base_dir().join(p)); }
        if let Some(p) = i.get("imageFilename").and_then(|v| v.as_str()) { if !p.contains("default.png") { let _ = fs::remove_file(get_base_dir().join(p)); } }
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
    res
}

#[tauri::command]
pub fn update_multiple_songs(filenames: Vec<String>, updates: serde_json::Map<String, Value>, state: State<'_, AppState>) -> Value {
    let mut db = state.db.lock().unwrap();
    let mut count = 0;
    let up: Vec<_> = updates.into_iter().filter(|(_, v)| v.as_str() != Some("< 維持 >")).collect();
    for i in db.iter_mut() {
        if filenames.contains(&i.get("musicFilename").and_then(|v| v.as_str()).unwrap_or("").split(&['/', '\\'][..]).last().unwrap_or("").into()) {
            for (k, v) in &up { i.insert(k.clone(), v.clone()); }
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
    db.retain(|i| {
        if filenames.contains(&i.get("musicFilename").and_then(|v| v.as_str()).unwrap_or("").split(&['/', '\\'][..]).last().unwrap_or("").into()) {
            if let Some(p) = i.get("musicFilename").and_then(|v| v.as_str()) { let _ = fs::remove_file(get_base_dir().join(p)); }
            if let Some(p) = i.get("imageFilename").and_then(|v| v.as_str()) { if !p.contains("default.png") { let _ = fs::remove_file(get_base_dir().join(p)); } }
            count += 1; false
        } else { true }
    });
    let _ = save_db(&db); serde_json::json!({"success": true, "count": count})
}

// ==========================================
// 外部ツールとダウンロード
// ==========================================
#[tauri::command]
pub fn check_tools_status() -> Value {
    let b = get_base_dir().join("userfiles/bin");
    serde_json::json!({"yt-dlp": b.join("yt-dlp.exe").exists(), "ffmpeg": b.join("ffmpeg.exe").exists(), "deno": b.join("deno.exe").exists()})
}

#[tauri::command]
pub fn fetch_video_info(url: String) -> Value {
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
    let exe = get_base_dir().join("userfiles/bin/yt-dlp.exe");
    let out = std::process::Command::new(exe).args(&["--dump-json", "--flat-playlist", &url]).creation_flags(0x08000000).output();
    match out {
        Ok(o) if o.status.success() => {
            let v: Vec<_> = String::from_utf8_lossy(&o.stdout).lines().filter_map(|l| serde_json::from_str::<Value>(l).ok())
                .filter(|i| i["title"] != "[Private video]" && i["title"] != "[Deleted video]")
                .map(|i| serde_json::json!({
                    "title": i["title"], "uploader": i["uploader"], "duration": i["duration"], "thumbnail": i["thumbnail"],
                    "url": i["url"].as_str().map(|s| s.into()).unwrap_or(format!("https://www.youtube.com/watch?v={}", i["id"].as_str().unwrap_or("")))
                })).collect();
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

#[tauri::command]
pub fn get_playback_history() -> Vec<Value> {
    let h_path = get_base_dir().join("userfiles/history.json");
    fs::read_to_string(&h_path).ok().and_then(|d| serde_json::from_str::<Vec<Value>>(&d).ok()).map(|mut v| { v.reverse(); v }).unwrap_or_default()
}
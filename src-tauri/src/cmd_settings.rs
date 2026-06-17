use serde_json::Value;
use ini::Ini;
use std::fs;

use crate::types::AppSettings;
use crate::utils::get_base_dir;

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
    let base = get_base_dir();
    let dir = base.join("userfiles");
    // ★修正: ファイルを作成する前に、確実に親ディレクトリを生成する
    let _ = fs::create_dir_all(&dir);

    let path = dir.join("settings.ini");
    let mut conf = Ini::load_from_file(&path).unwrap_or_else(|_| Ini::new());
    conf.with_section(Some("Database"))
        .set("items_per_page", settings.items_per_page.to_string())
        .set("open_player_new_window", settings.open_player_new_window.to_string())
        .set("open_manage_new_window", settings.open_manage_new_window.to_string())
        .set("developer_mode", settings.developer_mode.to_string())
        .set("lazy_load_playlists", settings.lazy_load_playlists.to_string());
    
    conf.with_section(Some("Theme"))
        .set("primary_color", settings.primary_color)
        .set("background_color", settings.background_color)
        .set("sub_background_color", settings.sub_background_color)
        .set("text_color", settings.text_color)
        .set("theme_mode", settings.theme_mode);
        
    conf.with_section(Some("Tags"))
        .set("active_tags", settings.active_tags.join(","))
        .set("player_visible_tags", settings.player_visible_tags.join(","));
        
    conf.write_to_file(path).is_ok()
}

#[tauri::command]
pub fn get_custom_themes() -> Value {
    let path = get_base_dir().join("userfiles/custom_themes.json");
    fs::read_to_string(&path).ok().and_then(|d| serde_json::from_str(&d).ok()).unwrap_or(serde_json::json!({}))
}

#[tauri::command]
pub fn save_custom_theme(name: String, colors: Value) -> bool {
    let dir = get_base_dir().join("userfiles");
    let _ = fs::create_dir_all(&dir);
    let path = dir.join("custom_themes.json");
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
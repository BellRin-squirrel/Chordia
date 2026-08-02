use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub items_per_page: i32,
    pub open_player_new_window: bool,
    pub open_manage_new_window: bool,
    pub open_extensions_new_window: bool,
    pub open_add_music_new_window: bool,  // ★ 追加
    pub open_settings_new_window: bool,   // ★ 追加
    pub lazy_load_playlists: bool,
    pub primary_color: String,
    pub background_color: String,
    pub sub_background_color: String,
    pub text_color: String,
    pub theme_mode: String,
    pub active_tags: Vec<String>,
    pub player_visible_tags: Vec<String>,
    pub normalize_volume: bool,
}

#[derive(Serialize, Clone)]
pub struct TagInfo {
    pub key: String,
    pub label: String,
}

#[derive(Serialize, Clone)]
pub struct AutocompleteLists {
    pub title: Vec<String>,
    pub artist: Vec<String>,
    pub album: Vec<String>,
}

#[derive(Serialize, Clone)]
pub struct DuplicateSong {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub filename: String,
    #[serde(rename = "imageData")]
    pub image_data: String,
}
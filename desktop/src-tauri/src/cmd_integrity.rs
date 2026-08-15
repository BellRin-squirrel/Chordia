use serde::Serialize;
use serde_json::Value;
use std::collections::HashSet;
use std::fs;
use tauri::State;
use id3::{Tag, TagLike};
use ini::Ini;

use crate::AppState;
use crate::utils::{get_base_dir, normalize_rel_path, load_lufs_cache};

#[derive(Serialize, Clone)]
pub struct TagMismatchItem {
    pub filename: String,
    pub title: String,
    pub field: String,
    pub db_value: String,
    pub file_value: String,
}

#[derive(Serialize, Clone)]
pub struct BinCheckResult {
    pub missing_tools: Vec<String>,
    pub invalid_tools: Vec<String>,
    pub unexpected_files: Vec<String>,
}

#[derive(Serialize, Clone)]
pub struct UncalculatedLufsItem {
    pub filename: String,
    pub title: String,
    pub artist: String,
}

#[derive(Serialize, Clone)]
pub struct CorruptedFileItem {
    pub filepath: String,
    pub error_reason: String,
}

#[derive(Serialize, Clone)]
pub struct IntegrityReport {
    pub tag_mismatches: Vec<TagMismatchItem>,
    pub bin_status: BinCheckResult,
    pub uncalculated_lufs: Vec<UncalculatedLufsItem>,
    pub corrupted_userfiles: Vec<CorruptedFileItem>,
    pub orphan_music_files: Vec<String>,
    pub orphan_image_files: Vec<String>,
    pub missing_music_files: Vec<String>,
    pub missing_image_files: Vec<String>,
}

#[tauri::command]
pub async fn check_system_integrity(state: State<'_, AppState>) -> Result<IntegrityReport, String> {
    let db_data = state.db.lock().unwrap().clone();

    // ★ 修正: spawn_blocking の外でディスクキャッシュの読み込みとメモリの同期を実行
    let disk_lufs_cache = load_lufs_cache();
    {
        let mut cache_guard = state.lufs_cache.lock().unwrap();
        *cache_guard = disk_lufs_cache.clone();
    }

    tokio::task::spawn_blocking(move || {
        let base_dir = get_base_dir();
        
        // --- 1. MP3タグ・歌詞の不整合確認 ---
        let mut tag_mismatches = Vec::new();

        for song in db_data.iter() {
            let rel_music = song.get("musicFilename").and_then(|v| v.as_str()).unwrap_or("");
            if rel_music.is_empty() { continue; }

            let abs_music_path = base_dir.join(normalize_rel_path(rel_music));
            if abs_music_path.exists() && abs_music_path.extension().and_then(|e| e.to_str()).map(|e| e.to_lowercase()) == Some("mp3".to_string()) {
                if let Ok(tag) = Tag::read_from_path(&abs_music_path) {
                    let song_title = song.get("title").and_then(|v| v.as_str()).unwrap_or("");

                    let checks = [
                        ("title", song.get("title").and_then(|v| v.as_str()).unwrap_or(""), tag.title().unwrap_or("")),
                        ("artist", song.get("artist").and_then(|v| v.as_str()).unwrap_or(""), tag.artist().unwrap_or("")),
                        ("album", song.get("album").and_then(|v| v.as_str()).unwrap_or(""), tag.album().unwrap_or("")),
                        ("genre", song.get("genre").and_then(|v| v.as_str()).unwrap_or(""), tag.genre().unwrap_or("")),
                        ("album_artist", song.get("album_artist").and_then(|v| v.as_str()).unwrap_or(""), tag.album_artist().unwrap_or("")),
                    ];

                    for (field, db_val, tag_val) in checks {
                        if db_val.trim() != tag_val.trim() {
                            tag_mismatches.push(TagMismatchItem {
                                filename: rel_music.to_string(),
                                title: song_title.to_string(),
                                field: field.to_string(),
                                db_value: db_val.to_string(),
                                file_value: tag_val.to_string(),
                            });
                        }
                    }

                    // 歌詞の不整合確認
                    let db_lyric = song.get("lyric").and_then(|v| v.as_str()).unwrap_or("").replace("\r\n", "\n").replace('\r', "\n");
                    let tag_lyric = tag.lyrics().next().map(|l| l.text.replace("\r\n", "\n").replace('\r', "\n")).unwrap_or_default();
                    if db_lyric.trim() != tag_lyric.trim() {
                        tag_mismatches.push(TagMismatchItem {
                            filename: rel_music.to_string(),
                            title: song_title.to_string(),
                            field: "lyric".to_string(),
                            db_value: db_lyric,
                            file_value: tag_lyric,
                        });
                    }
                }
            }
        }

        // --- 2. 拡張機能 (bin) チェック ---
        let bin_dir = base_dir.join("userfiles/bin");
        let ext = if cfg!(target_os = "windows") { ".exe" } else { "" };
        let required_tools = ["yt-dlp", "ffmpeg", "deno", "cloudflared"];
        let allowed_filenames: Vec<String> = required_tools.iter().map(|t| format!("{}{}", t, ext)).collect();

        let mut missing_tools = Vec::new();
        let mut invalid_tools = Vec::new();
        let mut unexpected_files = Vec::new();

        for tool in required_tools {
            let exe_path = bin_dir.join(format!("{}{}", tool, ext));
            if !exe_path.exists() {
                missing_tools.push(tool.to_string());
            } else if let Ok(m) = fs::metadata(&exe_path) {
                if m.len() < 10240 {
                    invalid_tools.push(tool.to_string());
                }
            }
        }

        if let Ok(entries) = fs::read_dir(&bin_dir) {
            for entry in entries.filter_map(|e| e.ok()) {
                if let Some(file_name) = entry.path().file_name().and_then(|n| n.to_str()) {
                    if !allowed_filenames.contains(&file_name.to_string()) {
                        unexpected_files.push(file_name.to_string());
                    }
                }
            }
        }

        let bin_status = BinCheckResult {
            missing_tools,
            invalid_tools,
            unexpected_files,
        };

        // --- 3. LUFS未計測曲の検出 (所有権を持った disk_lufs_cache を利用) ---
        let mut uncalculated_lufs = Vec::new();

        for song in db_data.iter() {
            if let Some(rel_music) = song.get("musicFilename").and_then(|v| v.as_str()) {
                let norm_music = normalize_rel_path(rel_music);
                
                if !disk_lufs_cache.contains_key(&norm_music) && !disk_lufs_cache.contains_key(rel_music) {
                    uncalculated_lufs.push(UncalculatedLufsItem {
                        filename: norm_music.clone(),
                        title: song.get("title").and_then(|v| v.as_str()).unwrap_or("Unknown").to_string(),
                        artist: song.get("artist").and_then(|v| v.as_str()).unwrap_or("Unknown").to_string(),
                    });
                }
            }
        }

        // --- 4. userfilesフォルダ内のファイル破損チェック ---
        let mut corrupted_userfiles = Vec::new();
        let userfiles_dir = base_dir.join("userfiles");

        let json_files = [
            "music.json",
            "playlist.json",
            "history.json",
            "played_times.json",
            "lufs_cache.json",
            "custom_themes.json",
            "playlist_covers.json",
        ];

        for json_file in json_files {
            let p = userfiles_dir.join(json_file);
            if p.exists() {
                if let Ok(content) = fs::read_to_string(&p) {
                    if serde_json::from_str::<Value>(&content).is_err() {
                        corrupted_userfiles.push(CorruptedFileItem {
                            filepath: format!("userfiles/{}", json_file),
                            error_reason: "JSON構文エラー".to_string(),
                        });
                    }
                } else {
                    corrupted_userfiles.push(CorruptedFileItem {
                        filepath: format!("userfiles/{}", json_file),
                        error_reason: "ファイルの読み込みに失敗".to_string(),
                    });
                }
            }
        }

        let ini_path = userfiles_dir.join("settings.ini");
        if ini_path.exists() {
            if Ini::load_from_file(&ini_path).is_err() {
                corrupted_userfiles.push(CorruptedFileItem {
                    filepath: "userfiles/settings.ini".to_string(),
                    error_reason: "INI構文エラー".to_string(),
                });
            }
        }

        let playlist_dir = userfiles_dir.join("playlist");
        if playlist_dir.exists() {
            if let Ok(entries) = fs::read_dir(&playlist_dir) {
                for entry in entries.filter_map(|e| e.ok()) {
                    let path = entry.path();
                    if path.is_file() && path.extension().and_then(|e| e.to_str()) == Some("json") {
                        if let Ok(content) = fs::read_to_string(&path) {
                            if serde_json::from_str::<Value>(&content).is_err() {
                                let fname = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                                corrupted_userfiles.push(CorruptedFileItem {
                                    filepath: format!("userfiles/playlist/{}", fname),
                                    error_reason: "プレイリストJSON構文エラー".to_string(),
                                });
                            }
                        }
                    }
                }
            }
        }

        // --- 5. 不要・リンク切れファイル (library) の検出 ---
        let mut referenced_music = HashSet::new();
        let mut referenced_images = HashSet::new();

        referenced_images.insert("app/icon/Chordia.png".to_string());
        referenced_images.insert("library/images/default.png".to_string());

        for song in db_data.iter() {
            if let Some(m) = song.get("musicFilename").and_then(|v| v.as_str()) {
                if !m.is_empty() { referenced_music.insert(normalize_rel_path(m)); }
            }
            if let Some(i) = song.get("imageFilename").and_then(|v| v.as_str()) {
                if !i.is_empty() { referenced_images.insert(normalize_rel_path(i)); }
            }
        }

        let covers_path = userfiles_dir.join("playlist_covers.json");
        if covers_path.exists() {
            if let Ok(content) = fs::read_to_string(&covers_path) {
                if let Ok(covers) = serde_json::from_str::<serde_json::Map<String, Value>>(&content) {
                    for (_, val) in covers {
                        if let Some(path_str) = val.as_str() {
                            if !path_str.is_empty() {
                                referenced_images.insert(normalize_rel_path(path_str));
                            }
                        }
                    }
                }
            }
        }

        let mut missing_music_files = Vec::new();
        for m in &referenced_music {
            if !base_dir.join(m).exists() {
                missing_music_files.push(m.clone());
            }
        }

        let mut missing_image_files = Vec::new();
        for img in &referenced_images {
            if !base_dir.join(img).exists() {
                missing_image_files.push(img.clone());
            }
        }

        let mut orphan_music_files = Vec::new();
        let music_dir = base_dir.join("library/music");
        if music_dir.exists() {
            for entry in walkdir::WalkDir::new(&music_dir).into_iter().filter_map(|e| e.ok()) {
                if entry.path().is_file() {
                    if let Ok(rel) = entry.path().strip_prefix(&base_dir) {
                        let rel_str = normalize_rel_path(&rel.to_string_lossy());
                        if !referenced_music.contains(&rel_str) {
                            orphan_music_files.push(rel_str);
                        }
                    }
                }
            }
        }

        let mut orphan_image_files = Vec::new();
        for img_dir_name in ["library/images", "library/cover_image"] {
            let dir_path = base_dir.join(img_dir_name);
            if dir_path.exists() {
                for entry in walkdir::WalkDir::new(&dir_path).into_iter().filter_map(|e| e.ok()) {
                    if entry.path().is_file() {
                        if let Ok(rel) = entry.path().strip_prefix(&base_dir) {
                            let rel_str = normalize_rel_path(&rel.to_string_lossy());
                            if !referenced_images.contains(&rel_str) {
                                orphan_image_files.push(rel_str);
                            }
                        }
                    }
                }
            }
        }

        Ok(IntegrityReport {
            tag_mismatches,
            bin_status,
            uncalculated_lufs,
            corrupted_userfiles,
            orphan_music_files,
            orphan_image_files,
            missing_music_files,
            missing_image_files,
        })
    }).await.map_err(|e| format!("整合性確認スレッドエラー: {}", e))?
}
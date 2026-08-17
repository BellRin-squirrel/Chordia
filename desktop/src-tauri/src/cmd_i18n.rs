use serde_json::Value;
use ini::Ini;
use std::fs;
use crate::utils::get_base_dir;

// ★ 内蔵デフォルト日本語INIテンプレート（フォールバック用）
const DEFAULT_JAPANESE_INI: &str = r#"[Meta]
name = "日本語"
code = "ja"

[Common]
back_to_top = "トップへ戻る"
cancel = "キャンセル"
save = "保存"
delete = "削除"
ok = "OK"
close = "閉じる"
none = "なし"
search = "検索"
status = "ステータス"
loading = "読み込み中..."
notice = "お知らせ"
complete = "完了"
error = "エラー"

[Menu]
title = "Chordia"
subtitle = "ライブラリをスマートに管理"
add_music = "曲を追加"
add_music_desc = "個別またはスキャン一括登録"
manage_db = "データベースを管理"
manage_db_desc = "編集・削除・整理"
migration = "データの引継ぎ"
migration_desc = "エクスポート・復元(インポート)"
integrity = "整合性確認"
integrity_desc = "タグ・音源・不要データの確認"
player = "音楽を再生"
player_desc = "プレイヤーを開く"
mobile_sync = "Mobile版に同期"
mobile_sync_desc = "セキュアな接続設定"
extensions = "拡張機能"
extensions_desc = "DL機能などを管理"
settings = "設定"
settings_desc = "アプリの環境設定"
info = "情報"
info_desc = "ライセンス・バージョン情報"

[Info]
title = "情報"
app_name = "Chordia Desktop版"
copyright = "© 2026 BellRin"

[Extensions]
title = "拡張機能"
subtitle = "外部ツールの管理およびライブラリ音量測定"
installation_status = "インストール状況"
action_title_checking = "確認中..."
action_desc_checking = "必要なツールをチェックしています。"
action_title_all_ready = "全てのツールが揃っています"
action_desc_all_ready = "すべての外部ツールが正常に利用可能です。"
action_title_missing = "不足・不正なツールがあります"
action_desc_missing = "一部の機能を利用するにはツールの更新・追加が必要です。"
btn_check_updates = "アップデートを確認"
btn_redownload = "再ダウンロードを実行"
btn_checking = "確認中..."

lufs_title = "一定音量機能の測定 (音量解析)"
lufs_desc = "設定画面で「一定音量」機能を有効化するには、事前に全楽曲の音量(LUFS)測定を完了させておく必要があります。"
lufs_status_label = "測定ステータス:"
status_checking = "確認中..."
status_ffmpeg_missing = "FFmpegが未インストールです"
status_no_songs = "ライブラリに楽曲がありません"
status_completed = "測定完了 (全曲解析済み)"
status_uncalculated = "未測定の楽曲があります (未解析: {count}曲)"
status_failed = "ステータス取得失敗"

btn_ffmpeg_required = "FFmpegが必要です"
btn_add_songs = "楽曲を追加してください"
btn_recalc_lufs = "音量測定を再実行"
btn_start_lufs = "音量測定を開始"
btn_calculating = "測定中..."
lufs_preparing = "準備中..."

lufs_already_completed = "すべての楽曲の音量解析は完了しています"
lufs_preparing_analysis = "解析の準備中..."
lufs_analyzing = "「{title}」を解析中..."
lufs_analyzed = "「{title}」の解析完了"
lufs_completed = "すべての解析が完了しました！"

update_results = "アップデートの確認結果"
btn_exec_update = "アップデート・修復を実行"
btn_all_latest = "すべて最新版で正常です"

tool_ytdlp_desc = "YouTubeなどの動画プラットフォームから動画・音声をダウンロードします。"
tool_ffmpeg_desc = "ダウンロードした動画からの音声抽出および「一定音量(LUFS)」の音量解析に使用します。"
tool_deno_desc = "一部のサイトのダウンロード処理を補助するJavaScriptランタイムです。"
tool_cloudflared_desc = "WANでMobile版に楽曲を同期するために使用します。"

tool_status_installed = "正常にインストール済み"
tool_status_not_installed = "未インストール (または不正なファイル)"
tool_update_needed = "要更新"
tool_reinstall_needed = "再インストール"
tool_up_to_date = "最新"
tool_corrupted = "正しいファイルではありません"

msg_downloading = "{tool} をダウンロード中... {percent}%"
msg_extracting = "{tool} を解凍・配置中..."
msg_all_tools_updated = "すべてのツールを更新・修復しました。"
msg_network_error = "通信に失敗しました"
msg_lufs_completed = "すべての楽曲の音量測定が完了しました！"
msg_lufs_error = "音量測定中にエラーが発生しました: "

[Settings]
title = "設定"
general = "一般設定"
design = "デザイン"
artwork = "アルバムアート"
tags = "表示タグ"
language = "表示言語 (Language)"
language_desc = "アプリの表示言語を選択します。"
items_per_page = "1ページの表示曲数"
open_new_window = "ページの開き方"
normalize_volume = "一定音量"

theme_color = "テーマカラー"
theme_select = "テーマ選択"
theme_light = "ライトテーマ"
theme_dark = "ダークテーマ"
theme_custom = "カスタム"
save_custom_theme = "オリジナルテーマとして保存"
delete_theme = "テーマを削除"
bg_color = "背景色"
sub_bg_color = "サブ背景色"
text_color = "文字色"

default_art_desc = "アートワーク未設定の楽曲に使用される画像です。"
change_image = "画像を変更"
reset_default = "初期値に戻す"

tag_name = "タグ名"
tag_db = "データベース"
tag_player = "プレイヤー"

save_theme_title = "テーマの保存"
save_theme_desc = "このテーマに名前を付けてください。"
theme_name_placeholder = "テーマ名を入力"

[Tags]
title = "タイトル"
artist = "アーティスト"
album = "アルバム"
genre = "ジャンル"
track = "トラック"
year = "年/日付"
album_artist = "アルバムアーティスト"
disc = "ディスクNo"
bpm = "BPM"
composer = "作曲者"
comment = "コメント"
lyric = "歌詞"

[Messages]
saved = "設定を保存しました"
save_failed = "保存に失敗しました"
art_updated = "初期画像を更新しました"
art_restored = "初期画像に戻しました"
theme_saved = "テーマ \"{name}\" を保存しました"
theme_deleted = "テーマ \"{name}\" を削除しました"
"#;

pub fn init_default_languages() {
    let base_dir = get_base_dir();
    let lang_dir = base_dir.join("lang");
    let _ = fs::create_dir_all(&lang_dir);

    let ja_path = lang_dir.join("Japanese.ini");
    if !ja_path.exists() {
        let _ = fs::write(ja_path, DEFAULT_JAPANESE_INI);
    }

    let en_path = lang_dir.join("English.ini");
    if !en_path.exists() {
        let default_en = r#"[Meta]
name = "English"
code = "en"

[Common]
back_to_top = "Back to Top"
cancel = "Cancel"
save = "Save"
delete = "Delete"
ok = "OK"
close = "Close"
none = "None"
search = "Search"
status = "Status"
loading = "Loading..."
notice = "Notice"
complete = "Complete"
error = "Error"

[Menu]
title = "Chordia"
subtitle = "Smart Library Manager"
add_music = "Add Songs"
add_music_desc = "Single or bulk scan import"
manage_db = "Manage Library"
manage_db_desc = "Edit, delete, and organize"
migration = "Data Transfer"
migration_desc = "Export & Restore backup"
integrity = "Integrity Check"
integrity_desc = "Verify tags, files, and data"
player = "Play Music"
player_desc = "Open player view"
mobile_sync = "Sync to Mobile"
mobile_sync_desc = "Secure connection settings"
extensions = "Extensions"
extensions_desc = "Manage DL tools & features"
settings = "Settings"
settings_desc = "App preferences & design"
info = "About"
info_desc = "License & Version info"

[Info]
title = "About"
app_name = "Chordia Desktop Edition"
copyright = "© 2026 BellRin"

[Extensions]
title = "Extensions"
subtitle = "Manage external tools and library loudness measurement"
installation_status = "Installation Status"
action_title_checking = "Checking..."
action_desc_checking = "Checking required tools..."
action_title_all_ready = "All tools are ready"
action_desc_all_ready = "All external tools are installed and working properly."
action_title_missing = "Missing or invalid tools"
action_desc_missing = "Some tools need to be installed or updated to use all features."
btn_check_updates = "Check for Updates"
btn_redownload = "Re-download Tools"
btn_checking = "Checking..."

lufs_title = "Loudness Measurement"
lufs_desc = "To enable Loudness Normalization in Settings, all songs in your library must be measured first."
lufs_status_label = "Status:"
status_checking = "Checking..."
status_ffmpeg_missing = "FFmpeg is not installed"
status_no_songs = "No songs in library"
status_completed = "Measurement Complete (All songs measured)"
status_uncalculated = "Unmeasured songs found ({count} remaining)"
status_failed = "Failed to get status"

btn_ffmpeg_required = "FFmpeg Required"
btn_add_songs = "Please Add Songs"
btn_recalc_lufs = "Recalculate Loudness"
btn_start_lufs = "Start Measurement"
btn_calculating = "Measuring..."
lufs_preparing = "Preparing..."

lufs_already_completed = "Loudness measurement is complete for all songs."
lufs_preparing_analysis = "Preparing analysis..."
lufs_analyzing = "Analyzing \"{title}\"..."
lufs_analyzed = "Analysis completed for \"{title}\""
lufs_completed = "All analysis completed!"

update_results = "Update Check Results"
btn_exec_update = "Update / Repair Tools"
btn_all_latest = "All tools are up to date"

tool_ytdlp_desc = "Downloads video and audio from YouTube and other platforms."
tool_ffmpeg_desc = "Extracts audio from videos and measures loudness (LUFS)."
tool_deno_desc = "JavaScript runtime assisting download processing for certain sites."
tool_cloudflared_desc = "Used for syncing with the Mobile app over WAN."

tool_status_installed = "Installed"
tool_status_not_installed = "Not installed (or invalid file)"
tool_update_needed = "Update Needed"
tool_reinstall_needed = "Reinstall Needed"
tool_up_to_date = "Latest"
tool_corrupted = "Invalid executable file"

msg_downloading = "Downloading {tool}... {percent}%"
msg_extracting = "Extracting {tool}..."
msg_all_tools_updated = "All tools updated and repaired."
msg_network_error = "Network communication failed"
msg_lufs_completed = "Loudness measurement completed for all songs!"
msg_lufs_error = "An error occurred during loudness measurement: "

[Settings]
title = "Settings"
general = "General"
design = "Design"
artwork = "Album Art"
tags = "Display Tags"
language = "Language"
language_desc = "Select the app display language."
items_per_page = "Items per page"
open_new_window = "Open Pages in New Window"
normalize_volume = "Loudness Normalization"

theme_color = "Theme Color"
theme_select = "Select Theme"
theme_light = "Light Theme"
theme_dark = "Dark Theme"
theme_custom = "Custom"
save_custom_theme = "Save as Custom Theme"
delete_theme = "Delete Theme"
bg_color = "Background Color"
sub_bg_color = "Card Background"
text_color = "Text Color"

default_art_desc = "This image is used for songs without artwork."
change_image = "Change Image"
reset_default = "Reset to Default"

tag_name = "Tag Name"
tag_db = "Database"
tag_player = "Player"

save_theme_title = "Save Theme"
save_theme_desc = "Please enter a name for this theme."
theme_name_placeholder = "Enter theme name"

[Tags]
title = "Title"
artist = "Artist"
album = "Album"
genre = "Genre"
track = "Track No."
year = "Year/Date"
album_artist = "Album Artist"
disc = "Disc No."
bpm = "BPM"
composer = "Composer"
comment = "Comment"
lyric = "Lyrics"

[Messages]
saved = "Settings saved"
save_failed = "Failed to save settings"
art_updated = "Default artwork updated"
art_restored = "Reset to default artwork"
theme_saved = "Saved theme \"{name}\""
theme_deleted = "Deleted theme \"{name}\""
"#;
        let _ = fs::write(en_path, default_en);
    }
}

#[tauri::command]
pub fn get_available_languages() -> Vec<serde_json::Map<String, Value>> {
    let lang_dir = get_base_dir().join("lang");
    let mut list = Vec::new();

    if let Ok(entries) = fs::read_dir(&lang_dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.is_file() && path.extension().and_then(|ext| ext.to_str()) == Some("ini") {
                if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                    let mut item = serde_json::Map::new();
                    item.insert("file".to_string(), Value::String(file_name.to_string()));

                    if let Ok(ini) = Ini::load_from_file(&path) {
                        let name = ini.section(Some("Meta"))
                            .and_then(|sec| sec.get("name"))
                            .unwrap_or(file_name);
                        item.insert("name".to_string(), Value::String(name.to_string()));
                    } else {
                        item.insert("name".to_string(), Value::String(file_name.to_string()));
                    }

                    list.push(item);
                }
            }
        }
    }

    list
}

fn ini_to_json_value(ini: &Ini) -> Value {
    let mut root_map = serde_json::Map::new();
    for (section, prop) in ini.iter() {
        let sec_name = section.unwrap_or("Common");
        let mut sec_map = serde_json::Map::new();
        for (k, v) in prop.iter() {
            sec_map.insert(k.to_string(), Value::String(v.to_string()));
        }
        root_map.insert(sec_name.to_string(), Value::Object(sec_map));
    }
    Value::Object(root_map)
}

// ★ 修正: エラー発生時でも必ず日本語フォールバックデータを返す堅牢な設計
#[tauri::command]
pub fn get_language_pack(filename: Option<String>) -> Result<Value, String> {
    let target_file = match filename {
        Some(f) if !f.is_empty() => f,
        _ => crate::cmd_settings::get_app_settings().language,
    };

    let target_path = get_base_dir().join("lang").join(&target_file);

    // 1. 要求された言語ファイルの読み込みを試行
    if target_path.exists() {
        if let Ok(ini) = Ini::load_from_file(&target_path) {
            return Ok(ini_to_json_value(&ini));
        }
    }

    // 2. 失敗した場合、ディスク上の Japanese.ini の読み込みを試行 (フォールバック 1)
    let ja_path = get_base_dir().join("lang/Japanese.ini");
    if ja_path.exists() {
        if let Ok(ini) = Ini::load_from_file(&ja_path) {
            return Ok(ini_to_json_value(&ini));
        }
    }

    // 3. ディスクのファイルが全て読めない場合でも、埋め込みの日本語デフォルトデータから生成 (フォールバック 2)
    let fallback_ini = Ini::load_from_str(DEFAULT_JAPANESE_INI).unwrap_or_else(|_| Ini::new());
    Ok(ini_to_json_value(&fallback_ini))
}
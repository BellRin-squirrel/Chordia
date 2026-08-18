use serde_json::Value;
use ini::Ini;
use std::fs;
use crate::utils::get_base_dir;

pub const DEFAULT_JAPANESE_INI: &str = r#"[Meta]
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
please_wait = "このまましばらくお待ちください"

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

[AddMusic]
title = "曲を追加"
subtitle = "情報を設定してライブラリに楽曲を登録します"
tab_single = "1曲追加"
tab_bulk_yt = "一括追加 (YouTubeリスト)"
tab_jsoncsv = "一括追加 (JSON/CSV)"
tab_mp3zip = "一括追加 (ZIPファイル)"

pane_info_title = "曲の情報"
dup_warning_text = "⚠️ 重複する楽曲がライブラリにあります"
btn_show_existing = "既存曲を再生"

pane_source_title = "音源の設定"
src_local = "ローカルファイル"
src_download = "動画ダウンロード"
drop_music_main = "MP3 / MP4 ファイルをドラッグ＆ドロップ"
drop_music_sub1 = "または"
drop_music_sub2 = "クリックして参照"
video_url_label = "動画のURL"
video_url_ph = "..."
btn_fetch_video = "動画情報を取得"
btn_cancel_video = "この動画を使わない"

pane_art_title = "アルバムアート"
art_opt_local = "ローカル"
art_opt_extract = "音源から抽出"
art_opt_thumb1 = "元のサムネ"
art_opt_thumb2 = "別動画"
art_opt_url = "画像URL"
art_opt_none = "設定しない"
drop_art_text = "PNG画像を選択"
art_extract_desc = "音源ファイルに埋め込まれているアルバムアートを抽出します。"
btn_extract_art = "抽出を実行"
art_thumb1_desc = "動画のサムネイルをスクエアに切り取って使用します。"
btn_download_orig_thumb = "オリジナル画像を保存"
alt_video_label = "別の動画URL"
btn_fetch_alt_thumb = "サムネイルを取得"
image_url_label = "画像のURL"
btn_preview_image_url = "画像をプレビュー"
art_none_desc = "以下のデフォルト画像が適用されます。"

btn_auto_lyric = "歌詞を自動取得 (LRCLIB)"
ph_lyric = "ここに歌詞を入力してください..."
btn_submit_single = "この設定で楽曲を追加"

bulk_yt_title = "YouTube 再生リストから一括追加"
bulk_yt_url_label = "再生リストのURL"
btn_fetch_bulk_yt = "取得"
btn_submit_bulk_yt = "表示されている楽曲を一括追加"

bulk_jsoncsv_title = "JSON / CSVファイルから一括追加"
bulk_jsoncsv_desc = "エクスポートされたメタデータ一覧ファイルを読み込み、リストに沿って楽曲を一括登録します。"
drop_jsoncsv_main = "ここにJSONまたはCSVファイルをドラッグ＆ドロップ"
drop_jsoncsv_sub = "またはクリックしてファイルを選択 (JSON / CSV)"
btn_scan_list = "リストを解析"
list_result_title = "解析された楽曲リスト"
btn_submit_list = "表示されている楽曲をすべて登録"

bulk_zip_title = "MP3 ZIPファイルから一括追加"
bulk_zip_desc = "ZIP内のMP3データを読み込み、埋め込まれているタグ情報を自動抽出して一括登録します。"
drop_zip_main = "ここにZIPファイルをドラッグ＆ドロップ"
drop_zip_sub = "またはクリックしてファイルを選択 (ZIP)"
btn_scan_zip = "ZIPファイルを解析"
zip_result_title = "抽出された楽曲リスト"
btn_submit_zip = "表示されている楽曲をすべて追加"

th_no = "No."
th_art = "アート"
th_path_filename = "パス / ファイル名"
btn_watch_video = "動画を見る"

progress_scanning_zip = "ZIPファイルをスキャン中..."
progress_analyzing_zip = "ZIPファイルを解析中..."
progress_registering = "ライブラリへ登録中..."

modal_password_title = "パスワードが必要です"
modal_password_desc = "このZIPファイルは保護されています。"
modal_password_ph = "パスワードを入力"
btn_confirm_pass = "確定"

dup_existing_msg = "「{title}」（{artist}）の楽曲はすでに追加されています。"
dup_bulk_msg = "「{title}」（{artist}）の楽曲は一括追加の項目内で重複しています。"
dup_modal_title = "重複の確認"
dup_modal_desc = "同じタイトル・アーティストの楽曲が既に登録されています。<br>このまま追加を続行しますか?"
btn_continue = "そのまま続行"
btn_skip = "この曲をスキップ"
btn_cancel_bulk = "一括追加をキャンセル"
btn_open_db_manage = "データベース管理画面を開く"

confirm_remove_row = "この楽曲を追加リストから除外しますか?"
msg_import_success = "{count}曲の登録が完了しました。"
msg_no_songs_to_import = "追加する楽曲がありません。"
msg_applied = "反映しました"
msg_title_artist_required = "タイトルとアーティストを入力してください"
msg_lyric_applied = "歌詞を適用しました"
msg_art_extracted = "アートワークを抽出しました"
msg_art_not_found = "アートワークが見つかりませんでした"
msg_select_image_file = "画像ファイルを選択してください"
msg_art_fetch_success = "サムネイルを取得しました"
msg_enter_url = "URLを入力してください"
msg_music_format_error = "MP3またはMP4ファイルのみ対応しています"
msg_ext_needed = "動画機能を利用するには拡張機能（yt-dlp, ffmpeg）が必要です"
msg_ext_needed_bulk = "動画機能を利用するには拡張機能（yt-dlp, ffmpeg, deno）をインストールしてください"
msg_fetch_failed = "取得に失敗しました: {msg}"
label_selected_file = "選択中: {name}"

loading_reading_file = "ファイルの読み込み中..."
loading_saving_library = "ライブラリへ保存中..."
loading_downloading_video = "動画をダウンロード中..."
loading_processing_thumb = "サムネイル処理中..."
loading_bulk_importing = "一括追加中... {current} / {total}"

alert_thumb1_no_video = "動画情報を取得していないため、元のサムネイルは利用できません。\n音源の設定で「動画ダウンロード」を選択し、URLから情報を取得してください。"
alert_extract_no_local = "ローカル音源ファイルが選択されていないため、抽出機能は利用できません。\n音源の設定でMP3/MP4ファイルをアップロードしてください。"
alert_reset_art_local = "音源がローカルファイルに変更されたため、アルバムアートを「ローカル」にリセットしました。"
alert_reset_art_download = "音源が動画ダウンロードに変更されたため、アルバムアートを「ローカル」にリセットしました。"
alert_select_audio_file = "音源となるファイルを選択してください"
alert_fetch_video_info = "動画情報を取得してください"
alert_song_added = "楽曲をライブラリに追加しました！"
alert_save_failed = "保存に失敗しました。"
alert_bulk_complete = "{success}曲の追加が完了しました。\n(失敗: {fail}曲)"

[Player]
select_playlist = "プレイリスト"
select_album = "アルバム"
select_artist = "アーティスト"
select_playlist_placeholder = "プレイリストを選択"
search_in_list_ph = "リスト内検索 (Ctrl+F)"
btn_edit_rules = "ルールを編集"
btn_play_all = "再生"
btn_shuffle_all = "シャッフル"

song_count = "{count} 曲"
duration_seconds = "{sec}秒"
duration_minutes = "{min}分"
duration_hours = "{hr}時間"
label_sort = "並び順:"
sort_desc = "降順"
sort_asc = "昇順"
duplicate_suffix = " - コピー"

no_next_songs = "次に再生される曲はありません"
no_history = "再生履歴はありません"
history_loading = "履歴を読み込み中..."
history_failed = "履歴の取得に失敗しました"

cover_modal_title = "カバーアートを変更"
tab_cover_local = "ローカル画像 (PNG)"
tab_cover_song = "楽曲から選択"
drop_cover_main = "PNG画像をドラッグ＆ドロップ"
drop_cover_sub = "またはクリックしてファイルを選択 (.png)"
ph_search_cover_song = "タイトル・アーティストで検索..."
cover_status_title = "選択中のカバーアート"
cover_status_desc = "「変更を適用」を押すと決定されます"

tab_queue = "次に再生"
tab_history = "履歴"
tab_details = "詳細"
tab_artwork = "カバーアート"

del_pl_title = "プレイリストの削除"
del_pl_msg = "「{name}」を削除してもよろしいですか？"
confirm_title = "確認"
smart_remove_msg = "スマートプレイリストから楽曲を削除すると、自動更新ルールが解除され、通常のプレイリストに変更されます。<br><br>よろしいですか？"
btn_convert_and_remove = "削除して変換"

edit_pl_songs_title = "プレイリストの曲を編集"
search_ph = "検索..."
btn_save_selection = "設定"

smart_modal_create_title = "スマートプレイリストを新規作成"
smart_modal_edit_title = "スマートプレイリストを編集"
pl_name_label = "プレイリスト名"
smart_pl_name_ph = "スマートプレイリストの名前を入力..."
btn_create_smart = "作成"

menu_new_pl = "新規プレイリスト"
menu_new_smart_pl = "新規スマートプレイリスト"
menu_play = "再生"
menu_shuffle = "シャッフル再生"
menu_edit_songs = "曲を編集"
menu_edit_rules = "ルールを編集"
menu_rename = "名前を変更"
menu_duplicate = "複製"
menu_song_info = "情報を見る"
menu_add_to_pl = "プレイリストに追加"
menu_remove_from_pl = "プレイリストから削除"

[Manage]
title = "データベース管理"
subtitle = "楽曲情報の編集・削除・アートワークの管理"
btn_select_songs = "楽曲を選択"
btn_finish_selection = "選択を終了"
search_placeholder = "タイトル、アーティスト、アルバム名で検索..."
btn_clear_search = "クリア"
btn_advanced_search = "高度な検索"
bulk_selected_count = "{count} 曲選択中"
btn_bulk_edit = "一括変更"
btn_bulk_delete = "一括削除"

th_play = "再生"
th_time = "時間"
th_action = "操作"
no_matching_songs = "一致する楽曲が見つかりませんでした"
hint_double_click = "ダブルクリックで編集できます"

btn_show_all = "すべて表示"
btn_show_pages = "ページ別表示に戻す"
btn_prev = "前へ"
btn_next = "次へ"
btn_jump = "移動"

art_modal_title = "アートワーク編集"
tab_local = "ローカル"
tab_video_url = "動画URL"
tab_image_url = "画像URL"
btn_select_pc_image = "PCから画像を選択"
ph_video_url = "YouTubeなどの動画URLを入力..."
btn_fetch_thumb = "サムネを取得"
ph_image_url = "画像の直接URLを入力..."
btn_fetch_image = "画像を取得"
art_status_current = "現在の画像"
art_status_new = "新しい画像 (反映前)"
art_status_thumb = "動画サムネイル (反映前)"
art_status_url = "画像URL (反映前)"
art_status_remove = "削除予定 (反映前)"
btn_delete_image = "画像を削除"
btn_apply_change = "変更を適用"

lyric_modal_title = "歌詞編集"
btn_auto_lyric = "自動取得 (LRCLIB)"
ph_lyric = "歌詞を入力..."
lyric_search_results = "歌詞の検索結果"
lyric_search_desc = "確認したい歌詞をクリックしてください。"
lyric_preview_title = "歌詞の確認"
btn_back_to_results = "一覧に戻る"
btn_apply_lyric = "適用"

bulk_modal_title = "選択した曲を一括変更"
bulk_meta_title = "メタデータの一括編集"
bulk_art_title = "カバーアートの一括編集"
bulk_lyric_title = "歌詞の一括編集"
bulk_keep = "設定を維持する（そのまま変更しない）"
bulk_art_overwrite = "新しい画像で一括上書きする"
bulk_lyric_overwrite = "新しい歌詞で一括上書きする"
btn_fetch = "取得"
label_keep = "< 維持 >"
label_keep_lyric = "< 維持 > (歌詞は変更されません)"
label_keep_art = "< 維持 > (そのまま維持されます)"
label_bulk_delete_target = "選択された {count} 曲"

delete_modal_title = "楽曲を削除"
delete_modal_desc = "以下の楽曲をライブラリとファイルから完全に削除しますか?"
btn_delete_confirm = "削除する"

adv_search_title = "高度な検索フィルター"
btn_apply_filter = "フィルターを設定"
btn_clear_filter = "条件をクリア"

adv_match_all = "すべての"
adv_match_any = "いずれかの"
adv_match_rules = "ルールに一致"
adv_particle_ga = "が"
adv_particle_to = "と"
adv_ph_search = "検索ワード..."
adv_ph_number = "数字..."

op_contains = "を含む"
op_not_contains = "を含まない"
op_equals = "である"
op_not_equals = "ではない"
op_startswith = "で始まる"
op_endswith = "で終わる"
op_greater = "より大きい"
op_less = "より小さい"
op_range = "の範囲内"

msg_bulk_updated = "{count}曲を一括更新しました"
msg_bulk_deleted = "{count}曲を削除しました"
msg_bulk_edit_failed = "一括更新に失敗しました"
msg_select_songs_prompt = "楽曲を選択してください"
msg_lyric_saved = "歌詞を保存しました"
msg_art_updated = "アートワークを更新しました"
msg_deleted = "削除しました"
msg_cannot_play = "再生できません"
msg_not_found = "見つかりませんでした"
msg_network_error = "通信エラーが発生しました"
msg_enter_url = "URLを入力してください"
msg_ext_missing = "拡張機能が不足しています"
msg_art_fetch_success = "サムネイルを取得しました"
msg_img_fetch_success = "画像を取得しました"
msg_db_update_failed = "DB更新に失敗しました"

[Migration]
title = "データの引継ぎ"
subtitle = "Chordiaの環境全体を一括エクスポート、またはバックアップから復元します"

export_title = "1. 引継ぎデータのエクスポート"
export_desc = "現在のライブラリ、設定情報、プレイリストを暗号化ZIPにまとめてエクスポートします。"

target_music = "楽曲ファイル"
target_music_desc = "library/music/ 内のすべての音声ファイル"
target_images = "アルバムアート"
target_images_desc = "library/images/ 内のすべての画像データ"
target_db = "データベース"
target_db_desc = "userfiles/music.json (曲情報リスト)"
target_settings = "設定ファイル"
target_settings_desc = "settings.ini / themes.json"
target_playlists = "プレイリスト・履歴"
target_playlists_desc = "playlist / played_times / history"

save_path_label = "保存先とファイル名"
save_path_placeholder = "保存先を選択してください..."
btn_browse = "参照"
password_label = "パスワード保護 (任意)"
password_placeholder = "パスワードを入力（空欄は暗号化なし）"
btn_export = "エクスポートを実行"
btn_exporting = "エクスポート中..."

import_title = "2. 引継ぎデータのインポート"
import_desc = "エクスポートしたバックアップデータ（ZIP）を選択し、現在の環境に丸ごと復元します。"
drop_main_msg = "ここに引継ぎZIPファイルをドロップ"
drop_sub_msg = "またはクリックしてファイルを選択"
import_pass_label = "引継ぎファイルの復号パスワード"
import_pass_placeholder = "パスワードを入力してください"
btn_apply = "適用"

modal_export_title = "エクスポート完了"
modal_export_msg = "データが正常にバックアップされました。"
modal_import_title = "インポート(復元)完了"
modal_import_msg = "すべてのライブラリと設定が正常に復元されました。"
btn_show_explorer = "エクスプローラーで表示"
btn_show_finder = "Finderで表示"

msg_compressing = "データをバックアップ用に圧縮しています..."
msg_rewriting_cache = "キャッシュを再度書き込んでいます..."
msg_restoring = "引継ぎZIPファイルを解析・復元しています..."

toast_interrupted = "処理を中断しました"
toast_specify_path = "エクスポート先のファイル名を指定してください"
toast_select_target = "項目を1つ以上選択してください"
toast_pass_too_long = "パスワードは128文字以内にしてください"
toast_export_success = "エクスポートが完了しました"
toast_system_error = "システムエラーが発生しました"
toast_explorer_failed = "エクスプローラーの展開に失敗しました"
toast_finder_failed = "Finderの展開に失敗しました"
toast_zip_required = "引継ぎファイルはZIP形式である必要があります"
toast_enter_password = "復号用パスワードを入力してください"
toast_password_protected = "このファイルはパスワードで保護されています"
toast_import_success = "インポートが完了しました"
toast_restore_failed = "復元に失敗しました: {err}"

[Sync]
title = "同期設定"
wan_title = "外出先 (WAN) 接続モード"
wan_desc = "安全なHTTPSトンネルを構築し、インターネット越しでの同期を許可します。"
wan_status_off = "● WAN接続モード: OFF (無効)"
wan_status_building = "● WAN接続モード: ON (トンネル構築中...)"
wan_status_on = "● WAN接続モード: ON (有効・待機中)"
wan_url_label = "WAN パブリック URL:"
wan_tunnel_building = "トンネル構築中..."
wan_qr_desc = "スマホの「QRコードで自動接続」で読み取ってください<br>(※WAN接続のため、6桁の認証コードはセキュリティ上「手入力」になります)"

ip_label = "IPアドレス (LAN用)"
port_label = "ポート番号"
loading_ip = "取得中..."
auth_code_desc = "以下の認証コードをスマホアプリに入力してください"
countdown_text = "更新まであと {sec} 秒"
qr_desc = "または、カメラでQRコードを読み取ります"
btn_show_qr = "LAN用 QRコードを表示"
btn_hide_qr = "QRコードを隠す"

requests_title = "接続リクエスト（許可待ち）"
no_requests = "現在リクエストはありません"
waiting_code_title = "認証コード入力待ち"
no_waiting_code = "現在コード入力待ちの端末はありません"
sessions_title = "接続済みのセッション（同期中）"
no_sessions = "接続中のデバイスはありません。"

btn_approve = "許可"
btn_reject = "拒否"
btn_cancel_approval = "取り消し"
btn_disconnect = "切断"
label_waiting_code = "コード入力待ち..."
label_remaining_time = "最終アクセス: 残り{min}分{sec}秒"

toast_wan_enabled = "WAN モードを有効化しました"
toast_wan_disabled = "WAN モードを無効化しました"
toast_auth_request = "接続要求: {device} からのリクエスト"
toast_auth_success = "ペアリング完了: {device} と接続されました"
toast_server_error = "サーバーの起動に失敗しました"
toast_waiting_port = "ポートの取得を待っています..."
err_cloudflared_start = "cloudflaredの起動に失敗しました（{bin} を確認してください）"
err_cloudflared_timeout = "Cloudflare Tunnel の URL 取得にタイムアウトしました。"

[Integrity]
title = "整合性確認"
subtitle = "データベース、ファイル、設定情報の健康状態を総合チェックします"
action_title = "全項目の検査を実行"
action_desc = "タグの不整合、拡張機能、音量未解析、ファイル破損、不要・リンク切れファイルを読み込みます。"
btn_start = "検査を開始"
btn_scanning = "検査中..."
loading_msg = "ライブラリの整合性をスキャン中..."
summary_status = "全体ステータス"
summary_issues = "検出された問題件数"
count_unit = "{count}件"

status_ok = "正常 (問題なし)"
status_error = "要確認"
status_warning = "軽微な警告あり"

sec_tag_title = "1. MP3タグ・歌詞の不整合"
sec_tag_desc = "DB上の登録内容とMP3ファイル本体に書き込まれているID3タグの間に違いがあります。"
sec_bin_title = "2. 拡張機能 (binフォルダ) の状態"
sec_bin_desc = "欠損ツールや不要なファイル、起動不可能なファイルがないか確認します。"
sec_lufs_title = "3. 音量解析 (LUFS) 未計測曲"
sec_lufs_desc = "一定音量（ラウドネス・ノーマライゼーション）がまだ計算されていない楽曲です。"
sec_corrupted_title = "4. 設定・言語・データベースファイルの破損"
sec_corrupted_desc = "構文エラーや欠損により正常に読み込みできない設定・言語パック・データベースファイルです。"
sec_orphan_title = "5. 不要・リンク切れファイル (libraryフォルダ)"
sec_orphan_desc = "DBに存在しない不要な実ファイルや、実ファイルが見つからないリンク切れデータです。"

msg_tag_ok = "すべての楽曲のタグ情報がDBと一致しています。"
msg_bin_ok = "すべての必須ツールが揃っており、不要なファイルもありません。"
msg_lufs_ok = "すべての楽曲の音量解析が完了しています。"
msg_corrupted_ok = "設定、言語パック、およびデータベースファイルに破損は見つかりませんでした。"
msg_orphan_ok = "不要な孤立ファイルやリンク切れファイルはありません。"

label_bin_missing = "❌ 欠損:"
label_bin_invalid = "⚠️ 破損:"
label_bin_unexpected = "❓ 不審ファイル:"
label_missing_music = "❌ リンク切れ(音源):"
label_missing_image = "❌ リンク切れ(画像):"
label_orphan_music = "🗑️ 孤立音源:"
label_orphan_image = "🗑️ 孤立画像:"
label_corrupted = "❌ 読込エラー:"

desc_bin_missing = "必須ツール {tool} がインストールされていません。"
desc_bin_invalid = "ツール {tool} が正しく起動できません。"
desc_bin_unexpected = "binフォルダ内に未知の不要ファイル {file} が存在します。"
desc_missing_music = "DBに登録されていますがファイルが存在しません ({file})"
desc_missing_image = "DBに登録されていますが画像が存在しません ({file})"
desc_orphan_music = "DBで参照されていない不要な楽曲ファイル ({file})"
desc_orphan_image = "DBやプレイリストで参照されていない不要な画像 ({file})"

err_official_lang_missing = "公式言語パックが見つかりません"
err_lang_file_modified = "公式言語パックの内容が一致しません (改変・破損)"
err_ini_syntax = "INI構文エラー (破損)"
err_json_syntax = "JSON構文エラー (破損)"
err_playlist_syntax = "プレイリストJSON構文エラー (破損)"
err_file_read = "ファイルの読み込みに失敗"

th_file = "ファイル"
th_field = "項目"
th_db_val = "DB上の値"
th_tag_val = "MP3タグ上の値"

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

pub const DEFAULT_ENGLISH_INI: &str = r#"[Meta]
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
please_wait = "Please wait a moment..."

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

[AddMusic]
title = "Add Songs"
subtitle = "Configure metadata and register songs into your library"
tab_single = "Single Song"
tab_bulk_yt = "Bulk Add (YouTube Playlist)"
tab_jsoncsv = "Bulk Add (JSON/CSV)"
tab_mp3zip = "Bulk Add (ZIP Archive)"

pane_info_title = "Track Metadata"
dup_warning_text = "⚠️ Duplicate track found in library"
btn_show_existing = "Play Existing"

pane_source_title = "Audio Source"
src_local = "Local File"
src_download = "Video Download"
drop_music_main = "Drag & Drop MP3 / MP4 files here"
drop_music_sub1 = "or"
drop_music_sub2 = "browse file"
video_url_label = "Video URL"
video_url_ph = "..."
btn_fetch_video = "Fetch Video Info"
btn_cancel_video = "Do Not Use Video"

pane_art_title = "Album Artwork"
art_opt_local = "Local"
art_opt_extract = "Extract from Audio"
art_opt_thumb1 = "Original Thumbnail"
art_opt_thumb2 = "Other Video"
art_opt_url = "Image URL"
art_opt_none = "None"
drop_art_text = "Select PNG image"
art_extract_desc = "Extracts embedded artwork from the audio file."
btn_extract_art = "Extract Artwork"
art_thumb1_desc = "Crops video thumbnail to square for artwork."
btn_download_orig_thumb = "Save Original Image"
alt_video_label = "Alternative Video URL"
btn_fetch_alt_thumb = "Fetch Thumbnail"
image_url_label = "Direct Image URL"
btn_preview_image_url = "Preview Image"
art_none_desc = "The following default artwork will be applied."

btn_auto_lyric = "Auto Fetch Lyrics (LRCLIB)"
ph_lyric = "Enter lyrics here..."
btn_submit_single = "Add Song with These Settings"

bulk_yt_title = "Bulk Import from YouTube Playlist"
bulk_yt_url_label = "Playlist URL"
btn_fetch_bulk_yt = "Fetch"
btn_submit_bulk_yt = "Batch Import Displayed Songs"

bulk_jsoncsv_title = "Bulk Import from JSON / CSV"
bulk_jsoncsv_desc = "Reads exported metadata files to register songs according to the list."
drop_jsoncsv_main = "Drag & Drop JSON or CSV file here"
drop_jsoncsv_sub = "or click to select file (JSON / CSV)"
btn_scan_list = "Analyze List"
list_result_title = "Parsed Songs List"
btn_submit_list = "Register All Displayed Songs"

bulk_zip_title = "Bulk Import from MP3 ZIP Archive"
bulk_zip_desc = "Reads MP3s in ZIP and automatically extracts tags for registration."
drop_zip_main = "Drag & Drop ZIP file here"
drop_zip_sub = "or click to select file (ZIP)"
btn_scan_zip = "Analyze ZIP Archive"
zip_result_title = "Extracted Songs List"
btn_submit_zip = "Add All Displayed Songs"

th_no = "No."
th_art = "Artwork"
th_path_filename = "Path / File Name"
btn_watch_video = "Watch Video"

progress_scanning_zip = "Scanning ZIP archive..."
progress_analyzing_zip = "Analyzing ZIP archive..."
progress_registering = "Registering into library..."

modal_password_title = "Password Required"
modal_password_desc = "This ZIP archive is password protected."
modal_password_ph = "Enter password"
btn_confirm_pass = "Confirm"

dup_existing_msg = "\"{title}\" ({artist}) is already registered in the library."
dup_bulk_msg = "\"{title}\" ({artist}) is duplicated within the import list."
dup_modal_title = "Duplicate Confirmation"
dup_modal_desc = "A track with the same title and artist is already registered.<br>Do you want to proceed?"
btn_continue = "Continue Anyway"
btn_skip = "Skip this track"
btn_cancel_bulk = "Cancel Bulk Import"
btn_open_db_manage = "Open Database Management"

confirm_remove_row = "Remove this track from the import list?"
msg_import_success = "Registered {count} songs successfully."
msg_no_songs_to_import = "No songs to import."
msg_applied = "Applied"
msg_title_artist_required = "Please enter title and artist"
msg_lyric_applied = "Lyrics applied successfully"
msg_art_extracted = "Artwork extracted successfully"
msg_art_not_found = "No artwork found in audio file"
msg_select_image_file = "Please select an image file"
msg_art_fetch_success = "Thumbnail fetched successfully"
msg_enter_url = "Please enter a URL"
msg_music_format_error = "Only MP3 and MP4 files are supported"
msg_ext_needed = "Extensions (yt-dlp, ffmpeg) are required to use video features"
msg_ext_needed_bulk = "Extensions (yt-dlp, ffmpeg, deno) are required for bulk import"
msg_fetch_failed = "Failed to fetch: {msg}"
label_selected_file = "Selected: {name}"

loading_reading_file = "Reading audio file..."
loading_saving_library = "Saving to library..."
loading_downloading_video = "Downloading video..."
loading_processing_thumb = "Processing thumbnail..."
loading_bulk_importing = "Importing songs... {current} / {total}"

alert_thumb1_no_video = "No video info fetched. Please select 'Video Download' and fetch info first."
alert_extract_no_local = "No local audio file selected. Please choose an MP3/MP4 file first."
alert_reset_art_local = "Audio source changed to local file. Artwork method reset to 'Local'."
alert_reset_art_download = "Audio source changed to video download. Artwork method reset to 'Local'."
alert_select_audio_file = "Please select an audio file"
alert_fetch_video_info = "Please fetch video info first"
alert_song_added = "Song added to library successfully!"
alert_save_failed = "Failed to save song."
alert_bulk_complete = "Added {success} songs successfully.\n(Failed: {fail} songs)"

[Player]
select_playlist = "Playlists"
select_album = "Albums"
select_artist = "Artists"
select_playlist_placeholder = "Select a Playlist"
search_in_list_ph = "Search in list (Ctrl+F)"
btn_edit_rules = "Edit Rules"
btn_play_all = "Play"
btn_shuffle_all = "Shuffle"

song_count = "{count} songs"
duration_seconds = "{sec}s"
duration_minutes = "{min} mins"
duration_hours = "{hr} hrs"
label_sort = "Sort by:"
sort_desc = "Descending"
sort_asc = "Ascending"
duplicate_suffix = " - Copy"

no_next_songs = "No tracks up next"
no_history = "No playback history"
history_loading = "Loading history..."
history_failed = "Failed to fetch history"

cover_modal_title = "Change Cover Artwork"
tab_cover_local = "Local Image (PNG)"
tab_cover_song = "Select from Tracks"
drop_cover_main = "Drag & Drop PNG image here"
drop_cover_sub = "or click to select file (.png)"
ph_search_cover_song = "Search by title or artist..."
cover_status_title = "Selected Cover Artwork"
cover_status_desc = "Click 'Apply Changes' to confirm"

tab_queue = "Next Up"
tab_history = "History"
tab_details = "Details"
tab_artwork = "Artwork"

del_pl_title = "Delete Playlist"
del_pl_msg = "Are you sure you want to delete \"{name}\"?"
confirm_title = "Confirmation"
smart_remove_msg = "Removing tracks from a smart playlist will disable automatic rules and convert it to a normal playlist.<br><br>Proceed?"
btn_convert_and_remove = "Remove & Convert"

edit_pl_songs_title = "Edit Playlist Tracks"
search_ph = "Search..."
btn_save_selection = "Save"

smart_modal_create_title = "New Smart Playlist"
smart_modal_edit_title = "Edit Smart Playlist"
pl_name_label = "Playlist Name"
smart_pl_name_ph = "Enter smart playlist name..."
btn_create_smart = "Create"

menu_new_pl = "New Playlist"
menu_new_smart_pl = "New Smart Playlist"
menu_play = "Play"
menu_shuffle = "Shuffle Play"
menu_edit_songs = "Edit Tracks"
menu_edit_rules = "Edit Rules"
menu_rename = "Rename"
menu_duplicate = "Duplicate"
menu_song_info = "Song Info"
menu_add_to_pl = "Add to Playlist"
menu_remove_from_pl = "Remove from Playlist"

[Manage]
title = "Manage Library"
subtitle = "Edit, delete tracks and manage artwork"
btn_select_songs = "Select Songs"
btn_finish_selection = "Done Selection"
search_placeholder = "Search by title, artist, album..."
btn_clear_search = "Clear"
btn_advanced_search = "Advanced Search"
bulk_selected_count = "{count} songs selected"
btn_bulk_edit = "Batch Edit"
btn_bulk_delete = "Batch Delete"

th_play = "Play"
th_time = "Duration"
th_action = "Action"
no_matching_songs = "No matching songs found"
hint_double_click = "Double click to edit"

btn_show_all = "Show All"
btn_show_pages = "Show Pages"
btn_prev = "Prev"
btn_next = "Next"
btn_jump = "Go"

art_modal_title = "Edit Artwork"
tab_local = "Local"
tab_video_url = "Video URL"
tab_image_url = "Image URL"
btn_select_pc_image = "Select from PC"
ph_video_url = "Enter YouTube or video URL..."
btn_fetch_thumb = "Fetch Thumbnail"
ph_image_url = "Enter direct image URL..."
btn_fetch_image = "Fetch Image"
art_status_current = "Current Image"
art_status_new = "New Image (Unsaved)"
art_status_thumb = "Video Thumbnail (Unsaved)"
art_status_url = "Image URL (Unsaved)"
art_status_remove = "To be deleted"
btn_delete_image = "Remove Image"
btn_apply_change = "Apply Changes"

lyric_modal_title = "Edit Lyrics"
btn_auto_lyric = "Auto Fetch (LRCLIB)"
ph_lyric = "Enter lyrics..."
lyric_search_results = "Lyrics Search Results"
lyric_search_desc = "Click on a result to preview lyrics."
lyric_preview_title = "Preview Lyrics"
btn_back_to_results = "Back to List"
btn_apply_lyric = "Apply"

bulk_modal_title = "Batch Edit Selected Songs"
bulk_meta_title = "Batch Edit Metadata"
bulk_art_title = "Batch Edit Artwork"
bulk_lyric_title = "Batch Edit Lyrics"
bulk_keep = "Keep existing value (No change)"
bulk_art_overwrite = "Overwrite with new image"
bulk_lyric_overwrite = "Overwrite with new lyrics"
btn_fetch = "Fetch"
label_keep = "< Keep >"
label_keep_lyric = "< Keep > (Lyrics will not be changed)"
label_keep_art = "< Keep > (Image will not be changed)"
label_bulk_delete_target = "{count} selected songs"

delete_modal_title = "Delete Song"
delete_modal_desc = "Are you sure you want to completely delete this song from your library and storage?"
btn_delete_confirm = "Delete"

adv_search_title = "Advanced Search Filter"
btn_apply_filter = "Apply Filter"
btn_clear_filter = "Clear Filter"

adv_match_all = "All of"
adv_match_any = "Any of"
adv_match_rules = "rules match"
adv_particle_ga = " "
adv_particle_to = "and"
adv_ph_search = "Search word..."
adv_ph_number = "Number..."

op_contains = "Contains"
op_not_contains = "Does not contain"
op_equals = "Equals"
op_not_equals = "Does not equal"
op_startswith = "Starts with"
op_endswith = "Ends with"
op_greater = "Greater than"
op_less = "Less than"
op_range = "In range"

msg_bulk_updated = "Updated {count} songs successfully"
msg_bulk_deleted = "Deleted {count} songs successfully"
msg_bulk_edit_failed = "Failed to update songs"
msg_select_songs_prompt = "Please select songs"
msg_lyric_saved = "Lyrics saved successfully"
msg_art_updated = "Artwork updated successfully"
msg_deleted = "Deleted successfully"
msg_cannot_play = "Cannot play audio"
msg_not_found = "Not found"
msg_network_error = "Network communication error"
msg_enter_url = "Please enter a URL"
msg_ext_missing = "Required extensions are missing"
msg_art_fetch_success = "Thumbnail fetched successfully"
msg_img_fetch_success = "Image fetched successfully"
msg_db_update_failed = "Failed to update database"

[Migration]
title = "Data Transfer"
subtitle = "Batch export the entire Chordia environment or restore from backup"

export_title = "1. Export Transfer Data"
export_desc = "Bundle your library, settings, and playlists into an encrypted ZIP backup."

target_music = "Music Files"
target_music_desc = "All audio files in library/music/"
target_images = "Album Artwork"
target_images_desc = "All image data in library/images/"
target_db = "Database"
target_db_desc = "userfiles/music.json (track info list)"
target_settings = "Configuration Files"
target_settings_desc = "settings.ini / themes.json"
target_playlists = "Playlists & History"
target_playlists_desc = "playlist / played_times / history"

save_path_label = "Destination & File Name"
save_path_placeholder = "Select export destination..."
btn_browse = "Browse"
password_label = "Password Protection (Optional)"
password_placeholder = "Enter password (leave blank for no encryption)"
btn_export = "Run Export"
btn_exporting = "Exporting..."

import_title = "2. Import Transfer Data"
import_desc = "Select an exported backup archive (ZIP) to restore everything into your current environment."
drop_main_msg = "Drop backup ZIP file here"
drop_sub_msg = "or click to select file"
import_pass_label = "Decryption Password"
import_pass_placeholder = "Enter decryption password"
btn_apply = "Apply"

modal_export_title = "Export Complete"
modal_export_msg = "Your data has been successfully backed up."
modal_import_title = "Restore Complete"
modal_import_msg = "All library data and settings have been restored."
btn_show_explorer = "Show in Explorer"
btn_show_finder = "Show in Finder"

msg_compressing = "Compressing data for backup..."
msg_rewriting_cache = "Rewriting internal cache..."
msg_restoring = "Extracting and restoring backup ZIP archive..."

toast_interrupted = "Operation cancelled"
toast_specify_path = "Please specify an export destination file name"
toast_select_target = "Please select at least one item to export"
toast_pass_too_long = "Password must be within 128 characters"
toast_export_success = "Export completed successfully"
toast_system_error = "A system error occurred"
toast_explorer_failed = "Failed to open in Explorer"
toast_finder_failed = "Failed to open in Finder"
toast_zip_required = "Backup file must be a ZIP archive (.zip)"
toast_enter_password = "Please enter the decryption password"
toast_password_protected = "This backup file is password protected"
toast_import_success = "Import completed successfully"
toast_restore_failed = "Failed to restore: {err}"

[Sync]
title = "Sync Settings"
wan_title = "Remote (WAN) Connection Mode"
wan_desc = "Builds a secure HTTPS tunnel to allow syncing over the Internet."
wan_status_off = "● WAN Mode: OFF (Disabled)"
wan_status_building = "● WAN Mode: ON (Building tunnel...)"
wan_status_on = "● WAN Mode: ON (Active / Waiting)"
wan_url_label = "WAN Public URL:"
wan_tunnel_building = "Building tunnel..."
wan_qr_desc = "Scan with \"Auto Connect via QR Code\" on mobile app<br>(*Due to WAN connection, 6-digit code must be entered manually for security)"

ip_label = "IP Address (LAN)"
port_label = "Port Number"
loading_ip = "Fetching..."
auth_code_desc = "Enter the following authentication code into the mobile app"
countdown_text = "Refreshes in {sec}s"
qr_desc = "Or scan the QR code with your camera"
btn_show_qr = "Show LAN QR Code"
btn_hide_qr = "Hide QR Code"

requests_title = "Connection Requests (Pending)"
no_requests = "No pending requests"
waiting_code_title = "Waiting for Code Entry"
no_waiting_code = "No devices currently waiting for code entry"
sessions_title = "Active Connected Sessions (Syncing)"
no_sessions = "No connected devices."

btn_approve = "Approve"
btn_reject = "Reject"
btn_cancel_approval = "Cancel"
btn_disconnect = "Disconnect"
label_waiting_code = "Waiting for code..."
label_remaining_time = "Last access: {min}m {sec}s remaining"

toast_wan_enabled = "WAN mode enabled"
toast_wan_disabled = "WAN mode disabled"
toast_auth_request = "Connection request from {device}"
toast_auth_success = "Pairing complete: Connected to {device}"
toast_server_error = "Failed to start sync server"
toast_waiting_port = "Waiting to obtain port..."
err_cloudflared_start = "Failed to start cloudflared (Please check {bin})"
err_cloudflared_timeout = "Timed out waiting for Cloudflare Tunnel URL."

[Integrity]
title = "Integrity Check"
subtitle = "Comprehensively check the health of database, files, and settings"
action_title = "Run Full System Check"
action_desc = "Scans for tag mismatches, extension tools, unmeasured loudness, file corruption, and orphan/missing files."
btn_start = "Start Check"
btn_scanning = "Checking..."
loading_msg = "Scanning library integrity..."
summary_status = "Overall Status"
summary_issues = "Detected Issues"
count_unit = "{count} items"

status_ok = "Healthy (No issues)"
status_error = "Needs Attention"
status_warning = "Minor Warnings Found"

sec_tag_title = "1. MP3 Tag & Lyrics Mismatches"
sec_tag_desc = "Differences between database metadata and ID3 tags stored in MP3 files."
sec_bin_title = "2. Extension Tools (bin folder) Status"
sec_bin_desc = "Checks for missing tools, corrupted binaries, and unexpected files."
sec_lufs_title = "3. Unmeasured Loudness (LUFS) Songs"
sec_lufs_desc = "Songs that have not yet been analyzed for Loudness Normalization."
sec_corrupted_title = "4. Corrupted Settings, Language & Database Files"
sec_corrupted_desc = "Settings, language packs, and database files that cannot be parsed due to syntax errors or corruption."
sec_orphan_title = "5. Orphan & Missing Files (library folder)"
sec_orphan_desc = "Unreferenced files in library folders and broken file links in database."

msg_tag_ok = "All song tags match the database."
msg_bin_ok = "All required tools are installed with no unexpected files."
msg_lufs_ok = "Loudness measurement is complete for all songs."
msg_corrupted_ok = "No corrupted settings, language packs, or database files found."
msg_orphan_ok = "No orphan or missing files found."

label_bin_missing = "❌ Missing:"
label_bin_invalid = "⚠️ Corrupted:"
label_bin_unexpected = "❓ Unknown File:"
label_missing_music = "❌ Missing Audio:"
label_missing_image = "❌ Missing Image:"
label_orphan_music = "🗑️ Orphan Audio:"
label_orphan_image = "🗑️ Orphan Image:"
label_corrupted = "❌ Read Error:"

desc_bin_missing = "Required tool {tool} is not installed."
desc_bin_invalid = "Tool {tool} failed to start properly."
desc_bin_unexpected = "Unexpected file {file} found in bin folder."
desc_missing_music = "Registered in database but file does not exist ({file})"
desc_missing_image = "Registered in database but image does not exist ({file})"
desc_orphan_music = "Unreferenced audio file ({file})"
desc_orphan_image = "Unreferenced image file ({file})"

err_official_lang_missing = "Official language pack is missing"
err_lang_file_modified = "Official language pack content mismatch (Modified/Corrupted)"
err_ini_syntax = "INI syntax error (Corrupted)"
err_json_syntax = "JSON syntax error (Corrupted)"
err_playlist_syntax = "Playlist JSON syntax error (Corrupted)"
err_file_read = "Failed to read file"

th_file = "File"
th_field = "Field"
th_db_val = "DB Value"
th_tag_val = "Tag Value"

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
        let _ = fs::write(en_path, DEFAULT_ENGLISH_INI);
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

#[tauri::command]
pub fn get_language_pack(filename: Option<String>) -> Result<Value, String> {
    let target_file = match filename {
        Some(f) if !f.is_empty() => f,
        _ => crate::cmd_settings::get_app_settings().language,
    };

    let target_path = get_base_dir().join("lang").join(&target_file);

    if target_path.exists() {
        if let Ok(ini) = Ini::load_from_file(&target_path) {
            return Ok(ini_to_json_value(&ini));
        }
    }

    let ja_path = get_base_dir().join("lang/Japanese.ini");
    if ja_path.exists() {
        if let Ok(ini) = Ini::load_from_file(&ja_path) {
            return Ok(ini_to_json_value(&ini));
        }
    }

    let fallback_ini = Ini::load_from_str(DEFAULT_JAPANESE_INI).unwrap_or_else(|_| Ini::new());
    Ok(ini_to_json_value(&fallback_ini))
}

use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use crate::utils::get_base_dir;
use base64::{Engine as _, engine::general_purpose};
use tauri::{State, AppHandle, Emitter};
use crate::AppState;

#[tauri::command]
pub fn get_default_export_path() -> Result<String, String> {
    let doc_dir = dirs::download_dir().unwrap_or_else(|| dirs::document_dir().unwrap_or_else(|| PathBuf::from(".")));
    Ok(doc_dir.join("Chordia_Backup.zip").to_string_lossy().to_string())
}

#[tauri::command]
pub fn ask_save_path(current_path: String) -> Option<String> {
    let mut dialog = rfd::FileDialog::new()
        .set_title("引継ぎファイルの保存先を選択")
        .add_filter("ZIP Archive", &["zip"])
        .set_file_name("Chordia_Backup.zip");
        
    if !current_path.is_empty() {
        if let Some(parent) = Path::new(&current_path).parent() {
            dialog = dialog.set_directory(parent);
        }
    }
    
    dialog.save_file().map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn execute_export(targets: serde_json::Map<String, Value>, save_path: String, password: Option<String>) -> Result<Value, String> {
    let save_path_clone = save_path.clone();
    
    let password_static: &'static str = if let Some(pass) = password {
        if pass.chars().count() > 128 {
            return Err("パスワードは128文字以内にしてください".to_string());
        }
        if !pass.is_empty() {
            Box::leak(pass.into_boxed_str())
        } else {
            ""
        }
    } else {
        ""
    };

    let result: Result<(), String> = tokio::task::spawn_blocking(move || {
        let base_dir = get_base_dir();
        let save_path_obj = Path::new(&save_path_clone);
        
        if let Some(p) = save_path_obj.parent() {
            let _ = fs::create_dir_all(p);
        }

        let file = fs::File::create(&save_path_obj).map_err(|e| format!("引継ぎファイルの作成に失敗しました: {}", e))?;
        let mut zip = zip::ZipWriter::new(file);
        
        let options = if !password_static.is_empty() {
            zip::write::SimpleFileOptions::default()
                .compression_method(zip::CompressionMethod::Deflated)
                .unix_permissions(0o755)
                .with_aes_encryption(zip::AesMode::Aes256, password_static)
        } else {
            zip::write::SimpleFileOptions::default()
                .compression_method(zip::CompressionMethod::Deflated)
                .unix_permissions(0o755)
        };

        if targets.get("music").and_then(|v| v.as_bool()).unwrap_or(false) {
            add_dir_to_zip(&mut zip, options.clone(), &base_dir.join("library/music"), "library/music")?;
        }
        if targets.get("images").and_then(|v| v.as_bool()).unwrap_or(false) {
            add_dir_to_zip(&mut zip, options.clone(), &base_dir.join("library/images"), "library/images")?;
        }
        if targets.get("db").and_then(|v| v.as_bool()).unwrap_or(false) {
            add_file_to_zip(&mut zip, options.clone(), &base_dir.join("userfiles/music.json"), "userfiles/music.json")?;
        }
        if targets.get("settings").and_then(|v| v.as_bool()).unwrap_or(false) {
            add_file_to_zip(&mut zip, options.clone(), &base_dir.join("userfiles/settings.ini"), "userfiles/settings.ini")?;
            add_file_to_zip(&mut zip, options.clone(), &base_dir.join("userfiles/custom_themes.json"), "userfiles/custom_themes.json")?;
        }
        if targets.get("playlists").and_then(|v| v.as_bool()).unwrap_or(false) {
            add_file_to_zip(&mut zip, options.clone(), &base_dir.join("userfiles/playlist.json"), "userfiles/playlist.json")?;
            add_dir_to_zip(&mut zip, options.clone(), &base_dir.join("userfiles/playlist"), "userfiles/playlist")?;
            add_file_to_zip(&mut zip, options.clone(), &base_dir.join("userfiles/history.json"), "userfiles/history.json")?;
            add_file_to_zip(&mut zip, options.clone(), &base_dir.join("userfiles/played_times.json"), "userfiles/played_times.json")?;
        }

        zip.finish().map_err(|e| format!("ZIPの最終処理に失敗しました: {}", e))?;
        Ok(())
        
    }).await.map_err(|e| format!("スレッドエラー: {}", e))?;

    match result {
        Ok(_) => Ok(serde_json::json!({"success": true, "path": save_path})),
        Err(e) => Err(e),
    }
}

// ★ 修正：AES暗号化ZIPが、パスワードなしで目録取得を行った際のエラー（UnsupportedArchive）も安全にキャッチして needs_password を判定します
#[tauri::command]
pub fn execute_migration_import(
    zip_data_b64: String, 
    password: Option<String>,
    state: State<'_, AppState>,
    app_handle: AppHandle
) -> Result<Value, String> {
    if let Some(ref pass) = password {
        if pass.chars().count() > 128 {
            return Err("パスワードは128文字以内にしてください".to_string());
        }
    }

    let base_dir = get_base_dir();
    
    // Base64デコード処理
    let b64_clean = if zip_data_b64.contains(',') { zip_data_b64.split(',').nth(1).unwrap() } else { &zip_data_b64 };
    let bytes = general_purpose::STANDARD.decode(b64_clean).map_err(|e| format!("デコードエラー: {}", e))?;
    
    // メモリ上のCursorを用いて解凍を実行
    let cursor = std::io::Cursor::new(bytes);
    let mut archive = zip::ZipArchive::new(cursor).map_err(|e| format!("ZIPの解析に失敗しました: {}", e))?;

    // 実際に暗号化されたファイルが存在するか確認（確実なエラーマッチング仕様へアップグレード）
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

    let pass_str = password.as_deref().unwrap_or("");
    if needs_password && pass_str.is_empty() {
        return Ok(serde_json::json!({"status": "password_required"}));
    }

    // 展開（リストア）開始
    for i in 0..archive.len() {
        let mut file = if needs_password {
            match archive.by_index_decrypt(i, pass_str.as_bytes()) {
                Ok(f) => f,
                Err(zip::result::ZipError::InvalidPassword) => return Err("パスワードが間違っています".to_string()),
                Err(e) => return Err(e.to_string()),
            }
        } else {
            archive.by_index(i).map_err(|e| e.to_string())?
        };

        let outpath = match file.enclosed_name() {
            Some(path) => base_dir.join(path),
            None => continue,
        };

        if (*file.name()).ends_with('/') {
            fs::create_dir_all(&outpath).map_err(|e| e.to_string())?;
        } else {
            if let Some(p) = outpath.parent() {
                if !p.exists() {
                    fs::create_dir_all(&p).map_err(|e| e.to_string())?;
                }
            }
            let mut outfile = fs::File::create(&outpath).map_err(|e| e.to_string())?;
            std::io::copy(&mut file, &mut outfile).map_err(|e| format!("展開ファイル書き込みエラー: {}", e))?;
        }
    }

    // ファイル書込み完了後、メモリ再書込み中の表示をJSへ指示するためイベントをエミット
    let _ = app_handle.emit("migration_status", "rewriting_cache");

    // ディスク上の新しい music.json と playlist.json を再ロードし、インメモリのAppStateを完全に書き換えてキャッシュクリーンを完了
    let new_db = crate::utils::load_db();
    let new_playlists = crate::utils::load_playlists_master();

    {
        let mut db_guard = state.db.lock().unwrap();
        *db_guard = new_db;
    }
    {
        let mut pl_guard = state.playlists.lock().unwrap();
        *pl_guard = new_playlists;
    }

    Ok(serde_json::json!({"status": "success"}))
}

fn add_file_to_zip(
    zip: &mut zip::ZipWriter<fs::File>,
    options: zip::write::SimpleFileOptions,
    src: &Path,
    dst_name: &str,
) -> Result<(), String> {
    if !src.exists() || !src.is_file() { return Ok(()); }
    zip.start_file(dst_name, options).map_err(|e| e.to_string())?;
    let mut f = fs::File::open(src).map_err(|e| e.to_string())?;
    std::io::copy(&mut f, zip).map_err(|e| format!("ファイル書き込みエラー ({}): {}", dst_name, e))?;
    Ok(())
}

fn add_dir_to_zip(
    zip: &mut zip::ZipWriter<fs::File>,
    options: zip::write::SimpleFileOptions,
    src_dir: &Path,
    dst_prefix: &str,
) -> Result<(), String> {
    if !src_dir.exists() || !src_dir.is_dir() { return Ok(()); }
    
    if !dst_prefix.is_empty() {
        let _ = zip.add_directory(dst_prefix.to_string() + "/", options);
    }

    for entry in walkdir::WalkDir::new(src_dir).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if path == src_dir { continue; }
        
        let rel_path = path.strip_prefix(src_dir).unwrap();
        let rel_str = rel_path.to_string_lossy().replace("\\", "/");
        
        if rel_str.is_empty() { continue; }
        
        let zip_name = if dst_prefix.is_empty() {
            rel_str
        } else {
            format!("{}/{}", dst_prefix, rel_str)
        };

        if path.is_file() {
            zip.start_file(zip_name.clone(), options).map_err(|e| e.to_string())?;
            let mut f = fs::File::open(path).map_err(|e| e.to_string())?;
            std::io::copy(&mut f, zip).map_err(|e| format!("ファイル書き込みエラー ({}): {}", zip_name, e))?;
        } else if path.is_dir() {
            let _ = zip.add_directory(zip_name + "/", options);
        }
    }
    Ok(())
}
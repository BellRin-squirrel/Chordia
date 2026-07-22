use serde_json::Value;
use tauri::{AppHandle, Emitter};
use std::fs;
use std::io::Read;
use crate::utils::get_base_dir;

#[tauri::command]
pub async fn check_tool_updates() -> Result<Value, String> {
    tokio::task::spawn_blocking(move || {
        let base = get_base_dir().join("userfiles/bin");
        let mut results = serde_json::Map::new();

        // 1. クリーンアップ処理 (実行環境に応じた拡張子の動的解決)
        let ext = if cfg!(target_os = "windows") { ".exe" } else { "" };
        let allowed_files = [
            format!("yt-dlp{}", ext),
            format!("ffmpeg{}", ext),
            format!("deno{}", ext),
        ];

        if let Ok(entries) = fs::read_dir(&base) {
            for entry in entries.filter_map(|e| e.ok()) {
                let path = entry.path();
                if path.is_file() {
                    if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                        if !allowed_files.contains(&file_name.to_string()) {
                            let _ = std::fs::remove_file(path);
                        }
                    }
                } else if path.is_dir() {
                    let _ = std::fs::remove_dir_all(path);
                }
            }
        }

        // 2. 整合性チェックとバージョン情報の生成
        for tool in ["yt-dlp", "ffmpeg", "deno"] {
            let exe_path = base.join(format!("{}{}", tool, ext));
            let exists = exe_path.exists();
            
            let mut is_valid = false;
            if exists {
                if let Ok(m) = fs::metadata(&exe_path) {
                    if m.len() >= 10240 {
                        let (arg, keyword) = match tool {
                            "yt-dlp" => ("--help", "yt-dlp"), 
                            "ffmpeg" => ("-version", "ffmpeg"),
                            "deno" => ("--version", "deno"),
                            _ => ("--version", ""),
                        };
                        
                        let mut cmd = std::process::Command::new(&exe_path);
                        cmd.arg(arg);

                        // ★ 修正：Windows環境でのみローカルでCommandExtを読み込み非表示フラグを適用
                        #[cfg(target_os = "windows")]
                        {
                            use std::os::windows::process::CommandExt;
                            cmd.creation_flags(0x08000000);
                        }

                        if let Ok(out) = cmd.output() {
                            let stdout = String::from_utf8_lossy(&out.stdout).to_lowercase();
                            let stderr = String::from_utf8_lossy(&out.stderr).to_lowercase();
                            is_valid = stdout.contains(keyword) || stderr.contains(keyword);
                        }
                    }
                }
            }

            let update_needed = !exists || !is_valid;
            
            let local_version = if !exists {
                "未インストール".to_string()
            } else if !is_valid {
                "正しいファイルではありません".to_string()
            } else {
                "インストール済み".to_string()
            };

            results.insert(tool.to_string(), serde_json::json!({
                "updateNeeded": update_needed,
                "localVersion": local_version,
                "latestVersion": "最新版",
                "isValid": is_valid
            }));
        }
        Ok(Value::Object(results))
    }).await.map_err(|e| format!("チェック処理スレッドエラー: {}", e))?
}

#[tauri::command]
pub async fn install_tool(tool_name: String, app: AppHandle) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let base_dir = get_base_dir().join("userfiles/bin");
        let _ = fs::create_dir_all(&base_dir);
        
        let url = match tool_name.as_str() {
            "yt-dlp" => {
                if cfg!(target_os = "windows") {
                    "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
                } else if cfg!(target_os = "macos") {
                    "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos"
                } else {
                    return Err("未対応のOSです".to_string());
                }
            },
            "ffmpeg" => {
                if cfg!(target_os = "windows") {
                    "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"
                } else if cfg!(target_os = "macos") {
                    "https://evermeet.cx/ffmpeg/getrelease/zip"
                } else {
                    return Err("未対応のOSです".to_string());
                }
            },
            "deno" => {
                if cfg!(target_os = "windows") {
                    "https://github.com/denoland/deno/releases/latest/download/deno-x86_64-pc-windows-msvc.zip"
                } else if cfg!(target_os = "macos") {
                    if cfg!(target_arch = "aarch64") {
                        "https://github.com/denoland/deno/releases/latest/download/deno-aarch64-apple-darwin.zip"
                    } else {
                        "https://github.com/denoland/deno/releases/latest/download/deno-x86_64-apple-darwin.zip"
                    }
                } else {
                    return Err("未対応のOSです".to_string());
                }
            },
            _ => return Err(format!("不明なツールです: {}", tool_name)),
        };

        let client = reqwest::blocking::Client::builder()
            .user_agent("Mozilla/5.0")
            .build()
            .map_err(|e| e.to_string())?;
            
        let mut response = client.get(url).send().map_err(|e| e.to_string())?;
        if !response.status().is_success() {
            return Err(format!("ダウンロードに失敗しました: {}", response.status()));
        }
        
        let total_size = response.content_length().unwrap_or(0);
        let mut downloaded: u64 = 0;
        let mut buffer = vec![0; 32768]; 
        let mut data = Vec::new();
        
        loop {
            let bytes_read = response.read(&mut buffer).map_err(|e| e.to_string())?;
            if bytes_read == 0 { break; }
            data.extend_from_slice(&buffer[..bytes_read]);
            downloaded += bytes_read as u64;
            
            let _ = app.emit("update_ext_download_progress", serde_json::json!({
                "toolName": tool_name,
                "downloaded": downloaded,
                "total": total_size
            }));
        }

        let _ = app.emit("update_ext_download_progress", serde_json::json!({
            "toolName": tool_name,
            "downloaded": "extracting",
            "total": total_size
        }));

        let ext = if cfg!(target_os = "windows") { ".exe" } else { "" };
        let exe_path = base_dir.join(format!("{}{}", tool_name, ext));

        if url.ends_with(".zip") || tool_name == "ffmpeg" {
            let cursor = std::io::Cursor::new(data);
            let mut archive = zip::ZipArchive::new(cursor).map_err(|e| e.to_string())?;
            let mut extracted = false;
            for i in 0..archive.len() {
                let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
                let name = file.name().to_lowercase();
                
                let target_match = if cfg!(target_os = "windows") {
                    name.ends_with(&format!("{}.exe", tool_name))
                } else {
                    name == tool_name || name.ends_with(&format!("/{}", tool_name))
                };

                if target_match {
                    let mut out = fs::File::create(&exe_path).map_err(|e| e.to_string())?;
                    std::io::copy(&mut file, &mut out).map_err(|e| e.to_string())?;
                    extracted = true;
                    break;
                }
            }
            if !extracted {
                return Err(format!("ZIP内に {} が見つかりませんでした", tool_name));
            }
        } else {
            fs::write(&exe_path, data).map_err(|e| e.to_string())?;
        }

        // macOS / Linux 等のUnixシステムにおいて、ダウンロードしたバイナリに実行権限（chmod +x）を付与
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Ok(metadata) = fs::metadata(&exe_path) {
                let mut perms = metadata.permissions();
                perms.set_mode(0o755); 
                let _ = fs::set_permissions(&exe_path, perms);
            }
        }

        Ok(())
    }).await.map_err(|e| e.to_string())?
}
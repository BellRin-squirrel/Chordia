use serde_json::Value;
use tauri::{AppHandle, Emitter};
use std::fs;
use std::io::Read;
use crate::core::utils::{get_base_dir, ensure_dir_writable, ensure_file_writable};

#[tauri::command]
pub async fn check_tool_updates() -> Result<Value, String> {
    tokio::task::spawn_blocking(move || {
        let base = get_base_dir().join("userfiles/bin");
        let mut results = serde_json::Map::new();

        let ext = if cfg!(target_os = "windows") { ".exe" } else { "" };
        let allowed_files = [
            format!("yt-dlp{}", ext),
            format!("ffmpeg{}", ext),
            format!("deno{}", ext),
            format!("cloudflared{}", ext),
        ];

        let _ = ensure_dir_writable(&base);

        if let Ok(entries) = fs::read_dir(&base) {
            for entry in entries.filter_map(|e| e.ok()) {
                let path = entry.path();
                if path.is_file() {
                    if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                        if !allowed_files.contains(&file_name.to_string()) {
                            ensure_file_writable(&path);
                            let _ = std::fs::remove_file(path);
                        }
                    }
                } else if path.is_dir() {
                    let _ = std::fs::remove_dir_all(path);
                }
            }
        }

        for tool in ["yt-dlp", "ffmpeg", "deno", "cloudflared"] {
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
                            "cloudflared" => ("--version", "cloudflared"),
                            _ => ("--version", ""),
                        };
                        
                        let mut cmd = std::process::Command::new(&exe_path);
                        cmd.arg(arg);

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
        ensure_dir_writable(&base_dir).map_err(|e| format!("ディレクトリ権限取得エラー: {}", e))?;
        
        let url = match tool_name.as_str() {
            "yt-dlp" => {
                if cfg!(target_os = "windows") {
                    "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe".to_string()
                } else if cfg!(target_os = "macos") {
                    "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos".to_string()
                } else {
                    return Err("未対応のOSです".to_string());
                }
            },
            "ffmpeg" => {
                if cfg!(target_os = "windows") {
                    "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip".to_string()
                } else if cfg!(target_os = "macos") {
                    "https://evermeet.cx/ffmpeg/getrelease/zip".to_string()
                } else {
                    return Err("未対応のOSです".to_string());
                }
            },
            "deno" => {
                if cfg!(target_os = "windows") {
                    "https://github.com/denoland/deno/releases/latest/download/deno-x86_64-pc-windows-msvc.zip".to_string()
                } else if cfg!(target_os = "macos") {
                    if cfg!(target_arch = "aarch64") {
                        "https://github.com/denoland/deno/releases/latest/download/deno-aarch64-apple-darwin.zip".to_string()
                    } else {
                        "https://github.com/denoland/deno/releases/latest/download/deno-x86_64-apple-darwin.zip".to_string()
                    }
                } else {
                    return Err("未対応のOSです".to_string());
                }
            },
            "cloudflared" => {
                if cfg!(target_os = "windows") {
                    "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe".to_string()
                } else if cfg!(target_os = "macos") {
                    if cfg!(target_arch = "aarch64") {
                        "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-arm64.tgz".to_string()
                    } else {
                        "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64.tgz".to_string()
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
            
        let mut response = client.get(&url).send().map_err(|e| e.to_string())?;
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

        // ★ 既存バイナリへの書き込み権限解除とクリーンアップ
        if exe_path.exists() {
            ensure_file_writable(&exe_path);
            let _ = fs::remove_file(&exe_path);
        }

        if url.ends_with(".tgz") {
            let temp_tgz_path = base_dir.join(format!("temp_{}.tgz", tool_name));
            ensure_file_writable(&temp_tgz_path);
            fs::write(&temp_tgz_path, &data).map_err(|e| e.to_string())?;

            let extracted_binary = base_dir.join("cloudflared");
            if extracted_binary.exists() {
                ensure_file_writable(&extracted_binary);
                let _ = fs::remove_file(&extracted_binary);
            }

            let mut cmd = std::process::Command::new("tar");
            cmd.args(&["-xzf", temp_tgz_path.to_str().unwrap(), "-C", base_dir.to_str().unwrap()]);
            let _ = cmd.output();

            if extracted_binary.exists() {
                let _ = fs::rename(&extracted_binary, &exe_path);
            }
            let _ = fs::remove_file(temp_tgz_path);
        } else if url.ends_with(".zip") || tool_name == "ffmpeg" {
            let cursor = std::io::Cursor::new(data);
            let mut archive = zip::ZipArchive::new(cursor).map_err(|e| e.to_string())?;
            let mut extracted = false;
            
            // ★ 一時ファイル経由で安全に書き込み
            let temp_extracted_path = base_dir.join(format!("temp_{}{}", tool_name, ext));
            if temp_extracted_path.exists() {
                ensure_file_writable(&temp_extracted_path);
                let _ = fs::remove_file(&temp_extracted_path);
            }

            for i in 0..archive.len() {
                let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
                let name = file.name().to_lowercase();
                
                let target_match = if cfg!(target_os = "windows") {
                    name.ends_with(&format!("{}.exe", tool_name))
                } else {
                    name == tool_name || name.ends_with(&format!("/{}", tool_name))
                };

                if target_match {
                    let mut out = fs::File::create(&temp_extracted_path).map_err(|e| e.to_string())?;
                    std::io::copy(&mut file, &mut out).map_err(|e| e.to_string())?;
                    drop(out);
                    let _ = fs::rename(&temp_extracted_path, &exe_path);
                    extracted = true;
                    break;
                }
            }
            if !extracted {
                let _ = fs::remove_file(&temp_extracted_path);
                return Err(format!("ZIP内に {} が見つかりませんでした", tool_name));
            }
        } else {
            // ★ 単体バイナリも一時ファイルに書き込んでからアトミックにリネーム
            let temp_bin_path = base_dir.join(format!("temp_{}{}", tool_name, ext));
            if temp_bin_path.exists() {
                ensure_file_writable(&temp_bin_path);
                let _ = fs::remove_file(&temp_bin_path);
            }

            fs::write(&temp_bin_path, data).map_err(|e| e.to_string())?;
            let _ = fs::rename(&temp_bin_path, &exe_path);
        }

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Ok(metadata) = fs::metadata(&exe_path) {
                let mut perms = metadata.permissions();
                perms.set_mode(0o755); 
                let _ = fs::set_permissions(&exe_path, perms);
            }

            // ★ macOS Gatekeeper の隔離フラグを解除
            #[cfg(target_os = "macos")]
            {
                if let Some(p_str) = exe_path.to_str() {
                    let _ = std::process::Command::new("xattr")
                        .args(&["-d", "com.apple.quarantine", p_str])
                        .output();
                }
            }
        }

        Ok(())
    }).await.map_err(|e| e.to_string())?
}
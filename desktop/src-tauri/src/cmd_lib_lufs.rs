use tauri::{State, AppHandle, Emitter};
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use tokio::sync::Semaphore;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use crate::AppState;
use crate::utils::{get_base_dir, normalize_rel_path, save_lufs_cache, load_lufs_cache};

#[tauri::command]
pub fn get_song_lufs(filename: String, state: State<'_, AppState>) -> Option<f32> {
    let cache = state.lufs_cache.lock().unwrap();
    cache.get(&filename).copied()
}

#[tauri::command]
pub async fn check_lufs_status(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    {
        let latest_disk_cache = load_lufs_cache();
        let mut cache_guard = state.lufs_cache.lock().unwrap();
        *cache_guard = latest_disk_cache;
    }

    let db_guard = state.db.lock().unwrap();
    let cache_guard = state.lufs_cache.lock().unwrap();
    let total = db_guard.len();
    let mut calculated = 0;
    
    for song in db_guard.iter() {
        if let Some(rel_path) = song.get("musicFilename").and_then(|v| v.as_str()) {
            if cache_guard.contains_key(rel_path) {
                calculated += 1;
            }
        }
    }
    
    let uncalculated = total.saturating_sub(calculated);
    let is_completed = total > 0 && uncalculated == 0;

    Ok(serde_json::json!({
        "total": total,
        "calculated": calculated,
        "uncalculated": uncalculated,
        "is_completed": is_completed
    }))
}

#[tauri::command]
pub async fn start_lufs_calculation_all(force: Option<bool>, state: State<'_, AppState>, app: AppHandle) -> Result<(), String> {
    let force_recalc = force.unwrap_or(false);

    {
        let disk_cache = if force_recalc {
            std::collections::HashMap::new()
        } else {
            load_lufs_cache()
        };
        let mut cache = state.lufs_cache.lock().unwrap();
        *cache = disk_cache;
        if force_recalc {
            save_lufs_cache(&cache);
        }
    }

    let mut targets_to_calc = Vec::new();
    
    {
        let db = state.db.lock().unwrap();
        let cache = state.lufs_cache.lock().unwrap();
        for song in db.iter() {
            if let Some(rel_path) = song.get("musicFilename").and_then(|v| v.as_str()) {
                if force_recalc || !cache.contains_key(rel_path) {
                    let title = song.get("title").and_then(|v| v.as_str()).unwrap_or("Unknown").to_string();
                    targets_to_calc.push((rel_path.to_string(), title));
                }
            }
        }
    }

    let total = targets_to_calc.len();
    if total == 0 {
        // ★ status_code を送信
        let _ = app.emit("lufs_calc_progress", serde_json::json!({
            "current": 0, "total": 0, "status_code": "already_completed", "message": "すべての楽曲の音量解析は完了しています"
        }));
        return Ok(());
    }

    // ★ status_code を送信
    let _ = app.emit("lufs_calc_progress", serde_json::json!({
        "current": 0, "total": total, "status_code": "preparing", "message": "解析の準備中..."
    }));

    let base_dir = get_base_dir();
    let ext = if cfg!(target_os = "windows") { ".exe" } else { "" };
    let ffmpeg_path = base_dir.join(format!("userfiles/bin/ffmpeg{}", ext));

    if !ffmpeg_path.exists() {
        return Err("FFmpegが見つかりません。".to_string());
    }

    let semaphore = Arc::new(Semaphore::new(4));
    let mut handles = Vec::new();
    let current_counter = Arc::new(AtomicUsize::new(0));

    for (rel_path, title) in targets_to_calc {
        let semaphore_clone = semaphore.clone();
        let ffmpeg = ffmpeg_path.clone();
        let abs_path = base_dir.join(normalize_rel_path(&rel_path));
        let path_key = rel_path.clone();
        let app_clone = app.clone();
        let counter_clone = current_counter.clone();

        handles.push(tokio::spawn(async move {
            let _permit = semaphore_clone.acquire_owned().await.unwrap();
            
            let current_now = counter_clone.load(Ordering::SeqCst);
            // ★ status_code と title を送信
            let _ = app_clone.emit("lufs_calc_progress", serde_json::json!({
                "current": current_now,
                "total": total,
                "status_code": "analyzing",
                "title": title,
                "message": format!("「{}」を解析中...", title)
            }));

            let mut lufs_val: Option<f32> = None;
            if abs_path.exists() {
                let mut std_cmd = std::process::Command::new(&ffmpeg);
                std_cmd.args(&["-hide_banner", "-nostdin", "-i", abs_path.to_str().unwrap(), "-af", "ebur128", "-f", "null", "-"]);
                
                #[cfg(target_os = "windows")]
                std_cmd.creation_flags(0x08000000);
                
                let mut cmd = tokio::process::Command::from(std_cmd);
                if let Ok(output) = cmd.output().await {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    for line in stderr.lines() {
                        if line.contains("I:") && line.contains("LUFS") {
                            let parts: Vec<&str> = line.split_whitespace().collect();
                            if parts.len() >= 2 {
                                if let Ok(val) = parts[1].parse::<f32>() {
                                    lufs_val = Some(val);
                                }
                            }
                        }
                    }
                }
            }
            
            let current_after = counter_clone.fetch_add(1, Ordering::SeqCst) + 1;
            // ★ status_code と title を送信
            let _ = app_clone.emit("lufs_calc_progress", serde_json::json!({
                "current": current_after,
                "total": total,
                "status_code": "analyzed",
                "title": title,
                "message": format!("「{}」の解析完了", title)
            }));

            (path_key, lufs_val)
        }));
    }

    let mut newly_calculated = false;

    for handle in handles {
        if let Ok((path_key, lufs_opt)) = handle.await {
            if let Some(lufs) = lufs_opt {
                let mut cache = state.lufs_cache.lock().unwrap();
                cache.insert(path_key, lufs);
                newly_calculated = true;
            }
        }
    }

    if newly_calculated {
        let cache = state.lufs_cache.lock().unwrap();
        save_lufs_cache(&cache);
    }

    // ★ status_code を送信
    let _ = app.emit("lufs_calc_progress", serde_json::json!({
        "current": total, "total": total, "status_code": "completed", "message": "すべての解析が完了しました！"
    }));

    Ok(())
}
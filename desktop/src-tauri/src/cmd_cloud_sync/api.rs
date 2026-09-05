use serde_json::Value;
use tauri::{AppHandle, Emitter, State};
use crate::server::SharedAuthState;
use std::fs;
use chrono::Local;
use crate::utils::{get_base_dir, safe_write_file};
use super::auth::get_saved_cloud_sid;

pub async fn send_single_play_history_to_cloud(
    client: &reqwest::Client,
    sid: &str,
    title: &str,
    artist: &str,
    album: &str,
    date: Option<&str>,
) -> Result<(), String> {
    let mut payload = serde_json::json!({
        "operation": "addPlayHistory",
        "SID": sid,
        "title": title,
        "artist": artist,
        "album": album,
        "albbum": album // サーバー側パラメータ互換用
    });

    if let Some(d) = date {
        if !d.is_empty() {
            payload["date"] = serde_json::Value::String(d.to_string());
            payload["timestamp"] = serde_json::Value::String(d.to_string());
        }
    }

    let body_json = serde_json::to_string(&payload)
        .map_err(|e| format!("JSON構築エラー: {}", e))?;

    let response = client
        .post("https://chordia.bellrin.f5.si/api/")
        .header("X-ACCESS-KEY", "ucbancmuvmczvlxgycbvuwfasdyowwap")
        .header("HTTP_X_ACCESS_KEY", "ucbancmuvmczvlxgycbvuwfasdyowwap")
        .header("Content-Type", "application/json")
        .body(body_json)
        .send()
        .await
        .map_err(|e| format!("通信エラー: {}", e))?;

    let res_text = response.text().await.map_err(|e| format!("レスポンス読み取りエラー: {}", e))?;
    println!("[Chordia Sync] addPlayHistory result: {}", res_text);

    let json_res: Value = serde_json::from_str(&res_text).map_err(|_| format!("不正なJSON: {}", res_text))?;

    if let Some(err) = json_res.get("error").and_then(|v| v.as_str()) {
        eprintln!("[Chordia Sync Error] addPlayHistory returned error: {}", err);
        return Err(err.to_string());
    }

    Ok(())
}

#[tauri::command]
pub async fn add_play_history_to_cloud(
    title: String,
    artist: String,
    album: String,
    date: Option<String>,
    auth: State<'_, SharedAuthState>,
) -> Result<(), String> {
    let sid = match get_saved_cloud_sid(&auth).await {
        Some(s) if !s.is_empty() => s,
        _ => return Ok(()),
    };

    let client = reqwest::Client::builder().timeout(std::time::Duration::from_secs(8)).build().map_err(|e| e.to_string())?;
    send_single_play_history_to_cloud(&client, &sid, &title, &artist, &album, date.as_deref()).await
}

// 既存の再生履歴をクラウドへ一括同期（送信完了後にローカル履歴を完全消去）
#[tauri::command]
pub async fn sync_all_local_history_to_cloud(
    app: AppHandle,
    auth: State<'_, SharedAuthState>,
) -> Result<usize, String> {
    let sid = get_saved_cloud_sid(&auth).await.ok_or_else(|| "ログインしていません。".to_string())?;

    let h_path = get_base_dir().join("userfiles/history.json");
    if !h_path.exists() {
        return Ok(0);
    }

    let data = fs::read_to_string(&h_path).map_err(|e| e.to_string())?;
    let history_list: Vec<Value> = serde_json::from_str(&data).unwrap_or_default();

    let total = history_list.len();
    if total == 0 {
        let _ = safe_write_file(&h_path, b"[]");
        return Ok(0);
    }

    let client = reqwest::Client::builder().timeout(std::time::Duration::from_secs(10)).build().map_err(|e| e.to_string())?;
    let mut success_count = 0;

    for (idx, item) in history_list.iter().enumerate() {
        let title = item.get("title").and_then(|v| v.as_str()).unwrap_or("Unknown");
        let artist = item.get("artist").and_then(|v| v.as_str()).unwrap_or("Unknown");
        let album = item.get("album").and_then(|v| v.as_str()).unwrap_or("");
        let timestamp = item.get("timestamp").and_then(|v| v.as_str());

        let _ = send_single_play_history_to_cloud(&client, &sid, title, artist, album, timestamp).await;
        success_count += 1;

        let _ = app.emit("sync_history_progress", serde_json::json!({
            "current": idx + 1,
            "total": total
        }));

        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    }

    // ★ クラウド送信完了後、ローカルの再生履歴を完全に消去
    let _ = safe_write_file(&h_path, b"[]");

    Ok(success_count)
}

#[tauri::command]
pub async fn fetch_cloud_play_history(auth: State<'_, SharedAuthState>) -> Result<Value, String> {
    let sid = get_saved_cloud_sid(&auth).await.ok_or_else(|| "ログインしていません。".to_string())?;

    let payload = serde_json::json!({
        "operation": "loadAllPlayHistory",
        "SID": sid
    });

    let body_json = serde_json::to_string(&payload)
        .map_err(|e| format!("JSON構築エラー: {}", e))?;

    let client = reqwest::Client::builder().timeout(std::time::Duration::from_secs(12)).build().map_err(|e| e.to_string())?;
    let response = client
        .post("https://chordia.bellrin.f5.si/api/")
        .header("X-ACCESS-KEY", "ucbancmuvmczvlxgycbvuwfasdyowwap")
        .header("HTTP_X_ACCESS_KEY", "ucbancmuvmczvlxgycbvuwfasdyowwap")
        .header("Content-Type", "application/json")
        .body(body_json)
        .send()
        .await
        .map_err(|e| format!("通信エラー: {}", e))?;

    let res_text = response.text().await.map_err(|e| format!("レスポンス読み取りエラー: {}", e))?;
    let json_res: Value = serde_json::from_str(&res_text).map_err(|_| format!("不正なJSONレスポンス: {}", res_text))?;

    if let Some(err) = json_res.get("error").and_then(|v| v.as_str()) {
        return Err(err.to_string());
    }

    Ok(json_res.get("history").cloned().unwrap_or(serde_json::json!([])))
}

pub async fn send_single_work_history_to_cloud(
    client: &reqwest::Client,
    sid: &str,
    end: &str,
    time: &str,
) -> Result<(), String> {
    let payload = serde_json::json!({
        "operation": "addWorkHistory",
        "SID": sid,
        "end": end,
        "time": time
    });

    let body_json = serde_json::to_string(&payload)
        .map_err(|e| format!("JSON構築エラー: {}", e))?;

    let response = client
        .post("https://chordia.bellrin.f5.si/api/")
        .header("X-ACCESS-KEY", "ucbancmuvmczvlxgycbvuwfasdyowwap")
        .header("HTTP_X_ACCESS_KEY", "ucbancmuvmczvlxgycbvuwfasdyowwap")
        .header("Content-Type", "application/json")
        .body(body_json)
        .send()
        .await
        .map_err(|e| format!("通信エラー: {}", e))?;

    let res_text = response.text().await.map_err(|e| format!("レスポンス読み取りエラー: {}", e))?;
    println!("[Chordia Sync] addWorkHistory result: {}", res_text);

    let json_res: Value = serde_json::from_str(&res_text).map_err(|_| format!("不正なJSON: {}", res_text))?;

    if let Some(err) = json_res.get("error").and_then(|v| v.as_str()) {
        eprintln!("[Chordia Sync Error] addWorkHistory returned error: {}", err);
        return Err(err.to_string());
    }

    Ok(())
}

// 既存の作業履歴をクラウドへ一括同期（送信完了後にローカル履歴を完全消去）
#[tauri::command]
pub async fn sync_all_local_work_history_to_cloud(
    app: AppHandle,
    auth: State<'_, SharedAuthState>,
) -> Result<usize, String> {
    let sid = get_saved_cloud_sid(&auth).await.ok_or_else(|| "ログインしていません。".to_string())?;

    let w_path = get_base_dir().join("userfiles/work_history.json");
    if !w_path.exists() {
        return Ok(0);
    }

    let data = fs::read_to_string(&w_path).map_err(|e| e.to_string())?;
    let work_list: Vec<Value> = serde_json::from_str(&data).unwrap_or_default();

    let total = work_list.len();
    if total == 0 {
        let _ = safe_write_file(&w_path, b"[]");
        return Ok(0);
    }

    let client = reqwest::Client::builder().timeout(std::time::Duration::from_secs(10)).build().map_err(|e| e.to_string())?;
    let mut success_count = 0;

    for (idx, item) in work_list.iter().enumerate() {
        let seconds = item.get("seconds").and_then(|v| v.as_u64()).unwrap_or(0);
        let api_time = if seconds > 0 {
            let hours = seconds / 3600;
            let mins = (seconds % 3600) / 60;
            let secs = seconds % 60;
            format!("{:02}:{:02}:{:02}", hours, mins, secs)
        } else {
            item.get("time").and_then(|v| v.as_str()).unwrap_or("00:00:00").to_string()
        };

        let raw_end = item.get("end").and_then(|v| v.as_str()).unwrap_or("");
        let api_end = if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(raw_end, "%Y-%m-%d %H:%M:%S") {
            dt.format("%Y.%m.%d.%H.%M").to_string()
        } else if raw_end.contains('.') {
            raw_end.to_string()
        } else {
            Local::now().format("%Y.%m.%d.%H.%M").to_string()
        };

        let _ = send_single_work_history_to_cloud(&client, &sid, &api_end, &api_time).await;
        success_count += 1;

        let _ = app.emit("sync_work_history_progress", serde_json::json!({
            "current": idx + 1,
            "total": total
        }));

        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    }

    // ★ クラウド送信完了後、ローカルの作業履歴を完全に消去
    let _ = safe_write_file(&w_path, b"[]");

    Ok(success_count)
}

#[tauri::command]
pub async fn fetch_cloud_work_history(auth: State<'_, SharedAuthState>) -> Result<Value, String> {
    let sid = get_saved_cloud_sid(&auth).await.ok_or_else(|| "ログインしていません。".to_string())?;

    let payload = serde_json::json!({
        "operation": "loadAllWorkHistory",
        "SID": sid
    });

    let body_json = serde_json::to_string(&payload)
        .map_err(|e| format!("JSON構築エラー: {}", e))?;

    let client = reqwest::Client::builder().timeout(std::time::Duration::from_secs(12)).build().map_err(|e| e.to_string())?;
    let response = client
        .post("https://chordia.bellrin.f5.si/api/")
        .header("X-ACCESS-KEY", "ucbancmuvmczvlxgycbvuwfasdyowwap")
        .header("HTTP_X_ACCESS_KEY", "ucbancmuvmczvlxgycbvuwfasdyowwap")
        .header("Content-Type", "application/json")
        .body(body_json)
        .send()
        .await
        .map_err(|e| format!("通信エラー: {}", e))?;

    let res_text = response.text().await.map_err(|e| format!("レスポンス読み取りエラー: {}", e))?;
    let json_res: Value = serde_json::from_str(&res_text).map_err(|_| format!("不正なJSONレスポンス: {}", res_text))?;

    if let Some(err) = json_res.get("error").and_then(|v| v.as_str()) {
        return Err(err.to_string());
    }

    Ok(json_res.get("history").cloned().unwrap_or(serde_json::json!([])))
}
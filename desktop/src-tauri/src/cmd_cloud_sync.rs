use serde_json::Value;
use tauri::{AppHandle, Emitter, State};
use crate::server::SharedAuthState;
use rand::{rng, Rng};
use std::fs;
use std::collections::HashMap;
use crate::utils::{get_base_dir, safe_write_file};

// ★ 34文字（0とOを除く英大文字・数字）から暗号論的に安全な8文字の認証コードを生成
fn generate_34char_auth_code() -> String {
    const CHARSET: &[u8] = b"123456789ABCDEFGHIJKLMNPQRSTUVWXYZ";
    let mut r = rng();
    (0..8)
        .map(|_| {
            let idx = r.random_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect()
}

// ★ OSおよびモデル名の詳細・わかりやすい名称を取得
fn get_system_model_and_os() -> (String, String) {
    #[cfg(target_os = "macos")]
    {
        let ver_output = std::process::Command::new("sw_vers")
            .arg("-productVersion")
            .output()
            .ok()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
            .unwrap_or_default();

        let os_name = if !ver_output.is_empty() {
            let major: u32 = ver_output.split('.').next().and_then(|v| v.parse().ok()).unwrap_or(0);
            let code_name = match major {
                16 => "Tahoe",
                15 => "Sequoia",
                14 => "Sonoma",
                13 => "Ventura",
                12 => "Monterey",
                11 => "Big Sur",
                _ => "",
            };
            if code_name.is_empty() {
                format!("macOS {}", ver_output)
            } else {
                format!("macOS {} {}", code_name, ver_output)
            }
        } else {
            "macOS".to_string()
        };

        let mut model_name = String::new();

        if let Ok(output) = std::process::Command::new("system_profiler")
            .arg("SPHardwareDataType")
            .output()
        {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines() {
                let line_trimmed = line.trim();
                if line_trimmed.starts_with("Model Name:") {
                    let name = line_trimmed.trim_start_matches("Model Name:").trim();
                    if !name.is_empty() {
                        model_name = name.to_string();
                        break;
                    }
                }
            }
        }

        if model_name.is_empty() {
            let raw_id = std::process::Command::new("sysctl")
                .args(&["-n", "hw.model"])
                .output()
                .ok()
                .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
                .unwrap_or_default();

            if raw_id.starts_with("MacBookAir") {
                model_name = "MacBook Air".to_string();
            } else if raw_id.starts_with("MacBookPro") {
                model_name = "MacBook Pro".to_string();
            } else if raw_id.starts_with("MacBook") {
                model_name = "MacBook".to_string();
            } else if raw_id.starts_with("Macmini") {
                model_name = "Mac mini".to_string();
            } else if raw_id.starts_with("iMac") {
                model_name = "iMac".to_string();
            } else if raw_id.starts_with("MacStudio") {
                model_name = "Mac Studio".to_string();
            } else if raw_id.starts_with("MacPro") {
                model_name = "Mac Pro".to_string();
            } else if !raw_id.is_empty() {
                model_name = raw_id;
            } else {
                model_name = "Mac".to_string();
            }
        }

        (model_name, os_name)
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;

        let os_output = std::process::Command::new("powershell")
            .args(&["-NoProfile", "-Command", "(Get-CimInstance Win32_OperatingSystem).Caption"])
            .creation_flags(0x08000000)
            .output()
            .ok()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
            .unwrap_or_default();

        let os = if !os_output.is_empty() {
            os_output.replace("Microsoft ", "")
        } else {
            "Windows".to_string()
        };

        let model_output = std::process::Command::new("powershell")
            .args(&["-NoProfile", "-Command", "(Get-CimInstance Win32_ComputerSystem).Model"])
            .creation_flags(0x08000000)
            .output()
            .ok()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
            .unwrap_or_default();

        let model = if !model_output.is_empty() && model_output != "System Product Name" {
            model_output
        } else {
            "Windows PC".to_string()
        };

        (model, os)
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        ("Desktop PC".to_string(), "Linux/Unix".to_string())
    }
}

// ★ 楽曲再生履歴追記API (addPlayHistory) - 日付パラメータ (date) を追加
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
        "album": album
    });

    // 日付が指定されている場合はペイロードに付与
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
    let json_res: Value = serde_json::from_str(&res_text).map_err(|_| format!("不正なJSON: {}", res_text))?;

    if let Some(err) = json_res.get("error").and_then(|v| v.as_str()) {
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

// ★ 全既存履歴のクラウド送信 (history.json の timestamp を日付として送信)
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

    Ok(success_count)
}

#[tauri::command]
pub async fn register_auth_code_to_cloud(
    username: String, 
    device: String,
    auth: State<'_, SharedAuthState>
) -> Result<String, String> {
    if username.trim().is_empty() || device.trim().is_empty() {
        return Err("ユーザー名とログインデバイス名を入力してください。".to_string());
    }

    let code = generate_34char_auth_code();
    let (model, os) = get_system_model_and_os();
    let chordia_v = format!("Chordia Desktop {}", crate::APP_VERSION);

    let payload = serde_json::json!({
        "operation": "registerAuthenticationCode",
        "code": code,
        "username": username,
        "device": device,
        "model": model,
        "OS": os,
        "chordiaV": chordia_v
    });

    let body_json = serde_json::to_string(&payload)
        .map_err(|e| format!("JSONの構築に失敗しました: {}", e))?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(12))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .post("https://chordia.bellrin.f5.si/api/")
        .header("X-ACCESS-KEY", "ucbancmuvmczvlxgycbvuwfasdyowwap")
        .header("HTTP_X_ACCESS_KEY", "ucbancmuvmczvlxgycbvuwfasdyowwap")
        .header("Content-Type", "application/json")
        .body(body_json)
        .send()
        .await
        .map_err(|e| format!("サーバーとの通信に失敗しました: {}", e))?;

    let status = response.status();
    let res_text = response.text().await.map_err(|e| format!("レスポンスの読み取りに失敗しました: {}", e))?;

    let json_res: serde_json::Value = serde_json::from_str(&res_text)
        .map_err(|_| format!("サーバーから不正なレスポンスが返却されました (HTTP {}): {}", status, res_text))?;

    if let Some(err_msg) = json_res.get("error").and_then(|v| v.as_str()) {
        return Err(err_msg.to_string());
    }

    let sid = json_res.get("sid").and_then(|v| v.as_str()).unwrap_or("");
    if sid.is_empty() {
        return Err("サーバーから有効なSIDが取得できませんでした。".to_string());
    }

    {
        let mut state = auth.lock().await;
        state.pending_sid = Some(sid.to_string());
    }

    Ok(code)
}

#[tauri::command]
pub async fn check_cloud_login_status(
    username: String,
    device: String,
    auth: State<'_, SharedAuthState>
) -> Result<String, String> {
    let sid = {
        let state = auth.lock().await;
        match state.pending_sid.clone() {
            Some(s) if !s.is_empty() => s,
            _ => return Err("有効な保留中SIDが存在しません。".to_string()),
        }
    };

    let payload = serde_json::json!({
        "operation": "checkAlreadyLogin",
        "SID": sid,
        "name": username,
        "device": device
    });

    let body_json = serde_json::to_string(&payload)
        .map_err(|e| format!("JSONの構築に失敗しました: {}", e))?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .post("https://chordia.bellrin.f5.si/api/")
        .header("X-ACCESS-KEY", "ucbancmuvmczvlxgycbvuwfasdyowwap")
        .header("HTTP_X_ACCESS_KEY", "ucbancmuvmczvlxgycbvuwfasdyowwap")
        .header("Content-Type", "application/json")
        .body(body_json)
        .send()
        .await
        .map_err(|e| format!("ポーリング通信エラー: {}", e))?;

    let res_text = response.text().await.map_err(|e| format!("レスポンス読み取りエラー: {}", e))?;
    let json_res: serde_json::Value = serde_json::from_str(&res_text)
        .map_err(|_| format!("不正なJSONレスポンスです: {}", res_text))?;

    if let Some(err_msg) = json_res.get("error").and_then(|v| v.as_str()) {
        return Err(err_msg.to_string());
    }

    let status_val = json_res.get("status").and_then(|v| v.as_str()).unwrap_or("unauthenticated");

    match status_val {
        "authenticated" => {
            let save_data = serde_json::json!({
                "logged_in": true,
                "username": username,
                "device": device,
                "sid": sid
            });
            let auth_file_path = get_base_dir().join("userfiles/sync_auth.json");
            let _ = safe_write_file(&auth_file_path, serde_json::to_string_pretty(&save_data).unwrap_or_default().as_bytes());

            let mut state = auth.lock().await;
            state.cloud_sid = Some(sid);
            state.pending_sid = None;
            Ok("authenticated".to_string())
        }
        "expired" => {
            let mut state = auth.lock().await;
            state.pending_sid = None;
            Ok("expired".to_string())
        }
        _ => {
            Ok("unauthenticated".to_string())
        }
    }
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

#[tauri::command]
pub fn get_local_play_statistics() -> Value {
    let h_path = get_base_dir().join("userfiles/history.json");
    let mut history_list = Vec::new();
    if let Ok(data) = fs::read_to_string(&h_path) {
        if let Ok(mut h) = serde_json::from_str::<Vec<Value>>(&data) {
            h.reverse();
            history_list = h;
        }
    }

    let mut play_counts: HashMap<String, (String, String, usize)> = HashMap::new();
    for item in &history_list {
        let title = item.get("title").and_then(|v| v.as_str()).unwrap_or("Unknown").to_string();
        let artist = item.get("artist").and_then(|v| v.as_str()).unwrap_or("Unknown").to_string();
        let key = format!("{}___{}", title, artist);
        let entry = play_counts.entry(key).or_insert((title, artist, 0));
        entry.2 += 1;
    }

    let mut ranking: Vec<(String, String, usize)> = play_counts.into_values().collect();
    ranking.sort_by(|a, b| b.2.cmp(&a.2));
    let top5: Vec<Value> = ranking.into_iter().take(5).map(|(t, a, count)| {
        serde_json::json!({
            "title": t,
            "artist": a,
            "count": count
        })
    }).collect();

    serde_json::json!({
        "ranking": top5,
        "history": history_list
    })
}

async fn get_saved_cloud_sid(auth: &SharedAuthState) -> Option<String> {
    {
        let state = auth.lock().await;
        if let Some(ref s) = state.cloud_sid {
            if !s.is_empty() { return Some(s.clone()); }
        }
    }

    let auth_file_path = get_base_dir().join("userfiles/sync_auth.json");
    if auth_file_path.exists() {
        if let Ok(content) = fs::read_to_string(&auth_file_path) {
            if let Ok(json) = serde_json::from_str::<Value>(&content) {
                if let Some(sid) = json.get("sid").and_then(|v| v.as_str()) {
                    if !sid.is_empty() { return Some(sid.to_string()); }
                }
            }
        }
    }
    None
}

#[tauri::command]
pub fn get_cloud_auth_info() -> Value {
    let auth_file_path = get_base_dir().join("userfiles/sync_auth.json");
    if auth_file_path.exists() {
        if let Ok(content) = fs::read_to_string(&auth_file_path) {
            if let Ok(json) = serde_json::from_str::<Value>(&content) {
                if json.get("logged_in").and_then(|v| v.as_bool()).unwrap_or(false) {
                    return json;
                }
            }
        }
    }
    serde_json::json!({ "logged_in": false })
}

#[tauri::command]
pub async fn logout_cloud_auth(auth: State<'_, SharedAuthState>) -> Result<(), String> {
    let auth_file_path = get_base_dir().join("userfiles/sync_auth.json");
    
    let mut username = String::new();
    let mut device = String::new();
    let mut sid = String::new();

    if auth_file_path.exists() {
        if let Ok(content) = fs::read_to_string(&auth_file_path) {
            if let Ok(json) = serde_json::from_str::<Value>(&content) {
                username = json.get("username").and_then(|v| v.as_str()).unwrap_or("").to_string();
                device = json.get("device").and_then(|v| v.as_str()).unwrap_or("").to_string();
                sid = json.get("sid").and_then(|v| v.as_str()).unwrap_or("").to_string();
            }
        }
    }

    if sid.is_empty() {
        let state = auth.lock().await;
        if let Some(ref s) = state.cloud_sid {
            sid = s.clone();
        }
    }

    if !sid.is_empty() {
        let payload = serde_json::json!({
            "operation": "logout",
            "SID": sid,
            "name": username,
            "device": device
        });

        let body_json = serde_json::to_string(&payload)
            .map_err(|e| format!("JSONの構築に失敗しました: {}", e))?;

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .map_err(|e| e.to_string())?;

        let response = client
            .post("https://chordia.bellrin.f5.si/api/")
            .header("X-ACCESS-KEY", "ucbancmuvmczvlxgycbvuwfasdyowwap")
            .header("HTTP_X_ACCESS_KEY", "ucbancmuvmczvlxgycbvuwfasdyowwap")
            .header("Content-Type", "application/json")
            .body(body_json)
            .send()
            .await
            .map_err(|e| format!("ログアウトAPI通信エラー: {}", e))?;

        let res_text = response.text().await.map_err(|e| format!("レスポンス読み取りエラー: {}", e))?;
        let json_res: serde_json::Value = serde_json::from_str(&res_text)
            .map_err(|_| format!("不正なJSONレスポンスです: {}", res_text))?;

        if let Some(err_msg) = json_res.get("error").and_then(|v| v.as_str()) {
            return Err(err_msg.to_string());
        }
    }

    if auth_file_path.exists() {
        let _ = fs::remove_file(auth_file_path);
    }
    let mut state = auth.lock().await;
    state.cloud_sid = None;
    state.pending_sid = None;

    Ok(())
}
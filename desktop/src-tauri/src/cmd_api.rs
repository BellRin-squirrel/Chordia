use serde_json::Value;
use tauri::State;
use crate::server::SharedAuthState;
use std::net::UdpSocket;
use rand::{rng, Rng};
use tauri::Emitter;
use tokio::process::Command;
use tokio::io::{AsyncBufReadExt, BufReader};
use std::path::PathBuf;
use std::fs;
use crate::utils::{get_base_dir, safe_write_file};

fn get_cloudflared_path() -> String {
    let exe_name = if cfg!(target_os = "windows") { "cloudflared.exe" } else { "cloudflared" };
    
    let userfiles_bin = get_base_dir().join("userfiles/bin").join(exe_name);
    if userfiles_bin.exists() {
        if let Some(path_str) = userfiles_bin.to_str() {
            return path_str.to_string();
        }
    }

    let base_bin = get_base_dir().join(exe_name);
    if base_bin.exists() {
        if let Some(path_str) = base_bin.to_str() {
            return path_str.to_string();
        }
    }

    if PathBuf::from(exe_name).exists() {
        return format!("./{}", exe_name);
    }

    exe_name.to_string()
}

pub async fn kill_child_process(mut child: tokio::process::Child) {
    if let Some(pid) = child.id() {
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            let mut kill_cmd = std::process::Command::new("taskkill");
            kill_cmd.args(&["/F", "/T", "/PID", &pid.to_string()]);
            kill_cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
            let _ = kill_cmd.output();
        }
        #[cfg(not(target_os = "windows"))]
        {
            let _ = std::process::Command::new("kill")
                .args(&["-9", &pid.to_string()])
                .output();
        }
    }
    let _ = child.kill().await;
}

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

// ★ OSおよびモデル名の詳細取得
fn get_system_model_and_os() -> (String, String) {
    #[cfg(target_os = "macos")]
    {
        // OSバージョン取得 (例: 15.7.7)
        let ver_output = std::process::Command::new("sw_vers")
            .arg("-productVersion")
            .output()
            .ok()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
            .unwrap_or_default();

        let os_name = if !ver_output.is_empty() {
            let major: u32 = ver_output.split('.').next().and_then(|v| v.parse().ok()).unwrap_or(0);
            let code_name = match major {
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

        // モデル名取得 (例: MacBookAir10,1, Mac14,2 等)
        let model_output = std::process::Command::new("sysctl")
            .args(&["-n", "hw.model"])
            .output()
            .ok()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
            .unwrap_or_default();

        let model = if !model_output.is_empty() {
            model_output
        } else {
            if cfg!(target_arch = "aarch64") {
                "Mac (Apple Silicon)".to_string()
            } else {
                "Mac (Intel)".to_string()
            }
        };

        (model, os_name)
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;

        // Windows OS 詳細取得
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

        // Windows モデル名取得
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

// ★ Chordia Sync クラウドAPIに認証コードを登録するコマンド
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

// ★ 認証コード認証済み確認ポーリングAPI
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
            // 認証完了: ローカルファイルに保存して永続化
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

// ★ 現在のChordia Sync認証状態を取得
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

// ★ Chordia Syncからログアウト（ログアウトAPI連携）
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

    // サーバーにログアウトAPIを送信
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

    // ローカルファイル・ステートをクリア
    if auth_file_path.exists() {
        let _ = fs::remove_file(auth_file_path);
    }
    let mut state = auth.lock().await;
    state.cloud_sid = None;
    state.pending_sid = None;

    Ok(())
}

#[tauri::command]
pub async fn start_sync_server(auth: State<'_, SharedAuthState>, app_handle: tauri::AppHandle) -> Result<Value, String> {
    let mut state = auth.lock().await;
    
    if let Some(tx) = state.shutdown_tx.take() {
        let _ = tx.send(());
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    }

    let listener = tokio::net::TcpListener::bind("0.0.0.0:0").await.map_err(|e| e.to_string())?;
    let port = listener.local_addr().unwrap().port();
    
    state.port = port;
    state.window_open = true;

    let new_code: String = (0..6).map(|_| rng().random_range(b'0'..=b'9') as char).collect();
    state.current_code = Some(new_code.clone());
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs_f64();
    state.code_expires_at = now + 30.0;
    let _ = app_handle.emit("update_auth_code", new_code.clone());

    let (tx, rx) = tokio::sync::oneshot::channel();
    state.shutdown_tx = Some(tx);

    let auth_clone = auth.inner().clone();
    let app_clone = app_handle.clone();
    
    tauri::async_runtime::spawn(async move {
        crate::server::start_server(app_clone, auth_clone, listener, rx).await;
    });

    let mut ip = "127.0.0.1".to_string();
    if let Ok(socket) = UdpSocket::bind("0.0.0.0:0") {
        if socket.connect("8.8.8.8:80").is_ok() {
            if let Ok(addr) = socket.local_addr() { ip = addr.ip().to_string(); }
        }
    }

    Ok(serde_json::json!({"ip": ip, "port": port}))
}

#[tauri::command]
pub async fn stop_sync_server(auth: State<'_, SharedAuthState>) -> Result<(), String> {
    let mut state = auth.lock().await;
    state.window_open = false;
    state.pending_requests.clear(); 
    if let Some(child) = state.tunnel_process.take() {
        kill_child_process(child).await;
    }
    if let Some(tx) = state.shutdown_tx.take() {
        let _ = tx.send(());
    }
    state.wan_url = None;
    Ok(())
}

#[tauri::command]
pub async fn respond_to_request(request_id: String, approve: bool, auth: State<'_, SharedAuthState>) -> Result<(), String> {
    let mut state = auth.lock().await;
    if let Some(req) = state.pending_requests.get_mut(&request_id) {
        req.status = if approve { "approved".to_string() } else { "rejected".to_string() };
    }
    Ok(())
}

#[tauri::command]
pub async fn get_active_sessions(auth: State<'_, SharedAuthState>) -> Result<Vec<Value>, String> {
    let mut state = auth.lock().await;
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs_f64();
    state.sessions.retain(|_, s| now - s.last_access <= 300.0);
    
    let mut active = Vec::new();
    for (_, s) in state.sessions.iter() {
        let remaining = (300.0 - (now - s.last_access)) as i64;
        active.push(serde_json::json!({"device": s.device.clone(), "ip": s.ip.clone(), "remaining": remaining}));
    }
    Ok(active)
}

#[tauri::command]
pub async fn force_disconnect_session(ip: String, device: String, auth: State<'_, SharedAuthState>) -> Result<(), String> {
    let mut state = auth.lock().await;
    state.sessions.retain(|_, s| !(s.ip == ip && s.device == device));
    Ok(())
}

#[tauri::command]
pub async fn toggle_wan_mode(enable: bool, port: u16, auth: State<'_, SharedAuthState>) -> Result<String, String> {
    let mut state = auth.lock().await;

    if enable {
        if state.tunnel_process.is_some() {
            return Ok(state.wan_url.clone().unwrap_or_default());
        }

        let binary_path = get_cloudflared_path();

        let mut std_cmd = std::process::Command::new(&binary_path);
        std_cmd.args(&[
            "tunnel",
            "--no-autoupdate",
            "--http-host-header",
            "localhost",
            "--url",
            &format!("http://127.0.0.1:{}", port),
        ])
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::piped());

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            std_cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }

        let mut cmd = Command::from(std_cmd);
        cmd.kill_on_drop(true);

        let mut child = cmd.spawn()
            .map_err(|_| format!("ERR_CLOUDFLARED_START:{}", binary_path))?;

        let stderr = child.stderr.take().ok_or("ERR_STDERR_PIPE")?;

        let (tx, rx) = tokio::sync::oneshot::channel::<String>();

        tokio::spawn(async move {
            let mut reader = BufReader::new(stderr);
            let mut line = String::new();
            let mut tx_option = Some(tx);

            while reader.read_line(&mut line).await.unwrap_or(0) > 0 {
                if let Some(_) = tx_option.as_ref() {
                    if line.contains("trycloudflare.com") {
                        if let Some(url_part) = line.split("https://").nth(1) {
                            let url = url_part.split_whitespace().next().unwrap_or("").trim_matches(&['\r', '\n', '\t', ' ', '|', '\''][..]);
                            if !url.is_empty() {
                                let wan_url = format!("https://{}", url);
                                if let Some(sender) = tx_option.take() {
                                    let _ = sender.send(wan_url);
                                }
                            }
                        }
                    }
                }
                line.clear();
            }
        });

        match tokio::time::timeout(std::time::Duration::from_secs(20), rx).await {
            Ok(Ok(wan_url)) => {
                state.tunnel_process = Some(child);
                state.wan_url = Some(wan_url.clone());
                Ok(wan_url)
            }
            _ => {
                kill_child_process(child).await;
                Err("ERR_CLOUDFLARED_TIMEOUT".to_string())
            }
        }
    } else {
        if let Some(child) = state.tunnel_process.take() {
            kill_child_process(child).await;
        }
        state.wan_url = None;
        Ok("".to_string())
    }
}
use serde_json::Value;
use tauri::State;
use crate::server::SharedAuthState;
use std::net::UdpSocket;
use rand::{rng, Rng};
use tauri::Emitter;
use tokio::process::Command;
use tokio::io::{AsyncBufReadExt, BufReader};
use std::path::PathBuf;
use crate::utils::get_base_dir;

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
    if let Some(mut child) = state.tunnel_process.take() {
        let _ = child.kill().await;
    }
    if let Some(tx) = state.shutdown_tx.take() {
        let _ = tx.send(());
    }
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

        let mut child = Command::new(&binary_path)
            .args(&[
                "tunnel",
                "--no-autoupdate",
                "--http-host-header",
                "localhost",
                "--url",
                &format!("http://127.0.0.1:{}", port),
            ])
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::piped())
            .spawn()
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
                let _ = child.kill().await;
                Err("ERR_CLOUDFLARED_TIMEOUT".to_string())
            }
        }
    } else {
        if let Some(mut child) = state.tunnel_process.take() {
            let _ = child.kill().await;
        }
        state.wan_url = None;
        Ok("".to_string())
    }
}
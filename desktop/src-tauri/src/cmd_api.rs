use serde_json::Value;
use tauri::State;
use crate::server::SharedAuthState;
use std::net::UdpSocket;
use rand::{rng, Rng};
use tauri::Emitter;

#[tauri::command]
pub async fn start_sync_server(auth: State<'_, SharedAuthState>, app_handle: tauri::AppHandle) -> Result<Value, String> {
    let mut state = auth.lock().await;
    
    // ★ 修正: すでに起動中の場合は古いサーバーを一度シャットダウンし、必ずポートを新しく解放して開き直す
    if let Some(tx) = state.shutdown_tx.take() {
        let _ = tx.send(());
        // ソケットの解放を確実にするため、ミリ秒単位で微小スリープを挟む
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    }

    // サーバーを新規起動してランダムなポートをバインド
    let listener = tokio::net::TcpListener::bind("0.0.0.0:0").await.map_err(|e| e.to_string())?;
    let port = listener.local_addr().unwrap().port();
    
    state.port = port;
    state.window_open = true;

    // 初回の認証コードを発行
    let new_code: String = (0..6).map(|_| rng().random_range(b'0'..=b'9') as char).collect();
    state.current_code = Some(new_code.clone());
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs_f64();
    state.code_expires_at = now + 30.0;
    let _ = app_handle.emit("update_auth_code", new_code.clone());

    let (tx, rx) = tokio::sync::oneshot::channel();
    state.shutdown_tx = Some(tx);

    let auth_clone = auth.inner().clone();
    let app_clone = app_handle.clone();
    
    // バックグラウンドでサーバーを起動
    tauri::async_runtime::spawn(async move {
        crate::server::start_server(app_clone, auth_clone, listener, rx).await;
    });

    // IPアドレスの取得
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
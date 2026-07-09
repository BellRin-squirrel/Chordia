use axum::{
    extract::State as AxumState,
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{Mutex, oneshot};
use tauri::{AppHandle, Emitter};
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::ServeDir;

use crate::utils::{get_base_dir, load_db, load_playlists_master, evaluate_smart_rules};

// ==========================================
// 認証状態の管理
// ==========================================
#[derive(Clone, Serialize, Deserialize)]
pub struct PendingRequest {
    pub id: String,
    pub ip: String,
    pub device: String,
    pub os: String,
    pub status: String,
    pub timestamp: f64,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct Session {
    pub ip: String,
    pub device: String,
    pub os: String,
    pub last_access: f64,
}

pub struct AuthState {
    pub window_open: bool,
    pub current_code: Option<String>,
    pub code_expires_at: f64,
    pub pending_requests: HashMap<String, PendingRequest>,
    pub sessions: HashMap<String, Session>,
    pub port: u16,
    pub shutdown_tx: Option<oneshot::Sender<()>>,
}

impl AuthState {
    pub fn new() -> Self {
        Self {
            window_open: false,
            current_code: None,
            code_expires_at: 0.0,
            pending_requests: HashMap::new(),
            sessions: HashMap::new(),
            port: 0,
            shutdown_tx: None,
        }
    }
}

pub type SharedAuthState = Arc<Mutex<AuthState>>;

#[derive(Clone)]
pub struct ServerState {
    pub auth: SharedAuthState,
    pub app_handle: AppHandle,
}

// ==========================================
// 認証ミドルウェア
// ==========================================
async fn verify_request(headers: &HeaderMap, auth: &SharedAuthState) -> bool {
    let api_key = headers.get("X-API-KEY").and_then(|v| v.to_str().ok());
    let ip = headers.get("X-DEVICE-IP").and_then(|v| v.to_str().ok());
    let device = headers.get("X-DEVICE-NAME").and_then(|v| v.to_str().ok());
    let os_ver = headers.get("X-DEVICE-OS").and_then(|v| v.to_str().ok());

    if let (Some(api_key), Some(ip), Some(device), Some(os_ver)) = (api_key, ip, device, os_ver) {
        let mut state = auth.lock().await;
        let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs_f64();
        
        // 修正：最終アクセス判定を 300.0秒（5分）に変更
        state.sessions.retain(|_, s| now - s.last_access <= 300.0);
        
        if let Some(session) = state.sessions.get_mut(api_key) {
            if session.ip == ip && session.device == device && session.os == os_ver {
                session.last_access = now;
                return true;
            }
        }
    }
    false
}

// ==========================================
// API エンドポイント
// ==========================================

async fn auth_request(AxumState(state): AxumState<ServerState>, Json(payload): Json<Value>) -> impl IntoResponse {
    let mut auth = state.auth.lock().await;
    if !auth.window_open {
        return (StatusCode::SERVICE_UNAVAILABLE, Json(json!({"status": "error", "message": "Server not accepting requests"})));
    }
    
    let ip = payload.get("ip").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let device = payload.get("device").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let os = payload.get("os").and_then(|v| v.as_str()).unwrap_or("").to_string();
    
    // スパム対策: 同一IPからの古いリクエストは削除する
    auth.pending_requests.retain(|_, r| r.ip != ip);

    use rand::distr::Alphanumeric;
    use rand::Rng;
    let req_id: String = rand::rng().sample_iter(&Alphanumeric).take(16).map(char::from).collect();
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs_f64();

    let req = PendingRequest {
        id: req_id.clone(),
        ip,
        device,
        os,
        status: "waiting".to_string(),
        timestamp: now,
    };
    
    auth.pending_requests.insert(req_id.clone(), req.clone());
    let _ = state.app_handle.emit("notify_auth_request", req);
    
    (StatusCode::OK, Json(json!({"status": "pending", "request_id": req_id})))
}

async fn auth_cancel(AxumState(state): AxumState<ServerState>) -> impl IntoResponse {
    state.auth.lock().await.pending_requests.clear();
    let _ = state.app_handle.emit("reset_pc_ui", ());
    Json(json!({"status": "reset"}))
}

async fn auth_verify_session(AxumState(state): AxumState<ServerState>, headers: HeaderMap) -> impl IntoResponse {
    if verify_request(&headers, &state.auth).await {
        (StatusCode::OK, Json(json!({"status": "valid"})))
    } else {
        (StatusCode::FORBIDDEN, Json(json!({"status": "invalid"})))
    }
}

async fn auth_verify(AxumState(state): AxumState<ServerState>, Json(payload): Json<Value>) -> impl IntoResponse {
    let code = payload.get("code").and_then(|v| v.as_str()).unwrap_or("");
    let ip = payload.get("ip").and_then(|v| v.as_str()).unwrap_or("");
    let device = payload.get("device").and_then(|v| v.as_str()).unwrap_or("");
    let os = payload.get("os").and_then(|v| v.as_str()).unwrap_or("");

    let mut auth = state.auth.lock().await;
    if auth.current_code.as_deref() == Some(code) {
        auth.pending_requests.clear(); // 認証成功時に保留全体をクリア
        auth.sessions.retain(|_, s| !(s.ip == ip && s.device == device));
        
        use rand::distr::Alphanumeric;
        use rand::Rng;
        let api_key: String = rand::rng().sample_iter(&Alphanumeric).take(64).map(char::from).collect();
        
        let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs_f64();
        auth.sessions.insert(api_key.clone(), Session { ip: ip.to_string(), device: device.to_string(), os: os.to_string(), last_access: now });
        
        let _ = state.app_handle.emit("notify_auth_success", json!({"device": device, "ip": ip}));
        return (StatusCode::OK, Json(json!({"status": "success", "api_key": api_key})));
    }
    (StatusCode::FORBIDDEN, Json(json!({"status": "error", "message": "Invalid code"})))
}

async fn auth_logout(AxumState(state): AxumState<ServerState>, headers: HeaderMap) -> impl IntoResponse {
    if let Some(api_key) = headers.get("X-API-KEY").and_then(|v| v.to_str().ok()) {
        state.auth.lock().await.sessions.remove(api_key);
    }
    Json(json!({"status": "logged_out"}))
}

async fn api_library(AxumState(state): AxumState<ServerState>, headers: HeaderMap) -> impl IntoResponse {
    if !verify_request(&headers, &state.auth).await { return (StatusCode::FORBIDDEN, Json(json!({"error": "Unauthorized"}))); }
    let db = load_db();
    let mut response_data = Vec::new();
    for mut item in db {
        let m_name = item.get("musicFilename").and_then(|v| v.as_str()).unwrap_or("").split(&['/', '\\'][..]).last().unwrap_or("").to_string();
        let i_name = item.get("imageFilename").and_then(|v| v.as_str()).unwrap_or("").split(&['/', '\\'][..]).last().unwrap_or("").to_string();
        item.insert("url_music".into(), Value::String(if m_name.is_empty() { "".into() } else { format!("/mobile_music/{}", m_name) }));
        item.insert("url_image".into(), Value::String(if i_name.is_empty() { "".into() } else { format!("/mobile_image/{}", i_name) }));
        item.remove("imageData");
        item.remove("streamUrl");
        response_data.push(item);
    }
    (StatusCode::OK, Json(json!({"library": response_data})))
}

async fn api_playlists(AxumState(state): AxumState<ServerState>, headers: HeaderMap) -> impl IntoResponse {
    if !verify_request(&headers, &state.auth).await { return (StatusCode::FORBIDDEN, Json(json!({"error": "Unauthorized"}))); }
    let master = load_playlists_master();
    let db = load_db();
    let mut playlists_list = Vec::new();
    for mut pl in master {
        let is_smart = pl.get("type").and_then(|v| v.as_str()) == Some("smart");
        let mut music = Vec::new();
        if is_smart {
            if let Some(conds) = pl.get("conditions") {
                for song in db.iter() {
                    if evaluate_smart_rules(song, conds) {
                        if let Some(fname) = song.get("musicFilename").and_then(|v| v.as_str()) {
                            music.push(Value::String(std::path::Path::new(fname).file_name().unwrap_or_default().to_str().unwrap_or("").to_string()));
                        }
                    }
                }
            }
        } else {
            let id = pl.get("id").and_then(|v| v.as_str()).unwrap_or("");
            let path = get_base_dir().join(format!("userfiles/playlist/{}.json", id));
            if path.exists() {
                if let Ok(data) = std::fs::read_to_string(&path) {
                    if let Ok(list) = serde_json::from_str::<Vec<Value>>(&data) { music = list; }
                }
            }
        }
        if let Some(obj) = pl.as_object_mut() { obj.insert("music".into(), Value::Array(music)); }
        playlists_list.push(pl);
    }
    (StatusCode::OK, Json(json!({"playlists": playlists_list})))
}

async fn auth_check(AxumState(state): AxumState<ServerState>, Json(payload): Json<Value>) -> impl IntoResponse {
    let mut auth = state.auth.lock().await;
    let req_ip = payload.get("ip").and_then(|v| v.as_str()).unwrap_or("");
    
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs_f64();
    // タイムアウトのクリーンアップ（10分以上経過したリクエストは破棄）
    auth.pending_requests.retain(|_, r| now - r.timestamp < 600.0);

    if let Some((_, req)) = auth.pending_requests.iter().find(|(_, r)| r.ip == req_ip) {
        let mut res = json!({"status": req.status});
        if req.status == "approved" {
            res.as_object_mut().unwrap().insert("code".into(), Value::String(auth.current_code.clone().unwrap_or_default()));
        }
        return Json(res);
    }
    Json(json!({"status": "expired"}))
}

pub async fn start_server(
    app_handle: AppHandle, 
    auth: SharedAuthState, 
    listener: tokio::net::TcpListener, 
    shutdown_rx: oneshot::Receiver<()>
) {
    let base = get_base_dir();
    let music_dir = base.join("library/music");
    let image_dir = base.join("library/images");

    let state = ServerState { auth: auth.clone(), app_handle };
    let cors = CorsLayer::new().allow_origin(Any).allow_methods(Any).allow_headers(Any);
    let app = Router::new()
        .route("/api/auth/request", post(auth_request))
        .route("/api/auth/cancel", post(auth_cancel))
        .route("/api/auth/verify_session", get(auth_verify_session))
        .route("/api/auth/verify", post(auth_verify))
        .route("/api/auth/logout", post(auth_logout))
        .route("/api/auth/check", post(auth_check))
        .route("/api/library", get(api_library))
        .route("/api/playlists", get(api_playlists))
        .nest_service("/mobile_music", ServeDir::new(music_dir))
        .nest_service("/mobile_image", ServeDir::new(image_dir))
        .layer(cors)
        .with_state(state);

    println!("[Server] API Server starting...");
    axum::serve(listener, app).with_graceful_shutdown(async move {
        shutdown_rx.await.ok();
        println!("[Server] API Server shutdown completely.");
    }).await.unwrap();
}
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

#[tauri::command]
pub async fn open_new_window(app: AppHandle, label: String, url: String, title: String, width: f64, height: f64) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&label) { 
        let _ = window.set_focus(); 
        return Ok(()); 
    }
    
    // ★ 修正：フロントから渡された絶対URLを安全にパースして External で開く。
    // これにより、dev モード (localhost:1420等) でも prod モードでも確実に接続できる。
    let webview_url = match url.parse() {
        Ok(parsed) => WebviewUrl::External(parsed),
        Err(_) => WebviewUrl::App(url.clone().into()),
    };

    let mut builder = WebviewWindowBuilder::new(&app, label.clone(), webview_url)
        .title(title)
        .inner_size(width, height)
        .resizable(true);

    if label == "mini_player_window" {
        builder = builder.decorations(false).transparent(true);
    }

    builder.build().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn set_mini_player_mode(app: tauri::AppHandle, mode: String) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("mini_player_window") {
        let scale_factor = window.scale_factor().unwrap_or(1.0);
        
        let current_width = if let Ok(size) = window.outer_size() {
            let logical_size = size.to_logical::<f64>(scale_factor);
            if logical_size.width > 50.0 {
                logical_size.width
            } else {
                256.0
            }
        } else {
            256.0
        };

        match mode.as_str() {
            "large" => { let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize { width: current_width, height: 750.0 })); }
            "medium" => { let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize { width: current_width, height: 550.0 })); }
            "small" => { let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize { width: current_width, height: current_width })); } 
            _ => {}
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn close_mini_player(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("mini_player_window") { let _ = window.close(); }
    Ok(())
}

#[tauri::command]
pub async fn minimize_mini_player(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("mini_player_window") {
        let _ = window.minimize();
    }
    Ok(())
}

#[tauri::command]
pub async fn make_window_square(app: tauri::AppHandle, width_is_master: bool) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("mini_player_window") {
        if let Ok(size) = window.outer_size() {
            let diff = (size.width as i32 - size.height as i32).abs();
            if diff > 2 {
                let target_dimension = if width_is_master { size.width } else { size.height };
                let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize { 
                    width: target_dimension, 
                    height: target_dimension 
                }));
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub fn show_in_explorer(path: String) -> Result<(), String> {
    let abs_path = crate::utils::get_base_dir().join(&path);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let path_str = abs_path.to_str().unwrap_or("");
        
        std::process::Command::new("explorer")
            .raw_arg(format!("/select,\"{}\"", path_str))
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
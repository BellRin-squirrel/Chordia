use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

#[tauri::command]
pub async fn open_new_window(app: AppHandle, label: String, url: String, title: String, width: f64, height: f64) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&label) { 
        let _ = window.set_focus(); 
        return Ok(()); 
    }
    
    let mut builder = WebviewWindowBuilder::new(&app, label.clone(), WebviewUrl::App(url.into()))
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
        match mode.as_str() {
            "large" => { let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize { width: 450.0, height: 750.0 })); }
            "medium" => { let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize { width: 320.0, height: 550.0 })); }
            "small" => { let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize { width: 250.0, height: 250.0 })); }
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
pub async fn make_window_square(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("mini_player_window") {
        if let Ok(size) = window.outer_size() {
            let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize { width: size.width, height: size.width }));
        }
    }
    Ok(())
}

// ★ 修正: エクスプローラーで表示 (カンマの後にスペースを入れずにパスを結合)
#[tauri::command]
pub fn show_in_explorer(path: String) -> Result<(), String> {
    let abs_path = crate::utils::get_base_dir().join(&path);
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(format!("/select,{}", abs_path.to_str().unwrap_or("")))
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
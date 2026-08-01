use serde_json::Value;
use tauri::State;

use crate::AppState;
use crate::utils::{evaluate_smart_rules, match_search, get_asset_url};

#[tauri::command]
pub fn get_library_count(
    search_query: String,
    advanced_conditions: Option<Value>, 
    state: State<'_, AppState>
) -> usize {
    let db = state.db.lock().unwrap();
    db.iter().filter(|i| {
        let match_search_query = if search_query.is_empty() { true } else { match_search(i, &search_query) };
        let match_advanced = if let Some(ref conds) = advanced_conditions {
            evaluate_smart_rules(i, conds)
        } else {
            true
        };
        match_search_query && match_advanced
    }).count()
}

#[tauri::command]
pub fn get_library_chunk(
    page: usize,
    limit: usize,
    sort_field: Option<String>,
    sort_desc: bool,
    search_query: String,
    advanced_conditions: Option<Value>, 
    state: State<'_, AppState>
) -> Vec<serde_json::Map<String, Value>> {
    let mut db = state.db.lock().unwrap().clone();
    
    db.retain(|i| {
        let match_search_query = if search_query.is_empty() { true } else { match_search(i, &search_query) };
        let match_advanced = if let Some(ref conds) = advanced_conditions {
            evaluate_smart_rules(i, conds)
        } else {
            true
        };
        match_search_query && match_advanced
    });

    if let Some(f) = sort_field {
        db.sort_by(|a, b| {
            let (va, vb) = (a.get(&f).and_then(|v| v.as_str()).unwrap_or("").to_lowercase(), b.get(&f).and_then(|v| v.as_str()).unwrap_or("").to_lowercase());
            let res = if ["track", "disc", "year", "bpm"].contains(&f.as_str()) {
                va.parse::<i32>().unwrap_or(0).cmp(&vb.parse::<i32>().unwrap_or(0))
            } else { va.cmp(&vb) };
            if sort_desc { res.reverse() } else { res }
        });
    }
    if limit > 0 { let start = (page.saturating_sub(1)) * limit; db.into_iter().skip(start).take(limit).collect() } else { db }
}

#[tauri::command]
pub fn get_common_values_for_selected(filenames: Vec<String>, state: State<'_, AppState>) -> serde_json::Map<String, Value> {
    let db = state.db.lock().unwrap();
    let sel: Vec<_> = db.iter().filter(|i| filenames.contains(&i.get("musicFilename").and_then(|v| v.as_str()).unwrap_or("").split(&['/', '\\'][..]).last().unwrap_or("").into())).collect();
    let mut res = serde_json::Map::new();
    if sel.is_empty() { return res; }
    for k in ["title", "artist", "album", "genre", "year", "track", "disc", "bpm", "composer", "comment", "lyric"] {
        let first = sel[0].get(k).and_then(|v| v.as_str()).unwrap_or("");
        res.insert(k.into(), if sel.iter().all(|i| i.get(k).and_then(|v| v.as_str()).unwrap_or("") == first) { first.into() } else { "< 維持 >".into() });
    }

    let first_img = sel[0].get("imageFilename").and_then(|v| v.as_str()).unwrap_or("");
    let common_img = if sel.iter().all(|i| i.get("imageFilename").and_then(|v| v.as_str()).unwrap_or("") == first_img) {
        first_img
    } else {
        "< 維持 >"
    };
    res.insert("imageFilename".into(), common_img.into());

    let first_data = sel[0].get("imageData").and_then(|v| v.as_str()).unwrap_or("");
    let common_data = if sel.iter().all(|i| i.get("imageData").and_then(|v| v.as_str()).unwrap_or("") == first_data) {
        first_data
    } else {
        "< 維持 >"
    };
    res.insert("imageData".into(), common_data.into());
    
    res
}
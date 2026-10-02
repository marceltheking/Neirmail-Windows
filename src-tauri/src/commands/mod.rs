pub mod account;
pub mod attachments;
pub mod auth;
pub mod cache;
pub mod compose;
pub mod notifications;
pub mod realtime;
pub mod sender_icons;

use crate::error::ApiError;
use crate::http::proxy;
use crate::state::AppState;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::atomic::Ordering;
use tauri::State;

#[tauri::command]
pub async fn api_request(
    state: State<'_, AppState>,
    method: String,
    path: String,
    body: Option<Value>,
    query: Option<HashMap<String, String>>,
) -> Result<Value, ApiError> {
    proxy::request(&state, &method, &path, body, query).await
}

#[tauri::command]
pub fn set_close_to_tray(state: State<'_, AppState>, enabled: bool) {
    state.close_to_tray.store(enabled, Ordering::Relaxed);
}

#[tauri::command]
pub fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
pub fn defer_quit(state: State<'_, AppState>) {
    state.quit_deferred.store(true, Ordering::Relaxed);
}

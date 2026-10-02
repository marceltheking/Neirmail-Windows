use crate::error::ApiError;
use crate::state::AppState;
use crate::ws::hub;
use crate::ws::hub::WsHandle;
use tauri::{AppHandle, State};

#[tauri::command(async)]
pub fn start_ws(
    app: AppHandle,
    ws_handle: State<'_, WsHandle>,
    state: State<'_, AppState>,
) -> Result<(), ApiError> {
    hub::start(app, &ws_handle, &state)
}

#[tauri::command(async)]
pub fn stop_ws(ws_handle: State<'_, WsHandle>) -> Result<(), ApiError> {
    hub::stop(&ws_handle)
}

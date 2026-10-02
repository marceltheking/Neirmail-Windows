use crate::error::ApiError;
use crate::http::download::{
    reject_oversized_response, reserve_unique_file, stream_response_to_file,
};
use crate::state::AppState;
use std::time::Duration;
use tauri::{AppHandle, Manager, State};

const MAX_EXPORT_BYTES: u64 = 6 * 1024 * 1024 * 1024;
const EXPORT_TIMEOUT: Duration = Duration::from_secs(30 * 60);

#[tauri::command]
pub async fn download_account_export(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<String, ApiError> {
    let response = state
        .http
        .get(format!("{}/webmail/export", state.base_url))
        .timeout(EXPORT_TIMEOUT)
        .send()
        .await
        .map_err(|error| ApiError::transport(error.to_string()))?;

    if !response.status().is_success() {
        return Err(ApiError {
            status: response.status().as_u16(),
            code: None,
            message: "The encrypted export could not be downloaded.".to_string(),
        });
    }
    reject_oversized_response(
        &response,
        MAX_EXPORT_BYTES,
        "The encrypted export exceeds the supported size.",
    )?;

    let download_dir = app
        .path()
        .download_dir()
        .map_err(|error| ApiError::transport(error.to_string()))?;
    let reserved = reserve_unique_file(&download_dir, "neir-export.neir.enc").await?;
    let target = stream_response_to_file(
        response,
        reserved,
        MAX_EXPORT_BYTES,
        "The encrypted export exceeds the supported size.",
    )
    .await?;

    Ok(target.to_string_lossy().to_string())
}

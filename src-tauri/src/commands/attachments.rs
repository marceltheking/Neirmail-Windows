use crate::error::ApiError;
use crate::http::download::{
    read_response_limited, reject_oversized_response, reserve_unique_file, stream_response_to_file,
    write_bytes_to_file,
};
use crate::http::image::{response_to_data_uri, ImageLimits};
use crate::state::AppState;
use rand::RngCore;
use std::path::PathBuf;
use std::time::Duration;
use tauri::{AppHandle, Manager, State};

const MAX_ATTACHMENT_BYTES: u64 = 25 * 1024 * 1024;
const MAX_SEALED_ATTACHMENT_BYTES: u64 = 40 * 1024 * 1024;
const SEALED_HEADER: &str = "x-neir-encrypted";
const FILE_NAME_HEADER: &str = "x-file-name";
const MAX_REMOTE_IMAGE_BYTES: u64 = 12 * 1024 * 1024;
const DOWNLOAD_TIMEOUT: Duration = Duration::from_secs(120);
const STAGING_DIR: &str = "staged-attachments";

#[tauri::command]
pub async fn download_attachment(
    app: AppHandle,
    state: State<'_, AppState>,
    attachment_id: String,
    file_name: String,
) -> Result<String, ApiError> {
    let response = request_plain_attachment(&state, &attachment_id).await?;
    let download_dir = app
        .path()
        .download_dir()
        .map_err(|err| ApiError::transport(err.to_string()))?;
    let safe_name = safe_download_name(&file_name);
    let reserved = reserve_unique_file(&download_dir, &safe_name).await?;
    let target = stream_response_to_file(
        response,
        reserved,
        MAX_ATTACHMENT_BYTES,
        "The attachment is too large.",
    )
    .await?;

    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn fetch_sealed_attachment(
    state: State<'_, AppState>,
    attachment_id: String,
) -> Result<tauri::ipc::Response, ApiError> {
    let response = request_attachment(&state, &attachment_id).await?;
    if response
        .headers()
        .get(SEALED_HEADER)
        .and_then(|value| value.to_str().ok())
        != Some("pgp")
    {
        return Err(ApiError {
            status: 502,
            code: Some("ATTACHMENT_NOT_SEALED".to_string()),
            message: "The attachment was not delivered in its expected form.".to_string(),
        });
    }
    reject_oversized_response(
        &response,
        MAX_SEALED_ATTACHMENT_BYTES,
        "The attachment is too large.",
    )?;
    let bytes = read_response_limited(
        response,
        MAX_SEALED_ATTACHMENT_BYTES,
        "The attachment is too large.",
    )
    .await?;

    Ok(tauri::ipc::Response::new(bytes))
}

#[tauri::command]
pub async fn save_attachment_bytes(
    app: AppHandle,
    request: tauri::ipc::Request<'_>,
) -> Result<String, ApiError> {
    let (bytes, file_name) = raw_attachment_payload(&request)?;
    let download_dir = app
        .path()
        .download_dir()
        .map_err(|err| ApiError::transport(err.to_string()))?;
    let reserved = reserve_unique_file(&download_dir, &safe_download_name(&file_name)).await?;
    let target = write_bytes_to_file(reserved, bytes).await?;

    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn stage_attachment(
    app: AppHandle,
    state: State<'_, AppState>,
    attachment_id: String,
    file_name: String,
) -> Result<String, ApiError> {
    let response = request_plain_attachment(&state, &attachment_id).await?;
    let reserved =
        reserve_unique_file(&new_staging_dir(&app)?, &safe_download_name(&file_name)).await?;
    let target = stream_response_to_file(
        response,
        reserved,
        MAX_ATTACHMENT_BYTES,
        "The attachment is too large.",
    )
    .await?;
    Ok(remember_staged(&state, target))
}

#[tauri::command]
pub async fn stage_attachment_bytes(
    app: AppHandle,
    state: State<'_, AppState>,
    request: tauri::ipc::Request<'_>,
) -> Result<String, ApiError> {
    let (bytes, file_name) = raw_attachment_payload(&request)?;
    let reserved =
        reserve_unique_file(&new_staging_dir(&app)?, &safe_download_name(&file_name)).await?;
    let target = write_bytes_to_file(reserved, bytes).await?;
    Ok(remember_staged(&state, target))
}

#[tauri::command(async)]
pub fn clear_staged_attachments(app: AppHandle) -> Result<(), ApiError> {
    remove_staged_attachments(&app);
    Ok(())
}

pub fn remove_staged_attachments(app: &AppHandle) {
    if let Ok(root) = staging_root(app) {
        let _ = std::fs::remove_dir_all(root);
    }
}

fn staging_root(app: &AppHandle) -> Result<PathBuf, ApiError> {
    app.path()
        .app_cache_dir()
        .map(|dir| dir.join(STAGING_DIR))
        .map_err(|err| ApiError::transport(err.to_string()))
}

fn new_staging_dir(app: &AppHandle) -> Result<PathBuf, ApiError> {
    let mut bytes = [0_u8; 12];
    rand::thread_rng().fill_bytes(&mut bytes);
    let name: String = bytes.iter().map(|byte| format!("{byte:02x}")).collect();
    Ok(staging_root(app)?.join(name))
}

fn remember_staged(state: &AppState, target: PathBuf) -> String {
    let path = target.to_string_lossy().to_string();
    state.remember_picked_files(std::slice::from_ref(&path));
    path
}

fn raw_attachment_payload<'a>(
    request: &'a tauri::ipc::Request<'_>,
) -> Result<(&'a [u8], String), ApiError> {
    let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else {
        return Err(invalid_payload("The attachment data was not received."));
    };
    if bytes.len() as u64 > MAX_ATTACHMENT_BYTES {
        return Err(ApiError {
            status: 413,
            code: Some("PAYLOAD_TOO_LARGE".to_string()),
            message: "The attachment is too large.".to_string(),
        });
    }
    let file_name = request
        .headers()
        .get(FILE_NAME_HEADER)
        .and_then(|value| value.to_str().ok())
        .map(|value| {
            percent_encoding::percent_decode_str(value)
                .decode_utf8_lossy()
                .to_string()
        })
        .ok_or_else(|| invalid_payload("The attachment name was not received."))?;
    Ok((bytes, file_name))
}

async fn request_attachment(
    state: &AppState,
    attachment_id: &str,
) -> Result<reqwest::Response, ApiError> {
    validate_resource_id(attachment_id)?;
    let url = format!(
        "{}/webmail/attachments/{}/download",
        state.base_url, attachment_id
    );
    let response = state
        .http
        .get(&url)
        .timeout(DOWNLOAD_TIMEOUT)
        .send()
        .await
        .map_err(|err| ApiError::transport(err.to_string()))?;
    if !response.status().is_success() {
        return Err(ApiError {
            status: response.status().as_u16(),
            code: None,
            message: "The attachment could not be downloaded.".to_string(),
        });
    }
    Ok(response)
}

async fn request_plain_attachment(
    state: &AppState,
    attachment_id: &str,
) -> Result<reqwest::Response, ApiError> {
    let response = request_attachment(state, attachment_id).await?;
    if response.headers().contains_key(SEALED_HEADER) {
        return Err(ApiError {
            status: 409,
            code: Some("ATTACHMENT_SEALED".to_string()),
            message: "This attachment is encrypted and must be unlocked first.".to_string(),
        });
    }
    reject_oversized_response(
        &response,
        MAX_ATTACHMENT_BYTES,
        "The attachment is too large.",
    )?;
    Ok(response)
}

fn invalid_payload(message: &str) -> ApiError {
    ApiError {
        status: 400,
        code: Some("INVALID_PAYLOAD".to_string()),
        message: message.to_string(),
    }
}

#[tauri::command]
pub async fn fetch_remote_image(
    state: State<'_, AppState>,
    image_url: String,
) -> Result<String, ApiError> {
    let url = format!("{}/webmail/image-proxy", state.base_url);
    let response = state
        .http
        .get(&url)
        .query(&[("url", image_url)])
        .send()
        .await
        .map_err(|err| ApiError::transport(err.to_string()))?;

    response_to_data_uri(
        response,
        ImageLimits {
            max_bytes: MAX_REMOTE_IMAGE_BYTES,
            failure_message: "The remote image could not be loaded.",
            too_large_message: "The remote image is too large to display.",
        },
    )
    .await
}

fn safe_download_name(file_name: &str) -> String {
    let base_name = file_name.rsplit(['/', '\\']).next().unwrap_or_default();
    let mut cleaned = base_name
        .chars()
        .filter(|character| !character.is_control())
        .map(|character| match character {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            _ => character,
        })
        .collect::<String>();

    cleaned = cleaned.trim().trim_end_matches(['.', ' ']).to_string();
    while cleaned.len() > 180 {
        cleaned.pop();
    }

    if cleaned.is_empty() || cleaned == "." || cleaned == ".." {
        return "attachment".to_string();
    }
    if cleaned.starts_with('.') {
        cleaned.insert_str(0, "attachment");
    }
    if is_windows_reserved_name(&cleaned) {
        cleaned.insert(0, '_');
    }
    cleaned
}

fn validate_resource_id(value: &str) -> Result<(), ApiError> {
    if !value.is_empty()
        && value.len() <= 128
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
    {
        return Ok(());
    }

    Err(ApiError {
        status: 400,
        code: Some("INVALID_ATTACHMENT_ID".to_string()),
        message: "The attachment identifier is invalid.".to_string(),
    })
}

fn is_windows_reserved_name(file_name: &str) -> bool {
    let stem = file_name
        .split('.')
        .next()
        .unwrap_or_default()
        .to_ascii_uppercase();
    matches!(stem.as_str(), "CON" | "PRN" | "AUX" | "NUL")
        || stem
            .strip_prefix("COM")
            .or_else(|| stem.strip_prefix("LPT"))
            .is_some_and(|suffix| {
                matches!(suffix, "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9")
            })
}

#[cfg(test)]
mod tests {
    use super::{safe_download_name, validate_resource_id};

    #[test]
    fn strips_path_components_and_unsafe_characters() {
        assert_eq!(safe_download_name("../../private/key.txt"), "key.txt");
        assert_eq!(safe_download_name("..\\..\\private\\key.txt"), "key.txt");
        assert_eq!(
            safe_download_name("invoice<final>?.pdf"),
            "invoice_final__.pdf"
        );
    }

    #[test]
    fn avoids_hidden_and_reserved_names() {
        assert_eq!(safe_download_name(".."), "attachment");
        assert_eq!(safe_download_name(".env"), "attachment.env");
        assert_eq!(safe_download_name("CON.txt"), "_CON.txt");
    }

    #[test]
    fn validates_attachment_identifiers_before_building_urls() {
        assert!(validate_resource_id("019cf53f-8e11-7a00-acde_41").is_ok());
        assert!(validate_resource_id("../admin").is_err());
        assert!(validate_resource_id("contains space").is_err());
        assert!(validate_resource_id("").is_err());
    }
}

use crate::error::ApiError;
use crate::http::multipart::{submit_compose, ComposeFields};
use crate::state::AppState;
use serde::Deserialize;
use serde_json::Value;
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

const MAX_HTML_FILE_BYTES: u64 = 5 * 1024 * 1024;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComposeFieldsPayload {
    to: Option<String>,
    cc: Option<String>,
    bcc: Option<String>,
    subject: Option<String>,
    body: Option<String>,
    html_body: Option<String>,
    in_reply_to: Option<String>,
    draft_id: Option<String>,
    scheduled_for: Option<String>,
    from_mailbox_id: Option<String>,
    keep_attachment_ids: Option<String>,
}

impl From<ComposeFieldsPayload> for ComposeFields {
    fn from(payload: ComposeFieldsPayload) -> Self {
        Self {
            to: payload.to,
            cc: payload.cc,
            bcc: payload.bcc,
            subject: payload.subject,
            body: payload.body,
            html_body: payload.html_body,
            in_reply_to: payload.in_reply_to,
            draft_id: payload.draft_id,
            scheduled_for: payload.scheduled_for,
            from_mailbox_id: payload.from_mailbox_id,
            keep_attachment_ids: payload.keep_attachment_ids,
        }
    }
}

#[tauri::command]
pub async fn send_compose(
    state: State<'_, AppState>,
    fields: ComposeFieldsPayload,
    attachment_paths: Vec<String>,
) -> Result<Value, ApiError> {
    submit_compose(
        &state,
        "/webmail/emails/send",
        fields.into(),
        &attachment_paths,
    )
    .await
}

#[tauri::command]
pub async fn save_draft(
    state: State<'_, AppState>,
    fields: ComposeFieldsPayload,
    attachment_paths: Vec<String>,
) -> Result<Value, ApiError> {
    submit_compose(
        &state,
        "/webmail/emails/draft",
        fields.into(),
        &attachment_paths,
    )
    .await
}

#[tauri::command]
pub async fn schedule_send(
    state: State<'_, AppState>,
    fields: ComposeFieldsPayload,
    attachment_paths: Vec<String>,
) -> Result<Value, ApiError> {
    submit_compose(
        &state,
        "/webmail/emails/schedule",
        fields.into(),
        &attachment_paths,
    )
    .await
}

#[tauri::command]
pub async fn pick_attachments(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<String>, ApiError> {
    let dialog_app = app.clone();
    let picked =
        tokio::task::spawn_blocking(move || dialog_app.dialog().file().blocking_pick_files())
            .await
            .map_err(|err| ApiError::transport(err.to_string()))?;

    let mut paths = Vec::new();
    for file in picked.unwrap_or_default() {
        let path = file
            .into_path()
            .map_err(|err| ApiError::transport(err.to_string()))?;
        paths.push(path.to_string_lossy().to_string());
    }
    state.remember_picked_files(&paths);
    Ok(paths)
}

#[tauri::command]
pub async fn pick_html_file(app: AppHandle) -> Result<Option<String>, ApiError> {
    let picked = tokio::task::spawn_blocking(move || {
        app.dialog()
            .file()
            .add_filter("Email HTML", &["html", "htm"])
            .blocking_pick_file()
    })
    .await
    .map_err(|err| ApiError::transport(err.to_string()))?;
    let Some(file) = picked else {
        return Ok(None);
    };
    let path = file
        .into_path()
        .map_err(|err| ApiError::transport(err.to_string()))?;
    let metadata = tokio::fs::metadata(&path)
        .await
        .map_err(|err| ApiError::transport(err.to_string()))?;
    if !metadata.is_file() || metadata.len() > MAX_HTML_FILE_BYTES {
        return Err(ApiError {
            status: 413,
            code: Some("HTML_FILE_TOO_LARGE".to_string()),
            message: "Choose an HTML file of 5 MB or less.".to_string(),
        });
    }
    let bytes = tokio::fs::read(&path)
        .await
        .map_err(|err| ApiError::transport(err.to_string()))?;
    Ok(Some(String::from_utf8_lossy(&bytes).into_owned()))
}

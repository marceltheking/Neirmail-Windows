use crate::error::ApiError;
use crate::state::AppState;
use reqwest::multipart::{Form, Part};
use serde_json::Value;
use std::path::Path;
use std::time::Duration;

const MAX_ATTACHMENT_COUNT: usize = 10;
const MAX_ATTACHMENT_BYTES: u64 = 25 * 1024 * 1024;
const MAX_COMPOSE_BYTES: u64 = MAX_ATTACHMENT_BYTES * MAX_ATTACHMENT_COUNT as u64;
const COMPOSE_TIMEOUT: Duration = Duration::from_secs(120);

#[derive(Default)]
pub struct ComposeFields {
    pub to: Option<String>,
    pub cc: Option<String>,
    pub bcc: Option<String>,
    pub subject: Option<String>,
    pub body: Option<String>,
    pub in_reply_to: Option<String>,
    pub draft_id: Option<String>,
    pub scheduled_for: Option<String>,
    pub from_mailbox_id: Option<String>,
    pub keep_attachment_ids: Option<String>,
}

fn append_text(mut form: Form, name: &'static str, value: Option<String>) -> Form {
    if let Some(value) = value {
        form = form.text(name, value);
    }
    form
}

pub async fn submit_compose(
    state: &AppState,
    path: &str,
    fields: ComposeFields,
    attachment_paths: &[String],
) -> Result<Value, ApiError> {
    if attachment_paths.len() > MAX_ATTACHMENT_COUNT {
        return Err(ApiError {
            status: 413,
            code: Some("TOO_MANY_ATTACHMENTS".to_string()),
            message: format!("A message can include up to {MAX_ATTACHMENT_COUNT} attachments."),
        });
    }

    let mut form = Form::new();
    form = append_text(form, "to", fields.to);
    form = append_text(form, "cc", fields.cc);
    form = append_text(form, "bcc", fields.bcc);
    form = append_text(form, "subject", fields.subject);
    form = append_text(form, "body", fields.body);
    form = append_text(form, "inReplyTo", fields.in_reply_to);
    form = append_text(form, "draftId", fields.draft_id);
    form = append_text(form, "scheduledFor", fields.scheduled_for);
    form = append_text(form, "fromMailboxId", fields.from_mailbox_id);
    form = append_text(form, "keepAttachmentIds", fields.keep_attachment_ids);

    let mut total_bytes = 0_u64;
    for file_path in attachment_paths {
        if !state.was_picked(file_path) {
            return Err(ApiError {
                status: 403,
                code: Some("ATTACHMENT_NOT_SELECTED".to_string()),
                message: "Only files chosen with the attachment picker can be sent.".to_string(),
            });
        }
        let metadata = tokio::fs::metadata(file_path)
            .await
            .map_err(|err| ApiError::transport(err.to_string()))?;
        if !metadata.is_file() {
            return Err(ApiError::transport(format!(
                "The selected attachment is not a file: {file_path}"
            )));
        }
        if metadata.len() > MAX_ATTACHMENT_BYTES {
            return Err(ApiError {
                status: 413,
                code: Some("ATTACHMENT_TOO_LARGE".to_string()),
                message: "Each attachment must be 25 MB or less.".to_string(),
            });
        }
        total_bytes = total_bytes.saturating_add(metadata.len());
        if total_bytes > MAX_COMPOSE_BYTES {
            return Err(ApiError {
                status: 413,
                code: Some("ATTACHMENTS_TOO_LARGE".to_string()),
                message: "The combined attachments are too large.".to_string(),
            });
        }
        let file_name = Path::new(file_path)
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("attachment")
            .to_string();
        let mime = mime_guess::from_path(file_path).first_or_octet_stream();
        let part = Part::file(file_path)
            .await
            .map_err(|err| ApiError::transport(err.to_string()))?
            .file_name(file_name)
            .mime_str(mime.as_ref())
            .map_err(|err| ApiError::transport(err.to_string()))?;
        form = form.part("file", part);
    }

    let url = format!("{}{}", state.base_url, path);
    let response = state
        .http
        .post(&url)
        .multipart(form)
        .timeout(COMPOSE_TIMEOUT)
        .send()
        .await
        .map_err(|err| ApiError::transport(err.to_string()))?;

    let status = response.status();
    let is_json = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .is_some_and(|content_type| content_type.contains("application/json"));
    let data: Option<Value> = if is_json {
        response.json().await.ok()
    } else {
        None
    };

    if !status.is_success() {
        let error_body = data.as_ref().and_then(|value| value.get("error"));
        let code = error_body
            .and_then(|error| error.get("code"))
            .and_then(|value| value.as_str())
            .map(str::to_string);
        let message = error_body
            .and_then(|error| error.get("message"))
            .and_then(|value| value.as_str())
            .map(str::to_string)
            .unwrap_or_else(|| format!("Request failed ({})", status.as_u16()));
        return Err(ApiError {
            status: status.as_u16(),
            code,
            message,
        });
    }

    Ok(data.unwrap_or(Value::Null))
}

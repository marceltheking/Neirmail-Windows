use crate::error::ApiError;
use crate::http::image::{response_to_data_uri, ImageLimits};
use crate::state::AppState;
use std::time::Duration;
use tauri::State;

const MAX_ICON_BYTES: u64 = 512 * 1024;
const ICON_TIMEOUT: Duration = Duration::from_secs(15);

#[tauri::command]
pub async fn fetch_sender_icon(
    state: State<'_, AppState>,
    domain: String,
) -> Result<String, ApiError> {
    validate_domain(&domain)?;
    let response = state
        .http
        .get(format!("{}/webmail/sender-icon/{}", state.base_url, domain))
        .timeout(ICON_TIMEOUT)
        .send()
        .await
        .map_err(|err| ApiError::transport(err.to_string()))?;

    response_to_data_uri(
        response,
        ImageLimits {
            max_bytes: MAX_ICON_BYTES,
            failure_message: "The sender icon is not available.",
            too_large_message: "The sender icon is too large.",
        },
    )
    .await
}

fn validate_domain(domain: &str) -> Result<(), ApiError> {
    let valid = domain.len() <= 253
        && domain.contains('.')
        && domain.split('.').all(|label| {
            !label.is_empty()
                && !label.starts_with('-')
                && !label.ends_with('-')
                && label
                    .bytes()
                    .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
        });
    if valid {
        return Ok(());
    }
    Err(ApiError {
        status: 400,
        code: Some("INVALID_DOMAIN".to_string()),
        message: "The sender domain is invalid.".to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::validate_domain;

    #[test]
    fn accepts_public_looking_domains() {
        assert!(validate_domain("example.com").is_ok());
        assert!(validate_domain("mail.sub-domain.example.co.uk").is_ok());
    }

    #[test]
    fn rejects_anything_that_could_change_the_request_path() {
        for domain in [
            "",
            "localhost",
            "../admin",
            "example.com/../../x",
            "example.com?x=1",
            "Example.com",
            "exa mple.com",
            "-bad.example.com",
            "example..com",
            "example.com#frag",
        ] {
            assert!(validate_domain(domain).is_err(), "{domain} was accepted");
        }
    }
}

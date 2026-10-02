use super::download::{read_response_limited, reject_oversized_response};
use crate::error::ApiError;
use base64::engine::general_purpose::STANDARD;
use base64::Engine;

const SAFE_IMAGE_TYPES: &[&str] = &[
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "image/avif",
];

pub struct ImageLimits<'a> {
    pub max_bytes: u64,
    pub failure_message: &'a str,
    pub too_large_message: &'a str,
}

pub async fn response_to_data_uri(
    response: reqwest::Response,
    limits: ImageLimits<'_>,
) -> Result<String, ApiError> {
    if !response.status().is_success() {
        return Err(ApiError {
            status: response.status().as_u16(),
            code: None,
            message: limits.failure_message.to_string(),
        });
    }
    reject_oversized_response(&response, limits.max_bytes, limits.too_large_message)?;

    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.split(';').next())
        .unwrap_or_default()
        .trim()
        .to_ascii_lowercase();
    if !SAFE_IMAGE_TYPES.contains(&content_type.as_str()) {
        return Err(ApiError {
            status: 415,
            code: Some("UNSUPPORTED_IMAGE_TYPE".to_string()),
            message: "The image type is not supported.".to_string(),
        });
    }

    let bytes = read_response_limited(response, limits.max_bytes, limits.too_large_message).await?;
    Ok(format!(
        "data:{content_type};base64,{}",
        STANDARD.encode(bytes)
    ))
}

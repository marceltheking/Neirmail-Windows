use crate::error::ApiError;
use crate::state::AppState;
use reqwest::Method;
use serde_json::Value;
use std::collections::HashMap;
use std::str::FromStr;

pub async fn request(
    state: &AppState,
    method: &str,
    path: &str,
    body: Option<Value>,
    query: Option<HashMap<String, String>>,
) -> Result<Value, ApiError> {
    let method =
        Method::from_str(method).map_err(|_| ApiError::transport("invalid HTTP method"))?;
    validate_target(&method, path)?;
    let url = format!("{}{}", state.base_url, path);

    let mut builder = state.http.request(method, &url);
    if let Some(query) = query {
        builder = builder.query(&query);
    }
    if let Some(body) = body {
        builder = builder.json(&body);
    }

    let response = builder
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

fn validate_target(method: &Method, path: &str) -> Result<(), ApiError> {
    if !matches!(
        *method,
        Method::GET | Method::POST | Method::PUT | Method::PATCH | Method::DELETE
    ) {
        return Err(ApiError::transport("HTTP method is not allowed"));
    }
    if !path.starts_with('/')
        || path.starts_with("//")
        || path.contains("://")
        || path.contains('\\')
        || path.chars().any(char::is_control)
        || has_dot_segment(path)
    {
        return Err(ApiError::transport("API path is not allowed"));
    }
    Ok(())
}

fn has_dot_segment(path: &str) -> bool {
    let route = path.split(['?', '#']).next().unwrap_or_default();
    route.split('/').any(|segment| {
        let lowered = segment.to_ascii_lowercase();
        matches!(
            lowered.as_str(),
            "." | ".." | "%2e" | "%2e%2e" | ".%2e" | "%2e."
        ) || lowered.contains("%2f")
            || lowered.contains("%5c")
    })
}

#[cfg(test)]
mod tests {
    use super::validate_target;
    use reqwest::Method;

    #[test]
    fn accepts_neir_api_targets() {
        assert!(validate_target(&Method::GET, "/webmail/emails?page=1").is_ok());
        assert!(validate_target(&Method::POST, "/settings/2fa/setup").is_ok());
    }

    #[test]
    fn rejects_external_or_unsupported_targets() {
        assert!(validate_target(&Method::CONNECT, "/webmail/ws").is_err());
        assert!(validate_target(&Method::GET, "https://example.com").is_err());
        assert!(validate_target(&Method::GET, "//example.com/path").is_err());
        assert!(validate_target(&Method::GET, "/path\\override").is_err());
        assert!(validate_target(&Method::GET, "/webmail/emails/../../admin/users").is_err());
        assert!(validate_target(&Method::GET, "/webmail/emails/%2e%2e/admin").is_err());
        assert!(validate_target(&Method::GET, "/webmail/emails/a%2Fb").is_err());
    }
}

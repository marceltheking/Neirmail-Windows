use crate::crypto::keychain;
use crate::error::ApiError;
use crate::http::proxy;
use crate::state::AppState;
use reqwest::cookie::CookieStore;
use serde::Serialize;
use serde_json::{json, Value};
use std::time::Duration;
use tauri::State;

const RESTORE_TIMEOUT: Duration = Duration::from_secs(8);

#[derive(Serialize)]
#[serde(tag = "status")]
pub enum LoginOutcome {
    #[serde(rename = "authenticated")]
    Authenticated,
    #[serde(rename = "requires_2fa")]
    Requires2Fa {
        #[serde(rename = "preAuthToken")]
        pre_auth_token: String,
    },
}

#[tauri::command]
pub async fn login(
    state: State<'_, AppState>,
    account_key: String,
) -> Result<LoginOutcome, ApiError> {
    let data = proxy::request(
        &state,
        "POST",
        "/auth/login",
        Some(json!({ "accountKey": account_key })),
        None,
    )
    .await?;

    if data
        .get("requires2Fa")
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        let pre_auth_token = data
            .get("preAuthToken")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string();
        return Ok(LoginOutcome::Requires2Fa { pre_auth_token });
    }

    Ok(LoginOutcome::Authenticated)
}

#[tauri::command]
pub async fn login_2fa(
    state: State<'_, AppState>,
    pre_auth_token: String,
    code: String,
) -> Result<(), ApiError> {
    proxy::request(
        &state,
        "POST",
        "/auth/login/2fa",
        Some(json!({ "preAuthToken": pre_auth_token, "code": code })),
        None,
    )
    .await?;
    Ok(())
}

#[tauri::command]
pub async fn logout(state: State<'_, AppState>) -> Result<(), ApiError> {
    proxy::request(&state, "POST", "/auth/logout", None, None).await?;
    Ok(())
}

#[tauri::command]
pub async fn me(state: State<'_, AppState>) -> Result<Value, ApiError> {
    proxy::request(&state, "GET", "/auth/me", None, None).await
}

#[tauri::command]
pub async fn get_pgp_settings(state: State<'_, AppState>) -> Result<Value, ApiError> {
    proxy::request(&state, "GET", "/settings/pgp", None, None).await
}

#[tauri::command(async)]
pub fn persist_session(state: State<'_, AppState>) -> Result<(), ApiError> {
    if let Ok(url) = state.base_url.parse() {
        if let Some(cookie) = state.cookie_jar.cookies(&url) {
            if let Ok(text) = cookie.to_str() {
                keychain::set_session_cookie(text);
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn restore_session(state: State<'_, AppState>) -> Result<bool, ApiError> {
    let Some(cookie_value) = keychain::get_session_cookie() else {
        return Ok(false);
    };

    if let Ok(url) = state.base_url.parse() {
        let secure = state.base_url.starts_with("https://");
        for pair in cookie_value.split("; ").filter(|pair| pair.contains('=')) {
            if let Ok(header) =
                reqwest::header::HeaderValue::from_str(&restored_cookie_header(pair, secure))
            {
                let mut iter = std::iter::once(&header);
                state.cookie_jar.set_cookies(&mut iter, &url);
            }
        }
    }

    let probe = tokio::time::timeout(
        RESTORE_TIMEOUT,
        proxy::request(&state, "GET", "/auth/me", None, None),
    )
    .await;

    match probe {
        Ok(Ok(_)) => Ok(true),
        Ok(Err(err)) => {
            if err.status == 401 {
                keychain::clear_session_cookie();
            }
            Ok(false)
        }
        Err(_) => Ok(false),
    }
}

fn restored_cookie_header(pair: &str, secure: bool) -> String {
    let flags = if secure { "; Secure" } else { "" };
    format!("{pair}; Path=/; HttpOnly{flags}")
}

#[tauri::command(async)]
pub fn forget_persisted_session() -> Result<(), ApiError> {
    keychain::clear_session_cookie();
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::restored_cookie_header;

    #[test]
    fn restored_cookies_are_secure_over_https_only() {
        assert_eq!(
            restored_cookie_header("session=abc", true),
            "session=abc; Path=/; HttpOnly; Secure"
        );
        assert_eq!(
            restored_cookie_header("session=abc", false),
            "session=abc; Path=/; HttpOnly"
        );
    }
}

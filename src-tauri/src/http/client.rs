use reqwest::cookie::Jar;
use reqwest::header::{HeaderMap, HeaderValue, ORIGIN};
use std::sync::Arc;
use std::time::Duration;

const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);

const DEFAULT_BASE_URL: &str = "https://neir.io";

pub fn base_url() -> String {
    std::env::var("NEIRMAIL_API_BASE_URL")
        .ok()
        .and_then(|value| accepted_override(&value, cfg!(debug_assertions)))
        .unwrap_or_else(|| DEFAULT_BASE_URL.to_string())
}

fn accepted_override(value: &str, development: bool) -> Option<String> {
    let trimmed = value.trim().trim_end_matches('/');
    let parsed = reqwest::Url::parse(trimmed).ok()?;
    let usable = matches!(parsed.scheme(), "http" | "https") && parsed.host_str().is_some();
    (usable && (development || request_origin(trimmed).is_some())).then(|| trimmed.to_string())
}

fn user_agent() -> String {
    let os = if cfg!(target_os = "windows") {
        "Windows"
    } else if cfg!(target_os = "macos") {
        "Macintosh"
    } else {
        "Linux"
    };
    format!("NeirMail/{} ({os})", env!("CARGO_PKG_VERSION"))
}

pub fn request_origin(base_url: &str) -> Option<String> {
    let url = reqwest::Url::parse(base_url).ok()?;
    let is_onion = url.host_str().is_some_and(|host| host.ends_with(".onion"));
    (url.scheme() == "https" || is_onion).then(|| url.origin().ascii_serialization())
}

const MAX_REDIRECTS: usize = 5;

fn redirect_allowed(previous: &reqwest::Url, next: &reqwest::Url) -> bool {
    if previous.host_str() != next.host_str() {
        return false;
    }
    let same_endpoint = previous.scheme() == next.scheme()
        && previous.port_or_known_default() == next.port_or_known_default();
    let https_upgrade =
        previous.scheme() == "http" && next.scheme() == "https" && next.port().is_none();
    same_endpoint || https_upgrade
}

pub fn build_client(jar: Arc<Jar>, base_url: &str) -> reqwest::Client {
    let mut headers = HeaderMap::new();
    if let Some(origin) =
        request_origin(base_url).and_then(|origin| HeaderValue::from_str(&origin).ok())
    {
        headers.insert(ORIGIN, origin);
    }
    reqwest::Client::builder()
        .default_headers(headers)
        .cookie_provider(jar)
        .redirect(reqwest::redirect::Policy::custom(|attempt| {
            let allowed = attempt.previous().len() < MAX_REDIRECTS
                && attempt
                    .previous()
                    .last()
                    .is_some_and(|previous| redirect_allowed(previous, attempt.url()));
            if allowed {
                attempt.follow()
            } else {
                attempt.stop()
            }
        }))
        .user_agent(user_agent())
        .connect_timeout(CONNECT_TIMEOUT)
        .timeout(REQUEST_TIMEOUT)
        .build()
        .expect("failed to build the neir.io http client")
}

#[cfg(test)]
mod tests {
    use super::{accepted_override, redirect_allowed, request_origin};

    fn url(value: &str) -> reqwest::Url {
        reqwest::Url::parse(value).unwrap()
    }

    #[test]
    fn follows_redirects_only_within_the_same_host_and_never_downgrades() {
        assert!(redirect_allowed(
            &url("http://neir.io/a"),
            &url("https://neir.io/a")
        ));
        assert!(redirect_allowed(
            &url("https://neir.io/a"),
            &url("https://neir.io/b")
        ));
        assert!(!redirect_allowed(
            &url("https://neir.io/a"),
            &url("http://neir.io/a")
        ));
        assert!(!redirect_allowed(
            &url("https://neir.io/a"),
            &url("https://evil.example/a")
        ));
        assert!(!redirect_allowed(
            &url("https://neir.io/a"),
            &url("https://neir.io:8443/a")
        ));
    }

    #[test]
    fn honours_a_plain_http_override_only_in_development_builds() {
        assert_eq!(
            accepted_override("http://127.0.0.1:3099/", true).as_deref(),
            Some("http://127.0.0.1:3099")
        );
        assert_eq!(accepted_override("http://127.0.0.1:3099", false), None);
    }

    #[test]
    fn release_builds_still_accept_https_and_onion_overrides() {
        assert_eq!(
            accepted_override("https://mail.example.org", false).as_deref(),
            Some("https://mail.example.org")
        );
        assert_eq!(
            accepted_override("http://exampleonionaddress.onion/", false).as_deref(),
            Some("http://exampleonionaddress.onion")
        );
    }

    #[test]
    fn ignores_overrides_that_are_not_web_addresses() {
        assert_eq!(accepted_override("file:///etc/passwd", true), None);
        assert_eq!(accepted_override("not a url", true), None);
        assert_eq!(accepted_override("", true), None);
    }

    #[test]
    fn sends_the_servers_own_origin_for_https_deployments() {
        assert_eq!(
            request_origin("https://neir.io").as_deref(),
            Some("https://neir.io")
        );
        assert_eq!(
            request_origin("https://mail.example.org:8443/").as_deref(),
            Some("https://mail.example.org:8443")
        );
    }

    #[test]
    fn sends_the_onion_origin_for_hidden_service_backends() {
        assert_eq!(
            request_origin("http://exampleonionaddress.onion").as_deref(),
            Some("http://exampleonionaddress.onion")
        );
    }

    #[test]
    fn sends_no_origin_to_a_plain_http_local_backend() {
        assert_eq!(request_origin("http://127.0.0.1:3099"), None);
        assert_eq!(request_origin("not a url"), None);
    }
}

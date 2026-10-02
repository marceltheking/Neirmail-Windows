use tauri::webview::NewWindowResponse;
use tauri::{App, Emitter, Url, WebviewWindowBuilder};

const MAIN_WINDOW: &str = "main";
const BLOCKED_WINDOW_EVENT: &str = "blocked-window-request";

pub fn create_main_window(app: &App) -> tauri::Result<()> {
    let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|window| window.label == MAIN_WINDOW)
        .cloned()
        .ok_or_else(|| tauri::Error::WindowNotFound)?;
    let handle = app.handle().clone();
    WebviewWindowBuilder::from_config(app, &config)?
        .on_navigation(|url| is_app_url(url, cfg!(debug_assertions)))
        .on_new_window(move |url, _| {
            if is_forwardable_link(&url) {
                let _ = handle.emit_to(MAIN_WINDOW, BLOCKED_WINDOW_EVENT, url.to_string());
            }
            NewWindowResponse::Deny
        })
        .build()?;
    Ok(())
}

fn is_forwardable_link(url: &Url) -> bool {
    matches!(url.scheme(), "http" | "https" | "mailto")
}

fn is_app_url(url: &Url, development: bool) -> bool {
    match url.scheme() {
        "tauri" => url.host_str() == Some("localhost"),
        "about" => matches!(url.path(), "blank" | "srcdoc"),
        "http" | "https" => match url.host_str() {
            Some("tauri.localhost") => true,
            Some("localhost") => development,
            _ => false,
        },
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::{is_app_url, is_forwardable_link};
    use tauri::Url;

    fn allowed(value: &str, development: bool) -> bool {
        is_app_url(&Url::parse(value).unwrap(), development)
    }

    #[test]
    fn keeps_the_webview_on_the_bundled_app() {
        assert!(allowed("tauri://localhost/index.html", false));
        assert!(allowed("http://tauri.localhost/", false));
        assert!(allowed("about:srcdoc", false));
        assert!(allowed("about:blank", false));
    }

    #[test]
    fn refuses_to_navigate_anywhere_else() {
        for url in [
            "https://evil.example/login",
            "http://localhost:1420/",
            "file:///C:/Users/me/Downloads/page.html",
            "tauri://evil.example/",
            "data:text/html,<h1>hi</h1>",
            "javascript:alert(1)",
            "https://tauri.localhost.evil.example/",
        ] {
            assert!(!allowed(url, false), "{url} was allowed");
        }
    }

    #[test]
    fn only_hands_web_and_mail_links_from_refused_windows_to_the_app() {
        for url in [
            "https://example.com/a",
            "http://example.com",
            "mailto:a@b.example",
        ] {
            assert!(is_forwardable_link(&Url::parse(url).unwrap()), "{url}");
        }
        for url in [
            "file:///etc/passwd",
            "javascript:alert(1)",
            "about:blank",
            "tauri://localhost/",
        ] {
            assert!(!is_forwardable_link(&Url::parse(url).unwrap()), "{url}");
        }
    }

    #[test]
    fn allows_the_vite_dev_server_only_in_development() {
        assert!(allowed("http://localhost:1420/", true));
        assert!(!allowed("http://localhost:1420/", false));
    }
}

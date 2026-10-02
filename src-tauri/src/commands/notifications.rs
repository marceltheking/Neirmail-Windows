#[cfg(windows)]
const WINDOWS_SOUND: &str = "Default";

#[cfg(target_os = "macos")]
const DESKTOP_SOUND: &str = "default";

#[cfg(all(not(windows), not(target_os = "macos")))]
const DESKTOP_SOUND: &str = "message-new-instant";

const MAX_TITLE_CHARS: usize = 120;
const MAX_BODY_CHARS: usize = 240;

#[tauri::command]
pub async fn show_native_notification(
    app: tauri::AppHandle,
    title: String,
    body: String,
    sound: Option<bool>,
) -> Result<(), String> {
    deliver(
        app,
        clean_text(&title, MAX_TITLE_CHARS),
        clean_text(&body, MAX_BODY_CHARS),
        sound.unwrap_or(true),
    )
    .await
}

fn clean_text(value: &str, limit: usize) -> String {
    let flattened: String = value
        .chars()
        .map(|character| {
            if character.is_control() {
                ' '
            } else {
                character
            }
        })
        .collect();
    let trimmed = flattened.split_whitespace().collect::<Vec<_>>().join(" ");
    let mut limited: String = trimmed.chars().take(limit).collect();
    if trimmed.chars().count() > limit {
        limited.push('…');
    }
    escape_markup(limited)
}

#[cfg(all(not(windows), not(target_os = "macos")))]
fn escape_markup(value: String) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

#[cfg(any(windows, target_os = "macos"))]
fn escape_markup(value: String) -> String {
    value
}

#[cfg(windows)]
async fn deliver(
    _app: tauri::AppHandle,
    title: String,
    body: String,
    play_sound: bool,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        register_windows_identity()?;
        let mut notification = notify_rust::Notification::new();
        notification
            .summary(&title)
            .body(&body)
            .auto_icon()
            .app_id("io.neir.neirmail");
        if play_sound {
            notification.sound_name(WINDOWS_SOUND);
        }
        notification
            .show()
            .map(|_| ())
            .map_err(|err| err.to_string())
    })
    .await
    .map_err(|err| err.to_string())?
}

#[cfg(not(windows))]
async fn deliver(
    app: tauri::AppHandle,
    title: String,
    body: String,
    play_sound: bool,
) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;

    let mut builder = app.notification().builder().title(title).body(body);
    if play_sound {
        builder = builder.sound(DESKTOP_SOUND);
    }
    builder.show().map_err(|err| err.to_string())
}

#[cfg(windows)]
fn register_windows_identity() -> Result<(), String> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    let current_user = RegKey::predef(HKEY_CURRENT_USER);
    let (key, _) = current_user
        .create_subkey(r"SOFTWARE\Classes\AppUserModelId\io.neir.neirmail")
        .map_err(|err| err.to_string())?;
    key.set_value("DisplayName", &"Neir Mail")
        .map_err(|err| err.to_string())
}

#[cfg(test)]
mod tests {
    use super::clean_text;

    #[test]
    fn flattens_control_characters_and_caps_length() {
        assert_eq!(clean_text("Hi\n\tthere\u{0}", 50), "Hi there");
        assert_eq!(clean_text(&"a".repeat(10), 4), "aaaa…");
    }

    #[cfg(all(not(windows), not(target_os = "macos")))]
    #[test]
    fn neutralises_notification_markup_on_linux() {
        assert_eq!(
            clean_text("<a href=\"https://evil\">Reset</a> & win", 80),
            "&lt;a href=\"https://evil\"&gt;Reset&lt;/a&gt; &amp; win"
        );
    }
}

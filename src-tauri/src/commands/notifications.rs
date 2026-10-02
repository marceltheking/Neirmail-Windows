#[cfg(windows)]
const WINDOWS_SOUND: &str = "Default";

#[cfg(target_os = "macos")]
const DESKTOP_SOUND: &str = "default";

#[cfg(all(not(windows), not(target_os = "macos")))]
const DESKTOP_SOUND: &str = "message-new-instant";

#[tauri::command]
pub async fn show_native_notification(
    app: tauri::AppHandle,
    title: String,
    body: String,
    sound: Option<bool>,
) -> Result<(), String> {
    deliver(app, title, body, sound.unwrap_or(true)).await
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

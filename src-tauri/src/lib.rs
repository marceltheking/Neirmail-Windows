mod cache;
mod commands;
mod crypto;
mod error;
mod http;
mod state;
mod window;
mod ws;

use cache::seal::CacheCipher;
use cache::CacheDb;
use state::AppState;
use std::sync::atomic::Ordering;
use std::sync::Mutex;
use std::time::Duration;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, WindowEvent};
use ws::hub::WsHandle;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(AppState::new())
        .manage(WsHandle(Mutex::new(None)))
        .setup(|app| {
            window::create_main_window(app)?;
            let show_item = MenuItem::with_id(app, "show", "Show Neir Mail", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let tray_menu = Menu::with_items(app, &[&show_item, &quit_item])?;
            let mut tray = TrayIconBuilder::with_id("neirmail")
                .menu(&tray_menu)
                .tooltip("Neir Mail")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_main_window(app),
                    "quit" => request_quit(app),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                });
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.build(app)?;

            let handle = app.handle().clone();
            std::thread::spawn(move || {
                commands::attachments::remove_staged_attachments(&handle);
                match open_cache(&handle) {
                    Ok(cache) => {
                        handle.manage(cache);
                    }
                    Err(err) => {
                        eprintln!("Local cache unavailable, continuing without it: {err}");
                    }
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::api_request,
            commands::set_close_to_tray,
            commands::quit_app,
            commands::defer_quit,
            commands::account::download_account_export,
            commands::auth::login,
            commands::auth::login_2fa,
            commands::auth::logout,
            commands::auth::me,
            commands::auth::get_pgp_settings,
            commands::auth::persist_session,
            commands::auth::restore_session,
            commands::auth::forget_persisted_session,
            commands::attachments::download_attachment,
            commands::attachments::fetch_sealed_attachment,
            commands::attachments::save_attachment_bytes,
            commands::attachments::stage_attachment,
            commands::attachments::stage_attachment_bytes,
            commands::attachments::clear_staged_attachments,
            commands::attachments::fetch_remote_image,
            commands::sender_icons::fetch_sender_icon,
            commands::compose::pick_attachments,
            commands::compose::pick_html_file,
            commands::compose::send_compose,
            commands::compose::save_draft,
            commands::compose::schedule_send,
            commands::cache::cache_get_folders,
            commands::cache::cache_set_folders,
            commands::cache::cache_get_email_list,
            commands::cache::cache_set_email_list,
            commands::cache::cache_get_email_detail,
            commands::cache::cache_set_email_detail,
            commands::cache::cache_forget_email_details,
            commands::cache::clear_cache,
            commands::notifications::show_native_notification,
            commands::realtime::start_ws,
            commands::realtime::stop_ws,
        ])
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let state = window.state::<AppState>();
                api.prevent_close();
                if state.close_to_tray.load(Ordering::Relaxed) {
                    let _ = window.hide();
                } else {
                    request_quit(window.app_handle());
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn open_cache(app: &tauri::AppHandle) -> Result<CacheDb, Box<dyn std::error::Error>> {
    let data_dir = app.path().app_local_data_dir()?;
    std::fs::create_dir_all(&data_dir)?;
    let db_path = data_dir.join("cache.sqlite3");
    let key = crypto::keychain::get_or_create_cache_key()?;
    let conn = cache::db::open(&db_path)?;
    Ok(CacheDb {
        conn: Mutex::new(conn),
        cipher: CacheCipher::new(&key),
    })
}

const QUIT_GRACE: Duration = Duration::from_secs(10);
const DEFERRED_QUIT_GRACE: Duration = Duration::from_secs(150);

fn request_quit(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
    let _ = app.emit("quit-requested", ());
    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(QUIT_GRACE).await;
        if handle
            .state::<AppState>()
            .quit_deferred
            .load(Ordering::Relaxed)
        {
            tokio::time::sleep(DEFERRED_QUIT_GRACE - QUIT_GRACE).await;
        }
        handle.exit(0);
    });
}

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

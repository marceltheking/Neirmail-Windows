use crate::error::ApiError;
use crate::state::AppState;
use futures_util::{SinkExt, StreamExt};
use reqwest::cookie::CookieStore;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::sync::oneshot;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::Message;

const CONNECT_TIMEOUT: Duration = Duration::from_secs(15);
const SILENCE_LIMIT: Duration = Duration::from_secs(75);
const CLIENT_PING_INTERVAL: Duration = Duration::from_secs(25);
const MAX_BACKOFF: Duration = Duration::from_secs(30);

pub struct WsHandle(pub Mutex<Option<oneshot::Sender<()>>>);

fn derive_ws_url(base_url: &str) -> String {
    let url = base_url
        .replacen("https://", "wss://", 1)
        .replacen("http://", "ws://", 1);
    format!("{url}/webmail/ws")
}

pub fn start(app: AppHandle, ws_handle: &WsHandle, state: &AppState) -> Result<(), ApiError> {
    let ws_url = derive_ws_url(&state.base_url);
    let base_url = state.base_url.clone();
    let cookie_jar = state.cookie_jar.clone();

    let (tx, mut rx) = oneshot::channel();
    {
        let mut guard = ws_handle
            .0
            .lock()
            .map_err(|_| ApiError::transport("Realtime state is unavailable."))?;
        if let Some(previous) = guard.take() {
            let _ = previous.send(());
        }
        *guard = Some(tx);
    }

    tauri::async_runtime::spawn(async move {
        let mut backoff = Duration::from_secs(1);
        loop {
            let Ok(mut request) = ws_url.clone().into_client_request() else {
                return;
            };
            if let Some(cookie) = base_url
                .parse()
                .ok()
                .and_then(|url| cookie_jar.cookies(&url))
            {
                request.headers_mut().insert("Cookie", cookie);
            }
            let connection =
                tokio::time::timeout(CONNECT_TIMEOUT, tokio_tungstenite::connect_async(request))
                    .await;
            let Ok(Ok((stream, _))) = connection else {
                tokio::select! {
                    _ = &mut rx => break,
                    _ = tokio::time::sleep(backoff) => {}
                }
                backoff = (backoff * 2).min(MAX_BACKOFF);
                continue;
            };
            backoff = Duration::from_secs(1);
            let _ = app.emit("mail-connected", ());
            let (mut write, mut read) = stream.split();
            let mut ping = tokio::time::interval(CLIENT_PING_INTERVAL);
            ping.tick().await;
            let mut deadline = tokio::time::Instant::now() + SILENCE_LIMIT;
            let stopped = loop {
                tokio::select! {
                    _ = &mut rx => break true,
                    _ = tokio::time::sleep_until(deadline) => break false,
                    _ = ping.tick() => {
                        if write.send(Message::Ping(Vec::new())).await.is_err() {
                            break false;
                        }
                    }
                    message = read.next() => {
                        deadline = tokio::time::Instant::now() + SILENCE_LIMIT;
                        match message {
                            Some(Ok(Message::Text(text))) => {
                                let _ = app.emit("mail-event", text.to_string());
                            }
                            Some(Ok(Message::Close(_))) | Some(Err(_)) | None => break false,
                            Some(Ok(_)) => {}
                        }
                    }
                }
            };
            let _ = write.close().await;
            if stopped {
                break;
            }
            tokio::select! {
                _ = &mut rx => break,
                _ = tokio::time::sleep(backoff) => {}
            }
            backoff = (backoff * 2).min(MAX_BACKOFF);
        }
    });

    Ok(())
}

pub fn stop(ws_handle: &WsHandle) -> Result<(), ApiError> {
    let mut guard = ws_handle
        .0
        .lock()
        .map_err(|_| ApiError::transport("Realtime state is unavailable."))?;
    if let Some(sender) = guard.take() {
        let _ = sender.send(());
    }
    Ok(())
}

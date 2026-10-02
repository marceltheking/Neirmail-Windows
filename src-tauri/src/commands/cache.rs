use crate::cache::{repository, CacheDb};
use crate::error::ApiError;
use serde_json::Value;
use tauri::State;

fn lock_err(err: impl std::fmt::Display) -> ApiError {
    ApiError::transport(err.to_string())
}

#[tauri::command(async)]
pub fn cache_get_folders(cache: State<'_, CacheDb>) -> Result<Vec<Value>, ApiError> {
    let conn = cache.conn.lock().map_err(lock_err)?;
    repository::read_folders(&conn, &cache.cipher).map_err(lock_err)
}

#[tauri::command(async)]
pub fn cache_set_folders(cache: State<'_, CacheDb>, folders: Vec<Value>) -> Result<(), ApiError> {
    let conn = cache.conn.lock().map_err(lock_err)?;
    repository::replace_folders(&conn, &cache.cipher, &folders).map_err(lock_err)
}

#[tauri::command(async)]
pub fn cache_get_email_list(
    cache: State<'_, CacheDb>,
    nav_key: String,
) -> Result<Vec<Value>, ApiError> {
    let conn = cache.conn.lock().map_err(lock_err)?;
    repository::read_email_list(&conn, &cache.cipher, &nav_key).map_err(lock_err)
}

#[tauri::command(async)]
pub fn cache_set_email_list(
    cache: State<'_, CacheDb>,
    nav_key: String,
    items: Vec<Value>,
) -> Result<(), ApiError> {
    let conn = cache.conn.lock().map_err(lock_err)?;
    repository::replace_email_list(&conn, &cache.cipher, &nav_key, &items).map_err(lock_err)
}

#[tauri::command(async)]
pub fn cache_get_email_detail(
    cache: State<'_, CacheDb>,
    id: String,
) -> Result<Option<Value>, ApiError> {
    let conn = cache.conn.lock().map_err(lock_err)?;
    repository::read_email_detail(&conn, &cache.cipher, &id).map_err(lock_err)
}

#[tauri::command(async)]
pub fn cache_set_email_detail(
    cache: State<'_, CacheDb>,
    id: String,
    detail: Value,
) -> Result<(), ApiError> {
    let conn = cache.conn.lock().map_err(lock_err)?;
    repository::write_email_detail(&conn, &cache.cipher, &id, &detail).map_err(lock_err)
}

#[tauri::command(async)]
pub fn cache_forget_email_details(
    cache: State<'_, CacheDb>,
    ids: Vec<String>,
) -> Result<(), ApiError> {
    let conn = cache.conn.lock().map_err(lock_err)?;
    repository::forget_email_details(&conn, &ids).map_err(lock_err)
}

#[tauri::command(async)]
pub fn clear_cache(cache: State<'_, CacheDb>) -> Result<(), ApiError> {
    let conn = cache.conn.lock().map_err(lock_err)?;
    repository::clear_all(&conn).map_err(lock_err)
}

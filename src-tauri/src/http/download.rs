use crate::error::ApiError;
use futures_util::StreamExt;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use tokio::fs::{File, OpenOptions};
use tokio::io::AsyncWriteExt;

pub struct ReservedFile {
    path: PathBuf,
    file: File,
}

pub fn reject_oversized_response(
    response: &reqwest::Response,
    limit: u64,
    message: &str,
) -> Result<(), ApiError> {
    if response.content_length().is_some_and(|size| size > limit) {
        return Err(payload_too_large(message));
    }
    Ok(())
}

pub async fn reserve_unique_file(dir: &Path, file_name: &str) -> Result<ReservedFile, ApiError> {
    tokio::fs::create_dir_all(dir)
        .await
        .map_err(|error| ApiError::transport(error.to_string()))?;

    for counter in 0..10_000 {
        let path = dir.join(candidate_name(file_name, counter));
        match OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&path)
            .await
        {
            Ok(file) => return Ok(ReservedFile { path, file }),
            Err(error) if error.kind() == ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(ApiError::transport(error.to_string())),
        }
    }

    Err(ApiError {
        status: 409,
        code: Some("DOWNLOAD_NAME_CONFLICT".to_string()),
        message: "A safe download name could not be reserved.".to_string(),
    })
}

#[cfg(windows)]
fn mark_downloaded(path: &Path) {
    let mut stream = path.as_os_str().to_os_string();
    stream.push(":Zone.Identifier");
    let _ = std::fs::write(stream, b"[ZoneTransfer]\r\nZoneId=3\r\n");
}

#[cfg(not(windows))]
fn mark_downloaded(_path: &Path) {}

pub async fn write_bytes_to_file(
    reserved: ReservedFile,
    bytes: &[u8],
) -> Result<PathBuf, ApiError> {
    let ReservedFile { path, mut file } = reserved;
    let result = async {
        file.write_all(bytes).await?;
        file.flush().await
    }
    .await;
    drop(file);

    if let Err(error) = result {
        let _ = tokio::fs::remove_file(&path).await;
        return Err(ApiError::transport(error.to_string()));
    }

    mark_downloaded(&path);
    Ok(path)
}

pub async fn stream_response_to_file(
    response: reqwest::Response,
    reserved: ReservedFile,
    limit: u64,
    too_large_message: &str,
) -> Result<PathBuf, ApiError> {
    let ReservedFile { path, mut file } = reserved;
    let result = write_response(response, &mut file, limit, too_large_message).await;
    drop(file);

    if let Err(error) = result {
        let _ = tokio::fs::remove_file(&path).await;
        return Err(error);
    }

    mark_downloaded(&path);
    Ok(path)
}

async fn write_response(
    response: reqwest::Response,
    file: &mut File,
    limit: u64,
    too_large_message: &str,
) -> Result<(), ApiError> {
    let mut bytes_written = 0_u64;
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|error| ApiError::transport(error.to_string()))?;
        bytes_written = bytes_written.saturating_add(chunk.len() as u64);
        if bytes_written > limit {
            return Err(payload_too_large(too_large_message));
        }
        file.write_all(&chunk)
            .await
            .map_err(|error| ApiError::transport(error.to_string()))?;
    }

    file.flush()
        .await
        .map_err(|error| ApiError::transport(error.to_string()))
}

pub async fn read_response_limited(
    response: reqwest::Response,
    limit: u64,
    too_large_message: &str,
) -> Result<Vec<u8>, ApiError> {
    let capacity = response.content_length().unwrap_or(0).min(limit) as usize;
    let mut bytes = Vec::with_capacity(capacity);
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|err| ApiError::transport(err.to_string()))?;
        if bytes.len().saturating_add(chunk.len()) > limit as usize {
            return Err(ApiError {
                status: 413,
                code: Some("PAYLOAD_TOO_LARGE".to_string()),
                message: too_large_message.to_string(),
            });
        }
        bytes.extend_from_slice(&chunk);
    }

    Ok(bytes)
}

fn payload_too_large(message: &str) -> ApiError {
    ApiError {
        status: 413,
        code: Some("PAYLOAD_TOO_LARGE".to_string()),
        message: message.to_string(),
    }
}

fn candidate_name(file_name: &str, counter: usize) -> String {
    if counter == 0 {
        return file_name.to_string();
    }

    let path = Path::new(file_name);
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("download");
    match path.extension().and_then(|value| value.to_str()) {
        Some(extension) => format!("{stem} ({counter}).{extension}"),
        None => format!("{stem} ({counter})"),
    }
}

#[cfg(test)]
mod tests {
    use super::candidate_name;

    #[test]
    fn builds_stable_collision_names() {
        assert_eq!(candidate_name("report.pdf", 0), "report.pdf");
        assert_eq!(candidate_name("report.pdf", 2), "report (2).pdf");
        assert_eq!(candidate_name("README", 1), "README (1)");
    }
}

use std::collections::HashMap;
use std::fs::{Permissions, set_permissions};
use std::io::SeekFrom;
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use std::path::Path;
use std::sync::Arc;

use aes::cipher::{KeyIvInit, StreamCipher};
use download_manager::error::ApplicationDownloadError;
use download_manager::util::download_thread_control_flag::{
    DownloadThreadControl, DownloadThreadControlFlag,
};
use download_manager::util::progress_object::ProgressHandle;
use droplet_types::{ChunkData, FileEntry};
use futures_util::StreamExt as _;
use log::info;
use remote::auth::generate_authorization_header;
use remote::error::{DropServerError, RemoteAccessError};
use remote::utils::DROP_CLIENT_ASYNC;
use sha2::Digest;
use tauri::Url;
use tokio::io::{AsyncReadExt as _, AsyncSeekExt as _, AsyncWriteExt as _};
use tokio_util::io::StreamReader;

const READ_BUF_LEN: usize = 1024 * 1024;

type Aes128Ctr64LE = ctr::Ctr64LE<aes::Aes128>;

#[cfg(unix)]
fn set_file_permissions(
    file: &FileEntry,
    path: &Path,
    file_handle: Option<tokio::fs::File>,
) -> Result<(), ApplicationDownloadError> {
    drop(file_handle);
    let perm = if file.permissions == 0 {
        0o744
    } else {
        file.permissions
    };
    let permissions = Permissions::from_mode(perm);
    set_permissions(path, permissions).map_err(|e| ApplicationDownloadError::IoError(Arc::new(e)))
}

#[cfg(not(unix))]
fn set_file_permissions(
    _file: &FileEntry,
    _path: &Path,
    _file_handle: Option<tokio::fs::File>,
) -> Result<(), ApplicationDownloadError> {
    Ok(())
}

fn is_paused(control_flag: &DownloadThreadControl) -> bool {
    control_flag.get() == DownloadThreadControlFlag::Stop
}

async fn fetch_chunk_response(
    game_id: &str,
    version_id: &str,
    chunk_id: &str,
    depot: &str,
) -> Result<reqwest::Response, ApplicationDownloadError> {
    let header = generate_authorization_header();
    let url = Url::parse(depot)
        .map_err(|v| ApplicationDownloadError::DownloadError(v.into()))?
        .join(&format!("content/{}/{}/{}", game_id, version_id, chunk_id))
        .map_err(|v| ApplicationDownloadError::DownloadError(v.into()))?;

    DROP_CLIENT_ASYNC
        .get(url)
        .header("Authorization", header)
        .send()
        .await
        .map_err(|e| ApplicationDownloadError::Communication(e.into()))
}

async fn handle_non_200_response(
    response: reqwest::Response,
) -> Result<bool, ApplicationDownloadError> {
    info!("chunk request got status code: {}", response.status());
    let raw_res = response.text().await.map_err(|e| {
        ApplicationDownloadError::Communication(RemoteAccessError::FetchErrorLegacy(e.into()))
    })?;
    info!("{raw_res}");
    if let Ok(err) = serde_json::from_str::<DropServerError>(&raw_res) {
        return Err(ApplicationDownloadError::Communication(
            RemoteAccessError::InvalidResponse(err),
        ));
    }
    Err(ApplicationDownloadError::Communication(
        RemoteAccessError::UnparseableResponse(raw_res),
    ))
}

#[allow(clippy::too_many_arguments)]
pub async fn download_game_chunk(
    game_id: &str,
    version_id: &str,
    chunk_id: &str,
    depot: &str,
    key: &[u8; 16],
    chunk_data: &ChunkData,
    file_list: &HashMap<String, String>,
    base_path: &Path,
    control_flag: &DownloadThreadControl,
    // How much we're downloading
    download_progress: &ProgressHandle,
    // How much we're writing to disk
    disk_progress: &ProgressHandle,
) -> Result<bool, ApplicationDownloadError> {
    if is_paused(control_flag) {
        download_progress.set(0);
        disk_progress.set(0);
        return Ok(false);
    }

    let response = fetch_chunk_response(game_id, version_id, chunk_id, depot).await?;

    if response.status() != 200 {
        return handle_non_200_response(response).await;
    }

    if is_paused(control_flag) {
        download_progress.set(0);
        disk_progress.set(0);
        return Ok(false);
    }

    let stream = response
        .bytes_stream()
        .map(|v| v.map_err(std::io::Error::other));
    let mut stream_reader = StreamReader::new(stream);

    let mut hasher = sha2::Sha256::new();
    let mut cipher = Aes128Ctr64LE::new(key.into(), &chunk_data.iv.into());
    let mut read_buf = vec![0u8; READ_BUF_LEN];

    for file in &chunk_data.files {
        let should_write = file_list
            .get(&file.filename)
            .map(|v| v == version_id)
            .unwrap_or(false);
        let path = base_path.join(file.filename.clone());
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let mut file_handle = if should_write {
            let mut fh = tokio::fs::OpenOptions::new()
                .truncate(false)
                .write(true)
                .append(false)
                .create(true)
                .open(&path)
                .await?;
            fh.seek(SeekFrom::Start(file.start.try_into().unwrap()))
                .await?;
            Some(fh)
        } else {
            None
        };

        let mut remaining = file.length;
        while remaining > 0 {
            let amount = stream_reader
                .read(&mut read_buf[0..remaining.min(READ_BUF_LEN)])
                .await?;
            download_progress.add(amount);
            remaining -= amount;

            cipher.apply_keystream(&mut read_buf[0..amount]);
            hasher.update(&read_buf[0..amount]);
            if let Some(fh) = &mut file_handle {
                fh.write_all(&read_buf[0..amount]).await?;
                disk_progress.add(amount);
            }
        }

        set_file_permissions(file, &path, file_handle)?;

        if is_paused(control_flag) {
            download_progress.set(0);
            disk_progress.set(0);
            return Ok(false);
        }
    }

    let digest = hex::encode(hasher.finalize());
    if digest != chunk_data.checksum {
        return Err(ApplicationDownloadError::Checksum);
    }

    Ok(true)
}

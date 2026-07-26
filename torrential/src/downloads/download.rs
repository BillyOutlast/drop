use std::{path::PathBuf, time::Instant};

use droplet_rs::{
    manifest::Manifest,
    versions::{create_backend_constructor, types::VersionBackend},
};
use log::warn;
use reqwest::StatusCode;
use serde_json::Value;

use crate::{
    conversions::convert_protobuf_manifest,
    proto::version::{VersionResponse, version_response::library_source::LibraryBackend},
    server::download::fetch_version_data,
    state::AppState,
    util::ErrorOption,
};

pub struct DownloadContext {
    pub(crate) manifest: Manifest,
    pub(crate) backend: Box<dyn VersionBackend + Send + Sync + 'static>,
    last_access: Instant,
}
impl DownloadContext {
    #[must_use]
    pub fn last_access(&self) -> Instant {
        self.last_access
    }
    pub fn reset_last_access(&mut self) {
        self.last_access = Instant::now();
    }
}

pub async fn create_download_context(
    app_state: &AppState,
    game_id: String,
    version_name: String,
) -> Result<DownloadContext, ErrorOption> {
    let version_data = fetch_version_data(app_state, game_id, version_name.clone()).await?;

    let backend = create_backend(&version_data)?;

    let download_context = DownloadContext {
        manifest: convert_protobuf_manifest(version_data.manifest.unwrap()),
        backend,
        last_access: Instant::now(),
    };

    Ok(download_context)
}

/// Creates a version backend using the filesystem location specified by the version data.
///
/// Returns an internal server error when the backend configuration is invalid, the version
/// path does not exist, or the backend cannot be constructed.
///
/// # Examples
///
/// ```no_run
/// # let version_data: &VersionResponse = todo!();
/// let backend = create_backend(version_data)?;
/// # Ok::<(), StatusCode>(())
/// ```
///
/// # Errors
///
/// Returns `StatusCode::INTERNAL_SERVER_ERROR` when the backend configuration, version path,
/// or backend construction is invalid.
fn create_backend(
    version_data: &VersionResponse,
) -> Result<Box<dyn VersionBackend + Send + Sync>, StatusCode> {
    let base_path = serde_json::from_str::<Value>(&version_data.source.options)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let base_path = base_path
        .get("baseDir")
        .and_then(|v| v.as_str())
        .ok_or(StatusCode::INTERNAL_SERVER_ERROR)?;

    let version_path = PathBuf::from(base_path);
    let version_path = version_path.join(version_data.library_path.clone());
    let backend_type = version_data.source.backend.ok_or_else(|| {
        warn!("version_data.source.backend is None");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    let version_path = match backend_type {
        LibraryBackend::FILESYSTEM => version_path.join(version_data.version_path.clone()),
        LibraryBackend::FLAT_FILESYSTEM => version_path,
    };

    if !version_path.exists() {
        warn!("{} path doesn't exist for version", version_path.display());
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    let backend =
        create_backend_constructor(&version_path).ok_or(StatusCode::INTERNAL_SERVER_ERROR)?;

    let backend = backend()
        .inspect_err(|err| warn!("failed to create version backend: {err:?}"))
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(backend)
}

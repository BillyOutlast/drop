use std::{
    fs::{self, File},
    io::Read,
    path::Path,
    sync::LazyLock,
    time::Duration,
};

use client::{app_state::AppState, app_status::AppStatus};
use database::db::DATA_ROOT_DIR;
use http::Extensions;
use log::{debug, info, warn};
use reqwest::Certificate;
use reqwest_middleware::{
    ClientBuilder, ClientWithMiddleware, Error, Middleware, Next, Result,
    reqwest::{Request, Response},
};
use serde::Deserialize;
use tauri::{AppHandle, Emitter, Manager, async_runtime::Mutex};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DropHealthcheck {
    app_name: String,
}
impl DropHealthcheck {
    pub fn app_name(&self) -> &String {
        &self.app_name
    }
}
static DROP_CERT_BUNDLE: LazyLock<Vec<Certificate>> = LazyLock::new(fetch_certificates);
pub static DROP_CLIENT_SYNC: LazyLock<reqwest::blocking::Client> = LazyLock::new(get_client_sync);
pub static DROP_CLIENT_ASYNC: LazyLock<ClientWithMiddleware> = LazyLock::new(get_client_async);
pub static DROP_CLIENT_WS_CLIENT: LazyLock<reqwest::Client> = LazyLock::new(get_client_ws);

pub static DROP_APP_HANDLE: LazyLock<Mutex<Option<AppHandle>>> = LazyLock::new(|| Mutex::new(None));

struct AutoOfflineMiddleware;

async fn transition_online(app_handle: &tauri::AppHandle, url: &url::Url) {
    let state = app_handle.state::<std::sync::nonpoison::Mutex<AppState>>();
    let state_lock = state.try_lock();
    if let Ok(mut state_lock) = state_lock {
        if state_lock.status == AppStatus::Offline {
            state_lock.status = AppStatus::SignedIn;
            app_handle
                .emit("update_state", &*state_lock)
                .expect("failed to emit state update");
        }
    } else {
        warn!("failed to lock app state - {}", url.as_str());
    }
}

async fn transition_offline(app_handle: &tauri::AppHandle) {
    let state = app_handle.state::<std::sync::nonpoison::Mutex<AppState>>();
    let mut state_lock = state.lock();
    state_lock.status = AppStatus::Offline;
    app_handle
        .emit("update_state", &*state_lock)
        .expect("failed to emit state update");
}

#[async_trait::async_trait]
impl Middleware for AutoOfflineMiddleware {
    async fn handle(
        &self,
        req: Request,
        extensions: &mut Extensions,
        next: Next<'_>,
    ) -> Result<Response> {
        let url = req.url().clone();
        let res = next.run(req, extensions).await;
        match res {
            Ok(res) => {
                tauri::async_runtime::spawn(async move {
                    let handle = DROP_APP_HANDLE.lock().await;
                    if let Some(app_handle) = &*handle {
                        transition_online(app_handle, &url).await;
                    }
                });
                Ok(res)
            }
            Err(err) => {
                if let Error::Reqwest(ref error) = err {
                    if error.is_connect() {
                        tauri::async_runtime::spawn(async move {
                            let handle = DROP_APP_HANDLE.lock().await;
                            if let Some(app_handle) = &*handle {
                                transition_offline(app_handle).await;
                            }
                        });
                    }
                }
                Err(err)
            }
        }
    }
}

fn process_cert_file(path: &Path, certs: &mut Vec<Certificate>) {
    let mut buf = Vec::new();
    let mut file = match File::open(path) {
        Ok(f) => f,
        Err(e) => {
            warn!("Failed to open file at {} with error {}", path.display(), e);
            return;
        }
    };
    file.read_to_end(&mut buf).unwrap_or_else(|e| {
        panic!(
            "Failed to read to end of certificate file {} with error {}",
            path.display(),
            e
        )
    });

    match Certificate::from_pem_bundle(&buf) {
        Ok(certificates) => {
            let count_before = certs.len();
            certs.extend(certificates);
            info!(
                "added {} certificate(s) from {}",
                certs.len() - count_before,
                path.file_name().unwrap().to_string_lossy()
            );
        }
        Err(e) => warn!(
            "Invalid certificate file {} with error {}",
            path.display(),
            e
        ),
    }
}

fn fetch_certificates() -> Vec<Certificate> {
    let certificate_dir = DATA_ROOT_DIR.join("certificates");
    let mut certs = Vec::new();

    let dir = match fs::read_dir(certificate_dir) {
        Ok(d) => d,
        Err(e) => {
            debug!("not loading certificates due to error: {e}");
            return certs;
        }
    };

    for entry in dir {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        process_cert_file(&entry.path(), &mut certs);
    }

    certs
}

pub fn get_client_sync() -> reqwest::blocking::Client {
    let mut client = reqwest::blocking::ClientBuilder::new();

    for cert in DROP_CERT_BUNDLE.iter() {
        client = client.add_root_certificate(cert.clone());
    }
    client
        .use_rustls_tls()
        .user_agent("Drop Desktop Client")
        .connect_timeout(Duration::from_millis(1500))
        .build()
        .expect("Failed to build synchronous client")
}
pub fn get_client_async() -> ClientWithMiddleware {
    let mut client = reqwest::ClientBuilder::new();

    for cert in DROP_CERT_BUNDLE.iter() {
        client = client.add_root_certificate(cert.clone());
    }
    let normal_client = client
        .use_rustls_tls()
        .user_agent("Drop Desktop Client")
        .build()
        .expect("Failed to build asynchronous client");

    ClientBuilder::new(normal_client)
        .with(AutoOfflineMiddleware)
        .build()
}
pub fn get_client_ws() -> reqwest::Client {
    let mut client = reqwest::ClientBuilder::new();

    for cert in DROP_CERT_BUNDLE.iter() {
        client = client.add_root_certificate(cert.clone());
    }
    client
        .use_rustls_tls()
        .user_agent("Drop Desktop Client")
        .http1_only()
        .build()
        .expect("Failed to build websocket client")
}

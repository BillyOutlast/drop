use std::{
    path::PathBuf,
    sync::{Arc, LazyLock},
};

use rand::RngCore;

use crate::interface::DatabaseInterface;

pub static DB: LazyLock<DatabaseInterface> = LazyLock::new(DatabaseInterface::set_up_database);

#[cfg(not(debug_assertions))]
static DATA_ROOT_PREFIX: &str = "drop";
#[cfg(debug_assertions)]
static DATA_ROOT_PREFIX: &str = "drop-debug";

pub static DATA_ROOT_DIR: LazyLock<Arc<PathBuf>> = LazyLock::new(|| {
    Arc::new(
        dirs::data_dir()
            .expect("Failed to get data dir")
            .join(DATA_ROOT_PREFIX),
    )
});

/// AES-256 encryption key from OS keyring.
/// In test builds, uses a deterministic non-zero key (no system keyring needed).
#[cfg(not(test))]
fn encryption_key_impl() -> [u8; 32] {
    let entry = match keyring::Entry::new("drop", "database_key") {
        Ok(e) => e,
        Err(err) => {
            log::warn!("failed to open keyring: {err}, using ephemeral key");
            let mut key = [0u8; 32];
            rand::rng().fill_bytes(&mut key);
            return key;
        }
    };
    let secret: Vec<u8> = entry.get_secret().unwrap_or_else(|_| {
        let mut buffer = [0u8; 32];
        rand::rng().fill_bytes(&mut buffer);
        entry.set_secret(&buffer).expect("failed to save key");
        log::info!("created new database key");
        buffer.to_vec()
    });
    let mut key = [0u8; 32];
    key.copy_from_slice(&secret);
    key
}

#[cfg(test)]
fn encryption_key_impl() -> [u8; 32] {
    // Deterministic test key (non-zero, no keyring dependency)
    std::env::var("DATABASE_TEST_KEY")
        .ok()
        .and_then(|hex| {
            let bytes = hex.as_bytes();
            if bytes.len() != 64 {
                panic!(
                    "DATABASE_TEST_KEY must be 64 hex characters, got {}: {hex}",
                    bytes.len()
                )
            }
            let mut key = [0u8; 32];
            for i in 0..32 {
                let hi = decode_hex_nibble(bytes[2 * i]).unwrap_or_else(|| {
                    panic!(
                        "invalid hex character at position {} in DATABASE_TEST_KEY",
                        2 * i
                    )
                });
                let lo = decode_hex_nibble(bytes[2 * i + 1]).unwrap_or_else(|| {
                    panic!(
                        "invalid hex character at position {} in DATABASE_TEST_KEY",
                        2 * i + 1
                    )
                });
                key[i] = (hi << 4) | lo;
            }
            Some(key)
        })
        .unwrap_or([0xAB; 32])
}

#[cfg(test)]
fn decode_hex_nibble(b: u8) -> Option<u8> {
    match b {
        b'0'..=b'9' => Some(b - b'0'),
        b'a'..=b'f' => Some(b - b'a' + 10),
        b'A'..=b'F' => Some(b - b'A' + 10),
        _ => None,
    }
}

pub(crate) static ENCRYPTION_KEY: LazyLock<[u8; 32]> = LazyLock::new(encryption_key_impl);

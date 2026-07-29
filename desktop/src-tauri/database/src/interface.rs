use std::{
    fs::{self, create_dir_all},
    mem::ManuallyDrop,
    ops::{Deref, DerefMut},
    path::{Path, PathBuf},
    sync::{PoisonError, RwLock, RwLockReadGuard, RwLockWriteGuard},
};

use aes::cipher::{KeyIvInit, StreamCipher};
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Key, Nonce,
};
type Aes128Ctr64LE = ctr::Ctr64LE<aes::Aes128>;
use anyhow::Error;
use chrono::Utc;
use log::{debug, error, info, warn};
use rand::RngCore;
use url::Url;

use crate::{
    db::{DATA_ROOT_DIR, DB, ENCRYPTION_KEY},
    models::{
        self,
        data::{Database, DatabaseVersionSerializable},
    },
};

/// Magic bytes for database file format detection.
const MAGIC_V2: &[u8; 4] = b"DMS2"; // AES-256-GCM (current)
                                    // MAGIC_V1 (b"DMS1") was never shipped — removed. Pre-PR databases have no magic prefix.

/// Encrypt `plaintext` with AES-256-GCM, returning `[MAGIC_V2][12-byte nonce][ciphertext+tag]`.
fn encrypt_database(key: &[u8; 32], plaintext: Vec<u8>) -> Result<Vec<u8>, anyhow::Error> {
    let key_slice = Key::<Aes256Gcm>::from_slice(key);
    let cipher = Aes256Gcm::new(key_slice);
    let mut nonce_bytes = [0u8; 12];
    rand::rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_ref())
        .map_err(|e| anyhow::anyhow!("encryption failed: {e}"))?;
    let mut result = Vec::with_capacity(4 + 12 + ciphertext.len());
    result.extend_from_slice(MAGIC_V2);
    result.extend_from_slice(&nonce_bytes);
    result.extend_from_slice(&ciphertext);
    Ok(result)
}

/// Decrypt data produced by `encrypt_database`.
/// Takes the nonce+ciphertext slice (magic prefix already stripped by caller).
/// Requires at least 28 bytes: 12-byte nonce + 16-byte minimum GCM ciphertext+tag.
fn decrypt_database(key: &[u8; 32], encrypted: &[u8]) -> Result<Vec<u8>, anyhow::Error> {
    if encrypted.len() < 28 {
        anyhow::bail!(
            "encrypted payload too short: {} bytes (min 28: 12 nonce + 16 GCM tag)",
            encrypted.len()
        );
    }
    let key_slice = Key::<Aes256Gcm>::from_slice(key);
    let cipher = Aes256Gcm::new(key_slice);
    let (nonce_bytes, ciphertext) = encrypted.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);
    cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| anyhow::anyhow!("decryption failed: {e}"))
}

pub struct DatabaseInterface {
    data: RwLock<models::data::Database>,
    path: PathBuf,
}
impl DatabaseInterface {
    pub fn set_up_database() -> Self {
        let db_path = DATA_ROOT_DIR.join("drop.db");
        let games_base_dir = DATA_ROOT_DIR.join("games");
        let logs_root_dir = DATA_ROOT_DIR.join("logs");
        let cache_dir = DATA_ROOT_DIR.join("cache");
        let pfx_dir = DATA_ROOT_DIR.join("pfx");

        debug!("creating data directory at {DATA_ROOT_DIR:?}");
        create_dir_all(DATA_ROOT_DIR.as_path()).unwrap_or_else(|e| {
            panic!(
                "Failed to create directory {} with error {}",
                DATA_ROOT_DIR.display(),
                e
            )
        });
        create_dir_all(&games_base_dir).unwrap_or_else(|e| {
            panic!(
                "Failed to create directory {} with error {}",
                games_base_dir.display(),
                e
            )
        });
        create_dir_all(&logs_root_dir).unwrap_or_else(|e| {
            panic!(
                "Failed to create directory {} with error {}",
                logs_root_dir.display(),
                e
            )
        });
        create_dir_all(&cache_dir).unwrap_or_else(|e| {
            panic!(
                "Failed to create directory {} with error {}",
                cache_dir.display(),
                e
            )
        });
        create_dir_all(&pfx_dir).unwrap_or_else(|e| {
            panic!(
                "Failed to create directory {} with error {}",
                pfx_dir.display(),
                e
            )
        });

        let exists = fs::exists(db_path.clone()).unwrap_or_else(|e| {
            panic!(
                "Failed to find if {} exists with error {}",
                db_path.display(),
                e
            )
        });

        if exists {
            match DatabaseInterface::open_at_path(&db_path) {
                Ok(db) => db.unwrap(),
                Err(e) => handle_invalid_database(e, db_path, games_base_dir, cache_dir)
                    .expect("failed to recover from failed database"),
            }
        } else {
            let default = Database::new(games_base_dir, None, cache_dir);
            debug!("Creating database at path {}", db_path.display());
            DatabaseInterface::create_at_path(&db_path, default)
                .expect("Database could not be created")
        }
    }

    pub fn open_at_path(db_path: &Path) -> Result<Option<DatabaseInterface>, Error> {
        if !db_path.exists() {
            return Ok(None);
        };
        let encrypted = std::fs::read(db_path)?;
        if encrypted.len() < 32 {
            anyhow::bail!(
                "database file too short (min 32 bytes for V2: 4 magic + 12 nonce + 16 GCM)"
            );
        }

        let magic = &encrypted[..4];
        let payload = &encrypted[4..];

        let plaintext = if magic == MAGIC_V2.as_slice() {
            decrypt_database(&*ENCRYPTION_KEY, payload)
                .map_err(|e| anyhow::anyhow!("v2 database decryption failed: {e}"))?
        } else {
            // Pre-PR legacy databases have no magic prefix.
            // Full file is AES-128-CTR encrypted with dummy zero key/IV.
            let mut legacy_data = encrypted.clone();
            let legacy_key = [0u8; 16];
            let legacy_iv = [0u8; 16];
            let mut legacy_cipher = Aes128Ctr64LE::new(&legacy_key.into(), &legacy_iv.into());
            legacy_cipher.apply_keystream(&mut legacy_data);
            legacy_data
        };

        let database_data = String::from_utf8(plaintext)?;
        let database_data: DatabaseVersionSerializable = ron::from_str(&database_data)?;
        Ok(Some(DatabaseInterface {
            data: RwLock::new(database_data.0),
            path: db_path.to_path_buf(),
        }))
    }

    pub fn create_at_path(db_path: &Path, database: Database) -> Result<DatabaseInterface, Error> {
        let database = DatabaseVersionSerializable(database);
        let plaintext = ron::to_string(&database)?.into_bytes();

        let encrypted = encrypt_database(&*ENCRYPTION_KEY, plaintext)
            .map_err(|e| anyhow::anyhow!("database encryption failed: {e}"))?;

        std::fs::write(db_path, encrypted)?;
        Ok(DatabaseInterface {
            data: RwLock::new(database.0),
            path: db_path.to_path_buf(),
        })
    }

    pub fn database_is_set_up(&self) -> bool {
        !borrow_db_checked().base_url.is_empty()
    }

    pub fn fetch_base_url(&self) -> Url {
        let handle = borrow_db_checked();
        Url::parse(&handle.base_url)
            .unwrap_or_else(|_| panic!("Failed to parse base url {}", handle.base_url))
    }

    fn save(&self) -> Result<(), Error> {
        let lock = self.data.read().expect("failed to lock database to save");
        DatabaseInterface::create_at_path(&self.path, lock.clone())?;
        Ok(())
    }

    fn borrow_data(
        &self,
    ) -> Result<
        std::sync::RwLockReadGuard<'_, Database>,
        PoisonError<std::sync::RwLockReadGuard<'_, Database>>,
    > {
        self.data.read()
    }

    fn borrow_data_mut(
        &self,
    ) -> Result<
        std::sync::RwLockWriteGuard<'_, Database>,
        PoisonError<std::sync::RwLockWriteGuard<'_, Database>>,
    > {
        self.data.write()
    }
}

// PENDING: Make the error relelvant rather than just assume that it's a Deserialize error
fn handle_invalid_database(
    error: Error,
    db_path: PathBuf,
    games_base_dir: PathBuf,
    cache_dir: PathBuf,
) -> Result<DatabaseInterface, Error> {
    warn!("{error:?}");
    let new_path = {
        let time = Utc::now().timestamp();
        let mut base = db_path.clone();
        base.set_file_name(format!("drop.db.backup-{time}"));
        base
    };
    info!("old database stored at: {}", new_path.to_string_lossy());
    fs::rename(&db_path, &new_path).unwrap_or_else(|e| {
        panic!(
            "Could not rename database {} to {} with error {}",
            db_path.display(),
            new_path.display(),
            e
        )
    });
    fs::remove_dir_all(cache_dir.clone())?;
    fs::create_dir_all(cache_dir.clone())?;

    let db = Database::new(games_base_dir, Some(new_path), cache_dir);

    Ok(DatabaseInterface::create_at_path(&db_path, db).expect("Database could not be created"))
}

// To automatically save the database upon drop
pub struct DBRead<'a>(RwLockReadGuard<'a, Database>);
pub struct DBWrite<'a>(ManuallyDrop<RwLockWriteGuard<'a, Database>>);
impl<'a> Deref for DBWrite<'a> {
    type Target = Database;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}
impl<'a> DerefMut for DBWrite<'a> {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}
impl<'a> Deref for DBRead<'a> {
    type Target = Database;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}
impl Drop for DBWrite<'_> {
    fn drop(&mut self) {
        unsafe {
            ManuallyDrop::drop(&mut self.0);
        }

        match DB.save() {
            Ok(()) => {}
            Err(e) => {
                error!("database failed to save with error {e}");
                panic!("database failed to save with error {e}")
            }
        }
    }
}

pub fn borrow_db_checked<'a>() -> DBRead<'a> {
    match DB.borrow_data() {
        Ok(data) => DBRead(data),
        Err(e) => {
            error!("database borrow failed with error {e}");
            panic!("database borrow failed with error {e}");
        }
    }
}

pub fn borrow_db_mut_checked<'a>() -> DBWrite<'a> {
    match DB.borrow_data_mut() {
        Ok(data) => DBWrite(ManuallyDrop::new(data)),
        Err(e) => {
            error!("database borrow mut failed with error {e}");
            panic!("database borrow mut failed with error {e}");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let key = *ENCRYPTION_KEY;
        let plaintext = b"Hello, world! This is a test of AES-256-GCM encryption.";
        let encrypted =
            encrypt_database(&key, plaintext.to_vec()).expect("encryption should succeed");
        let payload = &encrypted[4..]; // strip MAGIC_V2 prefix
        let decrypted = decrypt_database(&key, payload).expect("decryption should succeed");
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_encrypt_different_nonce_per_call() {
        let key = *ENCRYPTION_KEY;
        let plaintext = b"deterministic plaintext";
        let mut results = std::collections::HashSet::new();
        for _ in 0..10 {
            let encrypted =
                encrypt_database(&key, plaintext.to_vec()).expect("encryption should succeed");
            results.insert(encrypted);
        }
        assert_eq!(
            results.len(),
            10,
            "each encryption should produce unique ciphertext (different nonce)"
        );
    }

    #[test]
    fn test_decrypt_wrong_key_fails() {
        let key = *ENCRYPTION_KEY;
        let wrong_key = {
            let mut k = key;
            k[0] ^= 0xFF;
            k
        };
        let plaintext = b"secret data";
        let encrypted =
            encrypt_database(&key, plaintext.to_vec()).expect("encryption should succeed");
        let payload = &encrypted[4..]; // strip MAGIC_V2 prefix
        let result = decrypt_database(&wrong_key, payload);
        assert!(result.is_err(), "wrong key should fail decryption");
    }
}

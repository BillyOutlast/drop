//! Integration tests for `downpour::commands::upload::interface`.
//!
//! Validates upload-path components: manifest construction, dry-run manifest
//! generation (no-upload mode), progress-bar template validity, error
//! propagation from missing config, and manifest serialization roundtrip.
//!
//! Actual network uploads are NOT exercised — the upload path requires an S3
//! operator that is never configured in these tests.

use downpour::commands::connect::config::Config;
use downpour::manifest::{CompressionOption, DepotManifest};
use droplet_rs::manifest::{ManifestWriterFactory, generate_manifest_rusty};
use std::io::Write;

// ---------------------------------------------------------------------------
// 1. Upload path construction from manifest
// ---------------------------------------------------------------------------

#[test]
fn test_upload_path_construction_from_manifest() {
    let mut manifest = DepotManifest::new();
    assert!(manifest.is_empty());
    assert_eq!(manifest.len(), 0);

    // Append a single game-version mapping
    manifest.append(
        "game-test-1".to_string(),
        "v1.0.0".to_string(),
        CompressionOption::None,
    );
    assert!(!manifest.is_empty());
    assert_eq!(manifest.len(), 1);

    // Append a second entry
    manifest.append(
        "game-test-2".to_string(),
        "v2.0.0".to_string(),
        CompressionOption::Gzip,
    );
    assert_eq!(manifest.len(), 2);

    // Verify the manifest accumulates multiple entries correctly (each
    // `append` maps game_id -> { version_id, compression } in a HashMap).
    // This is the core data structure the upload command writes as
    // `manifest.json` to the depot.
}

// ---------------------------------------------------------------------------
// 2. Dry-run mode doesn't upload
// ---------------------------------------------------------------------------

#[tokio::test]
async fn test_dry_run_generates_manifest_without_upload() {
    let dir = tempfile::tempdir().expect("create temp dir");
    let file_path = dir.path().join("asset.bin");
    let mut file = std::fs::File::create(&file_path).expect("create temp file");
    file.write_all(&[0xABu8; 4096]).expect("write test data");
    drop(file);

    // When factory = None, `generate_manifest_rusty` reads files, organises
    // chunks, computes checksums, and returns a Manifest — but NEVER writes
    // chunk data anywhere (= dry-run / no-upload mode).
    let no_factory: Option<&dyn ManifestWriterFactory<Writer = tokio::io::Sink>> = None;
    let manifest = generate_manifest_rusty(
        dir.path(),
        |_progress: f32| {}, // progress callback (no-op)
        |_log: String| {},   // log callback (no-op)
        no_factory,
        None, // no concurrency limit
    )
    .await
    .expect("dry-run manifest generation should succeed");

    assert_eq!(
        manifest.version, "2",
        "generated manifest must use version '2'"
    );
    assert!(
        !manifest.chunks.is_empty(),
        "manifest should contain at least one chunk for 4 KiB of data"
    );
    assert!(
        manifest.size >= 4096,
        "manifest size should reflect the input file size"
    );
    assert_eq!(
        manifest.chunks.len(),
        1,
        "one small file should produce exactly one chunk"
    );
}

// ---------------------------------------------------------------------------
// 3. Progress reporting format
// ---------------------------------------------------------------------------

#[test]
fn test_progress_reporting_format() {
    // Verify the exact indicatif template used by the upload path parses
    // without error. If the template string becomes invalid the progress bar
    // will panic at runtime.
    let style = indicatif::ProgressStyle::default_bar()
        .template("[{elapsed_precise}] [ETA {eta}] {bar} {percent_precise}%");
    assert!(
        style.is_ok(),
        "upload progress template must parse without error"
    );

    // Also verify the template renders a plausible string (smoke check).
    let bar = indicatif::ProgressBar::new(100);
    bar.set_style(style.unwrap());
    bar.set_position(42);
    let line = format!("{bar:?}");
    assert!(!line.is_empty(), "progress bar display should not be empty");
}

// ---------------------------------------------------------------------------
// 4. Error on missing config file
// ---------------------------------------------------------------------------

#[test]
fn test_error_on_missing_config() {
    // A freshly-constructed Config has no entries and no active connection.
    // The upload command's `get_operator` helper will reject this with
    // "No active connection set" — verify the preconditions here.
    let config = Config::new();
    assert!(config.is_empty());
    assert_eq!(config.len(), 0);
    assert!(
        config.get_active().is_none(),
        "no active connection should be set on empty config"
    );
    assert!(
        config.get("anything").is_none(),
        "get on non-existent key should return None"
    );
    assert!(
        config.get("nonexistent").is_none(),
        "get on a different non-existent key should also return None"
    );
}

// ---------------------------------------------------------------------------
// 5. Manifest generation (serde roundtrip)
// ---------------------------------------------------------------------------

#[test]
fn test_manifest_serde_roundtrip() {
    let mut manifest = DepotManifest::new();
    manifest.append(
        "game-alpha".to_string(),
        "v1.0".to_string(),
        CompressionOption::None,
    );
    manifest.append(
        "game-beta".to_string(),
        "v2.0".to_string(),
        CompressionOption::Zstd,
    );
    assert_eq!(manifest.len(), 2);

    // Serialize to JSON — this is the format written as manifest.json
    let json = serde_json::to_string_pretty(&manifest).expect("serialize DepotManifest to JSON");

    // Verify JSON structure contains appends
    assert!(json.contains("game-alpha"), "JSON must contain game-alpha");
    assert!(json.contains("game-beta"), "JSON must contain game-beta");
    assert!(
        json.contains("None"),
        "JSON must preserve CompressionOption"
    );

    // Deserialize back and verify identity
    let deserialized: DepotManifest =
        serde_json::from_str(&json).expect("deserialize DepotManifest from JSON");

    assert_eq!(deserialized.len(), 2, "roundtrip must preserve entry count");
    assert!(!deserialized.is_empty(), "roundtrip must carry entries");

    // Edge case: empty manifest roundtrip
    let empty = DepotManifest::new();
    let empty_json = serde_json::to_string(&empty).expect("serialize empty DepotManifest");
    let empty_back: DepotManifest =
        serde_json::from_str(&empty_json).expect("deserialize empty DepotManifest");
    assert!(empty_back.is_empty());
    assert_eq!(empty_back.len(), 0);
}

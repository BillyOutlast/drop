//! Integration tests for `downpour::commands::connect::config::Config`.
//!
//! Smoke tests for the public API exposed via `lib.rs`. These tests verify
//! the constructor and accessor behavior WITHOUT calling `add_item`, which
//! persists to `dirs::config_dir()` (filesystem side-effect). End-to-end
//! persistence tests belong in `cli/tests/` with a temp HOME override.

use clap::Parser;
use downpour::commands::connect::config::Config;

#[test]
fn test_config_new_is_empty() {
    let config = Config::new();
    assert!(config.is_empty());
    assert_eq!(config.len(), 0);
    assert!(config.get_active().is_none());
}

#[test]
fn test_config_get_nonexistent_returns_none() {
    let config = Config::new();
    assert!(config.get("nonexistent").is_none());
    assert!(!config.exists(&"nonexistent".to_string()));
}

#[test]
fn test_config_new_has_no_active() {
    let config = Config::new();
    assert!(config.get_active().is_none());
}

#[test]
fn test_config_serde_roundtrip_empty() {
    let config = Config::new();

    let json = serde_json::to_string(&config).expect("serialize empty config");
    let deserialized: Config = serde_json::from_str(&json).expect("deserialize empty config");

    assert!(deserialized.is_empty());
    assert!(deserialized.get_active().is_none());
    assert!(deserialized.get("anything").is_none());
}

#[test]
fn test_manage_configuration_connect_path_is_reachable() {
    use downpour::cli::Cli;
    use downpour::commands::connect::config::manage_configuration;

    // S3ConfigCli fields are positional (no short/long attributes).
    let cli = Cli::parse_from([
        "downpour",
        "connect",
        "--name",
        "test-conn",
        "s3",
        "test-key",
        "test-secret",
        "https://test.example.com",
        "us-east-1",
        "test-bucket",
    ]);

    let (name, option) = match cli.command {
        downpour::cli::Commands::Connect { name, option } => (name, option),
        _ => panic!("expected Connect command"),
    };

    let rt = tokio::runtime::Runtime::new().unwrap();
    rt.block_on(async {
        let mut config = downpour::commands::connect::config::Config::new();
        // Exercises the Commands::Connect branch that main.rs dispatches to.
        // May error (no real S3 endpoint), but should NOT panic.
        let result = manage_configuration(&mut config, name, option).await;
        let _ = result;
    });
}

use client::app_state::{AppState, UmuState};
use client::app_status::AppStatus;
use client::{autostart, compat};

// ---------------------------------------------------------------------------
// 1. Module structure — verify all public exports compile and are accessible
// ---------------------------------------------------------------------------
#[test]
fn test_module_structure_modules_exist() {
    // Compile-time type checks: all public symbols resolve
    fn _check_autostart_fn() {
        let _f: fn(&tauri::AppHandle) -> Result<(), String> = autostart::sync_autostart_on_startup;
        let _ = _f;
    }
    fn _check_compat_statics() {
        let _c: &std::sync::LazyLock<Option<compat::CompatInfo>> = &compat::COMPAT_INFO;
        let _u: &std::sync::LazyLock<Option<std::path::PathBuf>> = &compat::UMU_LAUNCHER_EXECUTABLE;
        let _ = (_c, _u);
    }
}

#[test]
fn test_module_structure_umu_state_exhaustive() {
    // All 4 UmuState variants constructible
    let _ = UmuState::NotNeeded;
    let _ = UmuState::NotInstalled;
    let _ = UmuState::NoDefault;
    let _ = UmuState::Installed;
}

#[test]
fn test_module_structure_app_status_exhaustive() {
    // All 7 AppStatus variants constructible
    let _ = AppStatus::NotConfigured;
    let _ = AppStatus::Offline;
    let _ = AppStatus::ServerError;
    let _ = AppStatus::SignedOut;
    let _ = AppStatus::SignedIn;
    let _ = AppStatus::SignedInNeedsReauth;
    let _ = AppStatus::ServerUnavailable;
}

#[test]
fn test_module_structure_clone_derived() {
    // Clone trait is implemented for all value types
    let status = AppStatus::SignedIn;
    let _cloned = status.clone();
    let umu = UmuState::Installed;
    let _cloned = umu.clone();
    let state = AppState {
        status: AppStatus::Offline,
        user: None,
        umu_state: UmuState::NotNeeded,
    };
    let _cloned = state.clone();
}

// ---------------------------------------------------------------------------
// 2. AppState initialization and field access
// ---------------------------------------------------------------------------
#[test]
fn test_app_state_construct_default() {
    let state = AppState {
        status: AppStatus::NotConfigured,
        user: None,
        umu_state: UmuState::NotNeeded,
    };
    // Pattern-match to verify field values (avoids Debug requirement)
    assert!(matches!(
        state,
        AppState {
            status: AppStatus::NotConfigured,
            user: None,
            umu_state: UmuState::NotNeeded,
        }
    ));
}

#[test]
fn test_app_state_different_statuses() {
    let statuses = [
        AppStatus::NotConfigured,
        AppStatus::Offline,
        AppStatus::ServerError,
        AppStatus::SignedOut,
        AppStatus::SignedIn,
        AppStatus::SignedInNeedsReauth,
        AppStatus::ServerUnavailable,
    ];
    for s in &statuses {
        let state = AppState {
            status: *s,
            user: None,
            umu_state: UmuState::NotNeeded,
        };
        // PartialEq on AppStatus lets us compare; pattern-match AppState
        assert!(state.status == *s);
        assert!(state.umu_state == UmuState::NotNeeded);
    }
}

#[test]
fn test_app_state_all_umu_states() {
    let umus = [
        UmuState::NotNeeded,
        UmuState::NotInstalled,
        UmuState::NoDefault,
        UmuState::Installed,
    ];
    for u in &umus {
        let state = AppState {
            status: AppStatus::Offline,
            user: None,
            umu_state: u.clone(),
        };
        assert!(state.umu_state == *u);
    }
}

#[test]
fn test_app_state_field_update_via_struct_update() {
    let base = AppState {
        status: AppStatus::SignedIn,
        user: None,
        umu_state: UmuState::Installed,
    };
    let modified = AppState {
        status: AppStatus::Offline,
        ..base.clone()
    };
    assert!(modified.status == AppStatus::Offline);
    // user and umu_state preserved from base
    assert!(modified.user.is_none());
    assert!(modified.umu_state == UmuState::Installed);
}

// ---------------------------------------------------------------------------
// 3. AppStatus — variant equality, matching, discrimination
// ---------------------------------------------------------------------------
#[test]
fn test_app_status_variants_distinct() {
    // Each pair of different variants is not equal
    assert!(AppStatus::NotConfigured != AppStatus::Offline);
    assert!(AppStatus::Offline != AppStatus::ServerError);
    assert!(AppStatus::ServerError != AppStatus::SignedOut);
    assert!(AppStatus::SignedOut != AppStatus::SignedIn);
    assert!(AppStatus::SignedIn != AppStatus::SignedInNeedsReauth);
    assert!(AppStatus::SignedInNeedsReauth != AppStatus::ServerUnavailable);
    assert!(AppStatus::NotConfigured != AppStatus::SignedIn);
    assert!(AppStatus::Offline != AppStatus::SignedInNeedsReauth);
    assert!(AppStatus::ServerUnavailable != AppStatus::NotConfigured);
}

#[test]
fn test_app_status_same_variant_equal() {
    let a = AppStatus::SignedIn;
    let b = AppStatus::SignedIn;
    assert!(a == b);
    assert!(!(a != b));
}

#[test]
fn test_app_status_copy_semantics() {
    // AppStatus derives Copy, so both values live after move
    let a = AppStatus::SignedIn;
    let b = a; // Copy, not move
    assert!(a == b);
}

#[test]
fn test_app_status_match_discrimination() {
    fn classify(s: AppStatus) -> &'static str {
        match s {
            AppStatus::NotConfigured => "setup",
            AppStatus::Offline => "offline",
            AppStatus::ServerError => "error",
            AppStatus::SignedOut => "out",
            AppStatus::SignedIn => "in",
            AppStatus::SignedInNeedsReauth => "reauth",
            AppStatus::ServerUnavailable => "unavail",
        }
    }
    assert!(classify(AppStatus::NotConfigured) == "setup");
    assert!(classify(AppStatus::Offline) == "offline");
    assert!(classify(AppStatus::ServerError) == "error");
    assert!(classify(AppStatus::SignedOut) == "out");
    assert!(classify(AppStatus::SignedIn) == "in");
    assert!(classify(AppStatus::SignedInNeedsReauth) == "reauth");
    assert!(classify(AppStatus::ServerUnavailable) == "unavail");
}

#[test]
fn test_app_status_signed_in_vs_reauth() {
    // Semantically distinct variants
    assert!(AppStatus::SignedIn != AppStatus::SignedInNeedsReauth);
}

// ---------------------------------------------------------------------------
// 4. Autostart — module accessibility and logic verification
// ---------------------------------------------------------------------------
#[test]
fn test_autostart_function_resolves() {
    // sync_autostart_on_startup is pub fn with expected signature
    fn _verify_signature() {
        let _f: fn(&tauri::AppHandle) -> Result<(), String> = autostart::sync_autostart_on_startup;
    }
}

#[test]
fn test_autostart_module_accessible() {
    // Module-level items compile in test config
    let _ = autostart::sync_autostart_on_startup;
}

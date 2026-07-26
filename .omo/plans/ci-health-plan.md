# Plan: CI Health + Housekeeping

**Source:** Hyperplan session (team `ci-fix-planning`, 5 members × 3 rounds adversarial)
**Date:** 2026-07-25
**Branch base:** `develop` (tip `f961daef`)

---

## Setup

```bash
git checkout develop && git pull
git checkout -b ci/quick-fixes            # PR 1 branch
```

## PR 1: CI Quick Fixes + Housekeeping

### Commit 1 — CodeQL Swift: build-mode: none

| Field | Value |
|-------|-------|
| File | `.github/workflows/codeql.yml:55` |
| Change | `build-mode: autobuild` → `build-mode: none` |
| Why | Single `.swift` file at `desktop/libs/appletrust/add-certificate.swift` has no `Package.swift`. `autobuild` fails. `none` still does structural AST analysis. |
| Risk | Negligible |
| Verify | `actionlint .github/workflows/codeql.yml` |

### Commit 2 — SonarCloud: sonarqube-scan-action@v5

| Field | Value |
|-------|-------|
| File | `.github/workflows/ci.yml:183` |
| Change | `sonarcloud/github-action@v3` → `SonarSource/sonarqube-scan-action@v5.0.0` (resolve SHA from tag via `git ls-remote`) |
| Why | Old action repo moved/renamed. v5 supports same `args:` and `projectBaseDir:` inputs. |
| Risk | Low — same input contract |
| Verify | `actionlint .github/workflows/ci.yml` |

### Commit 3 — cargo fmt tailscale provider.rs

| Field | Value |
|-------|-------|
| File | `desktop/src-tauri/tailscale/src/provider.rs` |
| Change | Run `cargo fmt --manifest-path desktop/src-tauri/tailscale/Cargo.toml` |
| Why | Pure formatting diff — wraps 2 long `assert!()` calls to satisfy line length |
| Risk | Zero — no semantic change, same Rust edition (stable 1.95) |
| Verify | `cargo fmt --manifest-path desktop/src-tauri/tailscale/Cargo.toml -- --check && cargo check --manifest-path desktop/src-tauri/tailscale/Cargo.toml` |

### Commit 4 — MSW mock status in handoff

| Field | Value |
|-------|-------|
| File | `.omo/handoffs/session-handoff-2026-07-25.md:150` |
| Change | `(MSW handlers — unused!)` → `(MSW handlers — globally wired, narrow exercise)` |
| Why | `setupAllMocks()` in `server/test/setup.ts` wires OIDC + metadata handlers on `beforeAll`. 1/23 tests actively fire HTTP through them. |
| Risk | Zero |
| Verify | `pnpm --filter drop test` |

### Commit 5 (optional) — PCGW mock fidelity gap

| Field | Value |
|-------|-------|
| File | `server/test/mocks/metadata.ts` — `pcgamingwikiHandlers()` |
| Change | Split handler by `action` query param (cargoquery vs parse vs default) |
| Why | Real PCGW returns different shapes per query param. Current mock returns same static response for all — silent wrong-data bug for future tests. |
| Risk | Low — 5-minute change |
| Verify | `pnpm --filter drop exec vitest run` |

## PR 2: OSV-Scanner Migration

Branch: `ci/osv-scanner-upgrade` off develop.

### Commit — bump to v1.9.2

| Field | Value |
|-------|-------|
| File | `.github/workflows/osv-scanner.yml:33,42` |
| Change | SHA `1f1242919d8a60496dd1874b24b62b2370ed4c78` (v1.7.1) → resolve `v1.9.2` tag SHA from `google/osv-scanner-action` |
| Why | Avoids v1→v2 major boundary risk. Stays in v1.x patch range with same workflow structure. |
| Risk | Low |
| Verify | `actionlint .github/workflows/osv-scanner.yml` |

## Verification Gates

Run before merge:

1. `actionlint .github/workflows/*.yml` — workflow syntax
2. `cargo fmt --manifest-path desktop/src-tauri/tailscale/Cargo.toml -- --check`
3. `cargo check --manifest-path desktop/src-tauri/tailscale/Cargo.toml --workspace`
4. `pnpm --filter drop test` (32+ tests)
5. `pnpm --filter drop typecheck`
6. `pnpm --filter drop lint:fix`

## Deferred (per hyperplan consensus)

- ❌ No MSW verification test (oidc-mocks.test.ts already validates MSW works)
- ❌ No MSW barrel restructure (backlog item)
- ❌ No weekly automated housekeeping workflow (CONCEDED — net negative for small team)
- ❌ Keep `onUnhandledRequest: 'error'` as-is
- ❌ Keep CodeQL Swift (build-mode: none preserves structural analysis)

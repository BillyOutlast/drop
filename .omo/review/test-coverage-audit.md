# Test Coverage Audit — Drop Monorepo

> Generated: 2026-07-25 by deep-audit-team/test-auditor

---

## 1. Executive Summary

| Workspace | Source Files | Test Files | Test-to-Source File Ratio | Status |
|-----------|-------------|------------|---------------------------|--------|
| server/ (Nitro backend) | ~173 TS files | 23 test + 4 mock/2 util | ~0.13:1 (13%) | Critical Gaps |
| server/ (Vue frontend) | ~142 Vue/TS files | 2 component tests | ~0.01:1 (1%) | Near Zero |
| cli/ (Rust) | 16 Rust files | 2 integration tests | ~0.13:1 (13%) | Low |
| desktop/src-tauri/ (Rust) | ~73 Rust files | 2 inline test modules | ~0.03:1 (3%) | Critical |
| desktop/main/ (Nuxt 4) | 24+ Vue files | 0 tests | 0:1 | Zero |
| sites/promo | Unknown (Next.js) | 0 tests | 0:1 | Zero |
| sites/docs | Unknown (Astro) | 0 tests | 0:1 | Zero |
| libraries/droplet | 11 Rust files | 2 test locations | ~0.18:1 (18%) | Low |
| libraries/droplet_types | 1 Rust file | 0 tests | 0:1 | Zero |
| libraries/libarchive | 5 Rust files | 3 test files | ~0.6:1 (60%) | Moderate |
| libraries/native_model | 8 Rust files | ~12 test files | ~1.5:1 (150%) | Good |
| **Total** | **~450+** | **~44 test files** | **~0.1:1 (10%)** | **Critical** |

---

## 2. Test Inventory Per Workspace

### 2.1 Server (TypeScript/Nitro + Nuxt)

**Test Framework:** Vitest (unit/integration), Playwright (e2e)
**Mock Framework:** MSW (Mock Service Worker)
**Coverage Scope (vitest config):** `server/server/**/*.ts` only

| Category | Path | Count | Has Tests? |
|----------|------|-------|------------|
| **Unit tests** | `server/test/unit/` | 15 files | ✅ |
| **Integration tests** | `server/test/integration/` | 5 files | ✅ |
| **Component tests** | `server/test/components/` | 2 files | ✅ |
| **E2E tests** | `server/test/e2e/` | 1 file (1 spec) | ✅ |
| **Mocks** | `server/test/mocks/` | 4 files | ✅ |
| **Utils** | `server/test/utils/` | 2 files | ✅ |
| **Setup** | `server/test/setup.ts` | 1 file | ✅ |

**Unit test files (15):**
```
unit/prioritylist.test.ts
unit/plugins/init-order.test.ts
unit/metadata/provider-chain.test.ts
unit/auth/webauthn.test.ts
unit/auth/session-fixation.test.ts
unit/auth/oidc-escalation.test.ts
unit/auth/ca-blacklist.test.ts
unit/auth-totp.test.ts
unit/acls/confused-deputy.test.ts
unit/utils.test.ts
unit/tuple.test.ts
unit/session-memory.test.ts
unit/h3-factory.test.ts
unit/colors.test.ts
unit/array.test.ts
```

**Integration test files (5):**
```
integration/prioritylist.test.ts
integration/password-hash.test.ts
integration/oidc-mocks.test.ts
integration/fs-backend-hash.test.ts
integration/db-helper.test.ts
```

### 2.2 CLI (Rust)

**Test Framework:** `cargo test` (built-in)
**Test location:** `cli/tests/` (integration tests)

| Source | Files | Tests |
|--------|-------|-------|
| `cli/src/` | 16 .rs files | 0 inline (#[cfg(test)]) |
| `cli/tests/` | 2 files | manifest_test.rs, config_test.rs |

### 2.3 Desktop (Rust — Tauri v2)

**Test Framework:** `cargo test`
**7 crates in workspace**

| Crate | Source Files | Test Files | Source LOC | Test LOC | Status |
|-------|-------------|------------|------------|----------|--------|
| `database/` | 6 + tests.rs | 1 inline | ~300 | ~150 | ✅ Partial |
| `tailscale/` | 2 + test.rs | 1 inline | ~100 | ~50 | ✅ Partial |
| `utils/` | 3 | 0 | ~80 | 0 | ❌ Zero |
| `remote/` | 7 | 0 | ~400 | 0 | ❌ Zero |
| `process/` | 6 | 0 | ~350 | 0 | ❌ Zero |
| `games/` | 11 | 0 | ~600 | 0 | ❌ Zero |
| `download_manager/` | 11 | 0 | ~500 | 0 | ❌ Zero |
| `cloud_saves/` | 11 | 0 | ~500 | 0 | ❌ Zero |
| `client/` | 5 | 0 | ~150 | 0 | ❌ Zero |
| Tauri app root (`src/`) | 11 | 0 | ~400 | 0 | ❌ Zero |

### 2.4 Desktop (Nuxt 4 — desktop/main/)

| Source | Files | Tests |
|--------|-------|-------|
| Pages | 24 .vue | 0 |
| Components/Composables | Unknown | 0 |

### 2.5 Sites

| Site | Framework | Tests |
|------|-----------|-------|
| `sites/promo/` | Next.js 15 | 0 |
| `sites/docs/` | Astro 6 + Starlight | 0 |

### 2.6 Rust Libraries

| Library | Source Files | Test Files | Status |
|---------|-------------|------------|--------|
| `droplet` | 11 | tests.rs + pipeline_test.rs | ✅ Partial |
| `droplet_types` | 1 | 0 | ❌ Zero |
| `libarchive` | 5 | 3 | ✅ Moderate |
| `native_model` | 8 | ~12 | ✅ Good |

---

## 3. Critical Untested Modules

### 3.1 Server API Routes — 100% UNTESTED

**All 100 API route handlers have ZERO tests.** No route handler files have corresponding test files.

| Route Group | Files | Risk Level | Reason |
|-------------|-------|------------|--------|
| `server/server/api/v1/auth/` | 12 routes | 🔴 CRITICAL | Auth bypass, session hijack, MFA bypass |
| `server/server/api/v1/admin/` | 66 routes | 🔴 CRITICAL | Admin privilege escalation, data corruption |
| `server/server/api/v1/client/` | ~15 routes | 🔴 CRITICAL | Game distribution abuse, auth bypass |
| `server/server/api/v1/collection/` | ~8 routes | 🟠 HIGH | Data mutation, ownership bypass |
| `server/server/api/v1/object/` | 4 routes | 🟠 HIGH | Storage abuse, object access control |
| `server/server/api/v1/screenshots/` | 5 routes | 🟠 HIGH | Unauthorized content access |
| `server/server/api/v1/notifications/` | 5 routes | 🟡 MEDIUM | Logic bugs |
| `server/server/api/v1/store/` | ~5 routes | 🟡 MEDIUM | Store display |
| `server/server/api/v1/news/` | 3 routes | 🟡 MEDIUM | Content display |
| `server/server/api/v1/user/` | ~10 routes | 🟠 HIGH | Profile/token management |
| `server/server/api/v1/settings/` | 1 route | 🟡 MEDIUM | Config leaks |
| `server/server/api/v1/task/` | 1 route | 🟡 MEDIUM | Task status |
| Other misc (health, index, token, setup, etc.) | ~5 routes | 🟡 MEDIUM | — |

### 3.2 Server Internal Business Logic — 60% UNTESTED

| Module | Path | Files | Has Tests? | Risk |
|--------|------|-------|------------|------|
| **Auth** | `internal/auth/` | 5 files | Partial (webauthn, totp, passwordHash tested; oidc/ UNTESTED) | 🔴 CRITICAL |
| **Objects/Storage** | `internal/objects/` | 3 files | ❌ Zero | 🔴 CRITICAL |
| **Library/Manifest** | `internal/library/` | 5 files | ❌ Zero | 🔴 CRITICAL |
| **Screenshots** | `internal/screenshots/` | 1 file | ❌ Zero | 🟠 HIGH |
| **Saves** | `internal/saves/` | 1 file | ❌ Zero | 🟠 HIGH |
| **Notifications** | `internal/notifications/` | 1 file | ❌ Zero | 🟠 HIGH |
| **News** | `internal/news/` | 1 file | ❌ Zero | 🟠 HIGH |
| **Cache** | `internal/cache/` | 2 files | ❌ Zero | 🟡 MEDIUM |
| **Clients** | `internal/clients/` | 4 files | ❌ Zero (ca-blacklist tested) | 🟠 HIGH |
| **Config** | `internal/config/` | 2 files | ❌ Zero | 🟡 MEDIUM |
| **Tasks** | `internal/tasks/` | 6 files | ❌ Zero | 🟠 HIGH |
| **Services (Torrential)** | `internal/services/` | 4 files | ❌ Zero | 🟠 HIGH |
| **User Stats** | `internal/userstats/` | 1 file | ❌ Zero | 🟡 MEDIUM |
| **User Library** | `internal/userlibrary/` | 1 file | ❌ Zero | 🟠 HIGH |
| **Session (DB/Cache)** | `internal/session/` | 3 files | Partial (only memory tested) | 🟠 HIGH |
| **Database** | `internal/db/` | 1 file | ❌ Zero | 🔴 CRITICAL |
| **System Data** | `internal/system-data/` | 1 file | ❌ Zero | 🟡 MEDIUM |
| **Utilities** | `internal/utils/` | 6 files | Partial (prioritylist, tuple, array, h3 tested; files, query, handlefileupload, parseplatform UNTESTED) | 🟡 MEDIUM |

### 3.3 Desktop Rust — 90% UNTESTED

| Crate | Source Files | Tests | Risk |
|-------|-------------|-------|------|
| `download_manager/` | 11 files | 0 | 🔴 CRITICAL — file download, queue, progress |
| `cloud_saves/` | 11 files | 0 | 🔴 CRITICAL — save data integrity |
| `games/` | 11 files | 0 | 🔴 CRITICAL — game library, scanning, state |
| `remote/` | 7 files | 0 | 🔴 CRITICAL — network auth, cache, requests |
| `process/` | 6 files | 0 | 🟠 HIGH — process management |
| `client/` | 5 files | 0 | 🟠 HIGH — user/autostart |
| `Tauri root` | 11 files | 0 | 🔴 CRITICAL — app startup, updates, scheduler |

### 3.4 CLI — 70% UNTESTED

| Module | Tests | Risk |
|--------|-------|------|
| `commands/upload/` | 0 | 🔴 CRITICAL — upload pipeline |
| `commands/connect/` | 0 | 🔴 CRITICAL — S3/connect config |
| `logging.rs` | 0 | 🟡 MEDIUM |
| `manifest.rs` | 1 integration test | 🟢 Partial |
| `cli.rs` | 0 | 🟡 MEDIUM |

### 3.5 Frontend (Server + Desktop) — 99% UNTESTED

| Area | Files | Tests | Risk |
|------|-------|-------|------|
| Server components | 72 .vue | 2 tests | 🟠 HIGH |
| Server pages | 54 .vue | 0 | 🟠 HIGH |
| Server composables | 16 .ts | 0 (partially covered by unit tests) | 🟡 MEDIUM |
| Desktop (Nuxt) pages | 24 .vue | 0 | 🟡 MEDIUM |
| Sites (promo + docs) | Unknown | 0 | 🟢 LOW (mostly static) |

---

## 4. Missing Test Types

### 4.1 Server (TypeScript)

| Test Type | Current | Required For |
|-----------|---------|-------------|
| **Unit tests (business logic)** | 15 files | Internal modules (71 files, ~50 untested) |
| **API route handler tests** | **0** | **All 100 routes** |
| **Integration tests (DB)** | 5 files | Auth flows, object storage, library operations |
| **Component tests (Vue)** | 2 files | 72 components (70 untested) |
| **Page tests (Vue)** | **0** | 54 pages |
| **E2E tests** | 1 spec (health only) | Auth flows, game installation, admin operations |
| **Security tests** | 3 files (auth security) | Injection, CSRF, rate limiting, session management |

### 4.2 CLI (Rust)

| Test Type | Current | Required For |
|-----------|---------|-------------|
| **Unit tests** | 0 inline | All 16 src files |
| **Integration tests** | 2 files (manifest, config) | Upload commands, connect flows |
| **CLI argument tests** | 0 | clap argument parsing, subcommands |

### 4.3 Desktop (Rust)

| Test Type | Current | Required For |
|-----------|---------|-------------|
| **Unit tests** | ~2 inline modules | 7 crates × 5-11 files each |
| **Integration tests** | 0 | Cross-crate flows (download → write → verify) |
| **State machine tests** | 0 | Games state, download state, process lifecycle |

---

## 5. Specific Recommendations

### PRIORITY 1 — CRITICAL (Test Immediately)

1. **Add API route handler tests for ALL auth routes** (12 files in `server/server/api/v1/auth/`) because authentication is the security boundary of the entire platform. Use the existing MSW mock infrastructure and h3 factory pattern already proven in `test/unit/h3-factory.test.ts`.

2. **Add tests for `server/server/internal/objects/`** (fsBackend, objectHandler, transactional) because these handle ALL game file storage — data loss/corruption here is unrecoverable.

3. **Add tests for `server/server/internal/db/database.ts`** because it's the Prisma client singleton that every data operation depends on. A misconfigured connection pool affects every route.

4. **Add tests for `desktop/src-tauri/games/`** (library, scan, state, downloads, collections) because game detection and download management are the core desktop features with zero coverage.

5. **Add tests for `desktop/src-tauri/cloud_saves/`** (backup_manager, metadata, resolver) because save data loss is user-facing and unrecoverable.

### PRIORITY 2 — HIGH (Test Soon)

6. **Add API route handler tests for admin routes** (`server/server/api/v1/admin/` — 66 files) because admin operations mutate critical system data (games, users, settings, library sources).

7. **Add tests for `server/server/internal/library/`** because library management (manifest, providers, flat/filesystem providers) determines how games are discovered and served.

8. **Add tests for `server/server/internal/clients/`** (handler, event-handler, capabilities) because client-server protocol correctness affects all desktop ↔ server communication.

9. **Add tests for `server/server/internal/tasks/`** (registry, group, index) because background tasks handle integrity checks, session cleanup, and invitation processing.

10. **Add upload command tests for CLI** (`cli/src/commands/upload/`) because file upload is the primary CLI workflow.

11. **Add S3 connect tests for CLI** (`cli/src/commands/connect/`) because S3 configuration errors block the entire onboarding flow.

### PRIORITY 3 — MEDIUM (Add When Touching Code)

12. **Add tests for `server/server/internal/auth/oidc/`** before any OIDC changes — currently completely untested despite being an auth boundary.

13. **Add tests for `server/server/internal/screenshots/`, `saves/`, `notifications/`, `news/`** when implementing features in these areas.

14. **Add component tests for Vue components** when refactoring UI. Focus on `Modal/*`, `Auth/*`, `GameEditor/*` first.

15. **Add tests for `desktop/src-tauri/remote/`** (auth, cache, requests, server_proto) because network errors degrade the entire desktop experience.

16. **Add tests for `desktop/src-tauri/download_manager/`** because concurrent download queue logic is prone to race conditions.

17. **Add tests for `desktop/src-tauri/process/`** because process lifecycle management (start/stop/kill game processes) affects system stability.

### PRIORITY 4 — LOW (Add On Cleanup)

18. **Add inline unit tests for `cli/src/commands/connect/`** sub-modules (speedtest, interactive, configurable, config_option, s3).

19. **Add tests for `server/composables/`** utility functions when refactoring frontend code.

20. **Add tests for `libraries/droplet_types/`** — single file lib, trivial to add basic encoding/decoding tests.

---

## 6. Test Pattern Summary

### Server Tests (TypeScript)

| Pattern | How |
|---------|-----|
| **Unit test imports** | Import function directly, mock dependencies with `vi.mock()` |
| **Nitro globals** | Stubbed in `test/setup.ts` (`defineEventHandler`, `getHeader`, `readBody`, etc.) |
| **External HTTP** | MSW (Mock Service Worker) with `setupTestMocks()` / `teardownTestMocks()` |
| **Config** | `systemConfig` mock at top of test file before imports |
| **H3 handler testing** | Use `mockH3Handler()` pattern from `test/utils/h3.ts` |

### Rust Tests (CLI + Desktop + Libraries)

| Pattern | How |
|---------|-----|
| **Inline tests** | `#[cfg(test)] mod tests { ... }` in source files |
| **Integration tests** | `tests/` directory at crate root |
| **Test framework** | Built-in `#[test]`, `cargo test` |
| **Mocking** | Manual trait-based or struct mock pattern |

### E2E Tests (Server)

| Pattern | How |
|---------|-----|
| **Framework** | Playwright |
| **Location** | `server/test/e2e/` |
| **Dev server** | Auto-started by Playwright config |
| **Port** | 4000 (configurable via `E2E=true pnpm dev`) |
| **Current** | 1 spec (health endpoint only) |

---

## 7. Coverage Gap Heatmap

```
server/server/api/v1/auth/           ████████████████████ (12 routes, 0 tests)
server/server/api/v1/admin/          ████████████████████ (66 routes, 0 tests)
server/server/api/v1/client/         ████████████████████ (15 routes, 0 tests)
server/server/api/v1/collection/     ████████████████████ (8 routes, 0 tests)
server/server/internal/objects/      ████████████████████ (3 files, 0 tests)
server/server/internal/library/      ████████████████████ (5 files, 0 tests)
server/server/internal/services/     ████████████████████ (5 files, 0 tests)
server/server/internal/clients/      ████████████████████ (4 files, 0 tests)
server/server/internal/tasks/        ████████████████████ (6 files, 0 tests)
server/server/internal/auth/oidc/    ████████████████████ (1 file, 0 tests)
server/server/internal/db/           ████████████████████ (1 file, 0 tests)
desktop/src-tauri/games/             ████████████████████ (11 files, 0 tests)
desktop/src-tauri/cloud_saves/       ████████████████████ (11 files, 0 tests)
desktop/src-tauri/download_manager/  ████████████████████ (11 files, 0 tests)
desktop/src-tauri/remote/            ████████████████████ (7 files, 0 tests)
desktop/src-tauri/process/           ████████████████████ (6 files, 0 tests)
desktop/src-tauri/client/            ████████████████████ (5 files, 0 tests)
cli/src/commands/upload/             ████████████████████ (2 files, 0 tests)
cli/src/commands/connect/            ████████████████████ (6 files, 0 tests)
server/server/internal/auth/         ████░░░░░░░░░░░░░░░░ (3/5 tested)
server/server/internal/session/      ████░░░░░░░░░░░░░░░░ (1/3 tested)
server/test/unit/                    ████████████████████ (15 files, good)
server/test/mocks/                   ████████████████████ (MSW setup, good)
```

**Legend:** ██ = red (untested), ░░ = green (tested)

---

## 8. What's Working Well

1. **MSW mock infrastructure** is solid — OIDC + all metadata providers mocked, `onUnhandledRequest: "error"` catches unmocked external calls.
2. **Auth security tests** (webauthn, OIDC escalation, session fixation, CA blacklist) cover important vulnerability patterns.
3. **libarchive** has decent coverage (60%) with 3 test files.
4. **native_model** has excellent coverage (150%+) with a dedicated test crate.
5. **H3 handler test utility** (`test/utils/h3.ts`) provides a pattern for testing API handlers — just needs to be applied.
6. **Nuxt test environment** with fork pool isolation prevents cross-test state leaks.
7. **prioritylist** tests (unit + integration) cover the core data structure well.
8. **Coverage scope** is correctly scoped to Nitro backend only, excluding frontend code.

---

## 9. Summary

**Overall test-to-source file ratio: ~10% (44 test files for ~450 source files).**

Note: This is a file-count heuristic, not measured code coverage from an instrumented coverage tool. It provides a rough estimate of test presence across the codebase.

- **Server backend:** ~30% file ratio for business logic, 0% of API routes tested
- **Server frontend:** ~1% file ratio
- **CLI:** ~13% file ratio
- **Desktop Rust:** ~3% file ratio
- **Desktop Nuxt:** 0% (no tests)
- **Sites:** 0% (no tests)
- **Libraries:** native_model (good file ratio), libarchive (moderate), droplet (low), droplet_types (zero)

**Most urgent: Add API route handler tests utilizing the existing h3 factory + MSW infrastructure.**

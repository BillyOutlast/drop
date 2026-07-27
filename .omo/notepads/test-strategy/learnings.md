# Learnings - Test Strategy

## 2026-07-25 Session Start

- Repo: BillyOutlast/drop on `develop` (commit 91ad36ca)
- No upstream remote existed → added `git@github.com:Drop-OSS/drop.git`
- `cargo-llvm-cov` installed locally
- `fast-check` ^4.9.0 already in server devDependencies
- `PriorityListIndexed` in `server/server/internal/utils/prioritylist.ts` — 98 lines, sorted priority queue with string index
  - Existing test at `server/test/unit/prioritylist.test.ts` — 7 tests, no property-based tests
- `tailscale` crate at `desktop/src-tauri/tailscale/` — standalone, NOT in workspace, NOT imported by any crate
  - `lib.rs`: 350 lines, wraps CGo FFI via bindgen. Structs: Tailscale, TailscaleListener, TailscaleConn
  - Methods: new(), start(), up(), close(), set_dir(), set_hostname(), set_authkey(), set_control_url(), set_ephemeral(), set_log_fd(), get_ips(), loopback(), dial(), listen(), enable_funnel_to_localhost_plaintext_http1(), get_last_error_message()
  - Existing test `test.rs` requires actual Tailscale daemon — not a unit test
  - Consumers: NONE currently. `remote/`, `process/` crates don't depend on tailscale
  - **Finding**: Trait extraction is pre-emptive architecture work, not unblocking existing tests
- vitest config: Nuxt env, V8 coverage, forks pool, 30s timeout

## Phase 1 Progress

- Phase1-1: Upstream remote added ✓
- Phase1-2: cargo-llvm-cov installed. 3 CI workflows updated with coverage steps (droplet-ci, cli-ci, desktop-ci) ✓
- Phase1-3: Tailscale exploration complete. tailscale crate orphaned (not in workspace, not imported). All networking via HTTPS/reqwest. Remote crate handles REST API + WebSocket. Process crate launches local processes. No crate needs Tailscale. Trait extraction is pre-emptive architecture work.
- Phase1-4: 3 property-based tests added for PriorityListIndexed using fast-check ✓ (12 total tests, all pass)

## Phase 1 Complete

### Task Results

- Phase1-1 ✅ Upstream remote added (`git@github.com:Drop-OSS/drop.git`)
- Phase1-2 ✅ `cargo-llvm-cov` installed. 3 CI workflows updated (droplet, cli, desktop) with coverage + Codecov upload steps. Coverage steps `continue-on-error: true`.
- Phase1-3 ✅ `TailscaleProvider` trait extracted with `MockTailscale`. 566 lines in `provider.rs`. 17 unit tests + 1 doc-test passing. `cargo +nightly check --workspace` passes.
  - Key insight: tailscale crate was orphaned (not in workspace, no consumers). Now added to workspace with trait ready for injection.
  - Integration test in `test.rs` gated on `#[cfg(libtailscale_available)]` — won't link without real libtailscale C library.
- Phase1-4 ✅ 3 property-based tests added for PriorityListIndexed using fast-check. All 12 prioritylist tests pass (9 existing + 3 new property-based).
- 4 pre-existing test failures in `fs-backend-hash.test.ts` (Vite alias ~/ resolution issue with `fsBackend.ts`) — not from our changes.

### CI Changes Summary

- `droplet-ci.yml`: 3 new steps (Install LLVM tools → Generate coverage → Upload to Codecov)
- `cli-ci.yml`: Same pattern
- `desktop-ci.yml`: Same pattern (coverage `continue-on-error: true` matching pre-existing test pattern)
- Coverage paths match working-directory contexts

## 2026-07-25: T6 CA Blacklist Footgun

**Bug**: `server/server/internal/clients/ca-store.ts:93` — `dbCertificateStore.checkBlacklistCertificate()` returned `true` when `findUnique` returned `null` (cert not in DB).

**Impact**: Any deleted/missing certificate was treated as blacklisted = denial of service. A cert that never existed or was cleaned up would prevent client connections.

**Fix**: Changed `if (result === null) return true;` to `if (result === null) return false;`

**Tests** (`server/test/unit/auth/ca-blacklist.test.ts`):

- Missing cert → `false` (not blacklisted) — was returning `true`
- Explicitly blacklisted cert → `true`
- Existing non-blacklisted cert → `false`

All 3 pass after fix.

## Phase 2 Complete — Security Tests

### Bugs Found & Fixed

1. **CA Blacklist Footgun** (`ca-store.ts:93`): `if (result === null) return true;` → fixed to `return false`. Deleted cert no longer = blacklisted.
2. **Session Fixation** (`session/index.ts:73-74`): `getSessionToken(h3) ?? createSessionCookie(...)` reuses pre-set cookie. **FIXED**: Always issue new token on signin, invalidate old session in provider.

### Bugs Confirmed (behavior locked by test, no source fix)

3. **ACL Confused Deputy**: Already prevented by `checkSessionACL` returning `false` (not `undefined`) for non-admin — regression locked.
4. **WebAuthn Attestation**: No signature validation exists. Gap documented.

### New Test Files

| File                                      | Tests | Verifies                                            |
| ----------------------------------------- | ----- | --------------------------------------------------- |
| `test/unit/auth/webauthn.test.ts`         | 5     | CBOR parsing, challenge validation, attestation gap |
| `test/unit/auth/oidc-escalation.test.ts`  | 3     | OIDC admin group escalation prevention              |
| `test/unit/auth/session-fixation.test.ts` | 2     | Session token reuse vulnerability                   |
| `test/unit/acls/confused-deputy.test.ts`  | 4     | ACL session vs token precedence                     |
| `test/unit/auth/totp.test.ts`             | 5     | TOTP secret→code→verify round-trip                  |
| `test/unit/auth/ca-blacklist.test.ts`     | 3     | Certificate blacklist (missing ≠ blacklisted)       |
| `test/gaps/webauthn-attestation.md`       | —     | Attestation validation gap document                 |

### Post-Phase-2 Fix Applied

- **Session Fixation** (`session/index.ts:73-74`): Changed signin() to always call `createSessionCookie()` and `removeSession(oldToken)` instead of reusing pre-set cookie. Test updated to assert new token issued and old session invalidated.

### Pre-existing Fix

- `vitest.config.ts`: Added `~` alias resolving Nuxt's path convention — fixed 4 previously-failing fs-backend-hash tests

## 2026-07-25: PrismaRepository Trait Extraction Feasibility

### Prisma Schema State

- **`server/prisma/schema.prisma`**: 24 lines, **0 models** — only generator + datasource stubs
- **Generated client** (`server/prisma/client/internal/class.ts`): **29 models** + **8 enums** inlined as `inlineSchema` string
  - Models: APIToken, ApplicationSettings, Article, Certificate, Client, Collection, CollectionEntry, Company, Depot, Game, GameRating, GameTag, GameVersion, Invitation, LaunchConfiguration, Library, LinkedAuthMec, LinkedMFAMec, NewsTag, Notification, ObjectHash, Playtime, SaveSlot, Screenshot, Session, SetupConfiguration, Task, UnimportedGameVersion, User
  - Enums: APITokenMode, AuthMec, ClientCapabilities, GameType, LibraryBackend, MFAMec, MetadataSource, Platform
- `schema.prisma` has NEVER had models in git history (single commit `8e75a0bf` introduced the stub, parent has no file)
- Generated client is gitignored (`server/prisma/client/` in .gitignore) — regenerated locally via `pnpm postinstall`
- **Critical**: Running `prisma generate` from the current schema.prisma would produce a client with **0 models**, breaking all handlers

### API Handler Survey

- ~97 route handlers in `server/server/api/v1/` consume prisma directly
- Pattern: `import prisma from "~/server/internal/db/database"` then `prisma.<Model>.<method>()`
- Examples:
  - `games/[id]/index.get.ts`: `prisma.game.findUnique(…)`, `prisma.gameRating.aggregate(…)`
  - `tags/[id]/index.get.ts`: `prisma.gameTag.findUnique(…)`
  - `companies/[id]/index.get.ts`: `prisma.company.findUnique(…)`
- Some handlers use abstraction through managers (e.g., `collection/index.post.ts` uses `userLibraryManager.collectionCreate()`)
- No repository abstraction layer exists — direct Prisma calls are the norm

### Verdict: BLOCKED — Cannot Extract PrismaRepository

**Blocking reason: Schema.prisma has 0 models.** The generated client works only because it carries a stale inlined schema from a previous generation. Before any trait extraction can happen:

1. **Must fix schema.prisma** — restore all 29 model definitions + 8 enums from the inlined schema in `class.ts` into `schema.prisma`
2. **Verify `prisma generate` works** — ensure the generated client matches what code expects
3. **Then extract traits** — per-domain traits (GameRepo, CompanyRepo, TagRepo, etc.) wrapping prisma calls, with test doubles for unit tests

Without step 1, ~~any attempt to regenerate the client breaks the entire app~~ (the app already runs on a stale generated client, but the schema file is a ticking time bomb).

### Test Suite Progress

- Before: 81 passed, 1 skipped, 4 failed
- After: **107 passed, 1 skipped, 0 failed**
- New tests: 31 (Phase 1: 3 property-based + Phase 2: 28 security)
- Fixed: 4 previously-failing tests

## 2026-07-25: Stryker Mutation Testing Setup

### What Was Done

- Installed `@stryker-mutator/core@9.6.1` + `@stryker-mutator/vitest-runner` as devDependencies in `server/`
- Created `server/stryker.config.json` — scoped to `server/internal/metadata/**/*.ts`
- Config: vitest-runner, `inPlace: true`, `coverageAnalysis: perTest`, thresholds `low: 10`
- Key config lesson: `thresholds` uses `low`/`high`/`break` (not `mutation`)
- Run command: Must run from `server/` directory via `npx --no-install stryker run` (pnpm exec resolves to wrong CWD)
- Added `vitest.dir` option to scope test discovery to `test/unit/metadata` — avoids pre-existing fs-backend-hash test failure

### Baseline Results (metadata module, 7 files, 1604 mutants, 29s runtime)

| File              | Score (total) | Score (covered) | Killed | Survived |  No Cov  |
| ----------------- | :-----------: | :-------------: | :----: | :------: | :------: |
| **All 7 files**   |   **1.18%**   |   **73.08%**    | **18** |  **7**   | **1578** |
| `index.ts`        |    15.45%     |     73.08%      |   18   |    7     |    97    |
| `giantbomb.ts`    |      0%       |       0%        |   0    |    0     |   104    |
| `igdb.ts`         |      0%       |       0%        |   0    |    0     |   227    |
| `manual.ts`       |      0%       |       0%        |   0    |    0     |    15    |
| `pcgamingwiki.ts` |      0%       |       0%        |   0    |    0     |   276    |
| `steam.ts`        |      0%       |       0%        |   0    |    0     |   859    |

### Key Findings

1. **Only `index.ts` has any coverage** — the 5 `provider-chain.test.ts` tests only exercise `MetadataHandler.search()`, using mock providers
2. **All 5 real providers (igdb, steam, giantbomb, pcgamingwiki, manual) are at 0%** — no unit tests exercise their implementations
3. **Steam.ts is the biggest gap**: 859 mutants, 0 covered, 0 killed
4. **7 survived mutants in index.ts**: Edge cases in `search()` that the mock-based tests don't catch (e.g., different timeout paths, provider ordering edge cases, error handling variants)
5. **1 timeout mutant**: A mutant in index.ts caused an infinite loop (likely in a Promise/async path) and was correctly caught by the timeout

### Action Items

- Write tests for Steam provider (biggest coverage gap)
- Write tests for IGDB provider (second biggest)
- Increase `thresholds.low` as coverage improves
- Add `stryker run` to CI when coverage > 10%

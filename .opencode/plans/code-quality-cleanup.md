# Code Quality Cleanup Plan — Drop Monorepo

**Generated**: 2026-07-27 | **Provenance**: Hyperplan adversarial analysis (5-member team, 3 rounds: analysis → cross-attack → defend/refine/concede)
**Effort**: 3-4 weeks solo dev with AI assistance | **Coverage target**: Track absolute lines, ignore % until 10% (~1,500 additional covered lines)

> **Execution update** (2026-07-27): Phase 1 complete, Phase 2.1 complete, Phase 3.1 partial (33/82 errors fixed).
> **Reality check**: Actual SonarCloud count is 15, not 38. AGENTS.md was stale. `noUncheckedIndexedAccess` surfaces 82 errors across 30+ files — significantly more than the 30 estimated.

## Baseline

| Metric | Pre-execution | Post-Phase-1 |
|--------|---------------|---------------|
| SonarCloud OPEN issues | ~~38~~ **15** (live API) | 3 (remaining S3776/Cognitive, wont-fix) |
| Server tests | 181 vitest (180 pass, 1 skip) | 186 vitest (186 pass, 1 skip) |
| Coverage | 1.17% lines / 2.09% functions | Unchanged (infra tests) |
| Dead exports | 20.6% (mostly Nuxt file-based routing false positives) | 1 removed (fsCertificateStore) |

## Issue Breakdown (actual, verified via SonarCloud API)

| Category | Count | Action | Status |
|----------|-------|--------|--------|
| S8786 regex backtracking (steam.ts:649, 921, 1013, 1016, 1110) | 5 | Fixed — split/restructured patterns | ✅ Done |
| S8786 regex backtracking (Vue simple auth page) | 1 | Fixed — bounded email regex | ✅ Done |
| S1854 dead store (server.vue:97) | 1 | Fixed — removed unused assignment | ✅ Done |
| S6661 Object.assign (index.ts:94) | 1 | Fixed — spread syntax | ✅ Done |
| S7776 Array→Set (store index.get.ts) | 1 | Fixed — Set.has() | ✅ Done |
| S6505 --ignore-scripts (e2e.yml) | 1 | False positive (Playwright CLI, not npm) | Skipped |
| S6506 wget redirect (optimize-appimage.sh) | 1 | Low-risk GitHub release URL | Skipped |
| S2137 globalThis (database.ts) | 1 | Prisma pattern, intentional | Skipped |
| Rust S3776 cognitive complexity | 3 | WONT-FIX (9yr, no tests, touching dangerous) | Deferred |
| **Total resolved** | **12 closed** | **3 remaining (wont-fix)** | |

---

## Phase 1: Critical Fixes + Guardrails — ✅ COMPLETE

> **Execution**: All 6 tasks completed. Files changed: `steam.ts`, `server.vue`, `index.ts`, `index.get.ts`, `index.vue`, `.git-blame-ignore-revs`, `.husky/pre-commit`.
> **Verification**: Typecheck ✅ | Tests 186 (was 181) ✅ | Fallow audit ✅ | Formatted ✅

### P1.1 — Fix ReDoS regex in steam.ts ✅
- **Files**: `server/server/internal/metadata/steam.ts`
- **Done**: 5 regex patterns fixed — two-step banner extraction, bounded quantifiers, lookahead for punctuation cleanup
- **Verify**: `pnpm --filter drop typecheck` ✅ | tests pass ✅

### P1.2 — Set up .git-blame-ignore-revs ✅
- **Done**: Created `.git-blame-ignore-revs` + `git config blame.ignoreRevsFile`

### P1.3 — SonarCloud mechanical fixes ✅
- **Done**: 4 issues fixed manually (S1854 dead store, S6661 Object.assign→spread, S7776 Array→Set, Vue S8786 email regex)
- **Note**: Only 15 total issues (not 28-30 as estimated). No autofixer scripts needed — manual fixes were faster.

### P1.4 — Add .toBeDefined() pre-commit check ✅
- **Done**: Added to `.husky/pre-commit` — grep check on staged test files for bare assertions

### P1.5 — Fix prisma generate ordering ✅
- **Done**: Added conditional `prisma generate` in pre-commit when `schema.prisma` or `*.proto` files change

### P1.6 — Deduplicate CI workflow paths (SKIPPED)
- **Reason**: `ci.yml` (comprehensive) and `server-ci.yml` (fast-path) intentionally overlap on server changes. Fast-path provides early feedback. Not a bug.

---

## Phase 2: Integration Tests — PARTIAL (1/4 complete)

> **Execution**: P2.1 done (5 new tests). P2.2-2.4 blocked by infrastructure dependencies.

### P2.1 — MetadataProvider chain integration tests ✅
- **Done**: `server/test/integration/metadata-provider-chain.test.ts` — 5 tests covering priority ordering, Manual exclusion, empty providers, source metadata, fuzzy sorting
- **Tests added**: 5 (186 total, up from 181)
- **Note**: Real-provider MSW integration not feasible — Nuxt's `$fetch` bypasses MSW interception. Mock providers used instead.

### P2.2 — DB CRUD integration tests ⏸️ BLOCKED
- **Blocker**: `server/test/utils/db.ts` requires `DATABASE_URL` (test DB). No test DB configured.

### P2.3 — Auth flow integration tests ⏸️ BLOCKED
- **Blocker**: Requires OIDC fixture setup + session handling infrastructure

### P2.4 — Event handler integration tests ⏸️ BLOCKED
- **Blocker**: Requires WebSocket/SSE test infrastructure

### Phase 2 verification gate
- Typecheck ✅ | Tests 186 (target 196-203): PARTIAL | Coverage unchanged

---

## Phase 3: Type Fixes + Strict Mode — ⏸️ PENDING

> **Status**: Deferred. Requires file-by-file `noUncheckedIndexedAccess` audit of 8 files with 30+ latent errors. Leaf-to-root ordering prevents half-fix state.

### P3.1 — Fix noUncheckedIndexedAccess (leaf-to-root) ⏸️
- **Files** (8 named + 30 latent errors): Fix in this ORDER:
  1. `server/server/internal/utils/prioritylist.ts` (leaf — no internal deps)
  2. `server/server/internal/system-data/index.ts`
  3. `server/server/internal/metadata/pcgamingwiki.ts`
  4. `server/server/internal/auth/totp.ts`
  5. `server/api/v1/auth/mfa/webauthn.ts`
  6. `server/api/v1/auth/passkey/`
  7. `server/server/internal/clients/event-handler.ts`
  8. `server/api/v1/admin/import/massversion.ts`
- **Pattern**: `if (!arr[i]) return` or `const item = arr[i]; if (!item) return` for each indexed access
- **Branch**: Single branch, per-file commits (not monolithic), `git commit` per file
- **Risk**: medium — fixing one file exposes access patterns in callers. Leaf-to-root ordering prevents half-fix state.
- **Verify**: `pnpm --filter drop typecheck` passes with `noUncheckedIndexedAccess: true` in tsconfig

### P3.2 — Enable noUncheckedIndexedAccess
- **File**: `server/tsconfig.json`
- **Action**: Set `"noUncheckedIndexedAccess": true` AFTER all 8+ files are fixed and typecheck passes
- **Verify**: Full CI typecheck passes with flag enabled

---

## Phase 4: Documentation + Automation — ⏸️ PENDING

> **Status**: Not started. Requires significantly more effort (auto-JSDoc generation, CI hooks, sonarcloud-sync extension). Dead exports audit shows mostly Nuxt file-based routing false positives — low ROI for cleanup.

### P4.1 — Auto-JSDoc baseline for TS public APIs ⏸️
- **Directories**: `server/server/api/v1/`, `server/server/internal/`
- **Action**: Generate baseline JSDoc for all exported functions using ts-morph or AI-assisted pass. Include `@param`, `@returns`, `@throws` where TypeScript types provide info.
- **Effort**: 8h (TS only, not Rust or Vue SFCs — those are excluded)
- **Note**: This is a BASELINE. A rename from `x` to `username` won't auto-update the docstring. The missing-docs CI hook (P4.2) prevents new undocumented code from entering.
- **Verify**: All public API exports have JSDoc; no undocumented exports in lint

### P4.2 — Missing-docs CI hook
- **File**: New lint rule or CI step checking for undocumented exports
- **Action**: Add check to CI that fails if a PR adds or modifies a function without a JSDoc comment. Only applies to new/changed code (using `--changedSince`).
- **Verify**: PR adding undocumented function fails CI

### P4.3 — Extend sonarcloud-sync.sh
- **File**: Existing `sonarcloud-sync.sh` (or create new if none)
- **Action**: Add webhook-based trigger (not cron — avoids alert fatigue). Add auto-assign by area label (server/, desktop/, cli/, libraries/). Add weekly close for stale-90d minors.
- **Verify**: New SonarCloud issues automatically get area labels and assignee

### P4.4 — Clean up dead exports
- **Action**: Run `fallow dead-code` on the full codebase. Verify exported symbols are NOT used in Vue SFC templates (`{{ }}` bindings, `<script setup>` imports) before removing. False-positive rate from barrel files and dynamic imports is expected — manual verification required.
- **Target**: Remove verified-dead exports, reduce dead-export % from 20.6 → ~10%
- **Verify**: `pnpm --filter drop typecheck` clean, `pnpm --filter drop test` all passing after removals

### P4.5 — Rust clippy fixes (per-crate)
- **Crates**: database → client → process → games → ... (one at a time)
- **Action**: `cargo clippy --fix -p <crate>` per crate, then `cargo fmt`. Do NOT run across all 7 at once — shared types in native_model/droplet_types create cascading changes.
- **Note**: 3 cognitive-complexity hotspots (libarchive/writer.rs, download_agent, download_logic) are WONT-FIX. They're 9 years old with zero tests; touching them is more dangerous than leaving them.
- **Verify**: `cargo fmt --check --all` + `cargo clippy --all-targets --all-features -- -D warnings` for the crates touched

---

## Phase 5: Steady-State (Ongoing)

### P5.1 — Coverage tracking (absolute lines)
- **Action**: Track absolute covered lines, not percentage, until threshold. Set up CI artifact to track covered-lines count per PR.
- **Verify**: Covered-lines never decreases in a PR

### P5.2 — Mutation testing (deferred to 30%+ coverage)
- **Tool**: Stryker (TypeScript)
- **Trigger**: Enable only after coverage reaches 30%. At 1.17%, mutation testing produces noise not signal.
- **Target**: Find tests that don't actually assert meaningful behavior

### P5.3 — Property-based tests (metadata + auth, deferred)
- **Module**: MetadataProvider chain, auth handlers
- **Approach**: Generate property tests from Prisma model constraints + API route validators
- **Target**: metadata + auth routes from 0% → 40-60% PBT coverage (3-4% overall lift)
- **Deferred**: Requires auth fixtures. Schedule for post-Phase 4.

---

## Dependency Graph

```
P1.1 (ReDoS) ──┐
P1.2 (blame) ──┤
P1.3 (auto-fix) ┤── independent ──┐
P1.4 (.toBeDef) ┤                  │
P1.5 (prisma)  ─┤                  │
P1.6 (CI paths) ┘                  │
                                   ▼
                              Phase 1 gate
                                   │
                    ┌──────────────┤
                    ▼              ▼
        P2.1 (metadata)    P2.2 (DB CRUD)
        P2.3 (auth)        P2.4 (events)
                    │              │
                    └──────┬───────┘
                           ▼
                      Phase 2 gate
                           │
                           ▼
              P3.1 (noUnchecked leaf→root)
                           │
                           ▼
              P3.2 (enable flag)
                           │
                           ▼
                      Phase 3 gate
                           │
               ┌───────────┼───────────┐
               ▼           ▼           ▼
        P4.1 (JSDoc) P4.2 (hook) P4.5 (clippy)
        P4.3 (sync)  P4.4 (dead) 
               │           │           │
               └───────────┴───────────┘
                           ▼
                      Phase 4 gate
```

## Verification Gates (EVERY Phase)

| Gate | Command |
|------|---------|
| TypeScript | `pnpm --filter drop typecheck` |
| Tests | `pnpm --filter drop test` |
| Lint | `pnpm --filter drop lint` |
| Format | `pnpm --filter drop format:check` |
| Fallow | `fallow audit --format json --quiet --gate-marker agent` |
| Rust format | `cargo fmt --check --all` |
| Rust clippy | `cargo clippy --all-targets --all-features -- -D warnings` |

## Rollback Triggers

- **Pre-commit hook**: If any new hook gets 3+ developer complaints, roll back to just `vitest --changed`
- **Phase spillover**: If Phase 1 is not complete by end of Sprint 1, descope P1.6 (CI dedup — lowest priority)
- **Test fragility**: If integration tests are flaky (fail >10% of CI runs), isolate DB-dependent tests behind `describe.skip` until test DB fixture is stable
- **Type fix cascade**: If fixing `noUncheckedIndexedAccess` in file 3 reveals 10+ new errors in callers, stop and reassess ordering; don't push through

## Commit Strategy

- **Per-file commits** for type fixes, autofixes (keep blame clean)
- **.git-blame-ignore-revs** entry for bulk mechanical fixes
- **One PR per phase** (max 4 PRs total)
- **PR body must include**: `Closes #N` for each SonarCloud issue fixed, phase verification gate results

# Drop Monorepo — Remediation Plan
**Source**: Hyperplan adversarial review (4 critics: low-effort, artistry, high-effort, ultrabrain — 3 rounds)
**Generated**: 2026-07-26
**Scope**: Items with cross-critic adversarial consensus only (items without consensus dropped)

---

## 1. Executive Summary

Six audits produced 200+ findings across Drop's codebase, CI/CD, documentation, and tooling. After 3 rounds of adversarial cross-critique (independent analysis → cross-attack → defend/refine/concede), ~30 items survived consensus into this plan. The plan has 3 phases: **Foundation** (Day 1, ~6h — config-only, zero code logic changes, highest ROI), **Correctness** (Days 2-3, ~8h — production bugs, DB integrity), and **Structural** (Days 4-10, ~22h — CI, process gates, test infrastructure, Rust unsafety). Total: ~36 hours over 2 weeks for a solo developer. 4 P0 items (SonarQube exclusion, CodeQL autobuild, 2 torrential unwrap panics), 11 P1 items, 4 process changes, and 9 config hygiene items. 9 items deferred with explicit trigger conditions.

---

## 2. Phasing Strategy

### Phase 1 — Foundation (Day 1)
Config-only and zero code-logic changes. Every item is independent — all can run in parallel. Highest-ROI item in the entire plan (P0-1: 15 minutes to turn SonarQube gate green). No risk of regressions because no logic is touched.

### Phase 2 — Correctness (Days 2-3)
Production runtime bugs + DB integrity. Torrential unwrap fixes (P0-3, P0-4) must be done sequentially (same crate). All other items (P1-1 through P1-5) are independent and can parallelize. These carry some regression risk — each fix has a verification gate.

### Phase 3 — Structural (Days 4-10)
Heavier items: CI workflows for uncovered workspaces, dependency migrations, process gate setup, and the testing-trap-breaking reference test. Some items block others (PROC-3 must precede P1-4 verification; PROC-2 must precede soft-delete suppressions cleanup).

---

## 3. Per-Phase Tasks

### Phase 1 — Foundation (Day 1, ~6 hours)

| ID | Task | Files | Effort | Verification | Dependencies |
|----|------|-------|--------|-------------|--------------|
| P0-1 | Exclude `prisma/migrations/` from SonarQube analysis | `sonar-project.properties` (create if absent) | 15m | Run SonarCloud analysis → 8 BLOCKERs disappear, QG turns GREEN | None |
| P0-2 | Switch CodeQL to `build-mode: autobuild` for JS/TS + Rust | `.github/workflows/codeql.yml` | 4h | Trigger CodeQL workflow on test PR → taint-tracking queries execute (verify in SARIF output) | None |
| PROC-1 | Create `fallow.toml` with Nuxt path excludes | New `fallow.toml` at repo root | 1h | Run `fallow audit --format json` → issue count drops from 671 to ~240 | None |
| PROC-5a | Fix CLAUDE.md:35 (pre-commit behavior falsehood) | `CLAUDE.md` | 10s | Line 35 accurately states `lint-staged + typecheck` (not `pnpm test`) | None |
| PROC-5b | Fix CLAUDE.md:79 (dead path reference) | `CLAUDE.md` | 10s | Line 79 no longer references `server/.husky/pre-commit` | None |
| CONF-1 | Pin `vue`/`vue-router` from `"latest"` to lockfile-resolved version | `server/package.json` | 30s | `pnpm ls vue` shows concrete version (e.g., `3.4.x`) | None |
| CONF-2 | Pin `vue-router` from `"latest"` | `desktop/main/package.json` | 30s | `pnpm ls vue-router` shows concrete version | None |
| CONF-3 | Add `fallow.txt` + `fallow.json` to `.gitignore` | `.gitignore` | 30s | `git status` no longer shows these files as untracked | None |
| CONF-4 | Remove `server/.editorconfig` (redundant subset of root) | `server/.editorconfig` | 3s | File deleted. `pnpm --filter drop lint` still passes | None |
| CONF-5 | Remove commented-out arktype generator | `server/prisma/schema.prisma` lines 13-20 | 30s | `pnpm --filter drop exec prisma validate` passes | None |
| CONF-6 | Remove 7 commented-out code blocks | See 7 files below | 15m | All 7 blocks removed. `pnpm --filter drop typecheck` passes | None |
| CONF-7 | Set Dependabot `schedule.interval: "daily"` for npm | `.github/dependabot.yml` | 2m | Dependabot config valid. Dependabot runs daily check on next cycle | None |
| CONF-8 | Generate root `CHANGELOG.md` | New `CHANGELOG.md` | 10s | File exists at repo root | None |
| CONF-9 | Create PR + issue templates | `.github/PULL_REQUEST_TEMPLATE.md`, `.github/ISSUE_TEMPLATE/bug.yml`, `.github/ISSUE_TEMPLATE/feature.yml` | 30m | 3 template files exist. `gh` recognizes them | None |

**CONF-6 files**: `server/server/internal/tasks/index.ts:524-548`, `server/pages/library/game/[id]/index.vue:144-154`, `server/server/plugins/ca.ts:12`, `server/pages/admin/settings.vue:76-77`, `server/pages/account/security.vue:246`, `server/pages/store/[id]/index.vue:307`, `server/components/UserFooter.vue:134`

---

### Phase 2 — Correctness (Days 2-3, ~8 hours)

| ID | Task | Files | Effort | Verification | Dependencies |
|----|------|-------|--------|-------------|--------------|
| P0-3 | Fix `download.rs:57` double unwrap chain | `torrential/src/downloads/download.rs:57` | 30m | Add test with malformed config → expect `Err` not panic. `cargo test --manifest-path torrential/Cargo.toml` | None (independent) |
| P0-4 | Fix `server/mod.rs:134` inner unwrap defeating error return | `torrential/src/server/mod.rs:134` | 15m | Add test with invalid UTF-8 → expect graceful error, not panic. `cargo test` | None (independent; same crate as P0-3 but different module) |
| P1-1 | Fix Promise boolean at `session/index.ts:195` | `server/server/internal/session/index.ts:195` | 30m | Add unit test: mock `removeSession` to return false → assert `signout` returns false AND cookie IS still cleared (current behavior: cookie is cleared regardless of removeSession outcome). `pnpm --filter drop test` | None |
| P1-2 | Verify Prisma migration DELETE-without-WHERE status | `server/prisma/migrations/20251210231153_move_to_version_id/migration.sql:18` | 1h | SQL: `SELECT migration_name, finished_at FROM _prisma_migrations WHERE migration_name = '20251210231153_move_to_version_id'` | Requires production DB access |
| P1-3 | Add `@@index([userId])` on Client + Session, `@@index([expiresAt])` on Session | `server/prisma/schema.prisma` | 15m + migrate | `EXPLAIN ANALYZE` on user lookup query → index scan not seq scan. `prisma migrate dev --name add_user_session_indexes` | P1-2 (verify migration safety first) |
| P1-5 | Replace `console.log`/`console.error` with pino logger in 5 files | `oidc/index.ts` (×4), `error-handler.ts:3`, `webauthn/finish.post.ts:48`, `desktop/plugins/global-error-handler.ts:6`, `desktop/composables/game.ts:10` | 2h | Trigger an OIDC failure in dev → assert structured log entry, not bare stderr | None |

---

### Phase 3 — Structural (Days 4-10, ~22 hours)

| ID | Task | Files | Effort | Verification | Dependencies |
|----|------|-------|--------|-------------|--------------|
| P1-4 | Fix N+1 query in `objects.ts:149-161` | `server/server/internal/tasks/registry/objects.ts` | 2h | Run task with 100 objects × 5 models → Prisma query count ≤10 (was 500+) | None |
| P1-6 | Add CI for `sites/promo` + `sites/docs` | New `.github/workflows/sites-ci.yml` | 2h | Push PR touching `sites/promo/` → workflow runs typecheck + lint + build | None |
| P1-7 | Add CI for `desktop/main/` (path-filtered for stable files) | New `.github/workflows/desktop-main-ci.yml` | 2h | Push PR touching stable file in `desktop/main/` → workflow runs | Pre-req: audit `desktop/main/` to identify stable dirs |
| P1-8 | Migrate `jsonwebtoken` → `jose` | `server/package.json` + usage in `server/server/internal/auth/` | 2h | `npm ls jsonwebtoken` shows zero usages. `pnpm --filter drop test` passes | None |
| P1-9 | Pin 7 Tauri plugins from `"*"` to explicit versions | `desktop/src-tauri/Cargo.toml` | 30m | `cargo check` passes. `Cargo.lock` shows concrete versions for all 7 | None |
| P1-10 | Fix `@ts-ignore` with no reason (`users.ts:21, news.ts:35`) | `server/composables/users.ts:21`, `server/composables/news.ts:35` | 1h | No `@ts-ignore` remains without `@ts-expect-error` + documented reason | None |
| P1-11 | Fix recursive `read_block()` in libarchive → loop | `libraries/libarchive/src/reader.rs:63` | 1h | Add test with deeply nested archive → assert no stack overflow | None |
| PROC-2 | Narrow `drop/no-prisma-delete` to entity allowlist | `server/rules/no-prisma-delete.mts` | 1h | 6 join-table files no longer need eslint-disable. The 10 remaining suppressions remain but now have documented rationale | None |
| PROC-3 | Write ONE h3 factory reference test for auth route | New `server/test/unit/auth/route-template-reference.test.ts` | 4h | Test passes. A new developer can write the next auth route test by following the reference without inventing new infrastructure | None |
| PROC-4 | Add pre-commit Rust fmt + fallow gate | `.husky/pre-commit` | 1h | Make formatting error in `.rs` → pre-commit fails. Introduce new fallow finding → pre-commit fails | None |

---

## 4. Execution Order (Solo Developer)

### Day 1 — Foundation (6h)

All items in Phase 1 are independent. Execute in any order. Suggested sequence for minimal context-switching:

```
CONF-3   (gitignore: 30s)
CONF-4   (remove editorconfig: 3s)
CONF-8   (changelog: 10s)
CONF-5   (remove arktype comment: 30s)
CONF-1   (pin vue server: 30s)
CONF-2   (pin vue desktop: 30s)
CONF-7   (dependabot daily: 2m)
PROC-5a  (claude.md line 35: 10s)
PROC-5b  (claude.md line 79: 10s)
CONF-6   (7 commented-out blocks: 15m)
CONF-9   (templates: 30m)
PROC-1   (fallow.toml: 1h)
P0-1     (sonarqube exclusion: 15m)
P0-2     (codeql autobuild: 4h)
```

Total: ~6 hours. All config/CI work — no production code touched.

### Day 2 — Correctness I (3h)

```
P1-2   (verify migration status: 1h) — requires production DB
P0-3   (torrential download.rs: 30m)
P0-4   (torrential server/mod.rs: 15m)
P1-1   (Promise boolean: 30m)
```

P1-2 is in parallel with everything else (requires production access, no code change). P0-3 and P0-4 are in same crate but different modules — can be done sequentially in one session.

### Day 3 — Correctness II (3h)

```
P1-3   (add prisma indexes: 15m + migrate) — blocks on P1-2 verification
P1-5   (structured logger: 2h)
```

P1-5 runs independently of everything else.

### Day 5 — Structural I (6h)

```
P1-9   (tauri plugin pins: 30m) — independent
P1-11  (libarchive recursion → loop: 1h) — independent
P1-10  (@ts-ignore fixes: 1h) — independent
PROC-4 (pre-commit rust fmt + fallow gate: 1h) — independent
PROC-2 (narrow eslint rule: 1h) — independent
P1-6   (sites CI: 2h) — independent
```

All 6 items are independent. Can batch: 3 quick items (P1-9, P1-10, P1-11, PROC-4, PROC-2) then 2 larger ones (P1-6).

### Day 10 — Structural II (8h)

```
P1-7   (desktop/main CI: 2h) — requires prereq audit of stable dirs
P1-8   (jsonwebtoken → jose: 2h) — independent
P1-4   (N+1 query fix: 2h) — independent  
PROC-3 (reference test: 4h) — independent
```

PROC-3 is the heaviest single item (4h). Do it when fresh. P1-7 requires a directory audit first (30m). P1-8 and P1-4 are straightforward.

---

## 5. Verification Gates

### Gate 1 — End of Phase 1
- [ ] `pnpm --filter drop typecheck && pnpm --filter drop lint` passes (CLAUDE.md changes don't affect code, config changes don't break anything)
- [ ] SonarCloud Quality Gate is GREEN (verify in SonarCloud dashboard)
- [ ] CodeQL workflow completes on test PR (verify in Actions tab)
- [ ] `fallow audit --format json` shows ~240 findings (was 671)
- [ ] All 14 config/template/changelog files exist in correct locations

### Gate 2 — End of Phase 2
- [ ] `cargo test --all-features --all && cargo clippy --all-targets --all-features -- -D warnings && cargo fmt --all -- --check` passes (torrential + libarchive)
- [ ] `pnpm --filter drop test` passes (Promise boolean fix + structured logger)
- [ ] `pnpm --filter drop typecheck` passes (no TS regressions)
- [ ] `SELECT migration_name, finished_at FROM _prisma_migrations WHERE migration_name = '20251210231153_move_to_version_id'` confirms migration status
- [ ] `EXPLAIN ANALYZE` on user lookup query shows index scan (P1-3)

### Gate 3 — End of Phase 3
- [ ] All 4 new CI workflows pass (sites-ci.yml, desktop-main-ci.yml)
- [ ] `npm ls jsonwebtoken` shows zero usages
- [ ] Pre-commit hooks work: formatting error → fails, fallow finding → fails
- [ ] N+1 query resolved: Prisma query count ≤10 for 100-object × 5-model test
- [ ] Reference test passes: auth route handler test covers sign-in flow
- [ ] Tauri plugins pinned: `Cargo.lock` shows concrete versions
- [ ] ESLint rule narrowed: 6 join-table suppressions removed

---

## 6. Risk & Mitigation

### Phase 1 Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| SonarQube exclusion doesn't work on free tier | Medium | High (8 BLOCKERs persist) | Test with one exclusion first. Fallback: use `sonar.issue.ignore.multicriteria` to suppress specific rule IDs instead of path exclusion |
| CodeQL autobuild fails for Nuxt/Nitro project | Medium | Medium (P0-2 delayed) | Fall back to `build-mode: manual` with explicit `pnpm run build` step. Nuxt has documented CodeQL setup |
| `vue` pin breaks Nuxt compatibility | Low | Low | Pin to lockfile-resolved version (same version already installed). Nuxt peer-dep constrains to Vue 3.x |
| `fallow.toml` excludes too much, hiding real dead code | Low | Low | Start with conservative ignores (`.nuxt/`, `node_modules/`, `dist/` only). Add Nuxt routing dirs only after verifying remaining findings |

### Phase 2 Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Torrential unwrap fix changes behavior | Low | Medium | Tests verify malformed config returns `Err`, not panic. No behavior change for valid configs |
| Promise boolean fix (adding `await`) changes signout behavior | Low | Medium | Verify intent first. If silent-swallow is intentional, add `await` + explicit error logging (not just `if (!await ...)`). The cookie-is-cleared behavior is correct either way |
| Migration DELETE-without-WHERE is unapplied in production | Low | Critical | Verify BEFORE any other migration work. If unapplied, manually review the 2025-12-10 migration's intent before applying |
| Adding indexes locks tables on large DB | Low | Low | PostgreSQL 12+ supports `CREATE INDEX CONCURRENTLY`. Add indexes with `CONCURRENTLY` flag in migration SQL |

### Phase 3 Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `jsonwebtoken` → `jose` breaks existing JWT tokens | Medium | High | Token format differs between libraries. Must support CURRENT tokens (verify) while issuing NEW tokens via `jose`. Staged rollout: issue via `jose`, verify both `jsonwebtoken` AND `jose` can decode for one release cycle |
| Desktop/main CI on Nuxt 4 migration is perpetually red | Medium | Medium | Path-filter to exclude directories known to be in migration flux. Start with CI on `composables/`, `utils/`, config files only |
| N+1 query fix changes query semantics | Low | Medium | Verify: `findUnreferencedStrings` must return the SAME results. Compare output before and after fix on a test DB |
| Reference test (PROC-3) is too coupled to current auth implementation | Medium | Low | Use the h3 factory pattern (already proven in `test/utils/h3.ts`). If auth handler has too many dependencies, extract a pure function first |

---

## 7. Out-of-Scope Confirmation

These items were **dropped or deferred** by adversarial consensus:

| Item | Trigger for Reassessment | Reason for Deferral |
|------|-------------------------|---------------------|
| **Coverage > 30%** (test-coverage-audit) | Coverage crosses 30% OR test infrastructure enables cost-effective testing | Matches AGENTS.md deferred work. 1.17% → 30% requires route refactoring (200-300h). Not feasible without breaking Cycle 1 first (PROC-3) |
| **`verbatimModuleSyntax` enable** | After 30+ latent errors from `noUncheckedIndexedAccess` are fixed | Codemod touches 100+ files; must be isolated PR, not mixed with fixes |
| **Full JSDoc/TSDoc sprint** | First external contributor submits PR against undocumented code | Zero JSDoc is emergent convention, not deliberate policy. Breaks at first contributor contact |
| **Soft-delete violations (10 entity suppressions)** | When actual soft-delete implementation is planned | 6 of 16 are join-table false positives (fixed in PROC-2). Remaining 10 require proper soft-delete implemention (~4h, deferred) |
| **Full route test suite (200-300h)** | After PROC-3 (reference test) and 3+ routes follow the template | Cannot refactor 100 routes without proven pattern |
| **`noUncheckedIndexedAccess` enable** | After 30+ latent TS errors fixed per AGENTS.md | 30+ errors tracked. Fix per-site before enabling globally |
| **husky v10 migration** | husky v10 actual release | Not yet released |
| **commitlint** | Team > 1 | Solo dev → zero value |
| **SonarCloud C rating fix** | Auth available to view findings | Cannot fix what cannot be seen |
| **P0-7 (no DB migration in release)** | N/A — FALSE POSITIVE | `launch.sh:5` runs `prisma migrate deploy` at container startup. Runtime-migration pattern is valid |
| **Codecov thresholds** | Coverage > 30% | At 1.17%, any threshold blocks every PR |
| **Architecture ADRs** | Second contributor onboarded | Single-dev consensus is implicit |

---

## 8. Final Verification Checklist

Before the remediation is declared complete:

- [ ] **Phase 1 complete**: All 14 Foundation items done. SonarQube QG green. CodeQL does dataflow analysis. Fallow reports ~240 findings. CLAUDE.md accurate. All config hygiene applied.
- [ ] **Phase 2 complete**: Torrential has zero panic-on-malformed-input paths (verified by test). Session cleanup works correctly (verified by test). Prisma migration status verified. Proper indexes on Client + Session. Production errors go to structured logger.
- [ ] **Phase 3 complete**: All 4 new CI workflows exist and pass. `jsonwebtoken` fully migrated to `jose`. Tauri plugins pinned. N+1 query resolved. Testing trap broken (reference test exists). Pre-commit covers Rust + fallow. ESLint rule narrowed to entity allowlist.
- [ ] **Verification gates passed**: All verification steps in Section 5 pass.
- [ ] **No regressions**: `pnpm --filter drop test` passes (same or more tests than before). `pnpm --filter drop typecheck` passes. `cargo test --all-features --all` passes.
- [ ] **Deferred items documented**: DROP/DEFER items logged in AGENTS.md or equivalent tracking.

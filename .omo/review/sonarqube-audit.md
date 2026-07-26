# SonarQube Audit Report — Drop Project

**Generated:** 2026-07-25
**Project Key:** `BillyOutlast_drop`
**Branch:** `develop` (main branch)
**Analysis Date:** 2026-07-26T01:47:37Z

---

## 1. Quality Gate: ❌ ERROR

| Condition | Status | Threshold | Actual |
|-----------|--------|-----------|--------|
| new_reliability_rating | ❌ ERROR | 1 | **3** |
| new_security_rating | ❌ ERROR | 1 | **3** |
| new_maintainability_rating | ✅ OK | 1 | 1 |
| new_duplicated_lines_density | ✅ OK | 3 | 0.1 |
| new_security_hotspots_reviewed | ✅ OK | 100 | 100.0 |

**Quality Gate fails** due to reliability and security ratings exceeding threshold.

---

## 2. Project Metrics

| Metric | Value |
|--------|-------|
| Lines of Code (ncloc) | 72,023 |
| Cyclomatic Complexity | 3,765 |
| Total Violations | 127 |
| Bugs | 10 |
| Vulnerabilities | 13 |
| Code Smells | 104 |
| Security Hotspots | 0 |
| Technical Debt | 1,179 min (~19.7 hours) |
| Duplicated Lines Density | 1.1% |
| Test Coverage | N/A (not reported to SonarCloud) |

---

## 3. Issues by Severity

### 3.1 BLOCKER (6 issues)

| # | File | Line | Rule | Message |
|---|------|------|------|---------|
| 1 | `server/prisma/migrations/20260206064926_rename_gametypes/migration.sql` | 15 | plsql:QuotedIdentifiersCheck | Avoid using quoted identifiers. |
| 2 | `server/prisma/migrations/20251210231153_move_to_version_id/migration.sql` | 18 | plsql:DeleteOrUpdateWithoutWhereCheck | Ensure WHERE clause is not missing in this DELETE query. |
| 3 | `server/prisma/migrations/20250721053244_update_genre_names/migration.sql` | 13 | plsql:QuotedIdentifiersCheck | Avoid using quoted identifiers. |
| 4 | `server/prisma/migrations/20250721061200_remove_genres/migration.sql` | 11 | plsql:QuotedIdentifiersCheck | Avoid using quoted identifiers. |
| 5 | `server/prisma/migrations/20250401083942_rename_save_to_cloud_saves/migration.sql` | 14 | plsql:QuotedIdentifiersCheck | Avoid using quoted identifiers. |
| 6 | `server/prisma/migrations/20241226065709_rename_custom_to_manual/migration.sql` | 15 | plsql:QuotedIdentifiersCheck | Avoid using quoted identifiers. |
| 7 | `server/prisma/migrations/20241105221904_different_client_capabilities/migration.sql` | 13 | plsql:QuotedIdentifiersCheck | Avoid using quoted identifiers. |
| 8 | `server/prisma/migrations/20241105222110_trackable_names_for_capabilities/migration.sql` | 13 | plsql:QuotedIdentifiersCheck | Avoid using quoted identifiers. |

> All BLOCKER issues are in auto-generated Prisma migration SQL — inherited from Prisma's naming conventions. The DELETE without WHERE (item 2) warrants review.

### 3.2 CRITICAL / HIGH (4 issues — Cognitive Complexity)

| # | File | Line | Rule | Message |
|---|------|------|------|---------|
| 1 | `server/server/internal/auth/oidc/index.ts` | 154 | ts:S3776 | Cognitive Complexity 24 (limit 15). Refactor function. |
| 2 | `server/server/internal/session/cache.ts` | 50 | ts:S3776 | Cognitive Complexity 23 (limit 15). Refactor function. |
| 3 | `server/server/internal/session/db.ts` | 156 | ts:S3776 | Cognitive Complexity 24 (limit 15). Refactor function. |
| 4 | `server/server/internal/session/memory.ts` | 41 | ts:S3776 | Cognitive Complexity 21 (limit 15). Refactor function. |

> All CRITICAL issues are high cognitive complexity in core server logic (auth + session management). 3 of 4 in session layer.

### 3.3 MAJOR / MEDIUM (73 issues — top 30 listed by area)

#### Accessibility (Web:S6819, Web:InputWithoutLabelCheck, Web:S5255)

| # | File | Line | Rule | Message |
|---|------|------|------|---------|
| 1 | `server/components/GameEditor/Metadata.vue` | 56 | Web:S6853 | Form label must be associated with a control. |
| 2 | `server/components/GameEditor/Metadata.vue` | 90 | Web:InputWithoutLabelCheck | Input missing id + label. |
| 3 | `server/components/GameEditor/Metadata.vue` | 102 | Web:InputWithoutLabelCheck | Input missing id + label. |
| 4 | `server/components/GameEditor/Metadata.vue` | 218 | Web:S6819 | Use `<output>` instead of status role. |
| 5 | `server/components/Selector/MultiItem.vue` | 96 | Web:S6819 | Use `<output>` instead of status role. |
| 6 | `server/pages/admin/task/[id]/index.vue` | 71 | Web:S6819 | Use `<output>` instead of status role. |
| 7 | `server/pages/admin/library/index.vue` | 463 | Web:S6819 | Use `<output>` instead of status role. |
| 8 | `server/pages/admin/library/import.vue` | 266 | Web:S6819 | Use `<output>` instead of status role. |
| 9 | `server/pages/admin/library/[id]/import.vue` | 321 | Web:S6819 | Use `<output>` instead of status role. |
| 10 | `server/pages/client/authorize/[id].vue` | 69 | Web:InputWithoutLabelCheck | Input missing id + label. |
| 11 | `server/layouts/admin.vue` | 59,101 | Web:S5255 | Add aria-label to nav elements. |
| 12 | `server/components/UserHeader.vue` | 7,146 | Web:S5255 | Add aria-label to nav elements. |
| 13 | `server/pages/store/[id]/index.vue` | 54 | Web:S5256 | Add `<th>` headers to table. |
| 14 | `server/components/StoreView.vue` | 465 | ts:S3358 | Extract nested ternary operation. |
| 15 | `desktop/main/components/LibrarySearch.vue` | 96 | Web:S6819 | Use `<output>` instead of status role. |
| 16 | `desktop/main/pages/library/[id]/index.vue` | 348 | Web:S6819 | Use `<output>` instead of status role. |
| 17 | `desktop/main/components/InitiateAuthModule.vue` | 17 | Web:S6819 | Use `<output>` instead of status role. |
| 18 | `desktop/main/pages/auth/processing.vue` | 4 | Web:S6819 | Use `<output>` instead of status role. |
| 19 | `libraries/base/components/LoadingButton.vue` | 7 | Web:S6819 | Use `<output>` instead of status role. |

#### Security-Sensitive

| # | File | Line | Rule | Message |
|---|------|------|------|---------|
| 20 | `.github/workflows/e2e.yml` | 64 | githubactions:S6505 | Omit `--ignore-scripts` allows lifecycle scripts to run. |
| 21 | `Dockerfile` | 37 | docker:S8549 | Unlocked dependency versions (security-sensitive). |
| 22 | `desktop/optimize-appimage.sh` | 17 | shell:S6506 | Not disabling redirects might allow insecure redirects. |

#### Dependency Locking (text:S8570)

| # | File | Rule | Message |
|---|------|------|---------|
| 23 | `libraries/libarchive/Cargo.toml` | text:S8570 | Cargo.lock may be missing — versions not predictable. |
| 24 | `libraries/native_model/Cargo.toml` | text:S8570 | Cargo.lock may be missing. |
| 25 | `libraries/native_model/native_model_macro/Cargo.toml` | text:S8570 | Cargo.lock may be missing. |
| 26 | `libraries/native_model/tests_crate/Cargo.toml` | text:S8570 | Cargo.lock may be missing. |

#### Code Quality (TypeScript)

| # | File | Line | Rule | Message |
|---|------|------|------|---------|
| 27 | `server/server/internal/metadata/steam.ts` | 646,918,1010,1013,1107 | ts:S8786 | Regex with super-linear backtracking (5 occurrences). |
| 28 | `server/server/internal/metadata/steam.ts` | 449 | ts:S4624 | Nested template literal. |
| 29 | `server/server/internal/metadata/giantbomb.ts` | 361 | ts:S4624 | Nested template literal. |
| 30 | `server/server/internal/metadata/igdb.ts` | 652 | ts:S1751 | Loop body allows only one iteration. |
| 31 | `server/server/internal/metadata/pcgamingwiki.ts` | 340 | ts:S6035 | Replace alternation with character class. |
| 32 | `server/server/internal/session/index.ts` | 195 | ts:S6544 | Expected non-Promise value in boolean conditional. |
| 33 | `server/server/api/v1/client/game/[id]/versions.get.ts` | 11,12 | ts:S4782 | Redundant `undefined` type with `?` specifier. |
| 34 | `server/server/internal/library/manifest/utils.ts` | 3 | ts:S6564 | Redundant type alias for `V2Manifest`. |
| 35 | `server/server/internal/library/index.ts` | 381 | ts:S4043 | Use `toSorted()` instead of in-place `sort()`. |
| 36 | `server/server/internal/utils/prioritylist.ts` | 32 | ts:S4043 | Use `toSorted()` instead of in-place `sort()`. |
| 37 | `server/server/internal/objects/objectHandler.ts` | 24 | ts:S6564 | Redundant type alias for `string`. |
| 38 | `server/server/internal/db/database.ts` | 10 | ts:S2137 | Do not use `globalThis` to declare a variable. |
| 39 | `server/server/routes/auth/oidc.get.ts` | 18 | ts:S4624 | Nested template literal. |
| 40 | `server/composables/current-page-engine.ts` | 15 | ts:S4043 | Use `toSorted()` instead of in-place `sort()`. |
| 41 | `desktop/main/composables/current-page-engine.ts` | 16 | ts:S4043 | Use `toSorted()` instead of in-place `sort()`. |
| 42 | `desktop/main/pages/settings/index.vue` | 45 | ts:S7785 | Prefer top-level await over promise chain. |
| 43 | `desktop/main/pages/setup/server.vue` | 97 | ts:S1854 | Remove useless assignment to `result`. |
| 44 | `server/pages/admin/users/auth/simple/index.vue` | 427,442 | ts:S1121 | Extract assignment from expression. |
| 45 | `server/pages/admin/users/auth/simple/index.vue` | 446 | ts:S8786 | Regex with super-linear backtracking. |

#### Promo Site

| # | File | Line | Rule | Message |
|---|------|------|------|---------|
| 46 | `sites/promo/src/components/comparison.tsx` | 54 | ts:S6772 | Ambiguous spacing after img element. |
| 47 | `sites/promo/src/components/comparison.tsx` | 200 | ts:S3358 | Extract nested ternary. |
| 48 | `sites/promo/src/components/comparison.tsx` | 281,310 | ts:S6479 | Do not use Array index in keys. |
| 49 | `sites/promo/src/components/comparison.tsx` | 330 | ts:S7721 | Move function `onlyUnique` to outer scope. |
| 50 | `sites/promo/src/components/comparison.tsx` | 458,463 | ts:S3358 | Extract nested ternary (2x). |
| 51 | `sites/promo/src/components/map.tsx` | 53 | ts:S2137 | Do not use `Map` to declare a function. |
| 52 | `sites/promo/src/components/sponsors.tsx` | 101 | ts:S1763 | Unreachable code (lines 101-116). |
| 53 | `sites/promo/src/components/sponsors.tsx` | 245,262 | ts:S6479 | Do not use Array index in keys. |
| 54 | `sites/promo/src/components/team.tsx` | 137 | ts:S6822 | Redundant explicit `role="list"` on `<ul>`. |

### 3.4 MINOR / LOW (45 issues — representative selection)

#### Security-adjacent

| # | File | Line | Rule | Message |
|---|------|------|------|---------|
| 1 | `server/server/internal/services/torrential/index.ts` | 62,95 | ts:S4036 | PATH variable may contain writable directories. |
| 2 | `server/server/internal/services/services/nginx.ts` | 16 | ts:S4036 | PATH variable may contain writable directories. |
| 3 | `server/nuxt.config.ts` | 33 | ts:S4036 | PATH variable may contain writable directories. |
| 4 | `server/server/internal/auth/oidc/index.ts` | 105 | ts:S5332 | Using http protocol (use https instead). |
| 5 | `Dockerfile` | 62 | docker:S6471 | "node" image runs as root user. |

#### Code Quality

| # | File | Line | Rule | Message |
|---|------|------|------|---------|
| 6 | `server/rules/no-prisma-delete.mts` | 3 | ts:S7776 | Use `Set` instead of array for `blacklistedFunctions`. |
| 7 | `server/server/api/v1/store/index.get.ts` | 90 | ts:S7776 | Use `Set` instead of array for `companyActions`. |
| 8 | `server/server/internal/metadata/pcgamingwiki.ts` | 49 | ts:S4323 | Replace union type with type alias. |
| 9 | `server/server/internal/config/application-configuration.ts` | 15 | ts:S7784 | Prefer `structuredClone` over `JSON.parse(JSON.stringify(...))`. |
| 10 | `server/composables/ws.ts` | 32 | ts:S1301 | Replace switch with if statements. |
| 11 | `server/server/internal/clients/event-handler.ts` | 28 | ts:S1301 | Replace switch with if statements. |
| 12 | `sites/promo/eslint.config.mjs` | 2,3 | js:S7772 | Prefer `node:path` / `node:url` imports. |
| 13 | `server/server/internal/utils/recursivedirs.ts` | 1,2 | ts:S7772 | Prefer `node:fs` / `node:path` imports. |

> Full list: 45 MINOR/INFO issues — mostly stylistic, modernization, and convention violations.

---

## 4. Security Hotspots

**Total: 0** — No security hotspots requiring review.

---

## 5. Dependency Risks

**N/A** — Advanced Security not enabled for this SonarCloud organization. Cannot audit dependency risks via SonarQube.

---

## 6. Duplicated Code

**Overall: 1.1% duplication density | 1,003 duplicated lines | 40 duplication blocks | 32 files affected**

### Worst-offending files (>50% duplicated lines)

| File | Duplicated Lines | Density | Blocks |
|------|-----------------|---------|--------|
| `server/server/internal/acls/descriptions.ts` | 98 | **81.7%** | 5 |
| `server/server/api/v1/collection/[id]/index.get.ts` | 30 | **81.1%** | 1 |
| `server/server/api/v1/client/news/index.get.ts` | 25 | **83.3%** | 1 |
| `server/server/api/v1/client/collection/[id]/index.get.ts` | 25 | **78.1%** | 1 |
| `server/server/api/v1/collection/[id]/index.delete.ts` | 29 | **78.4%** | 1 |
| `server/server/api/v1/client/collection/[id]/index.delete.ts` | 24 | **75.0%** | 1 |
| `server/server/api/v1/admin/news/index.get.ts` | 27 | **73.0%** | 2 |
| `server/server/api/v1/client/saves/[gameid]/index.get.ts` | 28 | **73.7%** | 1 |
| `server/server/api/v1/client/saves/[gameid]/[slotindex]/index.get.ts` | 35 | **62.5%** | 1 |
| `server/server/api/v1/client/saves/[gameid]/[slotindex]/index.delete.ts` | 35 | **67.3%** | 1 |
| `server/server/api/v1/client/saves/[gameid]/[slotindex]/push.post.ts` | 35 | **68.6%** | 1 |
| `server/server/api/v1/collection/[id]/entry.post.ts` | 18 | **72.0%** | 1 |
| `server/server/api/v1/admin/company/[id]/banner.post.ts` | 28 | **53.8%** | 1 |
| `server/server/api/v1/admin/company/[id]/icon.post.ts` | 28 | **52.8%** | 1 |
| `server/composables/current-page-engine.ts` | 15 | **50.0%** | 1 |

### Cross-workspace duplication

| File | Duplicated Lines | Density |
|------|-----------------|---------|
| `server/composables/current-page-engine.ts` | 15 | 50.0% |
| `desktop/main/composables/current-page-engine.ts` | 15 | 45.5% |

| File | Duplicated Lines | Density |
|------|-----------------|---------|
| `server/pages/account/tokens.vue` | 52 | 22.6% |
| `server/pages/admin/settings/tokens.vue` | 52 | 22.2% |

**Duplication patterns:**
- `acls/descriptions.ts` has 5 duplicate blocks — largest concentration
- Many `server/api/v1/` route handlers share boilerplate patterns (collection, notification, saves routes)
- `server/nuxt.config.ts` has 2 blocks with 54 duplicated lines
- Session implementations (`cache.ts` / `memory.ts`) share 39-40 duplicated lines
- WebAuthn and Passkey `finish.post.ts` share 39 lines

---

## 7. Coverage Gaps

**N/A** — No coverage data reported to SonarCloud for this project. Test coverage is not tracked in SonarQube.

Per AGENTS.md: 32 vitest tests (1.17% line coverage), 10 cargo tests, 6 database cargo tests. Coverage baseline at 1.17% lines / 2.09% functions.

---

## 8. Summary

| Category | Count | Notes |
|----------|-------|-------|
| Violations (total) | 127 | |
| Bugs | 10 | 8 BLOCKER (SQL, auto-generated), 0 actual code bugs |
| Vulnerabilities | 13 | Security-adjacent config issues |
| Code Smells | 104 | Cognitive complexity, regex perf, a11y, duplication |
| Security Hotspots | 0 | None requiring review |
| Dependency Risks | N/A | Advanced Security not enabled |
| Quality Gate | ❌ ERROR | Reliability + Security ratings fail |
| Technical Debt | 1,179 min | ~19.7 hours estimated |
| Duplication | 1.1% | 1,003 lines in 32 files |
| Coverage | N/A | Not reported to SonarCloud |

**Top priorities:**
1. Fix DELETE without WHERE in `20251210231153_move_to_version_id/migration.sql`
2. Refactor high-complexity functions in session layer (3 files) + OIDC
3. Fix regex backtracking in `steam.ts` (5 occurrences) + `pcgamingwiki.ts`
4. Resolve `Promise`-in-boolean bug in `session/index.ts:195`
5. Security PATH issues in `torrential/index.ts`, `nginx.ts`, `nuxt.config.ts`
6. Unreachable code in `sites/promo/src/components/sponsors.tsx:101-116`

# CI/CD & Automation Audit — Drop Monorepo

**Date**: 2026-07-25
**Auditor**: CI/CD & Automation Auditor

---

## 1. Workflow Inventory

### Core CI

| Workflow | Triggers | Jobs | Caching | Notes |
|----------|----------|------|---------|-------|
| **ci.yml** | push/PR main, develop | validate (actionlint + risk register), dependency-review, secrets (gitleaks), typecheck, lint & format, test + coverage, SonarCloud, dockerfile lint (hadolint), shellcheck | pnpm cache | Main quality gate — runs on ALL changes to main/develop. Contains 10 jobs running in parallel. |
| **server-ci.yml** | push/PR develop — paths: server/**, libraries/base/** | typecheck, lint, test | pnpm cache | Narrower trigger than ci.yml. Redundant with ci.yml on develop. |
| **droplet-ci.yml** | push/PR develop — paths: libraries/droplet, droplet_types, libarchive | Build, Test, Lint (fmt, clippy, test, coverage, audit) | Rust cache (swatinem) | Covers Rust libraries. Has `workflow_dispatch`. |
| **desktop-ci.yml** | push/PR develop — paths: desktop/src-tauri/** | fmt, check (cargo check), test (continue-on-error), coverage, audit | Rust cache | No clippy — `cargo check` not `clippy`. Tests on `continue-on-error`. |
| **cli-ci.yml** | push/PR develop — paths: cli/** | fmt, clippy, test, coverage, audit | Rust cache | Has `workflow_dispatch`. |
| **e2e.yml** | push/PR develop — paths: server/** | Playwright E2E | pnpm cache | Single job, no matrix. Installs chromium only. |
| **editorconfig-ci.yml** | push/PR develop | editorconfig-checker | pnpm cache | Validates .editorconfig compliance. |

### Security

| Workflow | Triggers | Analysis |
|----------|----------|----------|
| **codeql.yml** | push/PR develop, schedule (weekly Sun) | CodeQL Advanced — 4 languages (actions, go, javascript-typescript, rust). Uses `build-mode: none` for most — no actual build analysis. |
| **osv-scanner.yml** | push/PR develop, merge_group, schedule (weekly Fri) | OSV-Scanner — recursive scan for known vulnerabilities. Reusable workflow. |

### Release

| Workflow | Triggers | Build & Deploy |
|----------|----------|----------------|
| **server-release.yml** | workflow_dispatch, release published, schedule (2 AM daily) | Multi-arch Docker build (linux/amd64 + linux/arm64) with digest + manifest merge. Pushes to ghcr.io/drop-oss/drop. Builds nightly + release images. SBOM + provenance enabled. |
| **client-release.yml** | workflow_dispatch (with tagName input), release published | Tauri build across 5 platforms (macOS arm64 + x64, Ubuntu 22.04 x64 + arm64, Windows x64). Apple code signing. Uploads to GitHub release. |

### Automation

| Workflow | Triggers | Purpose |
|----------|----------|---------|
| **pages.yml** | push develop — paths: sites/promo/**, sites/docs/** | Builds promo site (Next.js) + docs site (Astro) → nests docs at /docs → deploys to GitHub Pages. Concurrency group: "pages". |
| **dependabot-auto-merge.yml** | PR opened/synchronize/reopened | Auto-merges non-major npm Dependabot PRs after CI passes. Cargo + major npm require human review. |
| **stale.yml** | schedule (weekly Mon) | Closes issues after 90 days stale + 14 day grace. Exempts priority/p0, priority/p1. |

---

## 2. Configuration Audit

### Dependabot (`.github/dependabot.yml`)

**Comprehensive coverage — 8 update streams:**
1. Root npm (weekly, grouped minor/patch, limit 10)
2. Desktop/main npm separate workspace (weekly, limit 5)
3. CLI cargo (weekly, limit 5)
4. Droplet cargo (weekly, limit 5)
5. native_model cargo (weekly, limit 5)
6. Desktop src-tauri cargo (weekly, limit 5)
7. Dockerfile root (weekly, limit 5)
8. GitHub Actions (weekly, grouped minor/patch, limit 10)

**Strengths**: Groups reduce PR spam. Rebase strategy auto. Separate reviewer for root npm. Registry config for GitHub Packages.

**Weaknesses**: No `schedule.interval: "daily"` for security-critical deps. All at `weekly` — vulnerability fixes sit for up to 7 days.

### Pre-commit Hook (`.husky/pre-commit`)

```
pnpm --filter drop lint-staged && pnpm --filter drop typecheck
```

**Runs on**: `server/` workspace only (the `drop` package). Runs lint-staged (files staged in git) then typecheck.

### Pre-push Hook (`.husky/pre-push`)

```
pnpm --filter drop test
```

**Runs on push**: Vitest tests for server workspace.

**Gap**: No Rust workspace hooks — `cargo fmt --check` or `cargo clippy` not running pre-commit for Rust changes.

### Lint-Staged (in `server/package.json`)

| Pattern | Commands |
|---------|----------|
| `*.{ts,vue}` | eslint --fix, prettier --write |
| `*.{json,css,scss}` | prettier --write |
| `*.{yaml,yml,md}` | prettier --write |
| `*.{mjs,cjs}` | eslint --fix, prettier --write |
| `*.rs` | cargo fmt -- |

**Note**: `.rs` rule exists but only fires when running inside `server/` workspace via `pnpm --filter drop lint-staged`. Rust files in `cli/`, `libraries/`, `desktop/src-tauri/` are NOT covered by pre-commit hooks.

### Renovate

Found only in `libraries/native_model/renovate.json` — independent config since native_model is a standalone external crate. Not part of main monorepo.

### Risk Register (`security/risk-register.yaml`)

13 entries (RISK-001 through RISK-013). Covered: decompress, lodash, SVGO, request, file-type, Hono/node-server (x2), uuid, Astro (x3), esbuild, Valibot. All have `review_by: 2025-10-24` dates. CI enforcement in `ci.yml` validates that every `pnpm audit --ignore GHSA-...` maps to a risk register entry.

### CODEOWNERS

Covers: security-sensitive auth routes, metadata providers, Nitro server core, build/CI config, AGENTS.md, CONTRIBUTING.md. All owned by @BillyOutlast. Single bus factor — no backup reviewer.

---

## 3. Gaps & Missing Automation

### Missing Workspace CI

| Workspace | CI Exists? | Notes |
|-----------|-----------|-------|
| server/ | ✅ ci.yml, server-ci.yml, e2e.yml | Double coverage on develop |
| cli/ | ✅ cli-ci.yml | |
| desktop/src-tauri/ | ✅ desktop-ci.yml | No clippy |
| libraries/droplet, droplet_types, libarchive | ✅ droplet-ci.yml | |
| libraries/base (TS) | ❌ **MISSING** | Only triggered indirectly via server-ci.yml path filter. No dedicated workflow. |
| libraries/native_model | ❌ **MISSING** | External project with own CI — not run here. Acceptable. |
| sites/promo (Next.js) | ❌ **MISSING** | Only built in pages.yml (deploy). No typecheck/lint on PR. |
| sites/docs (Astro) | ❌ **MISSING** | Only built in pages.yml (deploy). No typecheck/lint on PR. |
| desktop/main/ (Nuxt 4) | ❌ **MISSING** | No CI whatsoever. Runs Nuxt 4 — could break silently. |

### Missing Scheduled Jobs

| Type | Status | Priority |
|------|--------|----------|
| Dependency updates | ✅ Dependabot (weekly) | — |
| Security scan (weekly) | ✅ CodeQL (Sun), OSV (Fri) | — |
| Secret scan (scheduled) | ❌ **MISSING** — gitleaks only runs on push/PR | Medium |
| Image vulnerability scan | ❌ **MISSING** — no Trivy or Grype scan on production images | High |
| License compliance scan | ❌ **MISSING** | Low |
| Docker image rebuild (nightly) | ✅ server-release.yml (2 AM) | — |
| Nightly desktop build | ❌ **MISSING** — client-release.yml schedule is commented out | Medium |
| Database migration checks | ❌ **MISSING** — no Prisma migration validation in CI | Medium |
| Coverage regression tracking | ❌ **MISSING** — coverage uploaded but no thresholds or badges | Low |
| E2E scheduled smoke test | ❌ **MISSING** — e2e.yml only runs on push/PR | Low |

### Missing Deployment Automation

| Deploy Target | Status | Priority |
|---------------|--------|----------|
| Production Docker image | ✅ server-release.yml | — |
| Desktop client release | ✅ client-release.yml | — |
| GitHub Pages (promo + docs) | ✅ pages.yml | — |
| Staging/preview environments | ❌ **MISSING** — no PR preview deployments | Medium |
| DB migration automation | ❌ **MISSING** — no `prisma migrate deploy` in release pipeline | High |
| Rollback mechanism | ❌ **MISSING** — no documented rollback strategy | Medium |

### Missing Release Automation

| Artifact | Status |
|----------|--------|
| Auto-generated changelog | ❌ No changelog generation |
| Semantic release | ❌ No semantic-release or release-please |
| Version bump automation | ❌ Manual version bumps in `server/package.json` |
| Git tag automation | ❌ Tags are manual — `server-release.yml` references `package.json` version |

### Missing Templates

| Template | Status |
|----------|--------|
| PR template | ❌ MISSING |
| Issue templates | ❌ MISSING |
| Bug report template | ❌ MISSING |
| Feature request template | ❌ MISSING |

---

## 4. Performance Issues

### CI Parallelism — GOOD

- **ci.yml**: 10 parallel jobs — excellent parallelism. All jobs are independent.
- **server-ci.yml**: 3 parallel jobs — fine.
- Cross-workflow: All workspace CI workflows run independently — they can run in parallel.

### Caching — MOSTLY GOOD

- **pnpm**: `setup-node cache: pnpm` used everywhere. Good.
- **Rust (swatinem/rust-cache)**: Used in droplet-ci, desktop-ci, cli-ci, client-release. Good.
- **Next.js cache** in pages.yml: Caches `.next/cache` with hash of lockfile + source. Good.
- **Docker layer caching**: NOT used in server-release.yml. `build-push-action` pushes but doesn't use `cache-from`/`cache-to`. Could significantly speed up multi-arch builds.

### Redundant Runs

- **ci.yml + server-ci.yml overlap**: On develop push/PR to `server/**`, BOTH workflows run. server-ci.yml is a subset of ci.yml. This wastes 3-5 minutes of runner time. Consider removing server-ci.yml or making ci.yml the only full gate.

### Wait Time

- **cargo-install in CI**: droplet-ci, desktop-ci, cli-ci all run `cargo install cargo-llvm-cov --locked` and `cargo install cargo-audit --locked` per run. This takes ~2-3 minutes each. Consider pre-building a Docker image with these tools, or using `actions/cache` for cargo install binaries.
- **Ubuntu apt-get update every time**: Every Node.js job runs `sudo apt-get update && sudo apt-get install -y libpng-dev`. This is ~30s per job. Cache the apt sources or pre-build a runner image.

### Matrix Strategy — GOOD

- **server-release.yml**: Dual-platform matrix (amd64 + arm64). Good.
- **client-release.yml**: 5-platform matrix. Good.
- **codeql.yml**: Language matrix (4 languages). Good.

---

## 5. Security Concerns

### Current Security Measures (GOOD)

- ✅ CodeQL Advanced — 4 languages
- ✅ OSV-Scanner — dependency vulnerability scan
- ✅ Gitleaks — secret scanning
- ✅ Dependency review action on PRs (fails on critical)
- ✅ Hadolint — Dockerfile linting
- ✅ Risk register — audit trail for ignored advisories
- ✅ SBOM + provenance in Docker builds
- ✅ `pnpm audit` in CI
- ✅ `cargo audit` (continue-on-error) in all Rust workflows

### Issues

1. **Gitleaks v2 — needs v3 migration** (documented in deferred work, pre-Sept 2026)
2. **cargo audit is `continue-on-error: true`** in ALL three Rust workflows. Fixes won't block CI.
3. **CodeQL `build-mode: none` for JavaScript/TypeScript** — no actual build analysis. This means CodeQL can't do dataflow analysis for JS/TS — only structural queries. Need build-mode: autobuild with proper setup.
4. **CodeQL `build-mode: none` for Rust** — same problem. Rust analysis without build can't track data flow.
5. **`pnpm audit` only runs on server** — not for desktop/main/ workspace, sites, or other npm workspaces.
6. **No scheduled gitleaks scan** — only on push/PR. An accidental secret merge between PR runs isn't caught.
7. **No container image vulnerability scanning** — builds push to ghcr.io but never scan with Trivy/Grype.
8. **`fail_ci_if_error: false` on ALL Codecov uploads** — coverage upload failures are silently ignored.

---

## 6. Branch Protection

No GitHub branch protection rules documented in the repo. No `CODE_OF_CONDUCT.md`. Based on workflows:
- `develop` has required CI checks (ci.yml blocks PRs)
- `main` presumably has stricter protection

**Recommended protections for `main`**:
- Require status checks: ci.yml all jobs, codeql, osv-scanner
- Require PR review (at least 1)
- Require up-to-date branches
- Require signed commits
- No direct pushes
- Require CODEOWNERS review

**Recommended protections for `develop`**:
- Require status checks: ci.yml, path-matched CI
- Require PR review
- Require up-to-date branches

---

## 7. Recommendations (Priority Ordered)

### Critical

| # | Issue | Recommendation |
|---|-------|---------------|
| R1 | **No staging/preview environments** | Add PR preview deployment for server (e.g., ephemeral Docker or preview URLs) |
| R2 | **No DB migration in release** | Add `prisma migrate deploy` step to server-release.yml before image build |
| R3 | **Site workspaces have no CI** | Add `sites-ci.yml` with typecheck + lint for sites/promo and sites/docs on PRs |
| R4 | **desktop/main has no CI** | Add desktop-main-ci.yml with typecheck + lint for Nuxt 4 app |

### High

| # | Issue | Recommendation |
|---|-------|---------------|
| R5 | **ci.yml + server-ci.yml redundant** | Remove server-ci.yml or make ci.yml use path filters and skip server-ci.yml on server changes |
| R6 | **Docker builds have no cache** | Add `cache-from`/`cache-to` with `type=gha` in server-release.yml build step |
| R7 | **Nightly desktop build is commented out** | Uncomment and fix the scheduled trigger in client-release.yml |
| R8 | **CodeQL uses `build-mode: none` for JS/TS and Rust** | Switch to `build-mode: autobuild` or manual for proper data flow analysis. Add node setup for JS/TS. |
| R9 | **cargo-install per CI run** | Cache `~/.cargo/bin` or prebuild tool images for cargo-llvm-cov and cargo-audit |
| R10 | **No gitleaks scheduled scan** | Add `schedule` trigger to the secrets job or a standalone gitleaks scheduled workflow |
| R11 | **No container vulnerability scanning** | Add Trivy/Grype scan to server-release.yml after build |
| R12 | **Nuxt 4 desktop app has zero CI** | Add typecheck + lint for desktop/main/ |

### Medium

| # | Issue | Recommendation |
|---|-------|---------------|
| R13 | **cargo audit is continue-on-error everywhere** | After triaging existing vulns, switch to blocking on new findings |
| R14 | **Gitleaks v2 → v3** | Plan migration before Sept 2026 GitHub Node 20 deprecation |
| R15 | **Pre-commit only covers server/ workspace** | Add to root `.husky/pre-commit`: detect Rust changes and run `cargo fmt --check` |
| R16 | **No PR/issue templates** | Add `.github/pull_request_template.md` and `.github/ISSUE_TEMPLATE/` |
| R17 | **Changelog generation missing** | Add `release-please` or `git-cliff` for automatic changelog |
| R18 | **apt-get update on every job** | Cache apt packages or use custom runner image with libpng-dev pre-installed |
| R19 | **Dependabot weekly is too slow for security** | Set `schedule.interval: "daily"` for npm and cargo ecosystems |

### Low

| # | Issue | Recommendation |
|---|-------|---------------|
| R20 | **PR deployment previews** | Add deploy previews for docs site (Astro → Cloudflare Pages or Vercel) |
| R21 | **Rollback documentation** | Document rollback procedure for DB migrations and Docker deployments |
| R22 | **Codecov `fail_ci_if_error: false`** | Tighten after confirming Codecov works reliably |
| R23 | **Single bus factor in CODEOWNERS** | Add backup reviewer for CI/workflows |
| R24 | **No issue templates** | Add bug report + feature request templates |
| R25 | **No license compliance scan** | Add FOSSA or askalono for license compliance |

---

## 8. Summary

**Strengths**:
- Comprehensive workflow coverage for main server, CLI, desktop, and Rust libraries
- Multi-arch Docker builds with SBOM/provenance
- Good caching strategy (pnpm, Rust, Next.js)
- Strong security scanning (CodeQL, OSV, gitleaks, dependency review)
- Excellent risk register discipline with CI enforcement
- Dependabot covers all 8 ecosystems thoroughly
- Parallel job structure in all workflows

**Critical Gaps**:
- `desktop/main/`, `sites/promo`, `sites/docs`, `libraries/base` have NO dedicated CI
- No database migration in release pipeline
- No staging/preview deployment environments
- Nightly desktop builds are commented out
- Redundant CI between ci.yml and server-ci.yml wasting runner time

**Risk Level**: Medium — gaps exist in coverage for non-server workspaces, but the core server CI is solid. The biggest risk is unreviewed breakage in the Nuxt 4 desktop app and static sites.

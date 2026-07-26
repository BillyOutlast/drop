# Agent Hooks & Configuration Audit Report

**Date:** 2026-07-25
**Auditor:** Agent Hooks & Configuration Auditor (deep-audit-team)
**Repo:** Drop Monorepo (`/home/john/Projects/drop`)

---

## 1. Complete Configuration Inventory

### 1.1 Root Configuration Files

| File | Path | Status | Purpose |
|------|------|--------|---------|
| `AGENTS.md` | `/AGENTS.md` | ✅ Present, 234 lines | Primary agent technical reference |
| `CLAUDE.md` | `/CLAUDE.md` | ✅ Present, 81 lines | Cross-tool behavioral rules (Claude Code, Cursor, Codex, OpenCode) |
| `fallow.txt` | `/fallow.txt` | ✅ Present (output) | Fallow audit output — **not a config file**, it's the rendered report |
| `fallow.json` | `/fallow.json` | ✅ Present | Fallow JSON output — **not a config file**, it's the serialized audit result (3.6.0, 671 issues) |
| `fallow.toml` | `/fallow.toml` | ❌ **MISSING** | Fallow configuration file — does not exist anywhere |
| `package.json` | `/package.json` | ✅ Present | Root package manager config |
| `.editorconfig` | `/.editorconfig` | ✅ Present, 32 lines | Root editor settings |

### 1.2 `.opencode/` Directory (OpenCode Agent Runtime)

| Path | Type | Status |
|------|------|--------|
| `.opencode/package.json` | File | ✅ Has `@opencode-ai/plugin@1.18.3` dependency |
| `.opencode/skills/test-runner/SKILL.md` | File | ✅ Project-level skill for running tests |
| `.opencode/plans/hyperplan-dep-tdd-coverage.md` | File | ✅ Detailed 8-PR execution plan |
| `.opencode/opencode.json` | File | ❌ **MISSING** — No OpenCode config file |
| `.opencode/opencode.jsonc` | File | ❌ **MISSING** — No OpenCode config file (comment variant) |
| `.opencode/agents/` | Dir | ❌ **MISSING** — No custom agent definitions |
| `.opencode/mcp.json` | File | ❌ **MISSING** — No MCP server configs |
| `.opencode/permissions.json` | File | ❌ **MISSING** — No permission rules |

### 1.3 `.claude/` Directory (Claude Code Configuration)

| Path | Type | Status |
|------|------|--------|
| `.claude/settings.json` | File | ✅ Present — PreToolUse hook for fallow gate |
| `.claude/hooks/fallow-gate.sh` | File | ✅ Present — 103-line bash script |
| `.claude/skills/generate-tests/SKILL.md` | File | ✅ Present — Java-focused test generation (186 lines) |
| `.claude/skills/generate-tests/rules/` | Dir | ✅ 25+ rule files covering Java unit tests, general test principles |
| `.claude/skills/generate-test-cases/SKILL.md` | File | ✅ Present — Test case listing only (134 lines) |
| `.claude/skills/generate-test-cases/rules/` | Dir | ✅ 14 rule files covering general test case strategy |

### 1.4 Git Hooks (`.husky/`)

| Path | Status | Content |
|------|--------|---------|
| `.husky/pre-commit` | ✅ **ACTIVE** | `pnpm --filter drop lint-staged && pnpm --filter drop typecheck` |
| `.husky/pre-push` | ✅ **ACTIVE** | `pnpm --filter drop test` |
| `.husky/_/commit-msg` | ✅ Present | Shell wrapper (sources `h`) |
| `.husky/_/husky.sh` | ⚠️ **DEPRECATED** | Shows husky v10 deprecation warning |
| `.husky/_/.gitignore` | ✅ Present | Ignores all files (husky internal pattern) |

### 1.5 CI/Config Files (`.github/`)

| File | Status | Notes |
|------|--------|-------|
| `.github/CODEOWNERS` | ✅ Present | 17 lines — BillyOutlast as sole owner |
| `.github/dependabot.yml` | ✅ Present | 159 lines — 7 ecosystems configured |
| `.github/workflows/ci.yml` | ✅ Present | Main CI |
| `.github/workflows/server-ci.yml` | ✅ Present | Server-only CI |
| `.github/workflows/cli-ci.yml` | ✅ Present | CLI CI |
| `.github/workflows/desktop-ci.yml` | ✅ Present | Desktop CI |
| `.github/workflows/droplet-ci.yml` | ✅ Present | Droplet lib CI |
| `.github/workflows/pages.yml` | ✅ Present | Promo + docs site builds |
| `.github/workflows/codeql.yml` | ✅ Present | Security scanning |
| `.github/workflows/osv-scanner.yml` | ✅ Present | Vulnerability scanning |
| `.github/workflows/editorconfig-ci.yml` | ✅ Present | Editorconfig enforcement |
| `.github/workflows/e2e.yml` | ✅ Present | E2E tests |
| `.github/workflows/stale.yml` | ✅ Present | Stale issue management |
| `.github/workflows/client-release.yml` | ✅ Present | Client releases |
| `.github/workflows/server-release.yml` | ✅ Present | Server releases |
| `.github/workflows/dependabot-auto-merge.yml` | ✅ Present | Auto-merge for dep PRs |
| `.github/scripts/` | ✅ Present | Helper scripts |

### 1.6 Lint & Format Configs

| File | Status | Notes |
|------|--------|-------|
| `.editorconfig` (root) | ✅ Present | 2-space indent, LF, UTF-8, .rs=4-space |
| `server/.editorconfig` | ✅ Present | Subset of root — LF, UTF-8, 2-space |
| `server/.prettierrc.json` | ✅ Present | JSON sort plugin |
| `server/eslint.config.mjs` | ✅ Present | Flat config, vue-i18n, custom no-prisma-delete rule |
| `libraries/base/eslint.config.js` | ✅ Present | Base library eslint |
| `sites/promo/eslint.config.mjs` | ✅ Present | Promo site eslint |
| `desktop/main/.prettierrc.json` | ✅ Present | Desktop prettier |
| `sites/promo/.prettierrc.json` | ✅ Present | Promo prettier |
| `sites/docs/.prettierrc.json` | ✅ Present | Docs prettier |
| `libraries/base/.prettierrc.json` | ✅ Present | Base lib prettier |
| Root `.prettierrc` | ❌ **MISSING** | No root prettier config (individual workspaces have their own) |
| `libraries/base/.editorconfig` | ✅ Present | Base lib editorconfig |

### 1.7 MCP Server Configuration

| Location | Status |
|----------|--------|
| Root MCP config | ❌ No MCP config file found anywhere in repo |
| `.opencode/` | ❌ No MCP configurations |

**Note:** MCP servers appear to be configured externally (via OpenCode/Claude desktop configs or IDE-level settings), not in the repo itself. This is acceptable for agent tooling but means there's no portable, check-in-able MCP configuration.

---

## 2. Fallow Configuration Analysis

### 2.1 Fallow Configuration Files

| Config File | Status | Verdict |
|-------------|--------|---------|
| `fallow.toml` | ❌ **MISSING** | No actual fallow configuration file exists |
| `fallow.txt` | ✅ Present | Rendered audit output (generated, not config) |
| `fallow.json` | ✅ Present | JSON audit result (generated, not config) |

**ISSUE: `fallow.toml` does not exist.** The fallow audit output (`fallow.txt`) is present and shows fallow v3.6.0 analysis, but there is no configuration file to customize:

- No `ignorePatterns` to suppress known false positives
- No `gate` configuration (defaults to `new-only`)
- No per-workspace configuration
- No entry point overrides (uses auto-detected 124 entry points)

### 2.2 Fallow Rules In Effect (from AGENTS.md)

The `AGENTS.md` references a fallow task map and gate:

| Rule | Command | Enforced? |
|------|---------|-----------|
| Pre-commit/pre-push gate | `fallow audit --format json --quiet --explain --gate-marker agent` | ⚠️ Partially — embedded in AGENTS.md as instruction to human/agent |
| Dead code trace before deletion | `fallow dead-code --trace <file>:<export>` | ⚠️ Manual only |
| Dead dependency trace | `fallow dead-code --trace-dependency <name>` | ⚠️ Manual only |
| Health check before refactoring | `fallow health --hotspots --targets` | ⚠️ Manual only |
| Ownership check | `fallow health --ownership` | ⚠️ Manual only |
| Coverage gaps | `fallow health --coverage-gaps` | ⚠️ Manual only |
| Duplication trace | `fallow dupes --trace dup:<fingerprint>` | ⚠️ Manual only |
| Flag detection | `fallow flags` | ⚠️ Manual only |
| Architecture guard check | `fallow guard <files>` | ⚠️ Manual only |
| Security surface scan | `fallow security` | ⚠️ Manual only |

The fallow audit gate is embedded in `AGENTS.md` (via `<!-- fallow:setup-hooks:start/end -->` markers) AND in the `.claude/hooks/fallow-gate.sh` script, which fires on git commit/push in Claude Code sessions. However:

- **No automated CI enforcement** — no `.github/workflows/` workflow runs fallow audit
- **OpenCode does NOT have a similar hook** — only Claude Code has the PreToolUse hook
- **The gate is advisory** — it runs as a Claude Code PreToolUse hook, not a pre-commit hook

### 2.3 Fallow Issues Summary (from fallow.txt)

| Category | Count | Key Concerns |
|----------|-------|-------------|
| Unused files | 385 | 64.3% dead files in server workspace |
| Unused exports | 126 | 21 exports + 105 in already-reported files |
| Unused type exports | 14 | 7 primary + 7 in dead files |
| Unused enum members | 4 | All in `desktop/main/types.ts` |
| Unused class members | 33 | Across objectHandler, session, OIDC, CA, metadata |
| Unused dependencies | 9 | Across desktop/main, sites/docs, sites/promo |
| Unused devDependencies | 1 | `eslint-config-next` in sites/promo |
| Unresolved imports | 44 | Prisma client imports failing resolution |
| Unlisted dependencies | 47 | Packages imported but not in package.json |
| Circular dependencies | 6 | Tasks index.ts (5 cycles) + library/index.ts |
| Duplicates | 124 clone groups | Significant code duplication across Vue components |
| Large functions | 168 total | 10 shown — 990-line template in Metadata.vue |
| High complexity | 227 findings | CRITICAL/HIGH in templates and TS backends |
| File health issues | 499 files | Most server files 100% dead with 0 fan-in |

**Metrics:** 53,270 LOC · maintainability 79.7 (moderate) · 1 churn hotspot

---

## 3. Agent Instruction Quality Assessment

### 3.1 AGENTS.md Quality

**Strengths:**
- ✅ Dense, technical, minimal fluff — matches the "caveman" style instructed
- ✅ Accurate workspace map with language/framework/entry points
- ✅ Clear pnpm policy with version pinning
- ✅ Nuxt double-nesting confusion point explicitly documented
- ✅ Commands table per workspace (build/test/lint)
- ✅ CI workflow map with file paths
- ✅ Pre-commit behavior documented with lint-staged patterns
- ✅ Gotchas section (libpng, tailwindcss recursion, noUncheckedIndexedAccess)
- ✅ Edit protocol (formatter commands)
- ✅ Test state snapshot with coverage baseline
- ✅ Deferred work backlog with triggers and rationale
- ✅ Self-verification instructions for out-of-date facts

**Weaknesses:**
- ⚠️ 234 lines — exceeds the stated "keep under 150 lines" limit
- ⚠️ Skills section in AGENTS.md is unusual — skills are typically in SKILL.md files
- ⚠️ `<!-- fallow:setup-hooks:start/end -->` markers embed HTML comments in markdown — render clean but visually noisy
- ⚠️ Test state is outdated (mentions 32 tests from July 24, 2026)
- ⚠️ Deferred work was captured at PR #22 close-out but repo issues are disabled — no way to track

### 3.2 CLAUDE.md Quality

**Strengths:**
- ✅ Clear behavioral rules (format after edit, verify before completion)
- ✅ Explicit do-not-commit list
- ✅ Package manager enforcement
- ✅ Edit loop detection
- ✅ Cross-tool compatibility (4 agent platforms listed)

**Weaknesses:**
- ⚠️ Line 35 states "pre-commit hook runs lint-staged + `pnpm test` automatically" — **INCORRECT.** The actual pre-commit hook runs `pnpm --filter drop lint-staged && pnpm --filter drop typecheck`, NOT tests. The pre-push hook runs tests. This is a factual error.
- ⚠️ Line 79 mentions `server/.husky/pre-commit` as dead code but git hooks live at root `.husky/` — this is confusing

### 3.3 Conflict Analysis

| Conflict | Files | Severity |
|----------|-------|----------|
| Pre-commit behavior | CLAUDE.md says "runs lint-staged + pnpm test", but `.husky/pre-commit` runs `lint-staged && typecheck` (no test) | **HIGH** — misleading agents |
| Formatter commands | AGENTS.md says `pnpm --filter drop exec prettier --write <file>`; CLAUDE.md says same | ✅ Consistent |
| Package policy | Both say "ALWAYS pnpm" | ✅ Consistent |
| Skill instructions | AGENTS.md says use `npx openskills read`; OpenCode may use different mechanism | ⚠️ **MEDIUM** — skill invocation instructions differ |

### 3.4 Outdated Instructions

| Item | File | Issue |
|------|------|-------|
| Test count "32 vitest + 1 skipped" | AGENTS.md:159 | Snapshot from 2026-07-24, may be stale |
| Pre-commit hook behavior | CLAUDE.md:35 | Factually wrong (no test in pre-commit) |
| `server/.husky/pre-commit` dead | CLAUDE.md:79 | Confusing — no such file exists at that path |
| Coverage baseline 1.17% | AGENTS.md:168 | Snapshot value, may have changed |

---

## 4. Hook Configuration and Gaps

### 4.1 Active Hooks

| Hook | File | Effect | Scope |
|------|------|--------|-------|
| pre-commit | `.husky/pre-commit` | `lint-staged` (format + eslint) + `typecheck` | **Server only** (pnpm --filter drop) |
| pre-push | `.husky/pre-push` | `pnpm --filter drop test` | **Server only** (pnpm --filter drop) |
| Claude PreToolUse (Bash) | `.claude/settings.json` + `.claude/hooks/fallow-gate.sh` | Blocks git commit/push if fallow audit fails | **Claude Code only** |

### 4.2 Missing Hooks

| Hook | Missing? | Impact |
|------|----------|--------|
| `commit-msg` | ✅ Present (but minimal — just sources `h`) | No commit message validation |
| **Rust pre-commit** | ❌ Missing | `cargo fmt` is covered by lint-staged for `*.rs` but `cargo clippy` is not run |
| **Desktop pre-commit** | ❌ Missing | No hooks for `desktop/src-tauri/` Rust code changes |
| **CLI pre-commit** | ❌ Missing | No hooks for `cli/` Rust code changes |
| **Sites pre-commit** | ❌ Missing | No hooks for `sites/promo/` or `sites/docs/` changes |
| **OpenCode hook** | ❌ Missing | No fallow gate or equivalent for OpenCode agent sessions |
| **CI-level fallow gate** | ❌ Missing | No GitHub Action runs fallow audit |

### 4.3 Hook Quality Issues

1. **Pre-commit only covers server workspace.** Running `pnpm --filter drop lint-staged` only lints the `server/` workspace. Rust workspaces (`cli/`, `desktop/src-tauri/`, `libraries/`) are not verified on commit.

2. **No test on pre-commit.** Tests only run on pre-push, meaning an agent can commit code that breaks existing tests and only discover the failure when pushing.

3. **CLAUDE.md contradiction.** States tests run in pre-commit, but they don't. This will cause agents to trust incorrect information.

4. **Fallow gate only in Claude Code.** The `.claude/hooks/fallow-gate.sh` is tied to Claude Code's PreToolUse hook system. OpenCode, Cursor, and Codex agents do not have this protection.

5. **husky v10 deprecation.** The `.husky/_/husky.sh` file shows a deprecation warning for husky v10. Current husky is v9.1.7 (from root `package.json`). When v10 releases, hooks may break.

### 4.4 CODEOWNERS Analysis

**Status:** ✅ Present, but minimal

- Only `@BillyOutlast` as owner for all files
- Security-sensitive paths covered (auth, metadata, Nitro core)
- Agent config files covered (AGENTS.md, CLAUDE.md)
- NOT covered: desktop, CLI, libraries, sites/promo, sites/docs

**Recommendation:** Add more granular ownership as the team grows.

---

## 5. Specific Issues and Recommendations

### 5.1 Critical Issues

| # | Issue | Severity | Recommendation |
|---|-------|----------|---------------|
| 1 | CLAUDE.md says pre-commit runs tests — FALSE | **HIGH** | Fix CLAUDE.md:35 to match actual `.husky/pre-commit` behavior — lint-staged + typecheck, NOT test |
| 2 | No CI-level fallow enforcement | **HIGH** | Add a `.github/workflows/fallow-audit.yml` that runs `fallow audit` on PRs to develop/main. Gate on `--gate-marker agent` |
| 3 | Pre-commit only covers server workspace | **HIGH** | Expand pre-commit to run `cargo fmt --check && cargo clippy -- -D warnings` for changed Rust workspaces, or add per-workspace lint-staged configs |
| 4 | No MCP config in repo | **HIGH** | Consider adding `.opencode/mcp.json` or `.claude/mcp.json` to make MCP server configuration portable and reviewable |

### 5.2 Medium Issues

| # | Issue | Severity | Recommendation |
|---|-------|----------|---------------|
| 5 | No fallow.toml exists | **MEDIUM** | Create `fallow.toml` with ignore patterns for known false positives (e.g., Prisma client imports, Nuxt generated dirs) |
| 6 | Test assertion gap | **MEDIUM** | Move `pnpm --filter drop test` to pre-commit (replacing or supplementing pre-push). Tests take ~30s, not slow enough to justify pre-push-only |
| 7 | No commit-msg validation | **MEDIUM** | Add commitlint or a simple commit-msg hook when team grows >1. Documented in deferred backlog already |
| 8 | OpenCode not configured | **MEDIUM** | Create `.opencode/opencode.json` with skill paths, agent definitions, and hooks mirroring the Claude Code setup |
| 9 | Skill invocation divergence | **MEDIUM** | AGENTS.md says `npx openskills read` for skill loading but OpenCode/Claude use different systems. Standardize or document both |
| 10 | CLAUDE.md references dead path | **MEDIUM** | Remove `server/.husky/pre-commit` dead code reference — confusing and the file doesn't exist |

### 5.3 Low Issues

| # | Issue | Severity | Recommendation |
|---|-------|----------|---------------|
| 11 | AGENTS.md exceeds stated line limit | **LOW** | Trim or remove the deferred-work backlog and skills section to stay under 150 lines |
| 12 | Test state snapshot dated | **LOW** | Update test counts when tests change |
| 13 | husky v10 deprecation pending | **LOW** | When upgrading husky, migrate away from `.husky/_/husky.sh` pattern |
| 14 | CODEOWNERS incomplete | **LOW** | Add coverage for desktop, CLI, libraries, sites when contributors join |
| 15 | `server/.editorconfig` is subset of root | **LOW** | Consider removing redundant `.editorconfig` in favor of root-only |
| 16 | fallow.txt committed to repo | **LOW** | Add `fallow.txt` and `fallow.json` to `.gitignore` — they are generated output, not configuration |

### 5.4 Positive Findings (Non-Issues)

- ✅ Agent instructions are technically accurate and dense — good for AI agents
- ✅ CLAUDE.md and AGEMENTS.md serve different purposes (behavior vs. reference) — good separation
- ✅ Fallow pre-commit gate for Claude Code is well-implemented (fail-open on errors, version floor check, jq dependency check)
- ✅ Husky hooks are correctly wired (`.husky/pre-commit` is the active hook, `_/` directory is internal)
- ✅ Prettier and ESLint configs are modern (flat config, plugins, vue-i18n integration)
- ✅ Dependabot covers 7 ecosystems comprehensively
- ✅ 14 CI workflows provide good coverage for security, linting, building, and releasing
- ✅ CODEOWNERS correctly marks security-critical paths
- ✅ Custom ESLint rule (`no-prisma-delete`) properly enforces soft-delete policy
- ✅ The hyperplan in `.opencode/plans/` is detailed and well-structured (dependency graph, parallel waves, PR-by-PR breakdown, risk table, stop conditions)

---

## 6. Summary

| Area | Grade | Key Action |
|------|-------|------------|
| Agent instructions | B+ | Fix pre-commit falsehood in CLAUDE.md; trim AGENTS.md |
| Fallow configuration | D | Create `fallow.toml`; add CI-based gate |
| Git hooks | B- | Add per-workspace Rust hooks; move test to pre-commit |
| Claude Code config | B | Good hook implementation; needs OpenCode equivalent |
| OpenCode config | F | No `opencode.json`, no MCP config, no agents config |
| Lint/format | A | Modern flat configs, custom rules, good plugin support |
| CI/CD | A- | 14 workflows comprehensive; missing fallow gate |
| CODEOWNERS | C+ | Covers security paths; misses half the codebase |

**Total issues found: 16 (4 critical, 6 medium, 6 low)**

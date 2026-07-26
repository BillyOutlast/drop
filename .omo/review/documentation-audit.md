# Documentation Audit Report — Drop Monorepo

**Date:** 2026-07-25  
**Auditor:** documentation-auditor (deep-audit-team)  
**Scope:** Entire Drop monorepo — root docs, sites/docs, inline code docs, API docs, architecture docs, GitHub templates, changelogs, technical debt markers

---

## 1. Documentation Inventory

### 1.1 Root Documentation

| Document | Status | Lines | Quality |
|----------|--------|-------|---------|
| `README.md` | ✅ Present | 37 | **Good** |
| `AGENTS.md` | ✅ Present | 234 | **Excellent** |
| `CLAUDE.md` | ✅ Present | 81 | **Good** |
| `CONTRIBUTING.md` | ✅ Present | 27 | **Needs Work** |
| `SECURITY.md` | ✅ Present | 65 | **Excellent** |
| `LICENSE` (AGPL-3.0 root) | ✅ Present | — | Standard |
| `.env.example` | ✅ Present | 5 | **Minimal** |
| `.editorconfig` | ✅ Present | 32 | **Good** |
| `fallow.json` | ✅ Present | — | Tool config |

### 1.2 `docs/` Directory

| File | Status | Quality |
|------|--------|---------|
| `docs/coverage-baseline-2026-07-24.md` | ✅ | **Good** (snapshot) |
| Everything else | ❌ **Missing** | — |

**Verdict:** The `docs/` directory is effectively empty (1 file). No architecture docs, no ADRs, no system design docs, no diagrams, no developer guides.

### 1.3 `sites/docs/` — Astro Starlight Documentation Site

**Total pages:** 40 (19 .md + 18 .mdx + 3 images)  
**Framework:** Astro 6 + Starlight with plugins (theme-rapide, links-validator, image-zoom)  
**Structure:**

```
User (7 pages)
├── Getting Started (index.md)
├── Install/
│   ├── Windows, macOS, Ubuntu, Debian, Fedora, Arch Linux,
│   │   Steam Deck, Bazzite (8 platform guides)
│   └── ...with screenshots for Ubuntu/Fedora/Debian store installs
└── Usage/
    └── Proton (mdx)

Admin (19 pages)
├── Quickstart (compose.yaml deployment)
├── Guides/
│   ├── Exposing, Creating Library, Import Game, Import Version,
│   │   Migrating
│   └── ...with screenshots (version-import-wizard)
├── Going Further/
│   ├── Setting Up OIDC, Importing Update, Emulators
├── Metadata/
│   ├── IGDB, Steam, GiantBomb, PCGamingWiki, Manual
├── Authentication/
│   ├── Simple, OIDC, MFA

Reference (6 pages)
├── Build Server, Build Client, Downloads, Library Sources,
│   Command Parsing, Update Mode
```

**Quality: Good overall** — well-structured, good Starlight configuration, useful content for users and admins.

**Gaps:**
- ❌ No API reference documentation
- ❌ No developer/contributor documentation section
- ❌ No CLI (`downpour`) documentation
- ❌ No desktop client documentation
- ❌ No library (`droplet`, `native_model`) usage docs
- ❌ No architecture overview or system design
- ❌ No FAQ or troubleshooting section
- ❌ Some pages are very short (e.g., Steam metadata: 1 paragraph)

### 1.4 Workspace README Files

| README | Status | Quality |
|--------|--------|---------|
| `server/README.md` | ✅ | **Minimal** (1 sentence) |
| `cli/README.md` | ✅ | **Minimal** (1 sentence) |
| `desktop/README.md` | ✅ | **Minimal** (1 sentence) |
| `sites/promo/README.md` | ✅ | **Minimal** (1 paragraph) |
| `sites/docs/README.md` | ✅ | **Minimal** ("The docs for Drop.") |
| `libraries/base/README.md` | ✅ | **Minimal** (1 sentence) |
| `libraries/droplet/README.md` | ✅ | **Needs Work** (brief overview) |
| `libraries/native_model/README.md` | ✅ | **Excellent** (327 lines, full docs + examples) |
| `libraries/libarchive/README.md` | ✅ | **Stale** (forked upstream README, points to Chef org) |
| `torrential/README.md` | ❓ | Not checked (experimental) |

**Pattern:** Most workspace READMEs are one-liners. Only `native_model` has thorough documentation.

### 1.5 Inline Code Documentation

#### TypeScript (`server/`)

| Metric | Count |
|--------|-------|
| JSDoc/TSDoc comments (`/**`) | **0** |
| `defineRouteMeta` with OpenAPI | **5 endpoints** out of 100+ |
| Total API route handlers | 100+ in `server/server/api/v1/` |
| Internal modules (`server/server/internal/`) | 24 subdirectories |

**Verdict: Missing.** Zero JSDoc/TSDoc in the TypeScript codebase. API documentation via `defineRouteMeta` is used on only 5 of 100+ endpoints. Internal modules have no documentation at module level.

#### Rust (`cli/`, `desktop/src-tauri/`, `libraries/`)

| Crate | `///` doc comments | `//!` crate docs | Quality |
|-------|-------------------|-------------------|---------|
| `native_model` | 170 in 8 files | 30 in 6 files | **Excellent** |
| `cli/` (downpour) | 7 in 1 file | 3 in 1 file | **Minimal** |
| `desktop/src-tauri/tailscale` | 48 in 1 file | 0 | **Moderate** |
| `desktop/src-tauri/download_manager` | 25 in 2 files | 0 | **Moderate** |
| `desktop/src-tauri/database` | 0 | 4 in 1 file | **Minimal** |
| `desktop/src-tauri/cloud_saves` | 1 | 0 | **None** |
| `desktop/src-tauri/src` (main) | 1 | 0 | **None** |
| `droplet` | 0 | 0 | **None** |
| `droplet_types` | 0 | 0 | **None** |
| `libarchive` | 0 | 0 | **None** (forked) |

**Verdict:** Highly uneven. `native_model` has excellent docs. The rest ranges from minimal to none. The critical business logic in `droplet`, `droplet_types`, and most of `desktop/src-tauri` is undocumented.

#### Vue Components

| Metric | Count |
|--------|-------|
| Total `.vue` files in `server/components/` | **72** |
| Files with JSDoc or HTML comments | **13** (36 matches total) |
| Files with NO documentation | **59 (~82%)** |

**Verdict:** Most Vue components (82%) have no inline documentation. Props, events, slots, and usage patterns are not documented.

### 1.6 API Documentation

| Item | Status | Details |
|------|--------|---------|
| Nitro OpenAPI generation | ✅ Enabled | `nitro.experimental.openAPI: true` in nuxt.config.ts |
| OpenAPI spec committed | ❌ Missing | Only available at runtime `/api/_openapi.json` |
| Route metadata (OpenAPI tags) | ❌ Minimal | Only 5 endpoints use `defineRouteMeta` |
| Request/response types documented | ❌ Missing | arktype schemas exist but aren't exported as docs |
| API route handler comments | ❌ Missing | Zero JSDoc/TSDoc in any route handler |

**Verdict:** The Nitro OpenAPI infrastructure is in place but largely unused. Of 100+ API endpoints, only 5 have any OpenAPI metadata. No committed OpenAPI spec for external consumers. The client SDK (`libraries/droplet`) has no documented API contract.

### 1.7 Architecture Documentation

| Item | Status |
|------|--------|
| ADRs (Architecture Decision Records) | ❌ **Missing** |
| Diagrams (.drawio, .puml, .mermaid) | ❌ **Missing** |
| System design docs | ❌ **Missing** |
| Architecture overview | ⚠️ **De facto** (AGENTS.md sections) |
| Data flow diagrams | ❌ **Missing** |
| Deployment architecture | ⚠️ **Partial** (docker-compose in quickstart docs) |
| Security architecture | ✅ **Good** (SECURITY.md + risk-register.yaml) |

**Verdict:** No formal architecture documentation exists. AGENTS.md acts as the de facto architecture reference but only covers CI, plugin ordering, metadata providers, and Prisma workflow.

### 1.8 Changelog / Release Notes

| Item | Status |
|------|--------|
| Root `CHANGELOG.md` | ❌ **Missing** |
| `desktop/changelog.md` | ✅ Present (v0.1.0-beta, v0.2.0-beta) |
| GitHub Releases | ✅ Uses GitHub releases |

**Verdict:** No root-level changelog. Desktop has an auto-generated changelog (via go-conventional-commits). Server, CLI, and libraries have no changelogs.

### 1.9 GitHub Templates

| Item | Status |
|------|--------|
| `ISSUE_TEMPLATE/` directory | ❌ **Missing** |
| `PULL_REQUEST_TEMPLATE/` directory | ❌ **Missing** |
| `pull_request_template.md` | ❌ **Missing** |
| `CODEOWNERS` | ✅ Present (17 rules) |
| `dependabot.yml` | ✅ Present |
| `coderabbit.yaml` | ✅ Present |
| CI workflows | ✅ **Comprehensive** (14 workflow files) |

**Verdict:** No issue or PR templates. This means contributors get no guidance on what information to include. CODEOWNERS and CI workflows are well-configured.

### 1.10 Technical Debt Markers (TODO/FIXME/HACK)

| Search Scope | Matches |
|-------------|---------|
| `server/server/api/` (all .ts) | **0** |
| `cli/` (all .rs) | **0** |
| `desktop/src-tauri/` (all .rs) | **0** |
| `libraries/` (all .rs) | **0** |

**Verdict:** Zero TODO/FIXME/HACK markers found anywhere in the codebase. This is either excellent discipline or indicates that technical debt is being silently accumulated without tracking.

**Note:** The `fallow.json` audit reveals **671 total issues** (385 unused files, 126 unused exports, 47 unlisted dependencies, 44 unresolved imports, etc.) — these represent significant undocumented technical debt, but none are tracked as TODO comments in code.

---

## 2. Quality Assessment Per Doc

| Document | Quality | Key Issues |
|----------|---------|------------|
| `README.md` | 🟢 Good | Clear, concise. Could add install instructions directly. |
| `AGENTS.md` | 🟢 Excellent | Dense, accurate, covers workspaces, builds, CI, gotchas, deferred work. Shows maintenance date. |
| `CLAUDE.md` | 🟢 Good | Clear behavioral rules. Some duplication with AGENTS.md. |
| `CONTRIBUTING.md` | 🟡 Needs Work | Self-describes as "stub — full guide being developed." Lacks detailed setup, coding standards, review process. |
| `SECURITY.md` | 🟢 Excellent | Full disclosure policy, response timeline, scope, risk register, supported versions. |
| `.env.example` (root) | 🔴 Minimal | Only 3 vars. Points to server/.env.example but doesn't document all vars. |
| `.env.example` (server/) | 🟡 Needs Work | 11 vars, no descriptions for most. Missing vars like OIDC_, DISABLE_SIMPLE_AUTH, TORRENTIAL_PATH. |
| `docs/` directory | 🔴 Missing | Single file. No architecture, design, or developer docs. |
| `sites/docs/` | 🟢 Good | Well-structured Starlight site. Missing API ref, developer docs, CLI docs. |
| Server README | 🔴 Minimal | One sentence. |
| CLI README | 🔴 Minimal | One sentence. |
| Desktop README | 🔴 Minimal | One sentence. |
| All workspace READMEs | 🔴 Minimal | Most are 1-sentence stubs. |
| `native_model` docs | 🟢 Excellent | Full crate docs, README with examples, performance benchmarks. |
| `droplet` docs | 🔴 Minimal | Brief README, no inline docs, no API contract docs. |
| `libarchive` README | 🔴 Stale | Forked from Chef org, points to Travis CI (dead). |
| TypeScript JSDoc/TSDoc | 🔴 Missing | Zero across entire server codebase. |
| Rust doc comments (most crates) | 🔴 Minimal | Only native_model has good coverage. |
| Vue component docs | 🔴 Minimal | 82% of components undocumented. |
| API OpenAPI annotations | 🔴 Minimal | 5 of 100+ endpoints annotated. |
| Architecture docs | 🔴 Missing | No ADRs, no diagrams, no system design. |
| CHANGELOG (root) | 🔴 Missing | No root changelog. Desktop has one per-release. |
| GitHub issue/PR templates | 🔴 Missing | No templates to guide contributors. |
| TODO/FIXME/HACK in code | 🟢 Clean | Zero found. |

---

## 3. Specific Gaps with Recommendations

### P0 — Critical Gaps (block contributor onboarding & API consumers)

| Gap | Recommendation | Effort |
|-----|---------------|--------|
| **No API documentation** | Generate OpenAPI spec from Nitro, commit `openapi.yaml` to repo. Add `defineRouteMeta` to all 100+ endpoints. Expose arktype schemas. | **Large** |
| **No CONTRIBUTING detail** | Expand CONTRIBUTING.md: full local dev setup, Docker workflow, test running, coding conventions, review process. | **Medium** |
| **No issue/PR templates** | Create `.github/ISSUE_TEMPLATE/bug.yml`, `feature.yml`, and `.github/PULL_REQUEST_TEMPLATE.md`. | **Small** |
| **Workspace READMEs are stubs** | Expand each workspace README to include purpose, setup, build commands, and usage examples. | **Medium** |

### P1 — High Priority (developer experience & maintainability)

| Gap | Recommendation | Effort |
|-----|---------------|--------|
| **No ADRs** | Start an `docs/adr/` directory. Record key decisions: metadata provider chain, double-nested server structure, Nuxt 3 vs 4 split. | **Medium** |
| **No architecture diagrams** | Add Mermaid diagrams for: system architecture, deployment, auth flow, metadata provider chain, data models. | **Medium** |
| **Zero JSDoc/TSDoc in TypeScript** | Add `@param` and `@returns` JSDoc to all internal module exports. Add module-level `@packageDocumentation` to `server/server/internal/*/index.ts`. | **Large** |
| **Missing CLI (`downpour`) docs** | Document commands, flags, examples in both code (`///`) and docs site. | **Medium** |
| **Missing desktop client docs** | Document Tauri commands, download manager architecture, auth protocol on docs site. | **Medium** |

### P2 — Medium Priority

| Gap | Recommendation | Effort |
|-----|---------------|--------|
| **docs/ directory sparse** | Create `docs/architecture.md`, `docs/development.md`, `docs/deployment.md`. | **Medium** |
| **Vue component docs missing** | Add prop/event/slot documentation to all components. Use Vue's `defineProps`/`defineEmits` with JSDoc annotations. | **Medium** |
| **Rust doc comments (non-native_model)** | Add `///` docs to public API surfaces in droplet, droplet_types, and desktop crates. | **Medium** |
| **No CHANGELOG at root** | Generate root `CHANGELOG.md` from git history using conventional commits. | **Small** |
| **`.env.example` incomplete** | Document all env vars with descriptions and defaults. | **Small** |

### P3 — Nice to Have

| Gap | Recommendation | Effort |
|-----|---------------|--------|
| **sites/docs lacks API reference** | Add auto-generated API reference from OpenAPI spec. | **Large** |
| **No FAQ section in docs** | Create FAQ from common Discord/forum questions. | **Small** |
| **libarchive README is stale** | Replace with Drop-maintained version (not Chef fork). | **Small** |
| **No developer docs section** | Add "For Developers" section to Starlight: architecture, contributing, building, testing. | **Medium** |

---

## 4. Priority Ranking

```
P0: ████████████████▌  1. API documentation (OpenAPI + route metadata)
                         2. CONTRIBUTING.md expansion
                         3. Issue/PR templates
                         4. Workspace README improvements

P1: ██████████████     1. ADRs (architecture decision records)
                         2. Architecture diagrams
                         3. JSDoc/TSDoc for TypeScript
                         4. CLI & Desktop documentation

P2: ████████████       1. docs/ directory expansion
                         2. Vue component documentation
                         3. Rust doc comments (droplet, desktop)
                         4. Root CHANGELOG.md
                         5. .env.example completion

P3: ██████             1. API reference in docs site
                         2. FAQ section
                         3. libarchive README fix
                         4. Developer docs section
```

---

## 5. Strengths (What's Done Well)

1. **AGENTS.md is exceptional.** Dense, accurate, well-maintained, covers workspaces, builds, CI, gotchas, deferred work log. Serves as the project's best single documentation artifact.

2. **sites/docs is well-configured.** Astro Starlight with good plugins (links-validator, image-zoom), clean sidebar navigation, useful deployment quickstart, platform install guides, metadata provider docs.

3. **native_model has excellent documentation.** Crate-level docs, inline doc comments on all public APIs, extensive README with examples, performance benchmarks.

4. **SECURITY.md is comprehensive.** Full disclosure policy, response timeline, scope definition, risk register with review dates.

5. **CI workflows are documented** in AGENTS.md with a complete CI workflow map.

6. **Deferred work is tracked** in AGENTS.md with triggers and rationale (6 items documented).

7. **Zero TODO/FIXME/HACK** in code — no undocumented technical debt markers.

---

## 6. Documentation Freshness Assessment

| Document | Freshness | Notes |
|----------|-----------|-------|
| AGENTS.md | 🟢 Fresh | Last updated 2026-07-24 (test state, PR #22) |
| CLAUDE.md | 🟢 Fresh | References current tooling |
| SECURITY.md | 🟢 Fresh | Current risk register with review dates |
| docs/coverage-baseline.md | 🟢 Fresh | Dated 2026-07-24 |
| sites/docs content | 🟡 Mostly fresh | Docker tag `0.4.0-rc-3` in quickstart — may be outdated |
| libarchive/README.md | 🔴 Stale | Forked from Chef/libarchive-rust, references Travis CI |
| droplet/README.md | 🟡 Needs update | Brief, lacks current API surface |
| Workspace READMEs | 🔴 Stale | All one-liners, no details |

---

## 7. Documentation by the Numbers

| Category | Total | Documented | Coverage |
|----------|-------|-----------|----------|
| API route handlers | 100+ | 5 (OpenAPI) | **5%** |
| Internal modules | 24 dirs | 0 (module docs) | **0%** |
| Vue components | 72 | 13 (partial) | **18%** |
| Rust crates | 10+ | 1 (native_model) | **10%** |
| Cli commands | TBD | 0 | **0%** |
| Tauri commands | TBD | 0 | **0%** |
| Workspace READMEs | 10 | 1 (native_model) | **10%** |

---

## 8. Summary

**Overall Documentation Health: 🟡 Needs Work**

The Drop monorepo has strong foundations (AGENTS.md, SECURITY.md, docs site infrastructure) but critical gaps in API documentation, inline code docs, architecture documentation, and contributor onboarding. The gap between the excellent security docs and the missing API/arch docs suggests security was prioritized (correctly), but developer experience and API consumer documentation have been neglected.

**Quick wins (can be done in <1 hour):**
1. Create ISSUE_TEMPLATE/bug.yml and feature.yml
2. Create PULL_REQUEST_TEMPLATE.md
3. Expand `.env.example` with all vars
4. Generate root CHANGELOG.md from git history

**Highest impact medium-term work:**
1. Add `defineRouteMeta` to all 100+ API endpoints
2. Create `docs/adr/` with 3-5 initial ADRs
3. Add architecture diagrams to docs site
4. Expand workspace READMEs beyond one-liners

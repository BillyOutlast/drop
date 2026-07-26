# Code Quality & Technical Debt Audit

**Date:** 2026-07-25
**Codebase:** Drop Monorepo (344 TS, 181 RS files)
**Auditor:** Code Quality Auditor

---

## Technical Debt Score Estimate: **MODERATE (32/100)**

| Category | Score | Weight |
|---|---|---|
| TypeScript anti-patterns | 35 | 20% |
| Rust anti-patterns | 40 | 20% |
| Error handling | 30 | 15% |
| Architecture & layering | 25 | 15% |
| Dependency health | 30 | 10% |
| Performance | 40 | 10% |
| Code organization | 35 | 10% |

**Interpretation:** 32/100 (higher = cleaner). Codebase has pragmatic debt — suppressed type errors, unwrap-heavy Rust, and pattern bypasses are concentrated in specific areas, but the overall structure is sound.

---

## 1. TypeScript Anti-Patterns

### 1.1 `@ts-ignore` / `@ts-expect-error` // SEVERITY: HIGH

**14 occurrences** across 9 files. Files with `@ts-ignore`:

| File | Line | Excuse | Risk |
|---|---|---|---|
| `server/composables/users.ts` | 21 | "forget why this ignor exists" | HIGH — unknown suppression |
| `server/composables/request.ts` | 22, 32 | No comment | MEDIUM |
| `server/composables/request.ts` | 54 | "Excessive stack depth" | LOW — known TS limitation |
| `server/composables/news.ts` | 35 | "forget why this ignor exists" | HIGH — unknown suppression |
| `server/server/internal/services/torrential/index.ts` | 112 | No comment | MEDIUM |
| `server/server/internal/services/services/nginx.ts` | 20 | No comment | LOW — env var access |

Files with `@ts-expect-error`:

| File | Line | Comment | Risk |
|---|---|---|---|
| `server/composables/collection.ts` | 13, 36 | valid pattern | LOW |
| `server/server/internal/tasks/registry/objects.ts` | 68, 75, 132 | "im not dealing with this", "not typing this mess omg" | **HIGH** |
| `server/server/internal/saves/index.ts` | 54 | "Not sure how to get this to be typed" | MEDIUM |
| `server/server/api/v1/games/[id]/index.get.ts` | 82 | "value exists at runtime" | MEDIUM |

**Recommendation:** Fix `users.ts:21` and `news.ts:35` unknowns ASAP. Refactor `objects.ts` to use proper Prisma types instead of dynamic reflection.

### 1.2 `as any` Casts // SEVERITY: HIGH

**11 occurrences** across 10 files. **Most concerning:**

| File | Line | Context |
|---|---|---|
| `server/server/internal/services/torrential/droplet-interface.ts` | 228, 265 | Callback typecasting bypass |
| `server/server/internal/auth/index.ts` | 30 | Dynamic provider registration |
| `server/server/internal/auth/oidc/index.ts` | 486 | Prisma JSON type coercion |
| `server/server/api/v1/admin/library/index.get.ts` | 111 | Filter passthrough to Prisma — **injection surface** |
| `server/server/api/v1/user/mfa/webauthn/index.delete.ts` | 46 | Credential typecast |
| `desktop/main/composables/game.ts` | 37 | Event payload destructure |
| `server/nuxt.config.ts` | 89 | Tailwind plugin cast |
| `server/test/unit/acls/confused-deputy.test.ts` | 41 | Test — acceptable |

**Recommendation:** `library/index.get.ts:111` is the highest risk — passing `filters as any` to Prisma `count()` bypasses type-checked where clauses. Use `Prisma.GameCountArgs` instead.

### 1.3 `console.log`/`console.error` in Production // SEVERITY: MEDIUM

**17 occurrences** in 11 files:

- **`server/composables/task.ts`** (lines 41, 75) — console.log in composable used at runtime
- **`server/server/internal/session/db.ts`** (line 132) — commented-out console.log (code smell)
- **`server/server/internal/auth/oidc/index.ts`** (lines 156, 511, 517, 520) — console.warn/error with no structured logger
- **`server/plugins/error-handler.ts`** (line 3) — console.error instead of logger
- **`server/server/api/v1/user/mfa/webauthn/finish.post.ts`** (line 48) — console.error instead of logger
- **`desktop/main/plugins/global-error-handler.ts`** (line 6) — console.error
- **`desktop/main/composables/game.ts`** (line 10) — console.log in production composable
- **`server/nuxt.config.ts`** (lines 35, 293, 301) — build-time logging, acceptable
- **`server/i18n/scripts/rewrite-keys.ts`** (line 54), **`detect-keys.ts`** (line 26) — script-only, acceptable

**Recommendation:** Replace runtime console calls with structured logger (pino). At minimum, `auth/oidc/index.ts`, `error-handler.ts`, `webauthn/finish.post.ts`.

### 1.4 `no-explicit-any` Suppressions // SEVERITY: LOW

**16 eslint-disable-next-line `@typescript-eslint/no-explicit-any`** across 12 files. Concentrated in:
- `server/server/internal/services/torrential/droplet-interface.ts` — 2 (generic callback infrastructure)
- `server/server/internal/session/types.d.ts` — 2 (type declaration files)
- `server/pages/admin/library/index.vue` — 2 (admin panel)
- `server/components/GameEditor/Metadata.vue` — 1 (990-line behemoth)
- `server/components/StoreView.vue` — 1 (524-line component)

**Recommendation:** Acceptable for type decl files and generic infrastructure. The large Vue components (Metadata.vue, StoreView.vue) should be refactored to remove need for any.

### 1.5 Commented-Out Code Blocks // SEVERITY: LOW

**7 significant blocks:**

| File | Lines | Content |
|---|---|---|
| `server/server/internal/tasks/index.ts` | 524-548 | Entire `msgWithTimestamp()` function commented out |
| `server/pages/library/game/[id]/index.vue` | 144-154 | Carousel navigation functions |
| `server/server/plugins/ca.ts` | 12 | `fsCertificateStore()` import |
| `server/pages/admin/settings.vue` | 76-77 | Notification composable |
| `server/pages/account/security.vue` | 246 | Auth fetch call |
| `server/pages/store/[id]/index.vue` | 307 | Rating calc |
| `server/components/UserFooter.vue` | 134 | API link |

**Recommendation:** Remove dead code. Git history preserves it.

---

## 2. Rust Anti-Patterns

### 2.1 `.unwrap()` Usage // SEVERITY: CRITICAL

**50+ calls** across 12 files. **Production code (non-test) offenders:**

| File | Count | Risk |
|---|---|---|
| `torrential/src/downloads/download.rs` | 5 | Multiple unwrap chains — will panic |
| `torrential/src/server/mod.rs` | 3 | Message type unwrap |
| `torrential/src/droplet/mod.rs` | 1 | enum_value unwrap |
| `torrential/src/downloads/serve.rs` | 4 | Semaphore, header, cache unwrap |
| `torrential/src/downloads/handlers.rs` | 1 | Header parse unwrap |
| `torrential/src/conversions.rs` | 2 | TryInto unwrap |
| `torrential/build.rs` | 10 | Build script — acceptable |
| `desktop/src-tauri/tailscale/src/lib.rs` | 0 | Uses proper pattern matching |

**Critical path:** `download.rs:57` — double unwrap chain:
```rust
let base_path = base_path.get("baseDir").unwrap().as_str().unwrap();
```
This panics if `baseDir` is missing or not a string.

**Recommendation:** Replace with `context()` from anyhow or proper match/if-let. **torrential/ is the highest-priority target for unwrap removal.**

### 2.2 `.expect()` Usage // SEVERITY: HIGH

**30 calls** in 12 files. **Production offenders:**

| File | Line | Message |
|---|---|---|
| `torrential/src/main.rs` | 29, 37, 73, 92, 101 | All startup — acceptable on fail |
| `torrential/src/server/mod.rs` | 60, 104 | Runtime operations |
| `torrential/src/downloads/serve.rs` | 68, 128 | Runtime semaphore operations |
| `libraries/droplet/src/versions/archive_backend.rs` | 138 | "file not found" |
| `cli/src/commands/connect/config.rs` | 44, 52, 67, 104 | Config operations |
| `libraries/droplet/src/manifest.rs` | 207 | Writer acquisition |

**Recommendation:** `serve.rs:68` — `LazyLock::new(|| file_open_limit::get().expect(...))` panics on init if syscall fails. Use fallback value.

### 2.3 `eprintln!()` for Error Logging // SEVERITY: MEDIUM

**7 occurrences** in 2 files:

| File | Line | Context |
|---|---|---|
| `desktop/src-tauri/tailscale/src/lib.rs` | 104, 114, 124 | Drop impls — acceptable (no logger available in Drop) |
| `libraries/droplet/tests/pipeline_test.rs` | 95, 190, 235, 282 | Tests — acceptable |

**Recommendation:** Tailscale Drop impls are borderline acceptable — consider `log::error!` if logger is initialized before drop.

### 2.4 `#[allow(dead_code)]` / `#[allow(clippy::*)]` // SEVERITY: MEDIUM

**10 suppressions** across 7 files:

| File | Line | Suppression |
|---|---|---|
| `desktop/src-tauri/process/src/process_handlers.rs` | 46 | `dead_code` |
| `desktop/src-tauri/process/src/process_handlers.rs` | 478, 479 | `unreachable_code`, `unused_variables` |
| `desktop/src-tauri/games/src/downloads/download_agent.rs` | 450 | `dead_code` |
| `desktop/src-tauri/games/src/downloads/download_logic.rs` | 31 | `clippy::too_many_arguments` |
| `desktop/src-tauri/download_manager/src/error.rs` | 42 | `dead_code` |
| `desktop/src-tauri/download_manager/src/util/queue.rs` | 14 | `dead_code` |
| `desktop/src-tauri/download_manager/src/download_manager_frontend.rs` | 95 | `dead_code` |
| `desktop/src-tauri/database/src/platform.rs` | 7 | `non_camel_case_types` |
| `desktop/src-tauri/cloud_saves/src/normalise.rs` | 57 | `clippy::single_element_loop` |

**Recommendation:** `dead_code` suppressions indicate unused functions/enums. Either remove the code or add `#[expect(dead_code)]` (Rust 2024). `clippy::too_many_arguments` on `download_logic.rs:31` should be fixed by introducing a config struct.

### 2.5 TODO/FIXME/HACK // SEVERITY: LOW

Only **1 TODO** found:
- `torrential/src/droplet/manifest.rs:24` — "re-write the droplet interface so it takes a 'static reference instead of an arc"

Low volume is good, but this remaining TODO is a correctness concern.

---

## 3. Architecture Violations

### 3.1 `drop/no-prisma-delete` Bypass // SEVERITY: HIGH

**16 eslint suppressions** across 16 files — the soft-delete rule is systematically bypassed.

| File | Line | Entity Deleted |
|---|---|---|
| `server/server/internal/screenshots/index.ts` | 59 | Screenshot |
| `server/server/internal/news/index.ts` | 132 | Article |
| `server/server/internal/clients/handler.ts` | 191 | Client |
| `server/server/internal/library/index.ts` | 654 | Library |
| `server/server/internal/tasks/registry/check-integrity.ts` | 79 | Integrity check |
| `server/server/api/v1/user/mfa/webauthn/index.delete.ts` | 35 | WebAuthn credential |
| `server/server/api/v1/user/mfa/webauthn/finish.post.ts` | 96 | WebAuthn credential |
| `server/server/api/v1/user/mfa/totp/start.post.ts` | 30 | TOTP secret |
| `server/server/api/v1/user/mfa/totp/finish.post.ts` | 47 | TOTP secret |
| `server/server/api/v1/auth/passkey/finish.post.ts` | 92 | Passkey |
| `server/server/api/v1/auth/mfa/webauthn/finish.post.ts` | 94 | WebAuthn |
| `server/server/api/v1/admin/users/[id]/index.delete.ts` | 30 | User |
| `server/server/api/v1/admin/company/[id]/game.post.ts` | 54 | Company-game relation |
| `server/server/api/v1/admin/company/[id]/game.patch.ts` | 27 | Company-game relation |
| `server/server/api/v1/admin/company/[id]/game.delete.ts` | 26 | Company-game relation |
| `server/server/api/v1/admin/game/[id]/tags.patch.ts` | 33 | Game-tag relation |

**Recommendation:** For join-table deletions (company-game, game-tag), deletion is correct — no need for soft-delete on relations. For entities (screenshots, articles, clients), either implement soft-delete or update the eslint rule to allow deletion of non-core entities.

### 3.2 TypeScript Strictness Gaps // SEVERITY: MEDIUM

- `verbatimModuleSyntax: false` — disables a key TS 5.x best practice. Fixing this would require adding `type` imports everywhere.
- `noUncheckedIndexedAccess` — not enabled (30+ latent errors, tracked in AGENTS.md)
- `strictNullChecks: true` ✓ (good)
- `exactOptionalPropertyTypes: true` ✓ (good)

**Recommendation:** Enable `verbatimModuleSyntax` with a codemod. Fix the `noUncheckedIndexedAccess` deferred items.

### 3.3 Layer Violation Potential // SEVERITY: LOW

The codebase generally respects layering (Nitro backend ↔ Nuxt frontend ↔ Prisma). The server uses `~/server/internal/` for business logic, which is correct. No direct DB calls from Vue components observed.

**Minor concern:** `server/composables/task.ts` has a WebSocket connection utility that's shared between frontend and backend layers — could create coupling.

---

## 4. Code Duplication

### 4.1 Droplet Callback Processors // SEVERITY: MEDIUM

`server/server/internal/services/torrential/droplet-interface.ts` (362 lines) has **8 nearly identical** callback processor definitions (lines 77-184). Each follows the same pattern:
```typescript
const XProcessor = this.defineDropletCallbackProcessor({
  queryType: DropBoundType.X,
  callbackType: "x",
  run: async (message, callbacks) => {
    const messageData = fromBinary(XSchema, message.data);
    callbacks.resolve(messageData.x);
    this.callbacks.delete(message.messageId);
  },
});
```

**Recommendation:** Create a factory function or data-driven configuration that reduces 8 definitions to 1 loop over a config array.

### 4.2 `prisma.delete()` Pattern // SEVERITY: LOW

16 files follow the same pattern — find-or-fail, then delete, then cleanup. This could be extracted into a generic `safeDelete(model, id, cleanupFn?)` utility.

### 4.3 Metadata Provider Patterns // SEVERITY: LOW

Providers (steam.ts: 1115, igdb.ts: 682, pcgamingwiki.ts: 504, giantbomb.ts: 426) share common HTTP fetch, caching, and image URL patterns. The metadata index (397 lines) already provides the chain — shared HTTP utilities would reduce duplication.

---

## 5. Dependency Health

### 5.1 Wildcard / Floating Dependencies // SEVERITY: HIGH

| Dependency | File | Version | Risk |
|---|---|---|---|
| `vue` | server/package.json | `"latest"` | **CRITICAL** — breaks builds |
| `vue-router` | server/package.json | `"latest"` | **CRITICAL** — breaks builds |
| `wry` | desktop/Cargo.toml | `"*"` | HIGH — unpinned |
| `tauri-build` | desktop/Cargo.toml | `"*"` | HIGH — unpinned |
| `tauri-plugin-autostart` | desktop/Cargo.toml | `"*"` | HIGH |
| `tauri-plugin-deep-link` | desktop/Cargo.toml | `"*"` | HIGH |
| `tauri-plugin-dialog` | desktop/Cargo.toml | `"*"` | HIGH |
| `tauri-plugin-opener` | desktop/Cargo.toml | `"*"` | HIGH |
| `tauri-plugin-os` | desktop/Cargo.toml | `"*"` | HIGH |
| `tauri-plugin-shell` | desktop/Cargo.toml | `"*"` | HIGH |
| `libarchive-drop` | libraries/droplet/Cargo.toml | `"*"` | MEDIUM |
| `serde_json` | desktop/Cargo.toml | `"1"` (no minor) | LOW |
| `serde` | desktop/Cargo.toml | `"1"` (no minor) | LOW |
| `rustbreak` | desktop/Cargo.toml | `"2"` (no patch) | LOW |

**Recommendation:** Pin `vue` and `vue-router` to explicit versions. Pin Tauri plugins to current compatible versions. Use `cargo upgrade` for workspace deps.

### 5.2 Outdated Dependencies // SEVERITY: LOW

| Dependency | Current | Notes |
|---|---|---|
| `otp-io` | `^1.2.7` | Low-maintenance OTP lib |
| `@lobomfz/prismark` | `0.0.3` | Early-stage, no updates |
| `libloading` | `0.7` (linux-only) | 0.8 available (not a direct risk) |

### 5.3 Dependency Security // SEVERITY: LOW

- `jsonwebtoken` with `jsonwebtoken` types — `jsonwebtoken` has known CVEs (CVE-2022-23529). The `jose` library is also present, suggesting partial migration.
- `argon2` — actively maintained, low risk.
- `tar` at `0.4.46` — symlink traversal, but only used for archive extraction.

**Recommendation:** Complete migration from `jsonwebtoken` to `jose` (already in deps).

---

## 6. Performance Anti-Patterns

### 6.1 N+1 Query // SEVERITY: HIGH

`server/server/internal/tasks/registry/objects.ts` — `findUnreferencedStrings()` (lines 149-161):
```typescript
for (const obj of objects) {
    const isRef = await isReferencedInModelFields(obj, fieldRefMap);
    // ...
}
```
This issues **1 query per object per model** — O(n*m) database calls. If there are 1000 objects and 20 models, that's 20,000 queries.

**Recommendation:** Batch-check using `IN` operator. Collect all object IDs into a single query per model:
```typescript
const found = await model.findMany({
  where: { OR: fields.map(f => ({ [f]: { in: objectIds } })) },
  select: { [fields[0]]: true },
});
```

### 6.2 Missing Indexes // SEVERITY: MEDIUM

**Prisma schema analysis:**

| Model | Missing | Impact |
|---|---|---|
| `Client` | `@@index([userId])` | All client lookups by user do full scan |
| `Session` | `@@index([userId])` | Session cleanup by user |
| `Notification` | `@@index([userId, read])` | Unread notification queries |
| `LinkedAuthMec` | `@@index([userId])` | Redundant with composite key, but fine |
| `GameVersion` | `@@index([gameId])` | Already covered by relation |
| `SaveSlot` | `@@index([userId])` | Already present ✓ |
| `Screenshot` | `@@index([gameId, userId])` | Already present ✓ |

**Recommendation:** Add `@@index([userId])` to Client and Session models.

### 6.3 Unbounded Queries // SEVERITY: MEDIUM

- `objects.ts:22` — `objectHandler.listAll()` returns ALL objects with no pagination. For large deployments, this will OOM.
- `SaveSlot` stores full `historyObjectIds String[]` and `historyChecksums String[]` — no limit enforcement beyond `saveSlotHistoryLimit`.

### 6.4 Recursive Read in Archive Reader // SEVERITY: LOW

`libraries/libarchive/src/reader.rs:63`:
```rust
return self.read_block();
```
Recursive retry on null buffer — could stack overflow on repeated failures. Should use loop instead.

---

## 7. Code Organization

### 7.1 Large Files (Exceeds 500 Lines) // SEVERITY: MEDIUM

| File | Lines | Issue |
|---|---|---|
| `server/components/GameEditor/Metadata.vue` | 990 | Mixed template/script/styles |
| `desktop/main/pages/library/[id]/index.vue` | 866 | Feature sprawl |
| `server/pages/admin/library/index.vue` | 805 | Complex admin panel |
| `server/server/internal/library/index.ts` | 712 | Monolithic service |
| `server/server/internal/metadata/steam.ts` | 1115 | Largest single file |
| `server/server/internal/metadata/igdb.ts` | 682 | Large provider |
| `desktop/src-tauri/process/src/process_manager.rs` | 644 | Large |
| `desktop/src-tauri/games/src/downloads/download_agent.rs` | 629 | Large |

**Recommendation:** Set a 500-line soft limit. Break `steam.ts` into sub-modules (search, details, images). Extract `library/index.ts` into sub-services.

### 7.2 Vue Component Complexity // SEVERITY: MEDIUM

Several Vue components mix too many concerns:
- **`GameEditor/Metadata.vue`** (990 lines) — editor, preview, search, image management
- **`StoreView.vue`** (524 lines) — store grid, filtering, search, pagination
- **`admin/library/index.vue`** (805 lines) — CRUD, import, search, filtering, mass actions

**Recommendation:** Extract composables for data fetching, separate presentational sub-components.

### 7.3 Module Boundary Clarity // SEVERITY: LOW

The `server/server/internal/` structure is well-organized by domain (auth, metadata, tasks, objects, library, etc.). Each domain has clear entry points. The metadata provider pattern with `PriorityListIndexed` is clean.

**Minor:** The `screenshots` and `notifications` services are relatively thin wrappers — consider whether they justify separate service files.

---

## 8. Prisma Schema Issues

### 8.1 Missing Indexes // SEVERITY: MEDIUM

```prisma
model Client {
  id     String @id @default(uuid())
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  // MISSING: @@index([userId])
}
```

```prisma
model Session {
  token     String   @id
  expiresAt DateTime
  userId String?
  user   User?  @relation(fields: [userId], references: [id], onDelete: Cascade)
  // MISSING: @@index([userId])
  // MISSING: @@index([expiresAt]) for cleanup
}
```

### 8.2 Schema Design Issues // SEVERITY: MEDIUM

1. **`Notification.nonce` is optional with `@@unique([userId, nonce])`** — unique constraint fails if `nonce` is null, since NULL != NULL in PostgreSQL. Use a sentinel value instead.

2. **`Task` model lacks defaults:**
   ```prisma
   model Task {
     started  DateTime  // No @default(now())
     ended    DateTime  // No @default(now())
   }
   ```

3. **`UnimportedGameVersion.fileList String[]`** — could grow unbounded. Consider a separate table.

4. **`ObjectHash.hash String`** — no index on hash field for lookups.

5. **`ApplicationSettings` uses `timestamp DateTime @id`** — each settings change creates a new row. Consider a single-row pattern with upsert instead.

### 8.3 Commented-Out Generator // SEVERITY: LOW

Lines 13-20 of `schema.prisma` have a commented-out `arktype` generator. Either uncomment and fix, or remove.

---

## 9. Error Handling Patterns

### 9.1 Structured Logging Gaps // SEVERITY: MEDIUM

Server uses `pino` as logger, but:
- Auth OIDC handler uses `console.error` directly (4 occurrences)
- Error handler plugin uses `console.error`
- WebAuthn finish endpoint uses `console.error`

**Recommendation:** Use `logger.error(...)` consistently. The OIDC handler imported logger exists but is bypassed.

### 9.2 Rust Error Handling // SEVERITY: HIGH

**Pattern:** `torrential/src/downloads/download.rs:57`:
```rust
let base_path = base_path.get("baseDir").unwrap().as_str().unwrap();
```
Two unwraps without context — panics on malformed config. Replace with:
```rust
let base_path = base_path
    .get("baseDir")
    .and_then(|v| v.as_str())
    .context("Missing baseDir in config")?;
```

**Pattern:** Tailscale Drop impls use `eprintln!` — acceptable because logger may not be initialized during Drop.

**Pattern:** `torrential/src/server/mod.rs:134`:
```rust
Err(anyhow!(String::from_utf8(message.data.clone()).unwrap()))
```
Inner unwrap defeats the error handling. Use `.map_err()` or `context()`.

### 9.3 Frontend Error Handling // SEVERITY: LOW

WebSocket composable (`composables/task.ts`) has minimal error handling — disconnection and reconnection logging uses console.log rather than user-facing notifications.

---

## 10. Dead Code Inventory

| Location | Type | Impact |
|---|---|---|
| `server/server/internal/tasks/index.ts:529-548` | Commented function | Low |
| `server/pages/library/game/[id]/index.vue:144-154` | Commented code | Low |
| `server/server/plugins/ca.ts:12` | Commented import | Low |
| `server/prisma/schema.prisma:13-20` | Commented generator | Low |
| `desktop/.../download_agent.rs` | 5 `#[allow(dead_code)]` markers | **High** — real dead code |
| `desktop/.../download_manager_frontend.rs` | `#[allow(dead_code)]` | **High** |
| `desktop/.../error.rs` | `#[allow(dead_code)]` | **Medium** |
| `desktop/.../queue.rs` | `#[allow(dead_code)]` | **Medium** |
| `desktop/.../process_handlers.rs` | `#[allow(dead_code)]` | **Medium** |

**Recommendation:** Run `cargo clippy -- -D warnings` on desktop workspace and fix or remove dead_code items.

---

## Remediation Priority Matrix

| Priority | Area | Effort | Impact |
|---|---|---|---|
| **P0** | Fix `.unwrap()` chains in torrential (6 files) | 1 day | Prevents production panics |
| **P0** | Pin `vue`/`vue-router` from `"latest"` | 5 min | Prevents build breakage |
| **P1** | Fix `objects.ts` N+1 query | 2 hours | Prevents DB meltdown at scale |
| **P1** | Add missing `@@index([userId])` on Client/Session | 10 min | Query perf |
| **P1** | Fix `library/index.get.ts` `as any` filter | 1 hour | Security |
| **P1** | Replace `console.error` with logger (3 files) | 2 hours | Observability |
| **P2** | Refactor droplet-interface.ts callback duplication | 3 hours | Maintainability |
| **P2** | Fix `Notification.nonce` nullable unique | 1 hour | Data integrity |
| **P2** | Pin Tauri plugin `*` deps | 1 hour | Reproducible builds |
| **P2** | Remove dead_code items in desktop Rust | 2 hours | Cleanliness |
| **P3** | Fix `@ts-ignore` unknowns in users.ts, news.ts | 1 hour | Type safety |
| **P3** | Break up steam.ts (1115 lines) | 4 hours | Maintainability |
| **P3** | Fix recursive `read_block()` in libarchive | 1 hour | Stack safety |

---

## Summary

**Strengths:**
- Good overall architecture with clear domain separation
- No circular dependencies detected
- Strong Prisma schema with proper relations and cascades
- Low TODO/FIXME density (only 1 found)
- Consistent use of metadata provider pattern
- TypeScript strict mode partially enabled

**Weaknesses:**
- **torrential** Rust code has pervasive unwrap/expect — highest risk area
- 16 `drop/no-prisma-delete` suppressions indicate policy is not enforced
- Pin dependencies from wildcards (`"latest"`, `"*"`, `"1"`)
- `objects.ts` cleanup task will cause N+1 DB meltdown at scale
- Missing indexes on Client and Session tables
- console.error bypasses structured logging in 5 runtime files
- 3 Vue components exceed 750 lines
- Commented-out code blocks scattered across codebase
- Recursive call in libarchive reader risk stack overflow

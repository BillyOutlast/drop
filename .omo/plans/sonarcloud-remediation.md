# Remediator Plan: SonarCloud 672 Issues

> Produced by hyperplan adversarial team (fixer/second/thinker/artist) — 3 rounds of cross-attack. Survivor findings only.

## P0 — Scanner Configuration (eliminates 15 issues, 30 min)

**Exclude Prisma migrations from SonarCloud analysis**

- Add to `sonar-project.properties` or project exclusion patterns:
  ```
  sonar.exclusions=**/prisma/migrations/**
  ```
- Effect: kills all 15 PLSQL false positives (7 QuotedIdentifiersCheck, 7 NamingTypesCheck, 1 DeleteOrUpdateWithoutWhere)
- These are auto-generated Prisma migration SQL, not human PL/SQL code

---

## P1 — Real Bugs (6 issues, verified from cross-attack)

### 1. fsBackend.ts:103 — S3516 — delete() always returns true

- **File:** `server/server/internal/objects/fsBackend.ts`
- **Problem:** `delete(id)` returns `true` on all paths. Early return (`file doesn't exist → true`) and nominal path (`file deleted → true`) are indistinguishable.
- **Fix:** Early return → `return false` when item doesn't exist. Nominal path → `return true` only on successful deletion. Wrap `rmSync` in try/catch for error signaling.
- **Verification:** Caller must be able to distinguish "already gone" from "successfully removed."

### 2. check-integrity.ts:39 — S4123 — await on non-Promise

- **File:** `server/server/internal/tasks/registry/check-integrity.ts`
- **Problem:** `await libraryManager.getLibrary(version.game.libraryId)` — `getLibrary()` returns synchronously (Map.get()). `await` is a no-op.
- **Fix:** Remove `await`. If `getLibrary()` ever becomes async, it's still fine without `await` at the call site.
- **Verification:** Caller handles `LibraryProvider<unknown> | undefined` correctly.

### 3. S1121 — 3 assignments-in-conditionals (latent bugs)

- **Files:**
  - `server/components/Selector/Platform.vue:94` — `if (model.value = '...')`
  - `server/pages/admin/users/auth/simple/index.vue:424,439`
- **Problem:** Assignment `=` instead of comparison `==` inside `if()` conditions. Side effects that silently evaluate to truthy.
- **Fix:** Change to `===` or extract assignment before the condition.
- **Verification:** Each should be a comparison or an explicit side-effect expression.

### 4. library/index.ts:577 — S6551 — runtime type corruption

- **File:** `server/server/internal/library/index.ts`
- **Problem:** Version stringified as `[object Object]` — object-to-string coercion where a primitive was expected.
- **Fix:** Add explicit `.toString()` or template literal, or destructure the object property.
- **Tag:** High confidence — confirmed by cross-attack survivor pattern.

### 5. steam.ts:604 — S8786 — ReDoS regex

- **File:** `server/server/internal/metadata/steam.ts`
- **Problem:** Regex with super-linear backtracking on user-controlled metadata. Potential event-loop DoS.
- **Fix:** Simplify regex or add bounds/atomic groups. 4 other S8786 in steam.ts need verification — likely similar patterns.

### 6. S4036 — 4 PATH injection risks

- **Files:**
  - `server/server/internal/services/torrential/index.ts:61,81`
  - Others at `nginx.ts:16`, `nuxt.config.ts:33`
- **Problem:** Using relative paths or PATH-dependent command execution.
- **Fix:** Use absolute paths or explicit `path.resolve()`.

---

## P2 — Mechanical Code Quality (safe, zero-judgment batch fixes)

| Rule                          | Count   | Fix                                                                           | Risk                  |
| ----------------------------- | ------- | ----------------------------------------------------------------------------- | --------------------- |
| S7772 `node:` prefix          | 29      | `from 'fs'` → `from 'node:fs'` (path, crypto, child_process, os, stream, net) | None                  |
| S7773 `Number.parseInt`       | 19      | `parseInt(x)` → `Number.parseInt(x)`                                          | None                  |
| S7781 `replaceAll`            | 13      | `s.replace(/x/g, y)` → `s.replaceAll('x', y)` (verify string vs regex)        | Low                   |
| S7754 `.some()`               | 17      | `.find(f)` → `.some(f)`; `.filter(f).length > 0` → `.some(f)`                 | None                  |
| S7752 `.flatMap()`            | 10      | `.map(x).flat()` → `.flatMap(x)`                                              | None                  |
| S1940 boolean simplify        | 3       | Simplify negation patterns                                                    | None                  |
| S6822 remove redundant `role` | 24      | Remove `role="list"` from `<ul>`                                              | OR whitelist (safer)  |
| S2933 `readonly` fields       | 32      | Add `readonly` to non-reassigned class fields                                 | Low (check lazy-init) |
| S6759 `readonly` props        | 35      | Add `readonly` to React/TSX component props                                   | Low                   |
| **Total**                     | **182** |                                                                               |                       |

---

## P3 — Needs Human Judgment (per-rule decision, batchable with guardrails)

| Rule                    | Count | Constraint                                                |
| ----------------------- | ----- | --------------------------------------------------------- |
| S9011 button type       | 79    | Avoid `<form>`-inside buttons (type=submit). ~67/79 safe  |
| S1128 unused imports    | 30    | Check Vue SFC template usage before removing              |
| S6582 optional chaining | 28    | Verify `&&` is null/undefined guard, not boolean coercion |
| S3626 redundant jumps   | 16    | API route handler returns must be preserved               |
| S3696 throw non-Error   | 11    | `throw "string"` → `throw new Error("string")` — safe     |

---

## P4 — Structural Refactors (higher effort)

- **S3776 cognitive complexity** (11 CRITICAL, score 37 worst at igdb.ts:341)
  - Session layer: cache.ts (23), db.ts (24), memory.ts (21) — share interface, extract shared helper
  - Metadata: igdb.ts (37), giantbomb.ts (20) — decompose nested conditionals
  - Auth: oidc/index.ts (24)
  - Library: library/index.ts (28+17)
  - ACLs: acls/index.ts (190)
- **S4790 MD5 → SHA-256** (3 CRITICAL, non-security use — dedup IDs, file hashing)
- **Metadata provider inheritance debt** (46 issues across steam.ts/pcgamingwiki.ts/igdb.ts/giantbomb.ts) — extract shared helpers (`parseIntSafe`, `replaceAllSafe`, regex validator)

---

## P5 — Accessibility (108 issues, concentrated in 5 shared components)

- ImgWithoutAltCheck (25) — needs alt text per image context
- InputWithoutLabelCheck (19) — needs label per form field
- Web:S6819 (11) — `<div role="status">` → `<output>`
- Web:S6840 (6) — autocomplete attribute
- Web:S6853 (7) — `<figure>` without `<figcaption>`
- Web:S5255 (4) — `<html lang="...">`
- Web:S6851 (2) — form landmark
- FrameWithoutTitle (1), S5256 (1)
- **Shared component targets:** GameEditor/Metadata.vue (11), UserFooter.vue (5), LibrarySearch.vue (7), Directory/News.vue (4)

---

## P6 — Infra & Deferred

- S6505 `--ignore-scripts` (12) — intentional design per pnpm `onlyBuiltDependencies`. Document decision, suppress.
- S7637 SHA pinning (13) — 10 in external vendored workflows, 3 in main CI. Low risk with tags.
- S8233/S8264/S8543 GitHub permissions (7) — security best practice, low risk for solo dev
- Dockerfile (6) — merge RUN, sort packages, root user
- Shell scripts (8) — dev-setup, version update, optimize-appimage
- S1135 TODO comments (29) — intentional development tracking, suppress
- S5332 HTTP in OIDC (1) — verify callback URL before suppressing
- S5144 Go URL (1) — backend/main.go stub, trivial
- S8570 Cargo.lock (4) — lib crates, intentional
- Swift/CSS (3) — edge cases

---

## Remediation Order

1. **Scanner config** — exclude prisma/migrations (15 issues, 30 min)
2. **P1 bugs** — 6 verified bug fixes (2-4 hours)
3. **P2 mechanical** — batch codemods (182 issues, 2 hours)
4. **P3 human-review** — S9011/S1128/S6582/S3626/S3696 (164 issues, 4-6 hours)
5. **P5 accessibility** — shared component fixes cascade (108 issues, 6-8 hours)
6. **P4 structural** — S3776 + S4790 + metadata provider helpers (14 issues, 2-3 days)
7. **P6 infra** — whitelist + document + defer (80 issues, 1-2 hours)

**Total estimated effort: ~5-7 days for full remediation. ~1-2 days for P1-P3 (352 issues).**

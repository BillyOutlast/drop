# Plan: Dep Updates + TDD + Codecov Coverage

Solo dev (BillyOutlast), ~5-10 hrs/week. 32 tests, 1.17% baseline. 8 PRs, 3 workstreams.

---

## Dependency Graph

| PR  | Title                                               | Depends On      | Blocks            | Risk   |
| --- | --------------------------------------------------- | --------------- | ----------------- | ------ |
| 1   | Branch protection + auto-merge fix                  | None            | 3, (all CI gated) | LOW    |
| 2   | Dependabot desktop/main + .codecov.yml              | None            | None              | LOW    |
| 3   | CI merge + MSW error + coverage scope               | 1 (CI gate fix) | None              | LOW    |
| 4   | noUncheckedIndexedAccess enable                     | None            | 7,8 (testability) | MEDIUM |
| 5   | Test setup stubs (H3 globals)                       | None            | 7,8               | LOW    |
| 6   | pnpm override consolidation                         | None            | None              | LOW    |
| 7   | Pure-function TDD (prioritylist, utils, validators) | 5               | None              | MEDIUM |
| 8   | Security-surface TDD (auth, session, metadata)      | 5               | None              | HIGH   |

## Parallel Execution Waves

```
Wave 1 (all independent):
├── PR1: Branch protection + auto-merge
├── PR2: Dependabot + codecov
├── PR4: noUncheckedIndexedAccess
└── PR5: Test setup stubs

Wave 2 (after Wave 1 PRs merge to develop):
├── PR3: CI merge + MSW + coverage scope (dep PR1)
├── PR7: Pure-function TDD (dep PR5)
└── PR8: Security-surface TDD (dep PR5)

Wave 3 (anytime, lowest priority):
└── PR6: pnpm override consolidation (no deps)
```

Solo dev reality: branches prepared sequentially, but each can be pushed for CI while next is started. Wave 1 = ~3 calendar days. Wave 2 = ~5-7 calendar days.

---

## PR-by-PR Plan

### PR1: Fix branch protection + auto-merge CI gate

**Files:** `.github/workflows/dependabot-auto-merge.yml` + GitHub UI (branch protection rules)
**Time:** 45min
**Why:** Broken dep PRs land on develop unchecked. Blocks all subsequent CI-dependent work.
**Steps:**

1. GitHub UI → Settings → Branches → Add rule for `develop` + `main`:
   - Require status checks: typecheck, lint, test, coverage
   - Require PR review (1 approver)
   - Dismiss stale reviews
2. Rewrite `dependabot-auto-merge.yml`:
   - Remove `contains(steps.meta.outputs.package, '@')` condition
   - Replace `github.rest.pulls.merge()` with merge queue or pre-check commit status
   - Parse semver from PR title instead of `@` prefix filter
     **Verification gate:** `gh api repos/BillyOutlast/drop/branches/develop/protection` returns 200 with rules. Create test Dependabot PR, verify auto-merge waits for CI.
     **Commit strategy:** `fix(ci): enable branch protection + fix dependabot auto-merge gate` — single squash commit

### PR2: Add Dependabot desktop/main + .codecov.yml

**Files:** `.github/dependabot.yml`, `.codecov.yml` (new)
**Time:** 25min
**Why:** Desktop/main 30+ deps invisible to Dependabot. Coverage dashboard missing.
**Steps:**

1. Add npm entry to `.github/dependabot.yml`:
   ```yaml
   - package-ecosystem: "npm"
     directory: "/desktop/main"
     schedule:
       interval: "weekly"
       day: "monday"
     groups:
       desktop-minor:
         update-types: ["minor", "patch"]
       desktop-major:
         update-types: ["major"]
   ```
2. Create `.codecov.yml`:
   ```yaml
   coverage:
     status:
       project: off
       patch:
         default:
           target: 50%
           informational: true
   ```

**Verification gate:** `cat .codecov.yml` valid YAML. `gh api repos/BillyOutlast/drop/contents/.github/dependabot.yml` includes desktop/main entry.
**Commit strategy:** `chore(deps): add dependabot desktop/main + .codecov.yml` — single commit

### PR3: Merge CI test+coverage jobs + MSW "error" + scope fix

**Files:** `.github/workflows/ci.yml`, `server/test/mocks/index.ts`, `server/vitest.config.ts`
**Time:** 50min
**Why:** 14 CI-min wasted per push. Masked missing mocks. Coverage includes untestable frontend code.
**Steps:**

1. In `ci.yml`: delete `coverage` job (lines 161-197), merge `--coverage` flag into `test` job's `pnpm run test` step
2. In `server/test/mocks/index.ts:37`: change `onUnhandledRequest: "warn"` → `"error"`
3. In `server/vitest.config.ts:16`: change `include: ["server/**/*.ts"]` → `include: ["server/server/**/*.ts"]`
   **Verification gate:** `pnpm --filter drop test` passes all 32. `pnpm --filter drop test -- --coverage` reports only Nitro backend lines.
   **Commit strategy:** `chore(ci): merge test+coverage, scope to backend, enable MSW error` — single commit

### PR4: Enable noUncheckedIndexedAccess + fix all 30+ sites

**Files:** `server/tsconfig.json` + ~10 files in `server/server/api/v1/{admin/import/massversion, auth/mfa/webauthn, auth/passkey}`, `server/server/internal/{auth/totp, metadata/pcgamingwiki, clients/event-handler, system-data/index, utils/prioritylist}.ts`
**Time:** 1.5h-2h mechanical
**Why:** Runtime crashes in auth + metadata paths. Security-critical.
**Steps:**

1. Add `"noUncheckedIndexedAccess": true` to `server/tsconfig.json` compilerOptions
2. Run `pnpm --filter drop typecheck` — collect errors
3. For each error file: add `if (!arr[i]) return` guard before array access
4. Verify: `pnpm --filter drop typecheck` passes clean
5. Verify: `pnpm --filter drop test` passes
   **Verification gate:** `pnpm --filter drop typecheck` zero errors. `pnpm --filter drop test` all 32 pass.
   **Commit strategy:** `fix(ts): enable noUncheckedIndexedAccess, guard 30+ auth/metadata sites` — single commit (all guards in one bulk fix)

### PR5: Expand Nuxt/H3 test stubs

**Files:** `server/test/setup.ts`, `server/test/utils/h3.ts` (new)
**Time:** 30min
**Why:** Auth/session/file-upload tests will crash without `setCookie`, `sendRedirect`, `sendError`, `setResponseStatus`, etc.
**Steps:**

1. Add stubs to `server/test/setup.ts`:
   ```ts
   (globalThis as Record<string, unknown>).setCookie = () => {};
   (globalThis as Record<string, unknown>).getCookie = () => undefined;
   (globalThis as Record<string, unknown>).sendRedirect = () => {};
   (globalThis as Record<string, unknown>).sendStream = () => {};
   (globalThis as Record<string, unknown>).sendError = () => {};
   (globalThis as Record<string, unknown>).setResponseStatus = () => {};
   (globalThis as Record<string, unknown>).readFormDataBody = async () => ({});
   (globalThis as Record<string, unknown>).getRequestURL = () =>
     new URL("http://localhost");
   ```
2. Create `server/test/utils/h3.ts` exporting `createMockEvent()`, `createMockH3Event()` factory helpers for per-test override
   **Verification gate:** `pnpm --filter drop test` passes. Import `createMockEvent` in a new test file.
   **Commit strategy:** `test(server): add H3 event stubs and mock-event factory` — single commit

### PR6: Consolidate pnpm tar overrides

**Files:** `pnpm-workspace.yaml`, `desktop/main/pnpm-workspace.yaml`
**Time:** 10min
**Why:** Desktop/main has extra `tar@<=7.5.20` entry not in root. Maintenance drift.
**Steps:**

1. Add `tar@<=7.5.20: '>=7.5.21'` to root's tar block (or keep consistent across both)
2. Confirm both resolve `>=7.5.21` the same way
   **Verification gate:** `grep tar pnpm-workspace.yaml && grep tar desktop/main/pnpm-workspace.yaml` — tar entries align. `pnpm install --frozen-lockfile` passes.
   **Commit strategy:** `chore(deps): consolidate tar override entries across workspaces` — single commit

### PR7: Pure-function TDD — prioritylist, utils, validators

**Files:** `server/server/internal/utils/prioritylist.ts` + `server/test/unit/prioritylist.test.ts`, `server/test/unit/validation.test.ts`, `server/test/unit/rate-limit.test.ts` (new)
**Time:** 3-4h
**Why:** Highest ROI per line of test. Zero state, zero DB, zero mocks.
**Steps:**

1. Write tests for `prioritylist.ts` (sort order, exclusion, empty list)
2. Write tests for validation utilities
3. Write tests for rate-limit utilities
   **Verification gate:** `pnpm --filter drop test` passes all new + existing. Coverage shows `server/server/internal/utils/` covered.
   **Commit strategy:** `test(server): add prioritylist, validation, rate-limit unit tests` — single commit

### PR8: Security-surface TDD — auth flows, session, metadata

**Files:** `server/test/unit/auth/totp.test.ts`, `server/test/unit/metadata/igdb.test.ts`, `server/test/unit/session.test.ts` (new)
**Time:** 4-6h
**Why:** Auth + metadata = security critical. MSW mocks already exist for metadata + OIDC.
**Steps:**

1. Write tests for `auth/totp.ts` (TOTP validation, secret generation, backup codes)
2. Write tests for metadata provider fallthrough chain (IGDB → Steam → GiantBomb)
3. Write tests for session middleware (cookie parse, token expiry, invalid tokens)
   **Verification gate:** `pnpm --filter drop test` passes all new + existing. Coverage shows `auth/` + `metadata/` lines covered.
   **Commit strategy:** `test(server): add auth, metadata, session security tests` — single commit

---

## Verification Gates Per PR

| PR  | Gate 1                                  | Gate 2                              | Gate 3                          |
| --- | --------------------------------------- | ----------------------------------- | ------------------------------- |
| PR1 | API returns protection rules            | Test Dependabot PR auto-merge waits | actionlint passes               |
| PR2 | `.codecov.yml` valid YAML               | Dependabot config valid             | gh API returns both entries     |
| PR3 | `vitest run` all pass                   | Coverage excludes frontend          | MSW missing-mock errors visible |
| PR4 | `typecheck` zero errors                 | `vitest run` all pass               | `lint` passes                   |
| PR5 | `vitest run` all pass                   | New mock-event factory importable   | No TS errors in setup           |
| PR6 | `pnpm install --frozen-lockfile` passes | tar entries aligned                 | No typecheck regressions        |
| PR7 | `vitest run` all pass                   | Coverage `utils/` ≥80%              | Lint passes                     |
| PR8 | `vitest run` all pass                   | Coverage `auth/` + `metadata/` ≥60% | Lint passes                     |

---

## Definition of Done

- [ ] Branch protection active on develop + main (status checks, PR review)
- [ ] Auto-merge waits for CI before merging Dependabot PRs
- [ ] CI runs test+coverage in single job, no duplicate 14-min waste
- [ ] MSW unmocked requests fail tests (no masked gaps)
- [ ] Coverage scoped to Nitro backend only (no frontend noise)
- [ ] `.codecov.yml` active with patch-level feedback
- [ ] Dependabot scanning desktop/main 30+ npm deps
- [ ] `noUncheckedIndexedAccess: true` enabled, zero TS errors
- [ ] H3 event stubs cover all common handlers, mock-event factory exported
- [ ] Pure-function coverage: prioritylist, utils, validators ≥80%
- [ ] Security-surface coverage: auth (TOTP), metadata, session started
- [ ] All 8 PRs merged to develop, CI green

---

## Time Budget

| PR        | Time       | Calendar (solo, 5-10h/wk)   |
| --------- | ---------- | --------------------------- |
| PR1       | 45min      | Day 1                       |
| PR2       | 25min      | Day 1 (parallel prep)       |
| PR3       | 50min      | Day 2-3 (after PR1 merges)  |
| PR4       | 2h         | Day 2-3 (parallel with PR3) |
| PR5       | 30min      | Day 2-3                     |
| PR6       | 10min      | Any day                     |
| PR7       | 3-4h       | Day 4-6                     |
| PR8       | 4-6h       | Day 7-10                    |
| **Total** | **12-15h** | **10 calendar days**        |

---

## Risks & Stop Conditions

| Risk                                         | Trigger                                                 | Action                                                                                         |
| -------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Branch protection breaks existing CI         | PR1 merged, CI fails on missing status checks           | Temporarily remove check requirements, re-add with correct job names                           |
| noUncheckedIndexedAccess cascades >50 errors | Typecheck after enable                                  | Bulk-guard with `// @ts-expect-error`, fix one file per day                                    |
| Test stubs incomplete                        | TDD tests crash "undefined is not a function"           | Add missing stub to setup.ts, re-run                                                           |
| Coverage fails to upload                     | Codecov token missing in fork PRs                       | Already handled by `fail_ci_if_error: false`                                                   |
| MSW "error" breaks existing tests            | Existing tests hit unmocked endpoints                   | Add MSW handlers for those endpoints. If 3+ break, revert to "warn" and plan handler additions |
| TDD scope creep (DB-dependent code)          | Attempting Prisma/DB tests without test DB infra        | STOP at Tiers 1-2 (pure functions only). Document deferred DB tests                            |
| **Hard stop**                                | typecheck or test fail after any PR, unfixable in 30min | Revert PR commit, document issue. Continue with remaining PRs in order                         |

## Commit Strategy

Each PR = 1 commit. Always squash-merge. Prefix: `fix:` (bugs), `chore:` (CI/config), `test:` (new tests). Never mix concerns.

Branch naming:

- `fix/ci-auto-merge`
- `chore/dependabot-desktop`
- `chore/ci-merge-msw-scope`
- `fix/no-unchecked-indexed`
- `test/h3-stubs`
- `chore/tar-overrides`
- `test/pure-functions`
- `test/security-surface`

TDD discipline per PR7/PR8: write test first, run to see it fail (red), implement, run to see it pass (green), refactor.

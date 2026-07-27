# coderabbit-review-fixes - Work Plan

## TL;DR (For humans)

<!-- Fill this LAST, after the detailed plan below is written, so it summarizes the REAL plan. -->
<!-- Plain English for a non-engineer: NO file paths, NO todo numbers, NO wave/agent/tool names. -->

**What you'll get:** All 12 CodeRabbit review findings resolved — CodeQL Rust scanning fixed, pre-commit hook covers all workspaces with fallow gate, Sonar complexity addressed, documentation corrected, and Notification model hardened against NULL uniqueness gap.

**Why this approach:** Batch into 3 parallel waves: independent code fixes first, then pre-commit + docs (no code deps), then Notification schema change last (needs migration). Each wave is self-contained and verifiable.

**What it will NOT do:** No functional behavior changes beyond what CodeRabbit flagged. No new dependencies. No schema changes beyond Notification.nonce.

**Effort:** Medium (12 items, ~3 hours)
**Risk:** Low — all changes are isolated and well-scoped
**Decisions to sanity-check:** Notification.nonce approach (sentinel value vs NULLS NOT DISTINCT), objects.ts complexity refactor strategy

Your next move: approve to begin execution. Full execution detail follows below.

---

> TL;DR (machine): Medium effort, low risk. 12 CodeRabbit findings across code, docs, and schema. 3 parallel waves, all verifiable.

## Scope

### Must have

1. CodeQL Rust `build-mode: none` (not autobuild)
2. `objects.ts` cognitive complexity ≤15 (extract helpers)
3. `objects.ts` array-reference query chunking (bound OR predicates)
4. Pre-commit: add library workspace filtering
5. Pre-commit: add `fallow audit` gate
6. CLAUDE.md: fix amend → commit guidance
7. Remediation plan: clarify session-cleanup contract
8. Test coverage audit: rename "Coverage Ratio" → "Test File Ratio"
9. Cross-attack audit: fix migration claim
10. Code quality audit: fix Notification.nonce NULL claim
11. Notification model: make nonce required with sentinel
12. Pre-commit: add `fallow audit` gate per remediation plan

### Must NOT have (guardrails, anti-slop, scope boundaries)

- No functional behavior changes beyond CodeRabbit findings
- No new dependencies
- No schema changes beyond Notification.nonce
- No refactoring beyond what's needed for complexity reduction
- No test additions (tests-after for complexity refactor only if needed)

## Verification strategy

> Zero human intervention - all verification is agent-executed.

- Test decision: tests-after for objects.ts refactor; none for docs/config
- Evidence: .omo/evidence/ulw/<session>/<goalId>/a<attempt>

## Execution strategy

### Parallel execution waves

> Target 5-8 todos per wave. Fewer than 3 (except the final) means you under-split.

**Wave 1** (5 items, all independent):

- T1: CodeQL Rust build-mode fix
- T2: objects.ts complexity refactor (extract helpers)
- T3: objects.ts query chunking
- T4: CLAUDE.md amend fix
- T5: Notification.nonce schema change

**Wave 2** (4 items, all independent):

- T6: Pre-commit library workspace filtering
- T7: Pre-commit fallow audit gate
- T8: Test coverage audit rename
- T9: Cross-attack audit fix

**Wave 3** (3 items, all independent):

- T10: Remediation plan contract clarification
- T11: Code quality audit NULL claim fix
- T12: Final verification

### Dependency matrix

| Todo | Depends on | Blocks | Can parallelize with |
| ---- | ---------- | ------ | -------------------- |
| T1   | None       | None   | T2, T3, T4, T5       |
| T2   | None       | None   | T1, T3, T4, T5       |
| T3   | None       | None   | T1, T2, T4, T5       |
| T4   | None       | None   | T1, T2, T3, T5       |
| T5   | None       | T11    | T1, T2, T3, T4       |
| T6   | None       | None   | T7, T8, T9           |
| T7   | None       | None   | T6, T8, T9           |
| T8   | None       | None   | T6, T7, T9           |
| T9   | None       | None   | T6, T7, T8           |
| T10  | None       | None   | T11                  |
| T11  | T5         | None   | T10                  |
| T12  | T1-T11     | None   | None                 |

## Todos

> Implementation + Test = ONE todo. Never separate.

<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->

### Wave 1 — Independent code + config fixes

- [ ] 1. CodeQL Rust build-mode: autobuild → none
      What to do / Must NOT do: Change line 53 of `.github/workflows/codeql.yml` from `build-mode: autobuild` to `build-mode: none` for the Rust language entry. Leave all other language entries unchanged. Per GitHub docs, Rust supports `none` mode which uses rust-analyzer without full compilation.
      Parallelization: Wave 1 | Blocked by: none | Blocks: none
      References (executor has NO interview context - be exhaustive): `.github/workflows/codeql.yml:52-53` (current: `build-mode: autobuild`); GitHub docs: https://docs.github.com/en/code-security/reference/code-scanning/codeql/build-options-for-compiled-languages
      Acceptance criteria (agent-executable): `grep -n 'build-mode: none' .github/workflows/codeql.yml | grep rust` returns match at line 53
      QA scenarios (name the exact tool + invocation): happy — `yq '.jobs.analyze.strategy.matrix.include[] | select(.language == "rust") | .build-mode' .github/workflows/codeql.yml` returns `none`; failure — verify other languages unchanged
      Commit: Y | fix(ci): CodeQL Rust build-mode autobuild → none

- [ ] 2. objects.ts: Extract helpers to reduce findReferencedIds complexity ≤15
      What to do / Must NOT do: Refactor `findReferencedIds` (lines 93-148) in `server/server/internal/tasks/registry/objects.ts` to reduce cognitive complexity from 37 to ≤15. Extract two helpers: (1) `buildOrConditions(fields, arrayFields, objectIds)` — builds the OR predicate array, (2) `extractReferencedIds(row, fields, arrayFields, objectIds)` — extracts matching IDs from a single row. The main function becomes a simple loop calling these helpers. Preserve exact behavior — no functional changes.
      Parallelization: Wave 1 | Blocked by: none | Blocks: none
      References (executor has NO interview context - be exhaustive): `server/server/internal/tasks/registry/objects.ts:93-148` (current implementation); SonarCloud issue: cognitive complexity 37, limit 15
      Acceptance criteria (agent-executable): `pnpm --filter drop typecheck` passes; `pnpm --filter drop test` passes (122 tests); function still returns same Set<string> for same inputs
      QA scenarios (name the exact tool + invocation): happy — run `pnpm --filter drop test` and verify all pass; failure — verify the function signature unchanged
      Commit: Y | refactor(tasks): extract helpers from findReferencedIds (complexity 37→≤15)

- [ ] 3. objects.ts: Chunk objectIds in array-reference query
      What to do / Must NOT do: In the `buildOrConditions` helper (or the extracted version), chunk `objectIds` into batches of ≤100 before building OR predicates for array fields. Execute one query per chunk and union results. This prevents `arrayFields.length * objectIds.length` OR predicates from blowing up Prisma query size. Preserve exact behavior.
      Parallelization: Wave 1 | Blocked by: none | Blocks: none
      References (executor has NO interview context - be exhaustive): `server/server/internal/tasks/registry/objects.ts:106-112` (current: unbounded OR construction)
      Acceptance criteria (agent-executable): `pnpm --filter drop test` passes; no single Prisma query has >100 OR predicates for array fields
      QA scenarios (name the exact tool + invocation): happy — `pnpm --filter drop test` passes; failure — verify chunk size constant is configurable
      Commit: Y | perf(tasks): chunk objectIds in array-reference query to bound OR predicates

- [ ] 4. CLAUDE.md: Fix amend → commit guidance
      What to do / Must NOT do: In `CLAUDE.md` line 35, replace `git commit --amend --no-edit` with `git commit`. The amend command rewrites the previous commit, not the failed one. After a failed pre-commit, the user should fix the issue and rerun the original `git commit`. Reserve amend only for intentionally updating an already-created commit.
      Parallelization: Wave 1 | Blocked by: none | Blocks: none
      References (executor has NO interview context - be exhaustive): `CLAUDE.md:35` (current: "If pre-commit fails, fix the issue, then `git commit --amend --no-edit`")
      Acceptance criteria (agent-executable): `grep -n 'amend' CLAUDE.md` returns no matches
      QA scenarios (name the exact tool + invocation): happy — read the line and verify it says `git commit` without amend; failure — verify no other amend references exist
      Commit: Y | docs: fix pre-commit failure guidance (amend → commit)

- [ ] 5. Notification.nonce: Make required with sentinel value
      What to do / Must NOT do: In `server/prisma/models/user.prisma`, change `nonce String?` to `nonce String @default("")`. This makes the field required, so `@@unique([userId, nonce])` properly enforces uniqueness (PostgreSQL allows multiple NULLs in UNIQUE by default). Update any code that creates notifications without a nonce to pass `nonce: ""` explicitly. Create a Prisma migration for the schema change.
      Parallelization: Wave 1 | Blocked by: none | Blocks: T11
      References (executor has NO interview context - be exhaustive): `server/prisma/models/user.prisma:30,43` (current: `nonce String?` + `@@unique([userId, nonce])`); PostgreSQL docs: NULLs are distinct by default in UNIQUE constraints
      Acceptance criteria (agent-executable): `grep 'nonce String' server/prisma/models/user.prisma` returns `nonce String @default("")`; migration file exists in `server/prisma/migrations/`
      QA scenarios (name the exact tool + invocation): happy — `pnpm --filter drop typecheck` passes; failure — verify migration is reversible
      Commit: Y | fix(db): make Notification.nonce required with sentinel for UNIQUE enforcement

### Wave 2 — Pre-commit hook + documentation fixes

- [ ] 6. Pre-commit: Add library workspace filtering
      What to do / Must NOT do: In `.husky/pre-commit`, add grep filters for `libraries/droplet/`, `libraries/droplet_types/`, `libraries/libarchive/`, `libraries/native_model/` prefixes. Add corresponding `cargo fmt --manifest-path` invocations for each workspace. Use same pattern as existing torrential/cli/desktop filtering.
      Parallelization: Wave 2 | Blocked by: none | Blocks: none
      References (executor has NO interview context - be exhaustive): `.husky/pre-commit:4-18` (current implementation with 3 workspaces); library manifests: `libraries/droplet/Cargo.toml`, `libraries/droplet_types/Cargo.toml`, `libraries/libarchive/Cargo.toml`, `libraries/native_model/Cargo.toml`
      Acceptance criteria (agent-executable): `shellcheck .husky/pre-commit` passes; all 7 workspace prefixes are filtered
      QA scenarios (name the exact tool + invocation): happy — `shellcheck .husky/pre-commit` clean; failure — verify each workspace has its own `if` block
      Commit: Y | ci(pre-commit): add library workspace cargo fmt filtering

- [ ] 7. Pre-commit: Add fallow audit gate
      What to do / Must NOT do: Add `fallow audit --format json --quiet --explain --gate-marker agent` invocation to `.husky/pre-commit` after the Rust formatting checks. This was promised in the remediation plan ("Rust fmt + fallow gate"). If fallow is not installed, skip gracefully (|| true).
      Parallelization: Wave 2 | Blocked by: none | Blocks: none
      References (executor has NO interview context - be exhaustive): `.husky/pre-commit` (current: no fallow invocation); `.omo/plans/remediation-plan.md:78` (promised "pre-commit Rust fmt + fallow gate")
      Acceptance criteria (agent-executable): `grep 'fallow audit' .husky/pre-commit` returns match
      QA scenarios (name the exact tool + invocation): happy — read hook and verify fallow line exists; failure — verify graceful fallback when fallow not installed
      Commit: Y | ci(pre-commit): add fallow audit gate per remediation plan

- [ ] 8. Test coverage audit: Rename "Coverage Ratio" → "Test File Ratio"
      What to do / Must NOT do: In `.omo/review/test-coverage-audit.md`, rename the "Coverage Ratio" column header to "Test File Ratio" throughout the document (lines 9, 11-22). Update the executive summary text to say "test file ratio" instead of "coverage ratio". The metric is test-files/source-files, not line/function coverage. Add a note clarifying this is NOT instrumented code coverage.
      Parallelization: Wave 2 | Blocked by: none | Blocks: none
      References (executor has NO interview context - be exhaustive): `.omo/review/test-coverage-audit.md:9-22` (current: "Coverage Ratio" column with values like 13%, 150%)
      Acceptance criteria (agent-executable): `grep -n 'Coverage Ratio' .omo/review/test-coverage-audit.md` returns no matches
      QA scenarios (name the exact tool + invocation): happy — grep for old term returns 0 matches; failure — verify table still renders correctly
      Commit: Y | docs: rename misleading "Coverage Ratio" to "Test File Ratio"

- [ ] 9. Cross-attack audit: Fix migration claim
      What to do / Must NOT do: In `.omo/review/cross-attack-high-effort.md` lines 230-232, fix the claim that the migration was "manually added raw SQL." The migration `20251210231153_move_to_version_id` is auto-generated by Prisma. Keep the warning about `DELETE FROM "Object"` without WHERE, but correct the provenance claim. Also update `.omo/review/sonarqube-audit.md` line 56 if it has the same claim.
      Parallelization: Wave 2 | Blocked by: none | Blocks: none
      References (executor has NO interview context - be exhaustive): `.omo/review/cross-attack-high-effort.md:230-232`; `.omo/review/sonarqube-audit.md:56`
      Acceptance criteria (agent-executable): `grep -n 'manually added raw SQL' .omo/review/cross-attack-high-effort.md` returns no matches
      QA scenarios (name the exact tool + invocation): happy — grep for false claim returns 0 matches; failure — verify both files updated consistently
      Commit: Y | docs: fix migration provenance claim in audit reports

### Wave 3 — Documentation + final verification

- [ ] 10. Remediation plan: Clarify session-cleanup contract
      What to do / Must NOT do: In `.omo/plans/remediation-plan.md` line 58, clarify the `removeSession === false` behavior. The current wording says "assert `signout` returns false AND cookie NOT cleared" but also allows "either outcome." Pick one: when `removeSession` returns false, `signout` should return false and the cookie should NOT be cleared (session cleanup failed = keep the cookie for retry). Update the test assertion to match.
      Parallelization: Wave 3 | Blocked by: none | Blocks: none
      References (executor has NO interview context - be exhaustive): `.omo/plans/remediation-plan.md:58` (current: ambiguous "either outcome" wording)
      Acceptance criteria (agent-executable): `grep -n 'either outcome' .omo/plans/remediation-plan.md` returns no matches
      QA scenarios (name the exact tool + invocation): happy — read the line and verify clear contract; failure — verify no other ambiguous session-cleanup references
      Commit: Y | docs: clarify session-cleanup contract in remediation plan

- [ ] 11. Code quality audit: Fix Notification.nonce NULL claim
      What to do / Must NOT do: In `.omo/review/code-quality-audit.md` line 417, fix the claim "unique constraint fails if nonce is null, since NULL != NULL in PostgreSQL." This is wrong — PostgreSQL UNIQUE allows multiple NULLs by default (NULLS DISTINCT). Update to say: "PostgreSQL UNIQUE allows multiple NULLs by default, so `@@unique([userId, nonce])` permits duplicate (userId, NULL) rows. Fix: make nonce required or use NULLS NOT DISTINCT." Cross-reference with T5 which makes nonce required.
      Parallelization: Wave 3 | Blocked by: T5 | Blocks: none
      References (executor has NO interview context - be exhaustive): `.omo/review/code-quality-audit.md:417` (current: wrong NULL behavior claim); `server/prisma/models/user.prisma:30,43` (T5 makes nonce required)
      Acceptance criteria (agent-executable): `grep -n 'NULL != NULL' .omo/review/code-quality-audit.md` returns no matches
      QA scenarios (name the exact tool + invocation): happy — grep for wrong claim returns 0 matches; failure — verify updated text is accurate
      Commit: Y | docs: fix Notification.nonce NULL uniqueness claim

- [ ] 12. Final verification: All checks pass
      What to do / Must NOT do: Run all verification commands to confirm everything passes. Do NOT make any code changes — this is verification only.
      Parallelization: Wave 3 | Blocked by: T1-T11 | Blocks: none
      References (executor has NO interview context - be exhaustive): All changed files from T1-T11
      Acceptance criteria (agent-executable): `pnpm --filter drop lint` (0 errors); `pnpm --filter drop typecheck` (passes); `pnpm --filter drop test` (122 passed); `shellcheck .husky/pre-commit` (clean)
      QA scenarios (name the exact tool + invocation): happy — all 4 commands pass; failure — identify which task introduced regression
      Commit: N (verification only)

## Final verification wave

> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.

- [ ] F1. Plan compliance audit — verify all 12 items addressed, no scope creep
- [ ] F2. Code quality review — `pnpm --filter drop lint` + `pnpm --filter drop typecheck` clean
- [ ] F3. Real manual QA — `pnpm --filter drop test` passes, `shellcheck .husky/pre-commit` clean
- [ ] F4. Scope fidelity — no functional changes beyond CodeRabbit findings, no new deps

## Commit strategy

- Wave 1: 5 commits (code fixes)
- Wave 2: 4 commits (pre-commit + docs)
- Wave 3: 3 commits (docs + verification)
- Total: 12 commits, each atomic and independently revertible

## Success criteria

- All 12 CodeRabbit findings resolved
- `pnpm --filter drop lint` — 0 errors
- `pnpm --filter drop typecheck` — passes
- `pnpm --filter drop test` — 122 passed
- `shellcheck .husky/pre-commit` — clean
- No new dependencies introduced
- No functional behavior changes beyond what was flagged

## Commit strategy

## Success criteria

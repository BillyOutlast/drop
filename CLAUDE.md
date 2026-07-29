# Drop — Agent Behavioral Rules

Cross-tool behavioral rules. Read by Claude Code, Cursor, Codex, OpenCode, and other AI coding agents. This file governs _behavior_; the dense technical reference is in `AGENTS.md`.

## After editing any file, format it immediately

Do not move on until formatting is applied. CI rejects unformatted code.

```bash
# TypeScript / Vue / Astro (server, sites, desktop/main, libraries/base)
pnpm --filter drop exec prettier --write <file>

# Rust (.rs files in cli/, desktop/src-tauri/, libraries/*)
cargo fmt -- <file>

# Markdown, YAML, JSON, CSS, SCSS
pnpm --filter drop exec prettier --write <file>
```

## Before batch commits

Run the full lint-fix and test suite:

```bash
# Format fix everything
pnpm --filter drop lint:fix

# Run tests (server workspace)
pnpm --filter drop test

# Verify nothing is unformatted
pnpm --filter drop format:check
```

The pre-commit hook runs lint-staged + `pnpm --filter drop typecheck` automatically. Tests run on pre-push via `pnpm --filter drop test`. If pre-commit fails, fix the issue and re-run the original `git commit` command.

## Do not commit

- `.env` files (use `.env.example` as template)
- `.nuxt/`, `.output/`, `dist/`, `coverage/` (build artifacts)
- `server/prisma/client/` (generated — regenerate with `pnpm --filter drop prisma generate`)
- `server/.nuxt/`, `server/.output/` (Nuxt build artifacts)
- `.omo/` (OpenCode internal state)
- Secrets, tokens, API keys — ever

## Package manager

ALWAYS pnpm. NEVER yarn or npm. The project has `packageManager: pnpm@11.17.0` enforced. yarn 1.x will refuse to run.

## Run commands from workspace directory

For `cd server && pnpm test`-style commands, either:

- `pnpm --filter drop <script>` from root
- `cd server && pnpm <script>` from inside the workspace

Do NOT run `pnpm test` from root (root has no `test` script).

## Verify before claiming completion

Do not say "done" or "fixed" without tool evidence from this session:

- Tests: `pnpm --filter drop test` output showing pass
- Lint: `pnpm --filter drop lint` output showing pass
- Typecheck: `pnpm --filter drop typecheck` output showing pass
- CI: `gh run view <run-id> --json conclusion` returning `success`

## When uncertain

1. Read `AGENTS.md` (technical reference)
2. `ls <path>` to verify directory structure
3. `cat <file>` to verify config
4. If still unclear, ask the user before proceeding

## Edit loops

If a file is repeatedly auto-formatted by linters, the file has a deeper issue. Stop and investigate — do not loop.

## Do not touch

- Generated Prisma client (`server/prisma/client/`)
- Lockfiles (`pnpm-lock.yaml`, `Cargo.lock`) — only update via `pnpm install` / `cargo update`

## PR review thread management

After every push to a branch with an open PR, automated review bots (OCR, CodeRabbit, Sourcery) fire and create new review threads. These accumulate rapidly. **Clean threads before each push** — do not let them grow exponentially.

**Check unresolved threads:**
```bash
bash .husky/pre-push 2>&1 | grep -A999 "PR_REVIEW_THREADS_START" | grep -B999 "PR_REVIEW_THREADS_END"
```

**Resolve threads**: Use MCP `resolve_thread` with the `PRRT_xxx` GraphQL node ID.

**Categories for disposition:**
- Bug/security/functional → fix in code, resolve
- OCR false positive (Nitro auto-imports like `$fetch`) → skip, resolve
- Nitpick/cosmetic → skip with brief reason, resolve
- Duplicate from multiple scans → resolve
- Positive feedback → acknowledge, resolve

**Post a summary comment** on the PR explaining disposition of all threads before resolving. See `pr-review-cleanup` skill for full workflow.

## Pre-commit format guards

The pre-commit hook must auto-fix formatting issues, not just detect them. CI should never be the first formatting failure.

- `cargo fmt` (auto-fixes), not `cargo fmt -- --check` (only checks)
- Always re-stage auto-fixed files with `git add`
- Keep `|| exit 1` for unfixable errors (missing toolchain, malformed syntax)

## jq defensive patterns

In CI scripts, `.value | tonumber` crashes on null. Always guard:
```bash
(.value // "0") | tonumber
```

In shell scripts, `echo | while` runs the loop in a subshell — variable mutations are lost. Use process substitution:
```bash
while read -r item; do ... done < <(echo "$data" | jq ...)
```

## SonarCloud coverage

When `new_uncovered_lines` = 0 but `new_coverage` = 0%: changed lines aren't classified as "coverable" but still drag the metric. Include both filters when building coverage gap tables.

Note: `.husky/pre-commit` may be modified to add audit gates (e.g., fallow). See `AGENTS.md` for fallow integration.

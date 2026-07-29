---
name: ci-format-guard
description: Use when pre-commit hooks pass locally but CI fails on formatting (prettier --check, cargo fmt --check), or when adding/modifying git hooks that enforce code style. Also use when a formatting failure in one CI job cascades to skip downstream lint/test jobs.
---

# CI Format Guard

Pre-commit hooks that pass locally but CI fails on formatting mean the hook checks but doesn't fix. CI formatting is the last line of defense — it should never be the first.

## Core Principle

**Hooks auto-fix, not just check.** If a hook detects a formatting issue it can fix, it should fix it — not report it and block.

## Pattern: Auto-Fix + Re-Stage

```bash
# ❌ BAD: Checks but doesn't fix — CI will fail
cargo fmt --manifest-path desktop/src-tauri/Cargo.toml -- --check $changed_rs || exit 1

# ✅ GOOD: Auto-fixes AND propagates failure for unfixable errors
cargo fmt --manifest-path desktop/src-tauri/Cargo.toml -- $changed_rs || exit 1
echo "$changed_rs" | xargs -r git add
```

The `|| exit 1` stays — cargo fmt can fail for unfixable reasons (missing toolchain, malformed syntax). But formatting issues get auto-fixed and re-staged.

## Quick Reference

| Workspace | Format command (auto-fix) | Verify command (CI) |
|-----------|--------------------------|---------------------|
| server (TS/Vue) | `pnpm --filter drop exec prettier --write <file>` | `pnpm --filter drop exec prettier --check .` |
| Rust (any) | `cargo fmt -- <file>` | `cargo fmt -- --check` |
| YAML/MD/JSON | `pnpm --filter drop exec prettier --write <file>` | Same as server |

## jq Defensive Patterns

jq in CI scripts crashes on null/non-numeric values. Always guard:

```bash
# ❌ BAD: crashes on null
.value | tonumber > 0

# ✅ GOOD: fallback to "0" before conversion
(.value // "0") | tonumber > 0
```

## Bash Pipeline Traps

```bash
# ❌ BAD: while loop runs in subshell — COMMENT_BODY mutations lost
echo "$data" | jq -c '.[]' | while read -r entry; do
  COMMENT_BODY+="processed"
done

# ✅ GOOD: process substitution keeps while in parent shell
while read -r entry; do
  COMMENT_BODY+="processed"
done < <(echo "$data" | jq -c '.[]')
```

## SonarCloud Coverage Disconnect

`new_uncovered_lines` = 0 but `new_coverage` = 0% happens when changed lines aren't classified as "coverable" (imports, type annotations, comments). Include BOTH metrics in coverage gap detection:

```jq
select(
  (.measures[]? | select(.metric == "new_uncovered_lines") | (.value // "0") | tonumber > 0)
  or
  (.measures[]? | select(.metric == "new_coverage") | .value // "100") == "0.0"
)
```

## Pre-commit Hook Structure

```
1. lint-staged (prettier --write, eslint --fix) → auto-fixes JS/TS/Vue → re-stages
2. cargo fmt → auto-fixes Rust → re-stages
3. typecheck → validates (read-only, no fixes)
4. shellcheck → validates (read-only)
5. fallow audit → validates (read-only, gate-only)
```

Auto-fixers first, validators last. Nothing unfixed leaves the hook.

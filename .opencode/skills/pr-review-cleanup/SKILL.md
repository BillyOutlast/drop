---
name: pr-review-cleanup
description: Use when PR has 10+ open review threads from automated bots (OCR, CodeRabbit, Sourcery) that need batch evaluation and resolution, or when pre-push hook warnings show unresolved threads accumulating across commits.
---

# PR Review Cleanup

Automated review bots (OCR, CodeRabbit, Sourcery) fire on every push. Each push creates new threads. Without cleanup, threads accumulate exponentially — every new scan finds existing threads plus new ones.

## Core Pattern

```
push → new review run → new threads → unresolved count grows
                                  ↓
hook warns (advisory) → agent reads JSON → batch evaluate → resolve all
```

## Quick Reference

| Step | Command |
|------|---------|
| Pull unresolved threads | `gh api graphql -f query='...reviewThreads...' -F pr=N` |
| Filter for JSON | `jq 'select(.isResolved == false)'` |
| Resolve thread | `gh api --method PATCH repos/:owner/:repo/pulls/:pr/comments/:id -f state=CLOSED` (or use MCP `resolve_thread` with PRRT_xxx ID) |
| Post summary | `gh pr comment N --body "All N threads evaluated: ..."` |

## GraphQL Query (get PRRT_xxx IDs — cursor-paginated)

```graphql
query($owner:String!, $repo:String!, $pr:Int!, $cursor:String) {
  repository(owner:$owner, name:$repo) {
    pullRequest(number:$pr) {
      reviewThreads(first:100, after:$cursor) {
        nodes {
          id isResolved isOutdated
          comments(first:1) {
            nodes { author { login } body path line }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}
```

Loop until `hasNextPage` is false. The `first:100` cap silently drops threads on large PRs; cursor pagination is mandatory.

The returned `id` is the PRRT_xxx GraphQL node ID used for resolution.

## Batch Resolution Pattern

1. Pull all threads into JSON
2. Filter `isResolved == false`
3. Categorize: *fix now* (bug/security), *skip with reason* (nitpick/false-positive), *already fixed* (commit addressed)
4. Post one summary comment explaining disposition of all threads
5. Resolve all threads via `resolve_thread` API (one call each)
6. Verify with `pre-push` hook — count should be 0

## Common Thread Categories

| Category | Action |
|----------|--------|
| Bug / security / functional | Fix in code, resolve |
| OCR false positive (Nitro auto-imports, hadolint suppression) | Skip with explanation, resolve |
| Duplicate from multiple OCR runs | Resolve (one run's copy), other auto-resolved |
| Nitpick / cosmetic | Skip with reason, resolve |
| Positive feedback ("good improvement") | Acknowledge, resolve |
| Pre-existing (not introduced by PR) | Skip, resolve |
| Stale / outdated (code already changed) | Resolve as outdated |

## Red Flags

- Resolving threads without reading them — OCR finds real bugs
- Leaving "good improvement" comments unresolved — clutter
- Not posting a summary comment — future reviewers need context on why threads were closed
- Using `--no-verify` to skip the hook instead of cleaning threads

## Pre-push Hook Integration

The pre-push hook at `.husky/pre-push` queries unresolved threads. JSON output between `## PR_REVIEW_THREADS_START` / `## PR_REVIEW_THREADS_END` markers. Agent should parse this and act BEFORE pushing — clean threads first, then push clean.

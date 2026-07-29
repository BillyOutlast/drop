---
name: pull-review-comments
description: Fetch all unresolved PR review threads (OCR, CodeRabbit, Sourcery) — cursor-paginated across all pages. Use during development to discover review feedback before pushing. Auto-detects PR from current branch.
---

# pull-review-comments

Fetch unresolved review threads for the PR associated with the current branch.
Invoke anytime during development — don't wait for the pre-push hook.

## Step 1: Discover PR number

```bash
REPO=$(git remote get-url origin | sed 's|.*github.com[:/]||;s|\.git$||')
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
PR_NUMBER=$(gh pr list --repo "${REPO}" --head "${CURRENT_BRANCH}" --state open --json number --jq '.[0].number')
```

If `PR_NUMBER` is empty: "No open PR found for branch `${CURRENT_BRANCH}`." Stop.

## Step 2: Fetch all unresolved threads (cursor-paginated)

```bash
OWNER="${REPO%%/*}"
REPO_NAME="${REPO##*/}"

ALL_UNRESOLVED='[]'
CURSOR=''
HAS_NEXT='true'
while [ "${HAS_NEXT}" = 'true' ]; do
  if [ -z "${CURSOR}" ]; then
    PAGE_JSON=$(gh api graphql -f query='
      query($owner:String!, $repo:String!, $pr:Int!) {
        repository(owner:$owner, name:$repo) {
          pullRequest(number:$pr) {
            reviewThreads(first:100) {
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
      }' -F owner="${OWNER}" -F repo="${REPO_NAME}" -F pr="${PR_NUMBER}" 2>&1) || {
      printf ':: Error: gh API call failed (exit %d)\n' "$?" >&2
      exit 1
    }
  else
    PAGE_JSON=$(gh api graphql -f query='
      query($owner:String!, $repo:String!, $pr:Int!, $cursor:String!) {
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
      }' -F owner="${OWNER}" -F repo="${REPO_NAME}" -F pr="${PR_NUMBER}" -F cursor="${CURSOR}" 2>&1) || {
      printf ':: Error: gh API call failed on page (exit %d) — results may be incomplete.\n' "$?" >&2
      break
    }
  fi

  PAGE_UNRESOLVED=$(echo "${PAGE_JSON}" | jq -c '
    .data.repository.pullRequest.reviewThreads.nodes
    | map(select(.isResolved == false))
    | map({
        thread_id: .id,
        file: .comments.nodes[0].path,
        line: .comments.nodes[0].line,
        author: .comments.nodes[0].author.login,
        body_preview: (.comments.nodes[0].body | .[0:200]),
        is_outdated: .isOutdated
      })')
  ALL_UNRESOLVED=$(echo "${ALL_UNRESOLVED}" | jq -c ". + ${PAGE_UNRESOLVED}")
  HAS_NEXT=$(echo "${PAGE_JSON}" | jq -r '.data.repository.pullRequest.reviewThreads.pageInfo.hasNextPage')
  CURSOR=$(echo "${PAGE_JSON}" | jq -r '.data.repository.pullRequest.reviewThreads.pageInfo.endCursor')
done

TOTAL=$(echo "${ALL_UNRESOLVED}" | jq 'length')
```

## Step 3: Report findings

If `TOTAL` is 0: "No unresolved review threads. Clean."

Otherwise, output grouped by file:

```bash
echo "${ALL_UNRESOLVED}" | jq -r '
  group_by(.file)
  | .[]
  | "--- \(.[0].file) ---",
    (.[] | "  L\(.line // "?"): [\(.author)] \(.body_preview[0:100])"),
    ""
'
```

Then present count: "N unresolved threads across M files."

## Step 4: Resolution

Ask user: "Work through these, skip for now, or auto-resolve false positives?"

If user wants to resolve:
- Use MCP `github-pull_request_review_write` with `method: "resolve_thread"` and `threadId`
- Provide: owner, repo, pullNumber, threadId for each thread
- Batch in groups of 4 for efficiency

## Common resolution patterns

| Finding type | Action |
|---|---|
| Bug / security | Fix code, then resolve |
| False positive (Nitro auto-imports, fallow tool directives, hadolint) | Resolve with explanation |
| Duplicate from multiple scans | Resolve |
| Nitpick / cosmetic | Skip or resolve |
| Pre-existing (not from this PR) | Resolve |
| Stale (code already changed) | Resolve |

## What NOT to do

- Don't resolve threads without reading them
- Don't leave threads open after fixing — verify with re-run
- Don't use `--no-verify` to skip resolution — clean threads before pushing

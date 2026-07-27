#!/usr/bin/env bash
# ==============================================================================
# sonarcloud-pr-comment.sh — Post SonarCloud findings as PR comment
# ==============================================================================
#
# Queries SonarCloud for unresolved issues on the current PR and posts a
# summary comment with links to existing GitHub issues.
#
# Usage:
#   ./scripts/sonarcloud-pr-comment.sh
#
# Environment:
#   SONAR_TOKEN          Required. SonarCloud API token
#   GH_TOKEN             GitHub API token (falls back to GITHUB_TOKEN)
#   SONAR_PROJECT_KEY    SonarCloud project key (default: BillyOutlast_drop)
#   GITHUB_REPOSITORY    GitHub repo (default: BillyOutlast/drop)
#   GITHUB_PR_NUMBER     PR number (auto-detected from GitHub context)
# ==============================================================================

set -euo pipefail

# ---- Configuration -----------------------------------------------------------

SONAR_PROJECT_KEY="${SONAR_PROJECT_KEY:-BillyOutlast_drop}"
GITHUB_REPOSITORY="${GITHUB_REPOSITORY:-BillyOutlast/drop}"
GH_TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"

# Auto-detect PR number from GitHub context
if [[ -z "${GITHUB_PR_NUMBER:-}" ]]; then
  if [[ -n "${GITHUB_REF:-}" && "$GITHUB_REF" =~ ^refs/pull/([0-9]+)/merge$ ]]; then
    GITHUB_PR_NUMBER="${BASH_REMATCH[1]}"
  else
    echo "ERROR: GITHUB_PR_NUMBER not set and cannot auto-detect from GITHUB_REF" >&2
    exit 1
  fi
fi

SONAR_API="https://sonarcloud.io/api/issues/search"
SEVERITIES="BLOCKER,CRITICAL,MAJOR"
PAGE_SIZE=100

# --- Validation ---------------------------------------------------------------

if [[ -z "${SONAR_TOKEN:-}" ]]; then
  echo "FATAL: SONAR_TOKEN is not set" >&2
  exit 1
fi

if [[ -z "$GH_TOKEN" ]]; then
  echo "FATAL: GH_TOKEN or GITHUB_TOKEN is not set" >&2
  exit 1
fi

if ! command -v jq &>/dev/null; then
  echo "FATAL: jq is required but not installed" >&2
  exit 1
fi

if ! command -v gh &>/dev/null; then
  echo "FATAL: gh (GitHub CLI) is required but not installed" >&2
  exit 1
fi

# log prints a timestamped message to standard output.

log() { echo "[$(date '+%H:%M:%S')] $*"; }

# --- Step 1: Fetch unresolved issues from SonarCloud -------------------------

log "Fetching unresolved issues from SonarCloud (project: ${SONAR_PROJECT_KEY})..."

SONAR_RESPONSE=$(curl -sS -f \
  -H "Authorization: Bearer ${SONAR_TOKEN}" \
  "${SONAR_API}?componentKeys=${SONAR_PROJECT_KEY}&resolved=false&severities=${SEVERITIES}&ps=${PAGE_SIZE}&p=1") || {
    log "SonarCloud API request failed, skipping comment"
    exit 0
  }

TOTAL=$(echo "$SONAR_RESPONSE" | jq -r '.total // 0')
log "Found ${TOTAL} unresolved issues (BLOCKER/CRITICAL/MAJOR)"

if [[ "$TOTAL" -eq 0 ]]; then
  log "No unresolved issues — posting success comment"
  COMMENT_BODY="## SonarCloud Analysis ✅\n\nNo BLOCKER, CRITICAL, or MAJOR issues found."
  echo -e "$COMMENT_BODY" | gh pr comment "$GITHUB_PR_NUMBER" \
    --repo "$GITHUB_REPOSITORY" \
    --body-file - 2>/dev/null || log "Failed to post comment"
  exit 0
fi

# --- Step 2: Group issues by severity ----------------------------------------

BLOCKER_COUNT=$(echo "$SONAR_RESPONSE" | jq '[.issues[] | select(.severity == "BLOCKER")] | length')
CRITICAL_COUNT=$(echo "$SONAR_RESPONSE" | jq '[.issues[] | select(.severity == "CRITICAL")] | length')
MAJOR_COUNT=$(echo "$SONAR_RESPONSE" | jq '[.issues[] | select(.severity == "MAJOR")] | length')

# --- Step 3: Fetch existing GitHub issues with sonarcloud label ---------------

log "Fetching existing GitHub issues with 'sonarcloud' label..."
EXISTING_ISSUES=$(gh issue list \
  --repo "$GITHUB_REPOSITORY" \
  --label sonarcloud \
  --state open \
  --json number,title,labels \
  --limit 100 2>/dev/null || echo "[]")

EXISTING_COUNT=$(echo "$EXISTING_ISSUES" | jq 'length')
log "Found ${EXISTING_COUNT} existing sonarcloud issues"

# --- Step 4: Build PR comment ------------------------------------------------

COMMENT_BODY="## SonarCloud Analysis\n\n"
COMMENT_BODY+="**Quality Gate**: Failed (coverage + security rating)\n\n"
COMMENT_BODY+="### Summary\n\n"
COMMENT_BODY+="| Severity | Count |\n"
COMMENT_BODY+="|----------|-------|\n"

if [[ "$BLOCKER_COUNT" -gt 0 ]]; then
  COMMENT_BODY+="| 🔴 BLOCKER | ${BLOCKER_COUNT} |\n"
fi
if [[ "$CRITICAL_COUNT" -gt 0 ]]; then
  COMMENT_BODY+="| 🟠 CRITICAL | ${CRITICAL_COUNT} |\n"
fi
if [[ "$MAJOR_COUNT" -gt 0 ]]; then
  COMMENT_BODY+="| 🟡 MAJOR | ${MAJOR_COUNT} |\n"
fi

COMMENT_BODY+="\n**Total**: ${TOTAL} issues\n\n"

# Add top 5 issues by severity
COMMENT_BODY+="### Top Issues\n\n"
COMMENT_BODY+="| File | Line | Rule | Severity |\n"
COMMENT_BODY+="|------|------|------|----------|\n"

echo "$SONAR_RESPONSE" | jq -r '
  .issues
  | sort_by(
      if .severity == "BLOCKER" then 0
      elif .severity == "CRITICAL" then 1
      elif .severity == "MAJOR" then 2
      else 3 end
    )
  | .[0:5]
  | .[]
  | "| \(.component | split(":") | last) | \(.line // "-") | \(.rule | split(":") | last) | \(.severity) |"
' | while IFS= read -r line; do
  COMMENT_BODY+="${line}\n"
done

COMMENT_BODY+="\n### Tracking\n\n"

if [[ "$EXISTING_COUNT" -gt 0 ]]; then
  COMMENT_BODY+="Existing GitHub issues tracking these findings:\n\n"
  echo "$EXISTING_ISSUES" | jq -r '.[] | "- #\(.number): \(.title)"' | head -10 | while IFS= read -r line; do
    COMMENT_BODY+="${line}\n"
  done
  
  if [[ "$EXISTING_COUNT" -gt 10 ]]; then
    COMMENT_BODY+="- ... and $((EXISTING_COUNT - 10)) more\n"
  fi
else
  COMMENT_BODY+="No existing GitHub issues found. Run \`./scripts/sonarcloud-sync.sh\` to create tracking issues.\n"
fi

COMMENT_BODY+="\n---\n\n"
COMMENT_BODY+="*Full analysis: [SonarCloud Dashboard](https://sonarcloud.io/project/overview?id=${SONAR_PROJECT_KEY})*\n"
COMMENT_BODY+="*To create tracking issues: \`./scripts/sonarcloud-sync.sh --backfill\`*"

# --- Step 5: Post comment to PR ----------------------------------------------

log "Posting comment to PR #${GITHUB_PR_NUMBER}..."

echo -e "$COMMENT_BODY" | gh pr comment "$GITHUB_PR_NUMBER" \
  --repo "$GITHUB_REPOSITORY" \
  --body-file - 2>/dev/null || {
    log "Failed to post comment to PR"
    exit 1
  }

log "Comment posted successfully to PR #${GITHUB_PR_NUMBER}"

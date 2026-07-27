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

# --- Helpers ------------------------------------------------------------------

log() { echo "[$(date '+%H:%M:%S')] $*"; }

# --- Step 1: Fetch unresolved issues from SonarCloud -------------------------

log "Fetching unresolved issues from SonarCloud (project: ${SONAR_PROJECT_KEY})..."

SONAR_RESPONSE=$(curl -sS -f \
  -H "Authorization: Bearer ${SONAR_TOKEN}" \
  "${SONAR_API}?componentKeys=${SONAR_PROJECT_KEY}&resolved=false&severities=${SEVERITIES}&pullRequest=${GITHUB_PR_NUMBER}&ps=${PAGE_SIZE}&p=1") || {
    log "SonarCloud API request failed, skipping comment"
    exit 0
  }

TOTAL=$(echo "$SONAR_RESPONSE" | jq -r '.total // 0')
TOTAL_PAGES=$(( (TOTAL + PAGE_SIZE - 1) / PAGE_SIZE ))
log "Found ${TOTAL} unresolved issues across ${TOTAL_PAGES} page(s) (BLOCKER/CRITICAL/MAJOR)"

if [[ "$TOTAL" -eq 0 ]]; then
  log "No unresolved issues — posting success comment"
  COMMENT_BODY="## SonarCloud Analysis ✅\n\nNo BLOCKER, CRITICAL, or MAJOR issues found."
  echo -e "$COMMENT_BODY" | gh pr comment "$GITHUB_PR_NUMBER" \
    --repo "$GITHUB_REPOSITORY" \
    --body-file - 2>/dev/null || log "Failed to post comment"
  exit 0
fi

# Fetch remaining pages if needed
if [[ "$TOTAL_PAGES" -gt 1 ]]; then
  ALL_ISSUES=$(echo "$SONAR_RESPONSE" | jq '.issues')
  PAGE=2
  while [[ "$PAGE" -le "$TOTAL_PAGES" ]]; do
    log "Fetching page ${PAGE}/${TOTAL_PAGES}..."
    PAGE_RESPONSE=$(curl -sS -f \
      -H "Authorization: Bearer ${SONAR_TOKEN}" \
      "${SONAR_API}?componentKeys=${SONAR_PROJECT_KEY}&resolved=false&severities=${SEVERITIES}&pullRequest=${GITHUB_PR_NUMBER}&ps=${PAGE_SIZE}&p=${PAGE}") || {
        log "SonarCloud API request failed on page ${PAGE}, skipping remaining pages"
        break
      }
    ALL_ISSUES=$(echo "$ALL_ISSUES $(echo "$PAGE_RESPONSE" | jq '.issues')" | jq -s 'add')
    PAGE=$((PAGE + 1))
  done
  SONAR_RESPONSE=$(echo "$SONAR_RESPONSE" | jq --argjson issues "$ALL_ISSUES" '.issues = $issues')
fi

# --- Step 2: Group issues by severity ----------------------------------------

BLOCKER_COUNT=$(echo "$SONAR_RESPONSE" | jq '[.issues[] | select(.severity == "BLOCKER")] | length')
CRITICAL_COUNT=$(echo "$SONAR_RESPONSE" | jq '[.issues[] | select(.severity == "CRITICAL")] | length')
MAJOR_COUNT=$(echo "$SONAR_RESPONSE" | jq '[.issues[] | select(.severity == "MAJOR")] | length')

# --- Step 3: Build current finding keys set -----------------------------------

CURRENT_KEYS=$(echo "$SONAR_RESPONSE" | jq -c '[.issues[].key] | unique')
log "Current finding keys: $(echo "$CURRENT_KEYS" | jq 'length') unique keys"

# --- Step 4: Fetch existing GitHub issues and match to current findings -------

log "Fetching existing GitHub issues with 'sonarcloud' label..."
EXISTING_ISSUES=$(gh issue list \
  --repo "$GITHUB_REPOSITORY" \
  --label sonarcloud \
  --state open \
  --json number,title,body \
  --limit 100 2>/dev/null || echo "[]")

EXISTING_COUNT=$(echo "$EXISTING_ISSUES" | jq 'length')
log "Found ${EXISTING_COUNT} existing sonarcloud issues"

MATCHED_ISSUES=$(echo "$EXISTING_ISSUES" | jq -c --argjson currentKeys "$CURRENT_KEYS" '
  [.[] | select(
    (.body // "") as $b |
    ($b | capture("sonarcloud-keys:\\s*(?<keys>[A-Za-z0-9,._-]+)"; "i").keys // "" | split(",") | map(gsub("^\\s+|\\s+$"; ""))) as $issueKeys |
    ($currentKeys - ($currentKeys - $issueKeys)) | length > 0
  ) | {number: .number, title: .title}]
')

MATCHED_COUNT=$(echo "$MATCHED_ISSUES" | jq 'length')
log "Matched ${MATCHED_COUNT} issues to current findings"

# --- Step 4: Build PR comment ------------------------------------------------

COMMENT_BODY="## SonarCloud Analysis\n\n"
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

TOP_ISSUES=$(echo "$SONAR_RESPONSE" | jq -r '
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
' 2>/dev/null || echo "")

if [[ -n "$TOP_ISSUES" ]]; then
  COMMENT_BODY+="${TOP_ISSUES}\n"
else
  COMMENT_BODY+="| No issues found | - | - | - |\n"
fi

COMMENT_BODY+="\n### Tracking\n\n"

if [[ "$MATCHED_COUNT" -gt 0 ]]; then
  COMMENT_BODY+="Existing GitHub issues tracking these findings:\n\n"
  while IFS= read -r line; do
    COMMENT_BODY+="${line}\n"
  done < <(echo "$MATCHED_ISSUES" | jq -r '.[] | "- #\(.number): \(.title)"' | head -10)

  if [[ "$MATCHED_COUNT" -gt 10 ]]; then
    COMMENT_BODY+="- ... and $((MATCHED_COUNT - 10)) more\n"
  fi
else
  COMMENT_BODY+="No existing GitHub issues found for these findings. Run \`./scripts/sonarcloud-sync.sh\` to create tracking issues.\n"
fi

COMMENT_BODY+="\n---\n\n"
COMMENT_BODY+="*Full analysis: [SonarCloud Dashboard](https://sonarcloud.io/project/overview?id=${SONAR_PROJECT_KEY})*\n"
COMMENT_BODY+="*To create tracking issues: \`./scripts/sonarcloud-sync.sh --backfill\`*\n\n"

log "Fetching quality gate status..."
QG_RESPONSE=$(curl -sS -f \
  -H "Authorization: Bearer ${SONAR_TOKEN}" \
  "https://sonarcloud.io/api/qualitygates/project_status?projectKey=${SONAR_PROJECT_KEY}&pullRequest=${GITHUB_PR_NUMBER}" 2>/dev/null || echo '{"projectStatus":{"status":"UNKNOWN","conditions":[]}}')

COMMENT_BODY+="<details>\n<summary>📋 JSON Summary (for AI agents)</summary>\n\n"
COMMENT_BODY+="\`\`\`json\n"

JSON_SUMMARY=$(echo "$SONAR_RESPONSE" | jq \
  --arg project "$SONAR_PROJECT_KEY" \
  --arg pr "$GITHUB_PR_NUMBER" \
  --argjson qg "$(echo "$QG_RESPONSE" | jq '{gateStatus: .projectStatus.status, failedConditions: [.projectStatus.conditions[]? | select(.status == "ERROR") | {metric: .metricKey, actual: .actualValue, threshold: .errorThreshold}]}')" \
  '{
  project: $project,
  pullRequest: ($pr | tonumber),
  qualityGate: $qg,
  totalIssues: .total,
  summary: {
    blocker: [.issues[] | select(.severity == "BLOCKER")] | length,
    critical: [.issues[] | select(.severity == "CRITICAL")] | length,
    major: [.issues[] | select(.severity == "MAJOR")] | length
  },
  issues: [.issues[] | {
    key: .key,
    rule: .rule,
    severity: .severity,
    message: .message,
    component: (.component | split(":") | last),
    line: .line,
    url: ("https://sonarcloud.io/project/issues?id=" + $project + "&issues=" + .key + "&open=" + .key)
  }]
}')

COMMENT_BODY+="${JSON_SUMMARY}\n"
COMMENT_BODY+="\`\`\`\n\n"
COMMENT_BODY+="</details>"

# --- Step 5: Post comment to PR ----------------------------------------------

log "Posting comment to PR #${GITHUB_PR_NUMBER}..."

echo -e "$COMMENT_BODY" | gh pr comment "$GITHUB_PR_NUMBER" \
  --repo "$GITHUB_REPOSITORY" \
  --body-file - 2>/dev/null || {
    log "Failed to post comment to PR"
    exit 1
  }

log "Comment posted successfully to PR #${GITHUB_PR_NUMBER}"

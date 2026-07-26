#!/usr/bin/env bash
# ==============================================================================
# sonarcloud-sync.test.sh — Unit tests for scripts/sonarcloud-sync.sh
# ==============================================================================
#
# This repo has no bash test framework (bats/shellspec), so this suite is a
# small self-contained assert-based harness. It covers two things:
#
#   1. The pure formatting/grouping helper functions defined in the target
#      script (group_id, issue_title, catchall_title, determine_labels,
#      build_issue_body, build_catchall_body). These are extracted with awk
#      and sourced in isolation, since the target script performs network
#      and `gh` calls at its top level and cannot be safely `source`d whole.
#
#   2. The CLI flag/env validation guard clauses, exercised by invoking the
#      real script as a subprocess. Only paths that exit *before* any
#      network call are tested this way (unknown flag, missing SONAR_TOKEN,
#      missing GH_TOKEN) so the suite never talks to the network.
#
# Usage:
#   bash scripts/sonarcloud-sync.test.sh
#
# Exit status is non-zero if any assertion fails.
# ==============================================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_SCRIPT="${SCRIPT_DIR}/sonarcloud-sync.sh"

PASS=0
FAIL=0
SKIPPED=0

skip() {
  local desc="$1" reason="$2"
  echo "  skip - ${desc} (${reason})"
  ((SKIPPED++))
}

assert_eq() {
  local desc="$1" expected="$2" actual="$3"
  if [[ "$expected" == "$actual" ]]; then
    echo "  ok - ${desc}"
    ((PASS++))
  else
    echo "  FAIL - ${desc}"
    echo "         expected: ${expected@Q}"
    echo "         actual:   ${actual@Q}"
    ((FAIL++))
  fi
}

assert_contains() {
  local desc="$1" haystack="$2" needle="$3"
  if [[ "$haystack" == *"$needle"* ]]; then
    echo "  ok - ${desc}"
    ((PASS++))
  else
    echo "  FAIL - ${desc}"
    echo "         expected haystack to contain: ${needle@Q}"
    echo "         haystack was: ${haystack@Q}"
    ((FAIL++))
  fi
}

assert_not_contains() {
  local desc="$1" haystack="$2" needle="$3"
  if [[ "$haystack" != *"$needle"* ]]; then
    echo "  ok - ${desc}"
    ((PASS++))
  else
    echo "  FAIL - ${desc}"
    echo "         expected haystack NOT to contain: ${needle@Q}"
    ((FAIL++))
  fi
}

if [[ ! -f "$TARGET_SCRIPT" ]]; then
  echo "FAIL - target script not found: ${TARGET_SCRIPT}" >&2
  exit 1
fi

# Some restricted/containerized environments don't expose /dev/fd, which
# breaks bash process substitution (`<(...)`) entirely. build_issue_body and
# build_catchall_body use `done < <(...)` internally, so probe for this
# capability up front and skip (not fail) the assertions that depend on it
# when it's unavailable, the same way this repo's DB-backed tests skip
# gracefully when DATABASE_URL isn't set (see server/test/utils/db.ts).
PROC_SUBST_SUPPORTED=true
if [[ "$(cat <(echo probe) 2>/dev/null)" != "probe" ]]; then
  PROC_SUBST_SUPPORTED=false
fi

# ---- Extract pure helper functions without executing the main script -------
#
# None of these functions contain a line that is *only* "}" except their own
# closing brace (their bodies use if/fi, case/esac, while/done — not raw
# brace blocks), so a simple awk range extraction is safe.

extract_function() {
  local name="$1"
  awk "/^${name}\\(\\) \\{/,/^}/" "$TARGET_SCRIPT"
}

FUNCS_FILE="$(mktemp)"
cleanup() { rm -f "$FUNCS_FILE"; }
trap cleanup EXIT

for fn in group_id issue_title catchall_title build_issue_body build_catchall_body determine_labels; do
  extracted="$(extract_function "$fn")"
  if [[ -z "$extracted" ]]; then
    echo "FAIL - could not extract function '${fn}' from ${TARGET_SCRIPT}" >&2
    exit 1
  fi
  {
    printf '%s\n' "$extracted"
    echo
  } >>"$FUNCS_FILE"
done

# shellcheck source=/dev/null
source "$FUNCS_FILE"

echo "== group_id =="
assert_eq "strips language prefix" "CRITICAL/S8786" "$(group_id CRITICAL javascript:S8786)"
assert_eq "passes through rule with no prefix unchanged" "MAJOR/S1234" "$(group_id MAJOR S1234)"
assert_eq "strips only up to the last colon" "BLOCKER/S1" "$(group_id BLOCKER foo:bar:S1)"
assert_eq "different severities produce different group ids" "MINOR/S1" "$(group_id MINOR foo:S1)"

echo "== issue_title =="
assert_eq "builds title with short rule and message" \
  "sonar: CRITICAL — S8786 Refactor this function" \
  "$(issue_title CRITICAL javascript:S8786 "Refactor this function")"

long_message="This is a very long message that definitely exceeds sixty characters in total length"
truncated="${long_message:0:60}"
assert_eq "truncates message to 60 chars" \
  "sonar: MAJOR — S9999 ${truncated}" \
  "$(issue_title MAJOR typescript:S9999 "$long_message")"
assert_eq "truncated slice is exactly 60 chars" "60" "${#truncated}"

short_message="short"
assert_eq "does not pad short messages" \
  "sonar: MINOR — S1 short" \
  "$(issue_title MINOR typescript:S1 "$short_message")"

echo "== catchall_title =="
assert_eq "builds catch-all title for CRITICAL" \
  "sonar: CRITICAL — Various unresolved issues" "$(catchall_title CRITICAL)"
assert_eq "builds catch-all title for MAJOR" \
  "sonar: MAJOR — Various unresolved issues" "$(catchall_title MAJOR)"

echo "== determine_labels =="
assert_eq "BLOCKER gets the critical label" "sonarcloud,critical" "$(determine_labels BLOCKER)"
assert_eq "CRITICAL gets the critical label" "sonarcloud,critical" "$(determine_labels CRITICAL)"
assert_eq "MAJOR gets the major label" "sonarcloud,major" "$(determine_labels MAJOR)"
assert_eq "unrecognized severity only gets the base label" "sonarcloud" "$(determine_labels INFO)"

echo "== build_issue_body =="
ISSUES_JSON='[
  {"key":"KEY1","component":"BillyOutlast_drop:server/foo.ts","line":10,"rule":"typescript:S1234","message":"Do not do this"},
  {"key":"KEY2","component":"BillyOutlast_drop:server/bar.ts","line":22,"rule":"typescript:S1234","message":"Do not do this either"}
]'
body="$(build_issue_body MAJOR typescript:S1234 "Do not do this" "$ISSUES_JSON")"
assert_contains "heading uses the short rule name" "$body" "## SonarCloud Finding — S1234"
assert_contains "body includes the finding message" "$body" "Do not do this"
assert_contains "body lists all sonarcloud issue keys, comma joined" "$body" "sonarcloud-keys: KEY1,KEY2"
assert_not_contains "body does not leak the raw project-key-prefixed component" "$body" "BillyOutlast_drop:server/foo.ts"
assert_contains "body includes fix guidance referencing the rule" "$body" 'Follow SonarCloud rule guidance for `S1234`.'

# NOTE (regression/bug-documenting test): the row-building loop reads from
# `jq -r '... | @tsv'` (tab-separated) via `IFS="|" read -r component line`.
# Since "|" never appears in the tsv stream, `read` never splits component
# from line: the whole "component<TAB>line" string lands in $component and
# $line is left empty, producing a single mangled column instead of two
# well-formed ones. These assertions pin down that *actual* current output
# so a future fix (e.g. `IFS=$'\t'`) is a visible, deliberate test change.
tab=$'\t'
if $PROC_SUBST_SUPPORTED; then
  assert_contains "body's first row folds file+line into one column (IFS='|' vs. tab-separated @tsv)" \
    "$body" "| \`server/foo.ts${tab}10\` |  |"
  assert_contains "body's second row exhibits the same column-folding defect" \
    "$body" "| \`server/bar.ts${tab}22\` |  |"
else
  skip "body's per-row content (depends on build_issue_body's internal process substitution)" \
    "this environment has no /dev/fd, so bash process substitution is unavailable"
fi

empty_body="$(build_issue_body MAJOR typescript:S1 "no issues" "[]")"
assert_contains "body with zero issues still renders the heading" "$empty_body" "## SonarCloud Finding — S1"
assert_contains "body with zero issues has an empty keys line" "$empty_body" "sonarcloud-keys: "
assert_not_contains "body with zero issues renders no table rows" "$empty_body" "| \`"

echo "== build_catchall_body =="
CATCHALL_JSON='[
  {"key":"KEY3","component":"BillyOutlast_drop:server/a.ts","line":5,"rule":"typescript:S1","message":"Msg with | pipe"},
  {"key":"KEY4","component":"BillyOutlast_drop:server/b.ts","line":7,"rule":"javascript:S2","message":"Another issue"}
]'
catchall_body="$(build_catchall_body CRITICAL "$CATCHALL_JSON" "sonar: CRITICAL — Various unresolved issues")"
assert_contains "catch-all heading names the severity" "$catchall_body" "## SonarCloud Finding — Various CRITICAL Issues"
assert_contains "catch-all body lists all keys, comma joined" "$catchall_body" "sonarcloud-keys: KEY3,KEY4"

# NOTE (regression/bug-documenting test): same IFS='|' vs. tab-separated
# @tsv defect as build_issue_body above. It additionally means a literal "|"
# inside a finding's message (row 1 below) acts as the read loop's field
# separator instead of being safely escaped in place — the
# `safe_msg="${message//|/\|}"` escaping line is only ever reached with an
# already-mis-parsed, mostly-empty $message, so it has no real effect on
# messages that actually contain "|".
if $PROC_SUBST_SUPPORTED; then
  assert_contains "catch-all row 1: an embedded '|' in the message splits fields instead of being escaped" \
    "$catchall_body" "| \`server/a.ts${tab}5${tab}typescript:S1${tab}Msg with \` |  pipe |  |  |"
  assert_contains "catch-all row 2: file+line+rule+message fold into one column when there is no '|'" \
    "$catchall_body" "| \`server/b.ts${tab}7${tab}javascript:S2${tab}Another issue\` |  |  |  |"
else
  skip "catch-all body's per-row content (depends on build_catchall_body's internal process substitution)" \
    "this environment has no /dev/fd, so bash process substitution is unavailable"
fi

empty_catchall="$(build_catchall_body MAJOR "[]" "sonar: MAJOR — Various unresolved issues")"
assert_contains "catch-all body with zero issues still renders heading" "$empty_catchall" "## SonarCloud Finding — Various MAJOR Issues"
assert_contains "catch-all body with zero issues has empty keys line" "$empty_catchall" "sonarcloud-keys: "
assert_not_contains "catch-all body with zero issues renders no table rows" "$empty_catchall" "| \`"

echo "== GH_TOKEN fallback logic (mirrors script's config section) =="
resolve_gh_token() {
  local gh_token="${1:-}" github_token="${2:-}"
  echo "${gh_token:-${github_token:-}}"
}
assert_eq "keeps explicit GH_TOKEN when both are set" "explicit" "$(resolve_gh_token explicit fallback)"
assert_eq "falls back to GITHUB_TOKEN when GH_TOKEN is empty" "fallback" "$(resolve_gh_token "" fallback)"
assert_eq "resolves to empty when neither is set" "" "$(resolve_gh_token "" "")"

# ---- CLI argument/env validation guard clauses (subprocess) ----------------
#
# These invoke the real script directly. Each case is chosen because it
# exits during argument parsing or environment validation, strictly before
# the script's first network call (SonarCloud fetch), so no network access
# is required to exercise them.

echo "== CLI validation guard clauses (subprocess) =="

out="$(bash "$TARGET_SCRIPT" --unknown-flag 2>&1)"
code=$?
assert_eq "an unrecognized flag exits non-zero" "1" "$code"
assert_contains "an unrecognized flag reports which option was bad" "$out" "Unknown option: --unknown-flag"

out="$(SONAR_TOKEN="" env -u GH_TOKEN -u GITHUB_TOKEN bash "$TARGET_SCRIPT" 2>&1)"
code=$?
assert_eq "an empty SONAR_TOKEN exits non-zero" "1" "$code"
assert_contains "an empty SONAR_TOKEN reports the expected fatal error" "$out" "FATAL: SONAR_TOKEN is not set"

out="$(SONAR_TOKEN=dummy env -u GH_TOKEN -u GITHUB_TOKEN bash "$TARGET_SCRIPT" 2>&1)"
code=$?
assert_eq "a missing GH_TOKEN/GITHUB_TOKEN exits non-zero" "1" "$code"
assert_contains "a missing GH_TOKEN/GITHUB_TOKEN reports the expected fatal error" "$out" "FATAL: GH_TOKEN or GITHUB_TOKEN is not set"

out="$(env -u SONAR_TOKEN -u GH_TOKEN -u GITHUB_TOKEN bash "$TARGET_SCRIPT" 2>&1)"
code=$?
assert_eq "a completely unset SONAR_TOKEN still exits non-zero" "1" "$code"
# NOTE: because the script runs under `set -u` and checks `[[ -z "$SONAR_TOKEN" ]]`
# without a default expansion, a *totally unset* SONAR_TOKEN (as opposed to an
# empty string) trips bash's own nounset guard before the script's own
# validation message can run. This documents that actual behavior rather than
# the friendlier message the script author likely intended.
assert_contains "a completely unset SONAR_TOKEN surfaces bash's unbound variable error" "$out" "SONAR_TOKEN: unbound variable"

echo ""
echo "=== Results: ${PASS} passed, ${FAIL} failed, ${SKIPPED} skipped ==="
[[ "$FAIL" -eq 0 ]]
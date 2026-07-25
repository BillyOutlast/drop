#!/bin/bash
# auto-test-generate.sh
# OpenCode hook: On PR modifying server/server/internal/*.ts, determine target test path.
# Outputs GENERATE: <path> with prompt or EXISTS: <path> if test already present.
#
# Usage: .opencode/hooks/auto-test-generate.sh <modified-file-path>
# Example: .opencode/hooks/auto-test-generate.sh server/server/internal/metadata/steam.ts

set -euo pipefail

if [ $# -ne 1 ]; then
  echo "USAGE: $0 <modified-file-path>" >&2
  exit 1
fi

INPUT="$1"
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

# Only process files under server/server/internal/
case "$INPUT" in
  server/server/internal/*.ts) ;;
  *)
    echo "SKIP: $INPUT (not under server/server/internal/)"
    exit 0
    ;;
esac

# Derive test path: strip server/server/internal/ prefix, swap .ts → .test.ts, prepend server/test/unit/
RELPATH="${INPUT#server/server/internal/}"
TEST_PATH="server/test/unit/${RELPATH%.ts}.test.ts"

# Check if test already exists
if [ -f "$REPO_ROOT/$TEST_PATH" ]; then
  echo "EXISTS: $TEST_PATH"
  exit 0
fi

FUNC_NAMES=$(grep -n '^export ' "$REPO_ROOT/$INPUT" 2>/dev/null | grep -E '(function|class|const|async)' | sed 's/export //' || echo "")

echo "GENERATE: $TEST_PATH"
echo "PROMPT: Generate vitest tests for $INPUT"
echo ""
echo "  - Test each exported function and class method"
echo "  - Cover error handling paths (network failures, auth rejections, invalid inputs)"
echo "  - Cover edge cases: empty/missing data, null/undefined, boundary values, timeouts"
echo "  - Test expected success flows with realistic fixtures"
echo "  - Mock external dependencies via vitest mocks (spyOn, mockImplementation)"
echo "  - Use describe/it blocks with descriptive names"
echo "  - Follow existing patterns in server/test/unit/"
echo "  - Add type-safe mocks matching source signatures"
echo "  - Test TypeScript type narrowing branches (discriminated unions, optional chaining)"
echo ""
if [ -n "$FUNC_NAMES" ]; then
  echo "  Functions to cover:"
  echo "$FUNC_NAMES" | sed 's/^/    - /'
fi

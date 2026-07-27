// Structural regression tests for the GitHub Actions workflow/action YAML
// files touched by this PR.
//
// These files are declarative CI configuration, not application code, so
// there is nothing to unit test in the traditional sense. However, this
// PR introduces several behaviorally meaningful changes (new `develop`
// trigger branches, a new non-blocking security-advisory gate, and
// tightened `if:`/`continue-on-error:` conditions) that are easy to
// silently revert or typo during future edits. Rather than pull in a YAML
// parsing dependency, these tests use plain substring/regex checks on the
// raw file text — the same lightweight approach already used elsewhere in
// this repo (see the "Verify risk register coverage" step in ci.yml and
// scripts/check-new-vulns.cjs's own regex-based YAML scanning).
"use strict";

const { describe, it, expect } = require("vitest");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.join(__dirname, "..");

function readWorkflow(name) {
  return fs.readFileSync(
    path.join(REPO_ROOT, ".github", "workflows", name),
    "utf8",
  );
}

function branchesFor(content, triggerName) {
  const match = content.match(
    new RegExp(`${triggerName}:\\n\\s*branches: \\[([^\\]]+)\\]`),
  );
  return match ? match[1] : null;
}

describe("ci.yml", () => {
  const content = readWorkflow("ci.yml");

  it("triggers on pull requests targeting main, rebuild, and develop", () => {
    expect(content).toContain(
      "  pull_request:\n    branches:\n      - main\n      - rebuild\n      - develop\n",
    );
  });

  it("still only pushes on main and rebuild (develop excluded from push)", () => {
    expect(content).toContain(
      "  push:\n    branches:\n      - main\n      - rebuild\n",
    );
  });

  it("keeps the pnpm audit step non-blocking and writes JSON for the follow-up check", () => {
    expect(content).toContain(
      [
        "      - name: Audit dependencies",
        "        # GHSA-mp2f-45pm-3cg9 patched locally via patches/decompress@4.2.1.patch.",
        "        # Remove ignore when upstream publishes decompress@>=4.2.2.",
        "        continue-on-error: true",
        "        run: pnpm audit --audit-level=critical --ignore GHSA-mp2f-45pm-3cg9",
      ].join("\n"),
    );
  });

  it("adds a follow-up step that fails only on new critical advisories", () => {
    expect(content).toContain("- name: Check for new critical advisories");
    expect(content).toContain(
      [
        "        if: success() || failure()",
        "        run: |",
        "          pnpm audit --audit-level=critical --json > /tmp/audit.json 2>/dev/null || true",
        "          node scripts/check-new-vulns.cjs \\",
        "            --format pnpm \\",
        "            --json /tmp/audit.json \\",
        "            --ignored GHSA-mp2f-45pm-3cg9 \\",
        "            --min-severity critical",
      ].join("\n"),
    );
  });

  it("does not fail the workflow when CODECOV_TOKEN is missing for the PR-comment step", () => {
    expect(content).toContain(
      [
        "      - name: Post coverage gaps to PR",
      ].join("\n"),
    );
    const stepStart = content.indexOf("- name: Post coverage gaps to PR");
    const stepEnd = content.indexOf(
      "run: bash scripts/codecov-pr-comment.sh",
      stepStart,
    );
    const step = content.slice(stepStart, stepEnd);
    expect(step).toContain("if: github.event_name == 'pull_request'");
    expect(step).toContain("continue-on-error: true");
  });

  it("no longer marks the SonarQube Scan step as continue-on-error", () => {
    expect(content).toContain(
      [
        "      - name: SonarQube Scan",
        "        id: sonar-scan",
        "        uses: SonarSource/sonarqube-scan-action",
      ].join("\n"),
    );
  });

  it("only runs the SonarCloud PR comment job when the scan succeeded", () => {
    const jobStart = content.indexOf("sonar-pr-comment:");
    const jobEnd = content.indexOf("\n  dockerfile:");
    expect(jobStart).toBeGreaterThan(-1);
    expect(jobEnd).toBeGreaterThan(jobStart);
    const job = content.slice(jobStart, jobEnd);
    expect(job).toContain(
      "if: github.event_name == 'pull_request' && needs.sonar.result == 'success'",
    );
  });
});

describe("osv-scanner.yml", () => {
  const content = readWorkflow("osv-scanner.yml");

  it("cancels outdated in-progress runs via a concurrency group", () => {
    expect(content).toContain(
      [
        "concurrency:",
        "  group: ${{ github.workflow }}-${{ github.event_name }}-${{ github.head_ref || github.ref }}",
        "  cancel-in-progress: true",
      ].join("\n"),
    );
  });

  it("scans pull requests and merge groups targeting develop as well as rebuild", () => {
    const pullRequest = branchesFor(content, "pull_request");
    const mergeGroup = branchesFor(content, "merge_group");
    expect(pullRequest).toContain('"rebuild"');
    expect(pullRequest).toContain('"develop"');
    expect(mergeGroup).toContain('"rebuild"');
    expect(mergeGroup).toContain('"develop"');
  });

  it("does not add develop to the push trigger", () => {
    const push = branchesFor(content, "push");
    expect(push).toContain('"rebuild"');
    expect(push).not.toMatch(/develop/);
  });
});

describe("branch-scoped CI workflows include the develop branch on pull_request", () => {
  const filesRequiringDevelopOnPR = [
    "cli-ci.yml",
    "desktop-ci.yml",
    "droplet-ci.yml",
    "server-ci.yml",
    "e2e.yml",
    "editorconfig-ci.yml",
    "codeql.yml",
  ];

  for (const file of filesRequiringDevelopOnPR) {
    it(`${file} triggers pull_request builds against develop`, () => {
      const branches = branchesFor(readWorkflow(file), "pull_request");
      expect(branches).not.toBeNull();
      expect(branches).toMatch(/rebuild/);
      expect(branches).toMatch(/develop/);
    });
  }

  it("open-code-review.yml triggers pull_request reviews against develop", () => {
    const branches = branchesFor(
      readWorkflow("open-code-review.yml"),
      "pull_request",
    );
    expect(branches).toMatch(/main/);
    expect(branches).toMatch(/rebuild/);
    expect(branches).toMatch(/develop/);
  });
});

describe("push triggers are left untouched by the develop rollout", () => {
  const filesWithUnchangedPush = [
    "cli-ci.yml",
    "desktop-ci.yml",
    "droplet-ci.yml",
    "server-ci.yml",
    "e2e.yml",
    "editorconfig-ci.yml",
  ];

  for (const file of filesWithUnchangedPush) {
    it(`${file} still only push-triggers on rebuild`, () => {
      const branches = branchesFor(readWorkflow(file), "push");
      expect(branches).toMatch(/rebuild/);
      expect(branches).not.toMatch(/develop/);
    });
  }
});

describe("workspace-root-triggered workflows watch pnpm-workspace.yaml and package.json", () => {
  const filesWithNewPaths = ["cli-ci.yml", "desktop-ci.yml", "droplet-ci.yml"];

  for (const file of filesWithNewPaths) {
    it(`${file} re-runs (on both push and pull_request) when pnpm-workspace.yaml or package.json change`, () => {
      const content = readWorkflow(file);
      const workspaceOccurrences = (
        content.match(/pnpm-workspace\.yaml/g) || []
      ).length;
      const packageJsonOccurrences = (
        content.match(/"package\.json"/g) || []
      ).length;
      // Once under `push.paths` and once under `pull_request.paths`.
      expect(workspaceOccurrences).toBe(2);
      expect(packageJsonOccurrences).toBe(2);
    });
  }
});

describe("rust-ci composite action", () => {
  const content = fs.readFileSync(
    path.join(REPO_ROOT, ".github", "actions", "rust-ci", "action.yml"),
    "utf8",
  );

  it("writes cargo audit output to JSON instead of failing the step directly", () => {
    expect(content).toContain(
      [
        "    - name: Audit dependencies",
      ].join("\n"),
    );
    const stepStart = content.indexOf("- name: Audit dependencies");
    const stepEnd = content.indexOf(
      "run: cargo audit --json",
      stepStart,
    );
    const step = content.slice(stepStart, stepEnd);
    expect(step).toContain("continue-on-error: true");
    expect(content).toContain(
      "run: cargo audit --json > /tmp/cargo-audit.json 2>/dev/null || true",
    );
  });

  it("adds a follow-up step that checks for new Rust advisories via GITHUB_WORKSPACE", () => {
    expect(content).toContain("- name: Check for new Rust advisories");
    expect(content).toContain(
      [
        "      if: success() || failure()",
        "      shell: bash",
        "      working-directory: ${{ inputs.working-directory }}",
        "      run: |",
        '        node "$GITHUB_WORKSPACE/scripts/check-new-vulns.cjs" \\',
        "          --format cargo \\",
        "          --json /tmp/cargo-audit.json \\",
        "          --min-severity high",
      ].join("\n"),
    );
  });

  it("resolves the script via GITHUB_WORKSPACE rather than a path relative to working-directory", () => {
    expect(content).not.toContain("run: node scripts/check-new-vulns.cjs");
    expect(content).not.toMatch(/run: \|\s*\n\s*node scripts\//);
  });
});

describe("codecov.yml", () => {
  const content = fs.readFileSync(
    path.join(REPO_ROOT, ".github", "codecov.yml"),
    "utf8",
  );

  it("keeps project and patch coverage status informational (non-blocking)", () => {
    expect(content).toContain(
      [
        "coverage:",
        "  status:",
        "    project:",
        "      default:",
        "        target: auto",
        "        threshold: 2%",
        "        base: auto",
        "        informational: true",
        "    patch:",
        "      default:",
        "        target: 80%",
        "        informational: true",
      ].join("\n"),
    );
  });

  it("defines a carried-forward 'server' flag scoped to server/", () => {
    expect(content).toContain(
      [
        "  individual_flags:",
        "    - name: server",
        "      paths:",
        "        - server/",
        "      carryforward: true",
      ].join("\n"),
    );
  });

  it("has no tab characters (consistent space indentation)", () => {
    expect(content).not.toMatch(/\t/);
  });
});
// Regression guard for the CI/config changes that:
//   1. Removed the (broken/unused) `auto_review` block from .coderabbit.yaml.
//   2. Added `permissions: issues: write` and a "Sync findings to GitHub
//      Issues" step (running scripts/sonarcloud-sync.sh) to the `sonar` job
//      in .github/workflows/ci.yml, scoped to push-to-develop only.
//
// These are plain text/structural assertions (no YAML parser dependency is
// declared in this workspace) so the tests stay dependency-free while still
// pinning down the exact behavior introduced by this change.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Resolve from the actual test file location (not process.cwd()), matching
// the pattern used in test/unit/dependency-pinning.test.ts.
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../");

function readRepoFile(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), "utf-8");
}

/**
 * Extract a single top-level GitHub Actions job block (e.g. "sonar") from a
 * workflow file's raw text, from its `  <jobName>:` line up to (but not
 * including) the next line at the same (2-space) indentation level.
 */
function extractJobBlock(workflowYaml: string, jobName: string): string {
  const lines = workflowYaml.split("\n");
  const startIdx = lines.findIndex((line) =>
    new RegExp(`^  ${jobName}:\\s*$`).test(line),
  );
  if (startIdx === -1) {
    throw new Error(`Job "${jobName}" not found in workflow`);
  }

  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^  \S/.test(lines[i])) {
      endIdx = i;
      break;
    }
  }

  return lines.slice(startIdx, endIdx).join("\n");
}

describe(".coderabbit.yaml", () => {
  const config = readRepoFile(".coderabbit.yaml");

  it("no longer configures auto_review (removed in this change)", () => {
    expect(config).not.toMatch(/^auto_review:/m);
    expect(config).not.toContain("ignore_title_keywords");
    expect(config).not.toContain("WIP");
    expect(config).not.toContain("DRAFT");
  });

  it("still enables chat auto-reply", () => {
    expect(config).toMatch(/^chat:\s*\n\s*auto_reply:\s*true/m);
  });

  it("retains the unrelated reviews/path_filters section untouched by this change", () => {
    expect(config).toContain("reviews:");
    expect(config).toContain("profile: chill");
    expect(config).toContain('- "!**/dist/**"');
    expect(config).toContain('- "!**/.git/**"');
  });

  it("does not leave excess blank lines behind where auto_review used to be", () => {
    expect(config).not.toMatch(/\n{3,}/);
  });
});

describe(".github/workflows/ci.yml — sonar job", () => {
  const workflow = readRepoFile(".github/workflows/ci.yml");
  const sonarJob = extractJobBlock(workflow, "sonar");

  it("grants issues: write permission needed to create/update/close GitHub issues", () => {
    expect(sonarJob).toMatch(/permissions:\s*\n\s*issues:\s*write/);
  });

  it("adds a step that syncs SonarCloud findings to GitHub issues", () => {
    expect(sonarJob).toContain("name: Sync findings to GitHub Issues");
    expect(sonarJob).toContain("run: bash scripts/sonarcloud-sync.sh");
  });

  it("only runs the sync step on pushes to develop, not on pull_request or other branches", () => {
    expect(sonarJob).toMatch(
      /if:\s*github\.event_name == 'push' && github\.ref == 'refs\/heads\/develop'/,
    );
  });

  it("passes SONAR_TOKEN and a GH_TOKEN sourced from the GITHUB_TOKEN secret to the sync step", () => {
    const syncStepMatch = sonarJob.match(
      /Sync findings to GitHub Issues[\s\S]*?run: bash scripts\/sonarcloud-sync\.sh/,
    );
    expect(syncStepMatch).not.toBeNull();

    const syncStep = syncStepMatch![0];
    expect(syncStep).toContain("SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}");
    expect(syncStep).toContain("GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}");
  });

  it("runs the sync step after the SonarQube scan step completes", () => {
    const scanIdx = sonarJob.indexOf("SonarQube Scan");
    const syncIdx = sonarJob.indexOf("Sync findings to GitHub Issues");
    expect(scanIdx).toBeGreaterThan(-1);
    expect(syncIdx).toBeGreaterThan(scanIdx);
  });

  it("keeps continue-on-error so a failing quality gate doesn't fail CI", () => {
    expect(sonarJob).toContain("continue-on-error: true");
  });

  it("still runs the job itself on both push and pull_request events", () => {
    expect(sonarJob).toMatch(
      /if:\s*github\.event_name == 'push' \|\| github\.event_name == 'pull_request'/,
    );
  });
});

describe("extractJobBlock helper", () => {
  it("throws when the requested job does not exist", () => {
    expect(() => extractJobBlock("jobs:\n  foo:\n    x: 1\n", "bar")).toThrow(
      /not found/,
    );
  });

  it("stops at the next top-level job, not at nested keys with the same name", () => {
    const yaml = [
      "jobs:",
      "  alpha:",
      "    steps:",
      "      - run: echo hi",
      "  beta:",
      "    steps:",
      "      - run: echo bye",
      "",
    ].join("\n");
    const block = extractJobBlock(yaml, "alpha");
    expect(block).toContain("echo hi");
    expect(block).not.toContain("echo bye");
  });
});
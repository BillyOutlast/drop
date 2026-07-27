// Tests for scripts/check-new-vulns.cjs
//
// The script is a CLI tool: it parses argv, does its work, then calls
// `main()` unconditionally at module load time and terminates via
// `process.exit(...)`. That means it can't be `require()`-d in-process
// without exiting the test runner. Instead these tests spawn the script
// as a real child process (mirroring how CI invokes it) and assert on
// exit code + stdout/stderr, exercising the full contract the workflows
// in this PR depend on.
"use strict";

const { describe, it, expect, beforeEach, afterEach } = require("vitest");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const SCRIPT_PATH = path.join(__dirname, "check-new-vulns.cjs");

// Base env with GITHUB_WORKSPACE stripped so tests are hermetic even when
// executed inside an actual GitHub Actions runner (where the var is set).
const BASE_ENV = { ...process.env };
delete BASE_ENV.GITHUB_WORKSPACE;

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "check-new-vulns-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeFile(name, contents) {
  const p = path.join(tmpDir, name);
  fs.writeFileSync(p, contents);
  return p;
}

function run(args, { env = {}, cwd = tmpDir } = {}) {
  const result = spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
    encoding: "utf8",
    cwd,
    env: { ...BASE_ENV, ...env },
  });
  return result;
}

function pnpmAudit(advisories) {
  return JSON.stringify({ advisories });
}

function cargoAudit(list) {
  return JSON.stringify({ vulnerabilities: { list } });
}

describe("check-new-vulns.cjs CLI argument handling", () => {
  it("exits 2 with usage message when --format is missing", () => {
    const jsonPath = writeFile("audit.json", pnpmAudit({}));
    const result = run(["--json", jsonPath]);
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/Usage: check-new-vulns\.cjs/);
  });

  it("exits 2 with usage message when --json is missing", () => {
    const result = run(["--format", "pnpm"]);
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/Usage: check-new-vulns\.cjs/);
  });

  it("exits 2 for an unsupported --format value", () => {
    const jsonPath = writeFile("audit.json", pnpmAudit({}));
    const result = run(["--format", "npm", "--json", jsonPath]);
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/Unsupported --format: npm/);
  });

  it("exits 2 when a flag is missing its value at end of argv", () => {
    const result = run(["--format", "pnpm", "--json"]);
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/missing value for --json/);
  });

  it("exits 2 when a flag's value looks like another flag", () => {
    const result = run(["--format", "--json", "somefile.json"]);
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(
      /--format requires a value \(got another flag '--json'\)/,
    );
  });

  it("prints help text and exits 0 for --help", () => {
    const result = run(["--help"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/Usage: check-new-vulns\.cjs/);
  });

  it("prints help text and exits 0 for -h", () => {
    const result = run(["-h"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/Usage: check-new-vulns\.cjs/);
  });

  it("silently ignores unrecognized flags", () => {
    const registerPath = writeFile("risk-register.yaml", "risks: []\n");
    const jsonPath = writeFile("audit.json", pnpmAudit({}));
    const result = run([
      "--format",
      "pnpm",
      "--json",
      jsonPath,
      "--register",
      registerPath,
      "--totally-unknown-flag",
      "some-value",
    ]);
    expect(result.status).toBe(0);
  });
});

describe("check-new-vulns.cjs audit JSON handling", () => {
  it("exits 0 with a warning when the audit JSON file is missing", () => {
    const registerPath = writeFile("risk-register.yaml", "risks: []\n");
    const result = run([
      "--format",
      "pnpm",
      "--json",
      path.join(tmpDir, "does-not-exist.json"),
      "--register",
      registerPath,
    ]);
    expect(result.status).toBe(0);
    expect(result.stderr).toMatch(/audit JSON unavailable \(file missing\)/);
  });

  it("exits 0 with a warning when the audit JSON file is empty", () => {
    const registerPath = writeFile("risk-register.yaml", "risks: []\n");
    const jsonPath = writeFile("audit.json", "");
    const result = run([
      "--format",
      "pnpm",
      "--json",
      jsonPath,
      "--register",
      registerPath,
    ]);
    expect(result.status).toBe(0);
    expect(result.stderr).toMatch(/audit JSON unavailable \(file empty\)/);
  });

  it("exits 0 with a warning when the audit JSON is malformed", () => {
    const registerPath = writeFile("risk-register.yaml", "risks: []\n");
    const jsonPath = writeFile("audit.json", "{ not: valid json ");
    const result = run([
      "--format",
      "pnpm",
      "--json",
      jsonPath,
      "--register",
      registerPath,
    ]);
    expect(result.status).toBe(0);
    expect(result.stderr).toMatch(/audit JSON unavailable/);
  });
});

describe("check-new-vulns.cjs risk register handling", () => {
  it("exits 0 with a warning when the risk register file is missing (fail-open)", () => {
    const jsonPath = writeFile(
      "audit.json",
      pnpmAudit({
        1: {
          github_advisory_id: "GHSA-aaaa-bbbb-cccc",
          module_name: "vulnerable-pkg",
          severity: "critical",
          title: "Some critical issue",
        },
      }),
    );
    const result = run([
      "--format",
      "pnpm",
      "--json",
      jsonPath,
      "--register",
      path.join(tmpDir, "no-such-register.yaml"),
    ]);
    // Even though there is an unregistered critical advisory, a missing
    // register is treated as infra noise, not a failure.
    expect(result.status).toBe(0);
    expect(result.stderr).toMatch(/risk register unavailable/);
  });

  it("does not treat commented-out advisory lines as known", () => {
    const registerPath = writeFile(
      "risk-register.yaml",
      "risks:\n  # advisory: GHSA-aaaa-bbbb-cccc\n",
    );
    const jsonPath = writeFile(
      "audit.json",
      pnpmAudit({
        1: {
          github_advisory_id: "GHSA-aaaa-bbbb-cccc",
          module_name: "vulnerable-pkg",
          severity: "critical",
          title: "Some critical issue",
        },
      }),
    );
    const result = run([
      "--format",
      "pnpm",
      "--json",
      jsonPath,
      "--register",
      registerPath,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(
      /NEW PNPM ADVISORY: GHSA-aaaa-bbbb-cccc/,
    );
  });

  it("resolves the default register path via GITHUB_WORKSPACE, not cwd", () => {
    const workspaceDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "check-new-vulns-workspace-"),
    );
    try {
      fs.mkdirSync(path.join(workspaceDir, "security"), { recursive: true });
      fs.writeFileSync(
        path.join(workspaceDir, "security", "risk-register.yaml"),
        "risks:\n  - id: RISK-001\n    advisory: GHSA-known-1111-2222\n",
      );
      const jsonPath = writeFile(
        "audit.json",
        pnpmAudit({
          1: {
            github_advisory_id: "GHSA-known-1111-2222",
            module_name: "known-pkg",
            severity: "critical",
            title: "Known, accepted issue",
          },
        }),
      );
      // cwd is tmpDir (which has no security/ dir); the register should
      // still be found via GITHUB_WORKSPACE.
      const result = run(["--format", "pnpm", "--json", jsonPath], {
        env: { GITHUB_WORKSPACE: workspaceDir },
        cwd: tmpDir,
      });
      expect(result.status).toBe(0);
      expect(result.stderr).not.toMatch(/NEW PNPM ADVISORY/);
    } finally {
      fs.rmSync(workspaceDir, { recursive: true, force: true });
    }
  });

  it("falls back to process.cwd() when GITHUB_WORKSPACE is unset", () => {
    fs.mkdirSync(path.join(tmpDir, "security"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, "security", "risk-register.yaml"),
      "risks:\n  - id: RISK-001\n    advisory: GHSA-known-1111-2222\n",
    );
    const jsonPath = writeFile(
      "audit.json",
      pnpmAudit({
        1: {
          github_advisory_id: "GHSA-known-1111-2222",
          module_name: "known-pkg",
          severity: "critical",
          title: "Known, accepted issue",
        },
      }),
    );
    const result = run(["--format", "pnpm", "--json", jsonPath], {
      cwd: tmpDir,
    });
    expect(result.status).toBe(0);
    expect(result.stderr).not.toMatch(/NEW PNPM ADVISORY/);
  });
});

describe("check-new-vulns.cjs pnpm format", () => {
  it("exits 1 and reports an unregistered, unignored critical advisory", () => {
    const registerPath = writeFile("risk-register.yaml", "risks: []\n");
    const jsonPath = writeFile(
      "audit.json",
      pnpmAudit({
        1001: {
          github_advisory_id: "GHSA-new1-1111-1111",
          module_name: "new-pkg",
          severity: "critical",
          title: "New critical issue",
        },
      }),
    );
    const result = run([
      "--format",
      "pnpm",
      "--json",
      jsonPath,
      "--register",
      registerPath,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(
      /NEW PNPM ADVISORY: GHSA-new1-1111-1111 new-pkg \(critical\) — New critical issue/,
    );
  });

  it("exits 0 when the advisory is in --ignored", () => {
    const registerPath = writeFile("risk-register.yaml", "risks: []\n");
    const jsonPath = writeFile(
      "audit.json",
      pnpmAudit({
        1: {
          github_advisory_id: "GHSA-ignored-1111-2222",
          module_name: "ignored-pkg",
          severity: "critical",
          title: "Ignored issue",
        },
      }),
    );
    const result = run([
      "--format",
      "pnpm",
      "--json",
      jsonPath,
      "--register",
      registerPath,
      "--ignored",
      "GHSA-ignored-1111-2222",
    ]);
    expect(result.status).toBe(0);
    expect(result.stderr).not.toMatch(/NEW PNPM ADVISORY/);
  });

  it("trims whitespace in a comma-separated --ignored list", () => {
    const registerPath = writeFile("risk-register.yaml", "risks: []\n");
    const jsonPath = writeFile(
      "audit.json",
      pnpmAudit({
        1: {
          github_advisory_id: "GHSA-bbbb-1111-2222",
          module_name: "pkg-b",
          severity: "critical",
          title: "Issue B",
        },
      }),
    );
    const result = run([
      "--format",
      "pnpm",
      "--json",
      jsonPath,
      "--register",
      registerPath,
      "--ignored",
      " GHSA-aaaa-1111-2222 , GHSA-bbbb-1111-2222 ",
    ]);
    expect(result.status).toBe(0);
  });

  it("exits 0 when advisories is empty", () => {
    const registerPath = writeFile("risk-register.yaml", "risks: []\n");
    const jsonPath = writeFile("audit.json", pnpmAudit({}));
    const result = run([
      "--format",
      "pnpm",
      "--json",
      jsonPath,
      "--register",
      registerPath,
    ]);
    expect(result.status).toBe(0);
    expect(result.stderr).not.toMatch(/NEW PNPM ADVISORY/);
  });

  it("exits 0 when the 'advisories' key is entirely absent", () => {
    const registerPath = writeFile("risk-register.yaml", "risks: []\n");
    const jsonPath = writeFile("audit.json", "{}");
    const result = run([
      "--format",
      "pnpm",
      "--json",
      jsonPath,
      "--register",
      registerPath,
    ]);
    expect(result.status).toBe(0);
  });

  it("filters out advisories below the default (critical) min-severity", () => {
    const registerPath = writeFile("risk-register.yaml", "risks: []\n");
    const jsonPath = writeFile(
      "audit.json",
      pnpmAudit({
        1: {
          github_advisory_id: "GHSA-high-1111-2222",
          module_name: "high-pkg",
          severity: "high",
          title: "High severity issue",
        },
      }),
    );
    const result = run([
      "--format",
      "pnpm",
      "--json",
      jsonPath,
      "--register",
      registerPath,
    ]);
    expect(result.status).toBe(0);
    expect(result.stderr).not.toMatch(/NEW PNPM ADVISORY/);
  });

  it("includes lower severities when --min-severity is lowered", () => {
    const registerPath = writeFile("risk-register.yaml", "risks: []\n");
    const jsonPath = writeFile(
      "audit.json",
      pnpmAudit({
        1: {
          github_advisory_id: "GHSA-high-1111-2222",
          module_name: "high-pkg",
          severity: "high",
          title: "High severity issue",
        },
      }),
    );
    const result = run([
      "--format",
      "pnpm",
      "--json",
      jsonPath,
      "--register",
      registerPath,
      "--min-severity",
      "high",
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/NEW PNPM ADVISORY: GHSA-high-1111-2222/);
  });

  it("compares severities case-insensitively", () => {
    const registerPath = writeFile("risk-register.yaml", "risks: []\n");
    const jsonPath = writeFile(
      "audit.json",
      pnpmAudit({
        1: {
          github_advisory_id: "GHSA-case-1111-2222",
          module_name: "case-pkg",
          severity: "HIGH",
          title: "Mixed case severity",
        },
      }),
    );
    const result = run([
      "--format",
      "pnpm",
      "--json",
      jsonPath,
      "--register",
      registerPath,
      "--min-severity",
      "High",
    ]);
    expect(result.status).toBe(1);
  });

  it("treats a missing severity field as critical (fail-safe default)", () => {
    const registerPath = writeFile("risk-register.yaml", "risks: []\n");
    const jsonPath = writeFile(
      "audit.json",
      pnpmAudit({
        1: {
          github_advisory_id: "GHSA-nosev-1111-2222",
          module_name: "no-severity-pkg",
          title: "No severity field at all",
        },
      }),
    );
    const result = run([
      "--format",
      "pnpm",
      "--json",
      jsonPath,
      "--register",
      registerPath,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/NEW PNPM ADVISORY: GHSA-nosev-1111-2222/);
  });

  it("recognizes 'moderate' as the pnpm alias for medium-rank severity", () => {
    const registerPath = writeFile("risk-register.yaml", "risks: []\n");
    const jsonPath = writeFile(
      "audit.json",
      pnpmAudit({
        1: {
          github_advisory_id: "GHSA-mod-1111-2222",
          module_name: "moderate-pkg",
          severity: "moderate",
          title: "Moderate issue",
        },
      }),
    );
    const result = run([
      "--format",
      "pnpm",
      "--json",
      jsonPath,
      "--register",
      registerPath,
      "--min-severity",
      "moderate",
    ]);
    expect(result.status).toBe(1);
  });

  it("does not flag an advisory already present in the risk register", () => {
    const registerPath = writeFile(
      "risk-register.yaml",
      [
        "risks:",
        "  - id: RISK-001",
        "    title: 'Accepted issue'",
        "    advisory: GHSA-known-9999-8888",
        "    severity: critical",
      ].join("\n"),
    );
    const jsonPath = writeFile(
      "audit.json",
      pnpmAudit({
        1: {
          github_advisory_id: "GHSA-known-9999-8888",
          module_name: "known-pkg",
          severity: "critical",
          title: "Accepted issue",
        },
      }),
    );
    const result = run([
      "--format",
      "pnpm",
      "--json",
      jsonPath,
      "--register",
      registerPath,
    ]);
    expect(result.status).toBe(0);
    expect(result.stderr).not.toMatch(/NEW PNPM ADVISORY/);
  });

  it("reports every new advisory, one per line, and skips known/ignored ones", () => {
    const registerPath = writeFile(
      "risk-register.yaml",
      "risks:\n  - id: RISK-001\n    advisory: GHSA-known-0000-0000\n",
    );
    const jsonPath = writeFile(
      "audit.json",
      pnpmAudit({
        1: {
          github_advisory_id: "GHSA-known-0000-0000",
          module_name: "known-pkg",
          severity: "critical",
          title: "Known issue",
        },
        2: {
          github_advisory_id: "GHSA-ignored-0000-0000",
          module_name: "ignored-pkg",
          severity: "critical",
          title: "Ignored issue",
        },
        3: {
          github_advisory_id: "GHSA-new-a-0000-0000",
          module_name: "new-pkg-a",
          severity: "critical",
          title: "New issue A",
        },
        4: {
          github_advisory_id: "GHSA-new-b-0000-0000",
          module_name: "new-pkg-b",
          severity: "critical",
          title: "New issue B",
        },
      }),
    );
    const result = run([
      "--format",
      "pnpm",
      "--json",
      jsonPath,
      "--register",
      registerPath,
      "--ignored",
      "GHSA-ignored-0000-0000",
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/NEW PNPM ADVISORY: GHSA-new-a-0000-0000/);
    expect(result.stderr).toMatch(/NEW PNPM ADVISORY: GHSA-new-b-0000-0000/);
    expect(result.stderr).not.toMatch(/GHSA-known-0000-0000/);
    expect(result.stderr).not.toMatch(/GHSA-ignored-0000-0000/);
  });
});

describe("check-new-vulns.cjs cargo format", () => {
  it("exits 1 and reports an unregistered RUSTSEC advisory at/above min-severity", () => {
    const registerPath = writeFile("risk-register.yaml", "risks: []\n");
    const jsonPath = writeFile(
      "audit.json",
      cargoAudit([
        {
          advisory: {
            id: "RUSTSEC-2026-0001",
            severity: "high",
            title: "Denial of Service in quick-xml",
          },
          package: { name: "quick-xml" },
        },
      ]),
    );
    const result = run([
      "--format",
      "cargo",
      "--json",
      jsonPath,
      "--register",
      registerPath,
      "--min-severity",
      "high",
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(
      /NEW CARGO ADVISORY: RUSTSEC-2026-0001 quick-xml \(high\) — Denial of Service in quick-xml/,
    );
  });

  it("exits 0 when vulnerabilities.list is empty", () => {
    const registerPath = writeFile("risk-register.yaml", "risks: []\n");
    const jsonPath = writeFile("audit.json", cargoAudit([]));
    const result = run([
      "--format",
      "cargo",
      "--json",
      jsonPath,
      "--register",
      registerPath,
    ]);
    expect(result.status).toBe(0);
  });

  it("exits 0 when the 'vulnerabilities' key is entirely absent", () => {
    const registerPath = writeFile("risk-register.yaml", "risks: []\n");
    const jsonPath = writeFile("audit.json", "{}");
    const result = run([
      "--format",
      "cargo",
      "--json",
      jsonPath,
      "--register",
      registerPath,
    ]);
    expect(result.status).toBe(0);
  });

  it("skips entries with no 'advisory' object without crashing", () => {
    const registerPath = writeFile("risk-register.yaml", "risks: []\n");
    const jsonPath = writeFile(
      "audit.json",
      cargoAudit([
        { package: { name: "no-advisory-pkg" } },
        {
          advisory: {
            id: "RUSTSEC-2026-0002",
            severity: "critical",
            title: "Real issue",
          },
          package: { name: "real-pkg" },
        },
      ]),
    );
    const result = run([
      "--format",
      "cargo",
      "--json",
      jsonPath,
      "--register",
      registerPath,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/NEW CARGO ADVISORY: RUSTSEC-2026-0002/);
    expect(result.stderr).not.toMatch(/no-advisory-pkg/);
  });

  it("falls back to 'unknown' for missing advisory id/title/package name", () => {
    const registerPath = writeFile("risk-register.yaml", "risks: []\n");
    const jsonPath = writeFile(
      "audit.json",
      cargoAudit([{ advisory: { severity: "critical" } }]),
    );
    const result = run([
      "--format",
      "cargo",
      "--json",
      jsonPath,
      "--register",
      registerPath,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(
      /NEW CARGO ADVISORY: unknown unknown \(critical\) — unknown/,
    );
  });

  it("recognizes 'medium' as the cargo alias for medium-rank severity", () => {
    const registerPath = writeFile("risk-register.yaml", "risks: []\n");
    const jsonPath = writeFile(
      "audit.json",
      cargoAudit([
        {
          advisory: {
            id: "RUSTSEC-2026-0003",
            severity: "medium",
            title: "Medium issue",
          },
          package: { name: "medium-pkg" },
        },
      ]),
    );
    const result = run([
      "--format",
      "cargo",
      "--json",
      jsonPath,
      "--register",
      registerPath,
      "--min-severity",
      "moderate",
    ]);
    expect(result.status).toBe(1);
  });

  it("does not flag a RUSTSEC advisory already present in the risk register", () => {
    const registerPath = writeFile(
      "risk-register.yaml",
      "risks:\n  - id: RISK-002\n    advisory: RUSTSEC-2026-0004\n",
    );
    const jsonPath = writeFile(
      "audit.json",
      cargoAudit([
        {
          advisory: {
            id: "RUSTSEC-2026-0004",
            severity: "high",
            title: "Accepted rust issue",
          },
          package: { name: "accepted-pkg" },
        },
      ]),
    );
    const result = run([
      "--format",
      "cargo",
      "--json",
      jsonPath,
      "--register",
      registerPath,
      "--min-severity",
      "high",
    ]);
    expect(result.status).toBe(0);
    expect(result.stderr).not.toMatch(/NEW CARGO ADVISORY/);
  });
});
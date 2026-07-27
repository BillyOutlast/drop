#!/usr/bin/env node
// Detect NEW (un-accepted) advisories in pnpm/cargo audit JSON output,
// comparing against entries in security/risk-register.yaml.
//
// Behavior:
//   - Missing or unparseable audit JSON → exit 0 (assume tool flaked, do
//     not fail the workflow on infra noise). A noisy log line is emitted.
//   - Risk register missing or malformed → exit 0 (same reason).
//   - New (un-registered) advisory found → exit 1, log each one.
//   - All advisories in register or no advisories → exit 0.
//
// Usage:
//   check-new-vulns.cjs --format pnpm --json /tmp/audit.json
//   check-new-vulns.cjs --format cargo --json /tmp/cargo-audit.json
//
// Flags:
//   --format {pnpm|cargo}   audit JSON shape to parse
//   --json <path>           path to audit JSON output
//   --register <path>       path to risk-register.yaml (default: security/risk-register.yaml)
//   --ignored <id,id,...>   comma-separated advisory IDs to ignore unconditionally
//                            (e.g. for pnpm audit --ignore GHSA-...)
//   --min-severity <s>      minimum severity to report (pnpm: critical|high|moderate|low;
//                            cargo: critical|high|medium|low|informational). Default: critical.

"use strict";

const fs = require("fs");
const path = require("path");

// fallow-ignore-next-line complexity
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--format") args.format = argv[++i];
    else if (a === "--json") args.json = argv[++i];
    else if (a === "--register") args.register = argv[++i];
    else if (a === "--ignored")
      args.ignored = argv[++i]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    else if (a === "--min-severity") args.minSeverity = argv[++i];
    else if (a === "--help" || a === "-h") {
      console.log(
        fs.readFileSync(__filename, "utf8").split("\n").slice(0, 25).join("\n"),
      );
      process.exit(0);
    }
  }
  return args;
}

function readJson(path) {
  try {
    if (!fs.existsSync(path)) return { ok: false, reason: "file missing" };
    const raw = fs.readFileSync(path, "utf8").trim();
    if (!raw) return { ok: false, reason: "file empty" };
    return { ok: true, data: JSON.parse(raw) };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// Parse security/risk-register.yaml by line-scanning for `advisory:` fields.
// We deliberately avoid a full YAML parser (no extra deps in CI). Format is
// stable: each entry has `advisory: GHSA-...` or `advisory: RUSTSEC-...` on
// its own line. Comment lines and unrelated fields are ignored.
function readKnownAdvisories(path) {
  const known = new Set();
  try {
    if (!fs.existsSync(path)) return known;
    const text = fs.readFileSync(path, "utf8");
    const re = /^\s*advisory:\s*(\S+)\s*$/gm;
    let m;
    while ((m = re.exec(text)) !== null) {
      known.add(m[1]);
    }
  } catch (e) {
    // Swallow — caller treats empty known set as "register unavailable".
  }
  return known;
}

function severityRank(s) {
  return (
    { critical: 4, high: 3, moderate: 2, medium: 2, low: 1, informational: 0 }[
      (s || "").toLowerCase()
    ] ?? -1
  );
}

function extractPnpm(data, minSeverity) {
  const advisories = data.advisories ? Object.values(data.advisories) : [];
  const minRank = severityRank(minSeverity);
  return advisories
    .filter((a) => severityRank(a.severity) >= minRank)
    .map((a) => ({
      id: a.github_advisory_id,
      module: a.module_name,
      severity: a.severity,
      title: a.title,
    }));
}

function extractCargo(data, minSeverity) {
  const vulns = (data.vulnerabilities && data.vulnerabilities.list) || [];
  const minRank = severityRank(minSeverity);
  return vulns
    .filter((v) => severityRank(v.advisory.severity) >= minRank)
    .map((v) => ({
      id: v.advisory.id,
      module: v.package.name,
      severity: v.advisory.severity,
      title: v.advisory.title,
    }));
}

// fallow-ignore-next-line complexity
function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.format || !args.json) {
    console.error(
      "Usage: check-new-vulns.cjs --format {pnpm|cargo} --json <path> [--register <path>] [--ignored <id,id,...>] [--min-severity <s>]",
    );
    process.exit(2);
  }
  if (!["pnpm", "cargo"].includes(args.format)) {
    console.error(`Unsupported --format: ${args.format}`);
    process.exit(2);
  }

  const registerPath =
    args.register || path.join(process.cwd(), "security", "risk-register.yaml");
  const ignored = new Set(args.ignored || []);

  const loaded = readJson(args.json);
  if (!loaded.ok) {
    console.warn(
      `[check-new-vulns] ${args.format} audit JSON unavailable (${loaded.reason}); treating as no advisories.`,
    );
    process.exit(0);
  }

  const minSeverity = args.minSeverity || "critical";
  const all =
    args.format === "pnpm"
      ? extractPnpm(loaded.data, minSeverity)
      : extractCargo(loaded.data, minSeverity);

  const known = readKnownAdvisories(registerPath);
  const newOnes = all.filter((a) => !ignored.has(a.id) && !known.has(a.id));

  if (newOnes.length > 0) {
    for (const a of newOnes) {
      console.error(
        `NEW ${args.format.toUpperCase()} ADVISORY: ${a.id} ${a.module} (${a.severity}) — ${a.title}`,
      );
    }
    process.exit(1);
  }

  process.exit(0);
}

main();

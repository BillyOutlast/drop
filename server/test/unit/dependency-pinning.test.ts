// Regression guard for CONF-1/CONF-2 (remediation-plan.md): `vue` and
// `vue-router` were pinned to lockfile-resolved versions after being found
// on `"latest"`, which let an unreviewed major bump silently break builds.
// This test asserts the fix holds and that no workspace re-introduces a
// floating ("latest" / "*") version for any dependency.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Resolve from the actual test file location (not process.cwd()), matching
// the pattern used in test/unit/plugins/init-order.test.ts.
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../");

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

function readPackageJson(relativePath: string): PackageJson {
  const raw = readFileSync(join(repoRoot, relativePath), "utf-8");
  return JSON.parse(raw) as PackageJson;
}

const FLOATING_VERSIONS = new Set(["latest", "*"]);

const workspaces: Array<{ name: string; path: string }> = [
  { name: "server", path: "server/package.json" },
  { name: "desktop/main", path: "desktop/main/package.json" },
  { name: "libraries/base", path: "libraries/base/package.json" },
];

describe("dependency version pinning", () => {
  it.each(workspaces)(
    "$name/package.json pins vue and vue-router (no 'latest')",
    ({ path }) => {
      const pkg = readPackageJson(path);
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

      for (const name of ["vue", "vue-router"] as const) {
        const version = allDeps[name];
        if (version === undefined) continue; // not every workspace depends on both
        expect(
          FLOATING_VERSIONS.has(version),
          `${path}: expected "${name}" to be pinned, but found "${version}"`,
        ).toBe(false);
      }
    },
  );

  it.each(workspaces)(
    "$name/package.json has no floating ('latest' or '*') dependency versions",
    ({ path }) => {
      const pkg = readPackageJson(path);
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

      const floating = Object.entries(allDeps)
        .filter(([, version]) => FLOATING_VERSIONS.has(version))
        .map(([name, version]) => `${name}@${version}`);

      expect(floating).toEqual([]);
    },
  );

  it("server and desktop/main resolve vue-router to the exact same version", () => {
    // vue-router version drift between the two Nuxt apps in this monorepo
    // is easy to miss and was part of the same remediation pass.
    const server = readPackageJson("server/package.json");
    const desktopMain = readPackageJson("desktop/main/package.json");

    const serverVersion =
      server.dependencies?.["vue-router"] ??
      server.devDependencies?.["vue-router"];
    const desktopVersion =
      desktopMain.dependencies?.["vue-router"] ??
      desktopMain.devDependencies?.["vue-router"];

    expect(serverVersion).toBeDefined();
    expect(desktopVersion).toBeDefined();
    expect(serverVersion).toBe(desktopVersion);
  });
});

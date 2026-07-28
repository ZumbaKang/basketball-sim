import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  coveredBuildWorkspaceMixedNameObjectFormFixture,
  coveredBuildWorkspaceNamelessObjectFormFixture,
  coveredBuildWorkspaceObjectFormFixture,
  lateBuildWorkspaceFixture,
  omittedBuildWorkspaceFixture,
  omittedBuildWorkspaceNamelessObjectFormFixture,
  omittedBuildWorkspaceObjectFormFixture,
} from "./fixtures/ci-workspace-coverage.js";
import {
  assertBuildWorkspaceCoverage,
  readPackageManifest,
  readWorkspacePackageManifest,
} from "./workspace-manifest.js";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const ciWorkflow = readFileSync(
  new URL("../.github/workflows/ci.yml", import.meta.url),
  "utf8",
);

describe("CI workflow", () => {
  it("builds every buildable root workspace before running tests", () => {
    const rootManifest = readPackageManifest(join(repoRoot, "package.json"));

    expect(() =>
      assertBuildWorkspaceCoverage(
        rootManifest,
        (workspacePath) =>
          readWorkspacePackageManifest(repoRoot, workspacePath),
        ciWorkflow,
      ),
    ).not.toThrow();
  });

  it("fails when any workspace with a build script is omitted", () => {
    const fixture = omittedBuildWorkspaceFixture;

    expect(() =>
      assertBuildWorkspaceCoverage(
        fixture.rootPackage,
        (workspacePath) =>
          fixture.workspacePackages[
            workspacePath as keyof typeof fixture.workspacePackages
          ],
        fixture.ciWorkflow,
      ),
    ).toThrowError("Missing CI build commands for: beta");
  });

  it("fails when an object-form workspace with a build script is omitted", () => {
    const fixture = omittedBuildWorkspaceObjectFormFixture;

    expect(() =>
      assertBuildWorkspaceCoverage(
        fixture.rootPackage,
        (workspacePath) =>
          fixture.workspacePackages[
            workspacePath as keyof typeof fixture.workspacePackages
          ],
        fixture.ciWorkflow,
      ),
    ).toThrowError("Missing CI build commands for: beta");
  });

  it("accepts object-form workspaces.packages when every build is covered", () => {
    const fixture = coveredBuildWorkspaceObjectFormFixture;

    expect(() =>
      assertBuildWorkspaceCoverage(
        fixture.rootPackage,
        (workspacePath) =>
          fixture.workspacePackages[
            workspacePath as keyof typeof fixture.workspacePackages
          ],
        fixture.ciWorkflow,
      ),
    ).not.toThrow();
  });

  it("matches nameless object-form packages by path alone when every build is covered", () => {
    const fixture = coveredBuildWorkspaceNamelessObjectFormFixture;

    expect(() =>
      assertBuildWorkspaceCoverage(
        fixture.rootPackage,
        (workspacePath) =>
          fixture.workspacePackages[
            workspacePath as keyof typeof fixture.workspacePackages
          ],
        fixture.ciWorkflow,
      ),
    ).not.toThrow();
  });

  it("fails when a nameless object-form workspace path is omitted from CI builds", () => {
    const fixture = omittedBuildWorkspaceNamelessObjectFormFixture;

    expect(() =>
      assertBuildWorkspaceCoverage(
        fixture.rootPackage,
        (workspacePath) =>
          fixture.workspacePackages[
            workspacePath as keyof typeof fixture.workspacePackages
          ],
        fixture.ciWorkflow,
      ),
    ).toThrowError("Missing CI build commands for: beta");
  });

  it("accepts mixed named/nameless object-form packages covered by name and path", () => {
    const fixture = coveredBuildWorkspaceMixedNameObjectFormFixture;

    expect(() =>
      assertBuildWorkspaceCoverage(
        fixture.rootPackage,
        (workspacePath) =>
          fixture.workspacePackages[
            workspacePath as keyof typeof fixture.workspacePackages
          ],
        fixture.ciWorkflow,
      ),
    ).not.toThrow();
  });

  it("fails when a workspace build runs after the Run tests step", () => {
    const fixture = lateBuildWorkspaceFixture;

    expect(() =>
      assertBuildWorkspaceCoverage(
        fixture.rootPackage,
        (workspacePath) =>
          fixture.workspacePackages[
            workspacePath as keyof typeof fixture.workspacePackages
          ],
        fixture.ciWorkflow,
      ),
    ).toThrowError("CI build commands must precede tests for: beta");
  });
});

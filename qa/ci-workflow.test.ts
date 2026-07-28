import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  coveredBuildWorkspaceNamelessObjectFormFixture,
  coveredBuildWorkspaceObjectFormFixture,
  omittedBuildWorkspaceFixture,
  omittedBuildWorkspaceNamelessObjectFormFixture,
  omittedBuildWorkspaceObjectFormFixture,
} from "./fixtures/ci-workspace-coverage.js";
import {
  npmWorkspaceScriptCommandPositions,
  readPackageManifest,
  readWorkspacePackageManifest,
  workspacesWithScript,
  type PackageManifest,
} from "./workspace-manifest.js";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const ciWorkflow = readFileSync(
  new URL("../.github/workflows/ci.yml", import.meta.url),
  "utf8",
);

function assertBuildWorkspaceCoverage(
  rootManifest: PackageManifest,
  readWorkspaceManifest: (workspacePath: string) => PackageManifest,
  workflow: string,
): void {
  const positions = npmWorkspaceScriptCommandPositions(workflow, "build");
  const testStep = workflow.indexOf("- name: Run tests");
  const missing: string[] = [];
  const late: string[] = [];

  for (const workspace of workspacesWithScript(
    rootManifest,
    "build",
    readWorkspaceManifest,
  )) {
    const position = [workspace.path, workspace.name]
      .filter((selector): selector is string => Boolean(selector))
      .map((selector) => positions.get(selector))
      .find((candidate) => candidate !== undefined);

    if (position === undefined) {
      missing.push(workspace.path);
    } else if (testStep < 0 || position > testStep) {
      late.push(workspace.path);
    }
  }

  if (missing.length > 0 || late.length > 0) {
    throw new Error(
      [
        missing.length > 0
          ? `Missing CI build commands for: ${missing.join(", ")}`
          : "",
        late.length > 0
          ? `CI build commands must precede tests for: ${late.join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join(". "),
    );
  }
}

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
});

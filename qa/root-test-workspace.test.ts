import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  coveredTestWorkspaceObjectFormFixture,
  omittedTestWorkspaceFixture,
  omittedTestWorkspaceObjectFormFixture,
} from "./fixtures/root-test-workspace-coverage.js";
import {
  readPackageManifest,
  readWorkspacePackageManifest,
  workspacesWithScript,
  type PackageManifest,
} from "./workspace-manifest.js";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function testCommandSelectors(command: string): ReadonlySet<string> {
  const selectors = new Set<string>();
  const workspaceCommand =
    /\bnpm\s+run\s+test\s+(?:-w\s+|--workspace(?:=|\s+))(?:"([^"]+)"|'([^']+)'|([^\s&|#]+))/g;

  for (const match of command.matchAll(workspaceCommand)) {
    const selector = match[1] ?? match[2] ?? match[3];
    selectors.add(selector);
  }

  return selectors;
}

function assertTestWorkspaceCoverage(
  rootManifest: PackageManifest,
  readWorkspaceManifest: (workspacePath: string) => PackageManifest,
): void {
  const rootTestCommand = rootManifest.scripts?.test;
  if (!rootTestCommand) {
    throw new Error("Root package is missing a test script");
  }

  const selectors = testCommandSelectors(rootTestCommand);
  const missing = workspacesWithScript(
    rootManifest,
    "test",
    readWorkspaceManifest,
  ).flatMap((workspace) =>
    [workspace.path, workspace.name].some(
      (selector) => selector !== undefined && selectors.has(selector),
    )
      ? []
      : [workspace.path],
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing root test commands for: ${missing.join(", ")}`,
    );
  }
}

describe("root test workspace coverage", () => {
  it("runs every root workspace that declares a test script", () => {
    const rootManifest = readPackageManifest(join(repoRoot, "package.json"));

    expect(() =>
      assertTestWorkspaceCoverage(rootManifest, (workspacePath) =>
        readWorkspacePackageManifest(repoRoot, workspacePath),
      ),
    ).not.toThrow();
  });

  it("fails when a workspace with a test script is omitted", () => {
    const fixture = omittedTestWorkspaceFixture;

    expect(() =>
      assertTestWorkspaceCoverage(
        fixture.rootPackage,
        (workspacePath) =>
          fixture.workspacePackages[
            workspacePath as keyof typeof fixture.workspacePackages
          ],
      ),
    ).toThrowError("Missing root test commands for: beta");
  });

  it("fails when an object-form workspace with a test script is omitted", () => {
    const fixture = omittedTestWorkspaceObjectFormFixture;

    expect(() =>
      assertTestWorkspaceCoverage(
        fixture.rootPackage,
        (workspacePath) =>
          fixture.workspacePackages[
            workspacePath as keyof typeof fixture.workspacePackages
          ],
      ),
    ).toThrowError("Missing root test commands for: beta");
  });

  it("accepts object-form workspaces.packages when every test is covered", () => {
    const fixture = coveredTestWorkspaceObjectFormFixture;

    expect(() =>
      assertTestWorkspaceCoverage(
        fixture.rootPackage,
        (workspacePath) =>
          fixture.workspacePackages[
            workspacePath as keyof typeof fixture.workspacePackages
          ],
      ),
    ).not.toThrow();
  });
});

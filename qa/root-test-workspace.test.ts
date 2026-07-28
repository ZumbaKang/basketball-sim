import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  coveredTestWorkspaceMixedNameObjectFormFixture,
  coveredTestWorkspaceNamelessObjectFormFixture,
  coveredTestWorkspaceObjectFormFixture,
  coveredTestWorkspaceShorthandFixture,
  omittedTestWorkspaceFixture,
  omittedTestWorkspaceNamelessObjectFormFixture,
  omittedTestWorkspaceObjectFormFixture,
} from "./fixtures/root-test-workspace-coverage.js";
import {
  assertTestWorkspaceCoverage,
  readPackageManifest,
  readWorkspacePackageManifest,
} from "./workspace-manifest.js";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

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

  it("matches nameless object-form packages by path alone when every test is covered", () => {
    const fixture = coveredTestWorkspaceNamelessObjectFormFixture;

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

  it("fails when a nameless object-form workspace path is omitted from root tests", () => {
    const fixture = omittedTestWorkspaceNamelessObjectFormFixture;

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

  it("counts npm test -w shorthand selectors as covered", () => {
    const fixture = coveredTestWorkspaceShorthandFixture;

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

  it("accepts mixed named/nameless object-form packages covered by name and path", () => {
    const fixture = coveredTestWorkspaceMixedNameObjectFormFixture;

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

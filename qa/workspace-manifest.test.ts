import { describe, expect, it } from "vitest";
import {
  coveredBuildWorkspaceNamelessObjectFormFixture,
  coveredBuildWorkspaceObjectFormFixture,
  omittedBuildWorkspaceFixture,
  omittedBuildWorkspaceObjectFormFixture,
} from "./fixtures/ci-workspace-coverage.js";
import {
  coveredTestWorkspaceNamelessObjectFormFixture,
  coveredTestWorkspaceObjectFormFixture,
  coveredTestWorkspaceShorthandFixture,
  omittedTestWorkspaceFixture,
  omittedTestWorkspaceObjectFormFixture,
} from "./fixtures/root-test-workspace-coverage.js";
import {
  assertBuildWorkspaceCoverage,
  assertTestWorkspaceCoverage,
  npmWorkspaceScriptCommandPositions,
  npmWorkspaceScriptCommandSelectors,
  workspacePaths,
  workspacesWithScript,
  type PackageManifest,
} from "./workspace-manifest.js";

describe("workspace-manifest discovery", () => {
  it("reads object-form workspaces.packages the same as array form", () => {
    const arrayForm: PackageManifest = {
      workspaces: ["alpha", "beta"],
    };
    const objectForm: PackageManifest = {
      workspaces: { packages: ["alpha", "beta"] },
    };

    expect(workspacePaths(objectForm)).toEqual(workspacePaths(arrayForm));
    expect(workspacePaths(objectForm)).toEqual(["alpha", "beta"]);
  });

  it("returns an empty list when object-form packages is missing", () => {
    expect(workspacePaths({ workspaces: {} })).toEqual([]);
    expect(workspacePaths({})).toEqual([]);
  });

  it("discovers buildable workspaces from object-form packages", () => {
    const fixture = coveredBuildWorkspaceObjectFormFixture;
    const buildable = workspacesWithScript(
      fixture.rootPackage,
      "build",
      (workspacePath) =>
        fixture.workspacePackages[
          workspacePath as keyof typeof fixture.workspacePackages
        ],
    );

    expect(buildable.map((workspace) => workspace.path)).toEqual([
      "alpha",
      "beta",
    ]);
  });

  it("discovers testable workspaces from object-form packages", () => {
    const fixture = coveredTestWorkspaceObjectFormFixture;
    const testable = workspacesWithScript(
      fixture.rootPackage,
      "test",
      (workspacePath) =>
        fixture.workspacePackages[
          workspacePath as keyof typeof fixture.workspacePackages
        ],
    );

    expect(testable.map((workspace) => workspace.path)).toEqual([
      "alpha",
      "beta",
    ]);
  });

  it("still reports omitted build workspaces under object-form packages", () => {
    const fixture = omittedBuildWorkspaceObjectFormFixture;
    const buildable = workspacesWithScript(
      fixture.rootPackage,
      "build",
      (workspacePath) =>
        fixture.workspacePackages[
          workspacePath as keyof typeof fixture.workspacePackages
        ],
    );

    expect(buildable.map((workspace) => workspace.path)).toEqual([
      "alpha",
      "beta",
    ]);
  });

  it("still reports omitted test workspaces under object-form packages", () => {
    const fixture = omittedTestWorkspaceObjectFormFixture;
    const testable = workspacesWithScript(
      fixture.rootPackage,
      "test",
      (workspacePath) =>
        fixture.workspacePackages[
          workspacePath as keyof typeof fixture.workspacePackages
        ],
    );

    expect(testable.map((workspace) => workspace.path)).toEqual([
      "alpha",
      "beta",
    ]);
  });

  it("discovers nameless object-form packages by path alone", () => {
    const buildable = workspacesWithScript(
      coveredBuildWorkspaceNamelessObjectFormFixture.rootPackage,
      "build",
      (workspacePath) =>
        coveredBuildWorkspaceNamelessObjectFormFixture.workspacePackages[
          workspacePath as keyof typeof coveredBuildWorkspaceNamelessObjectFormFixture.workspacePackages
        ],
    );
    const testable = workspacesWithScript(
      coveredTestWorkspaceNamelessObjectFormFixture.rootPackage,
      "test",
      (workspacePath) =>
        coveredTestWorkspaceNamelessObjectFormFixture.workspacePackages[
          workspacePath as keyof typeof coveredTestWorkspaceNamelessObjectFormFixture.workspacePackages
        ],
    );

    expect(buildable).toEqual([
      { name: undefined, path: "alpha" },
      { name: undefined, path: "beta" },
    ]);
    expect(testable).toEqual([
      { name: undefined, path: "alpha" },
      { name: undefined, path: "beta" },
    ]);
  });
});

describe("npm workspace script command parsers", () => {
  it("parses build selectors and positions from a CI workflow snippet", () => {
    const positions = npmWorkspaceScriptCommandPositions(
      omittedBuildWorkspaceFixture.ciWorkflow,
      "build",
    );

    expect([...positions.keys()]).toEqual(["alpha"]);
    expect(positions.get("alpha")).toBeTypeOf("number");
  });

  it("parses chained root test selectors across shell operators", () => {
    const selectors = npmWorkspaceScriptCommandSelectors(
      coveredTestWorkspaceObjectFormFixture.rootPackage.scripts.test,
      "test",
    );

    expect(selectors).toEqual(new Set(["alpha", "beta"]));
  });

  it("accepts -w, --workspace, and --workspace= selector forms", () => {
    const command =
      'npm run build -w alpha && npm run build --workspace beta && npm run build --workspace="@fixture/gamma"';
    const positions = npmWorkspaceScriptCommandPositions(command, "build");

    expect([...positions.keys()]).toEqual([
      "alpha",
      "beta",
      "@fixture/gamma",
    ]);
    expect(positions.get("alpha")).toBeLessThan(positions.get("beta")!);
    expect(positions.get("beta")).toBeLessThan(
      positions.get("@fixture/gamma")!,
    );
  });

  it("keeps omitted-workspace fixture selectors identical for consumers", () => {
    expect(
      npmWorkspaceScriptCommandSelectors(
        omittedTestWorkspaceFixture.rootPackage.scripts.test,
        "test",
      ),
    ).toEqual(new Set(["alpha"]));
    expect(
      npmWorkspaceScriptCommandSelectors(
        omittedBuildWorkspaceFixture.ciWorkflow,
        "build",
      ),
    ).toEqual(new Set(["alpha"]));
  });

  it("treats npm test -w shorthand the same as npm run test -w", () => {
    const selectors = npmWorkspaceScriptCommandSelectors(
      coveredTestWorkspaceShorthandFixture.rootPackage.scripts.test,
      "test",
    );

    expect(selectors).toEqual(new Set(["alpha", "beta"]));
  });

  it("does not treat npm build -w as a valid build shorthand", () => {
    expect(
      npmWorkspaceScriptCommandSelectors(
        "npm build -w alpha && npm run build -w beta",
        "build",
      ),
    ).toEqual(new Set(["beta"]));
  });
});

describe("workspace coverage assertion helpers", () => {
  it("throws the same omitted-build error from the shared helper", () => {
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

  it("throws the same omitted-test error from the shared helper", () => {
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

  it("accepts covered object-form build and test fixtures", () => {
    expect(() =>
      assertBuildWorkspaceCoverage(
        coveredBuildWorkspaceObjectFormFixture.rootPackage,
        (workspacePath) =>
          coveredBuildWorkspaceObjectFormFixture.workspacePackages[
            workspacePath as keyof typeof coveredBuildWorkspaceObjectFormFixture.workspacePackages
          ],
        coveredBuildWorkspaceObjectFormFixture.ciWorkflow,
      ),
    ).not.toThrow();

    expect(() =>
      assertTestWorkspaceCoverage(
        coveredTestWorkspaceObjectFormFixture.rootPackage,
        (workspacePath) =>
          coveredTestWorkspaceObjectFormFixture.workspacePackages[
            workspacePath as keyof typeof coveredTestWorkspaceObjectFormFixture.workspacePackages
          ],
      ),
    ).not.toThrow();
  });
});

import { describe, expect, it } from "vitest";
import {
  coveredBuildWorkspaceObjectFormFixture,
  omittedBuildWorkspaceFixture,
  omittedBuildWorkspaceObjectFormFixture,
} from "./fixtures/ci-workspace-coverage.js";
import {
  coveredTestWorkspaceObjectFormFixture,
  omittedTestWorkspaceFixture,
  omittedTestWorkspaceObjectFormFixture,
} from "./fixtures/root-test-workspace-coverage.js";
import {
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
});

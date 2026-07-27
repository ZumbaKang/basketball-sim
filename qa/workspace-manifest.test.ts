import { describe, expect, it } from "vitest";
import {
  coveredBuildWorkspaceObjectFormFixture,
  omittedBuildWorkspaceObjectFormFixture,
} from "./fixtures/ci-workspace-coverage.js";
import {
  coveredTestWorkspaceObjectFormFixture,
  omittedTestWorkspaceObjectFormFixture,
} from "./fixtures/root-test-workspace-coverage.js";
import {
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

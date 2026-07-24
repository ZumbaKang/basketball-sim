import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { omittedBuildWorkspaceFixture } from "./fixtures/ci-workspace-coverage.js";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const ciWorkflow = readFileSync(
  new URL("../.github/workflows/ci.yml", import.meta.url),
  "utf8",
);

interface PackageManifest {
  name?: string;
  workspaces?: readonly string[] | { packages?: readonly string[] };
  scripts?: Readonly<Record<string, string>>;
}

interface BuildableWorkspace {
  name?: string;
  path: string;
}

function workspacePaths(manifest: PackageManifest): readonly string[] {
  if (Array.isArray(manifest.workspaces)) {
    return manifest.workspaces;
  }

  return manifest.workspaces?.packages ?? [];
}

function buildableWorkspaces(
  rootManifest: PackageManifest,
  readWorkspaceManifest: (workspacePath: string) => PackageManifest,
): BuildableWorkspace[] {
  return workspacePaths(rootManifest).flatMap((workspacePath) => {
    const manifest = readWorkspaceManifest(workspacePath);
    return manifest.scripts?.build
      ? [{ name: manifest.name, path: workspacePath }]
      : [];
  });
}

function buildCommandPositions(workflow: string): ReadonlyMap<string, number> {
  const positions = new Map<string, number>();
  const command =
    /\bnpm\s+run\s+build\s+(?:-w\s+|--workspace(?:=|\s+))(?:"([^"]+)"|'([^']+)'|([^\s#]+))/g;

  for (const match of workflow.matchAll(command)) {
    const selector = match[1] ?? match[2] ?? match[3];
    positions.set(selector, match.index);
  }

  return positions;
}

function assertBuildWorkspaceCoverage(
  rootManifest: PackageManifest,
  readWorkspaceManifest: (workspacePath: string) => PackageManifest,
  workflow: string,
): void {
  const positions = buildCommandPositions(workflow);
  const testStep = workflow.indexOf("- name: Run tests");
  const missing: string[] = [];
  const late: string[] = [];

  for (const workspace of buildableWorkspaces(
    rootManifest,
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

function readPackageManifest(path: string): PackageManifest {
  return JSON.parse(readFileSync(path, "utf8")) as PackageManifest;
}

describe("CI workflow", () => {
  it("builds every buildable root workspace before running tests", () => {
    const rootManifest = readPackageManifest(join(repoRoot, "package.json"));

    expect(() =>
      assertBuildWorkspaceCoverage(
        rootManifest,
        (workspacePath) =>
          readPackageManifest(join(repoRoot, workspacePath, "package.json")),
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
});

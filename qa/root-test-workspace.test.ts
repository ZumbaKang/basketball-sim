import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { omittedTestWorkspaceFixture } from "./fixtures/root-test-workspace-coverage.js";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

interface PackageManifest {
  name?: string;
  workspaces?: readonly string[] | { packages?: readonly string[] };
  scripts?: Readonly<Record<string, string>>;
}

interface TestableWorkspace {
  name?: string;
  path: string;
}

function workspacePaths(manifest: PackageManifest): readonly string[] {
  if (Array.isArray(manifest.workspaces)) {
    return manifest.workspaces;
  }

  return manifest.workspaces?.packages ?? [];
}

function testableWorkspaces(
  rootManifest: PackageManifest,
  readWorkspaceManifest: (workspacePath: string) => PackageManifest,
): TestableWorkspace[] {
  return workspacePaths(rootManifest).flatMap((workspacePath) => {
    const manifest = readWorkspaceManifest(workspacePath);
    return manifest.scripts?.test
      ? [{ name: manifest.name, path: workspacePath }]
      : [];
  });
}

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
  const missing = testableWorkspaces(
    rootManifest,
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

function readPackageManifest(path: string): PackageManifest {
  return JSON.parse(readFileSync(path, "utf8")) as PackageManifest;
}

describe("root test workspace coverage", () => {
  it("runs every root workspace that declares a test script", () => {
    const rootManifest = readPackageManifest(join(repoRoot, "package.json"));

    expect(() =>
      assertTestWorkspaceCoverage(rootManifest, (workspacePath) =>
        readPackageManifest(join(repoRoot, workspacePath, "package.json")),
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
});

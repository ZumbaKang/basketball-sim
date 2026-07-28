import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface PackageManifest {
  name?: string;
  workspaces?: readonly string[] | { packages?: readonly string[] };
  scripts?: Readonly<Record<string, string>>;
}

export interface WorkspacePackage {
  name?: string;
  path: string;
}

/** Resolve workspace paths from either array or object-form package.json. */
export function workspacePaths(manifest: PackageManifest): readonly string[] {
  if (Array.isArray(manifest.workspaces)) {
    return manifest.workspaces;
  }

  return manifest.workspaces?.packages ?? [];
}

export function workspacesWithScript(
  rootManifest: PackageManifest,
  scriptName: string,
  readWorkspaceManifest: (workspacePath: string) => PackageManifest,
): WorkspacePackage[] {
  return workspacePaths(rootManifest).flatMap((workspacePath) => {
    const manifest = readWorkspaceManifest(workspacePath);
    return manifest.scripts?.[scriptName]
      ? [{ name: manifest.name, path: workspacePath }]
      : [];
  });
}

export function readPackageManifest(path: string): PackageManifest {
  return JSON.parse(readFileSync(path, "utf8")) as PackageManifest;
}

export function readWorkspacePackageManifest(
  repoRoot: string,
  workspacePath: string,
): PackageManifest {
  return readPackageManifest(join(repoRoot, workspacePath, "package.json"));
}

/**
 * npm lifecycle scripts that also accept the shorthand form
 * `npm <script>` (without `run`), e.g. `npm test -w alpha`.
 */
const NPM_LIFECYCLE_SHORTCUTS = new Set([
  "test",
  "start",
  "stop",
  "restart",
]);

/**
 * Match `npm run <script> -w|--workspace <selector>` occurrences in a shell
 * command or CI workflow snippet. For lifecycle scripts (`test`, `start`,
 * `stop`, `restart`), also accept the shorthand `npm <script> -w` form.
 * Unquoted selectors stop at whitespace or common shell operators
 * (`&`, `|`, `#`) so chained commands parse cleanly.
 */
export function npmWorkspaceScriptCommandPositions(
  command: string,
  scriptName: string,
): ReadonlyMap<string, number> {
  const positions = new Map<string, number>();
  const escapedScript = scriptName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const runPrefix = NPM_LIFECYCLE_SHORTCUTS.has(scriptName)
    ? String.raw`(?:run\s+)?`
    : String.raw`run\s+`;
  const pattern = new RegExp(
    String.raw`\bnpm\s+${runPrefix}${escapedScript}\s+(?:-w\s+|--workspace(?:=|\s+))(?:"([^"]+)"|'([^']+)'|([^\s&#|]+))`,
    "g",
  );

  for (const match of command.matchAll(pattern)) {
    const selector = match[1] ?? match[2] ?? match[3];
    if (selector !== undefined && match.index !== undefined) {
      positions.set(selector, match.index);
    }
  }

  return positions;
}

export function npmWorkspaceScriptCommandSelectors(
  command: string,
  scriptName: string,
): ReadonlySet<string> {
  return new Set(
    npmWorkspaceScriptCommandPositions(command, scriptName).keys(),
  );
}

/**
 * Assert every workspace that declares a `build` script appears in the CI
 * workflow via `npm run build -w|--workspace`, and that those builds precede
 * the "Run tests" step.
 */
export function assertBuildWorkspaceCoverage(
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

/**
 * Assert every workspace that declares a `test` script is invoked from the
 * root package `test` script via `npm [run] test -w|--workspace`.
 */
export function assertTestWorkspaceCoverage(
  rootManifest: PackageManifest,
  readWorkspaceManifest: (workspacePath: string) => PackageManifest,
): void {
  const rootTestCommand = rootManifest.scripts?.test;
  if (!rootTestCommand) {
    throw new Error("Root package is missing a test script");
  }

  const selectors = npmWorkspaceScriptCommandSelectors(rootTestCommand, "test");
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

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
 * Match `npm run <script> -w|--workspace <selector>` occurrences in a shell
 * command or CI workflow snippet. Unquoted selectors stop at whitespace or
 * common shell operators (`&`, `|`, `#`) so chained commands parse cleanly.
 */
export function npmWorkspaceScriptCommandPositions(
  command: string,
  scriptName: string,
): ReadonlyMap<string, number> {
  const positions = new Map<string, number>();
  const escapedScript = scriptName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    String.raw`\bnpm\s+run\s+${escapedScript}\s+(?:-w\s+|--workspace(?:=|\s+))(?:"([^"]+)"|'([^']+)'|([^\s&#|]+))`,
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

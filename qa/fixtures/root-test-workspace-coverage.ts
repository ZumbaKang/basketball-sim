export const omittedTestWorkspaceFixture = {
  rootPackage: {
    workspaces: ["alpha", "beta", "build-only"],
    scripts: {
      test: "npm run test -w alpha",
    },
  },
  workspacePackages: {
    alpha: {
      name: "@fixture/alpha",
      scripts: { test: "vitest run" },
    },
    beta: {
      name: "@fixture/beta",
      scripts: { test: "vitest run" },
    },
    "build-only": {
      name: "@fixture/build-only",
      scripts: { build: "tsc" },
    },
  },
} as const;

/** Same coverage gap, but with object-form `workspaces.packages`. */
export const omittedTestWorkspaceObjectFormFixture = {
  rootPackage: {
    workspaces: {
      packages: ["alpha", "beta", "build-only"],
    },
    scripts: {
      test: "npm run test -w alpha",
    },
  },
  workspacePackages: omittedTestWorkspaceFixture.workspacePackages,
} as const;

export const coveredTestWorkspaceObjectFormFixture = {
  rootPackage: {
    workspaces: {
      packages: ["alpha", "beta", "build-only"],
    },
    scripts: {
      test: "npm run test -w alpha && npm run test -w beta",
    },
  },
  workspacePackages: omittedTestWorkspaceFixture.workspacePackages,
} as const;

/**
 * Object-form workspaces whose package.json omits `name`. Coverage must
 * match by path alone — package-name selectors are unavailable.
 */
export const coveredTestWorkspaceNamelessObjectFormFixture = {
  rootPackage: {
    workspaces: {
      packages: ["alpha", "beta", "build-only"],
    },
    scripts: {
      test: "npm run test -w alpha && npm run test -w beta",
    },
  },
  workspacePackages: {
    alpha: {
      scripts: { test: "vitest run" },
    },
    beta: {
      scripts: { test: "vitest run" },
    },
    "build-only": {
      scripts: { build: "tsc" },
    },
  },
} as const;

/** Same nameless packages, but root test only covers alpha — beta is omitted. */
export const omittedTestWorkspaceNamelessObjectFormFixture = {
  rootPackage: {
    workspaces: {
      packages: ["alpha", "beta", "build-only"],
    },
    scripts: {
      test: "npm run test -w alpha",
    },
  },
  workspacePackages:
    coveredTestWorkspaceNamelessObjectFormFixture.workspacePackages,
} as const;

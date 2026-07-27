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

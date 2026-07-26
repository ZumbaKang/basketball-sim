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

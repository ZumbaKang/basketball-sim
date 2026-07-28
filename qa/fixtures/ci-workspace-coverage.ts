export const omittedBuildWorkspaceFixture = {
  rootPackage: {
    workspaces: ["alpha", "beta", "tests"],
  },
  workspacePackages: {
    alpha: {
      name: "@fixture/alpha",
      scripts: { build: "tsc" },
    },
    beta: {
      name: "@fixture/beta",
      scripts: { build: "tsc" },
    },
    tests: {
      name: "@fixture/tests",
      scripts: { test: "vitest run" },
    },
  },
  ciWorkflow: `
jobs:
  test:
    steps:
      - name: Build workspaces
        run: |
          npm run build -w alpha
      - name: Run tests
        run: npm test
`,
} as const;

/** Same coverage gap, but with object-form `workspaces.packages`. */
export const omittedBuildWorkspaceObjectFormFixture = {
  rootPackage: {
    workspaces: {
      packages: ["alpha", "beta", "tests"],
    },
  },
  workspacePackages: omittedBuildWorkspaceFixture.workspacePackages,
  ciWorkflow: omittedBuildWorkspaceFixture.ciWorkflow,
} as const;

export const coveredBuildWorkspaceObjectFormFixture = {
  rootPackage: {
    workspaces: {
      packages: ["alpha", "beta"],
    },
  },
  workspacePackages: {
    alpha: {
      name: "@fixture/alpha",
      scripts: { build: "tsc" },
    },
    beta: {
      name: "@fixture/beta",
      scripts: { build: "tsc" },
    },
  },
  ciWorkflow: `
jobs:
  test:
    steps:
      - name: Build workspaces
        run: |
          npm run build -w alpha
          npm run build -w beta
      - name: Run tests
        run: npm test
`,
} as const;

/**
 * Object-form workspaces whose package.json omits `name`. Coverage must
 * match by path alone — package-name selectors are unavailable.
 */
export const coveredBuildWorkspaceNamelessObjectFormFixture = {
  rootPackage: {
    workspaces: {
      packages: ["alpha", "beta"],
    },
  },
  workspacePackages: {
    alpha: {
      scripts: { build: "tsc" },
    },
    beta: {
      scripts: { build: "tsc" },
    },
  },
  ciWorkflow: `
jobs:
  test:
    steps:
      - name: Build workspaces
        run: |
          npm run build -w alpha
          npm run build -w beta
      - name: Run tests
        run: npm test
`,
} as const;

/** Same nameless packages, but CI only builds one path — beta is omitted. */
export const omittedBuildWorkspaceNamelessObjectFormFixture = {
  rootPackage: coveredBuildWorkspaceNamelessObjectFormFixture.rootPackage,
  workspacePackages:
    coveredBuildWorkspaceNamelessObjectFormFixture.workspacePackages,
  ciWorkflow: `
jobs:
  test:
    steps:
      - name: Build workspaces
        run: |
          npm run build -w alpha
      - name: Run tests
        run: npm test
`,
} as const;

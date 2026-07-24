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

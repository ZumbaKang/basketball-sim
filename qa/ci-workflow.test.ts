import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ciWorkflow = readFileSync(
  new URL("../.github/workflows/ci.yml", import.meta.url),
  "utf8",
);

describe("CI workflow", () => {
  it("builds the frontend before running the test suite", () => {
    const frontendBuild = ciWorkflow.indexOf("npm run build -w frontend");
    const testStep = ciWorkflow.indexOf("- name: Run tests");

    expect(frontendBuild).toBeGreaterThan(-1);
    expect(testStep).toBeGreaterThan(frontendBuild);
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  new URL("../.github/workflows/cursor-pr-ready.yml", import.meta.url),
  "utf8",
);

describe("Cursor PR ready workflow", () => {
  it("only marks same-repository Cursor drafts targeting the default branch ready", () => {
    expect(workflow).toContain("pull_request_target:");
    expect(workflow).toContain("github.event.pull_request.user.login == 'cursor[bot]'");
    expect(workflow).toContain(
      "github.event.pull_request.head.repo.full_name == github.repository",
    );
    expect(workflow).toContain(
      "github.event.pull_request.base.ref == github.event.repository.default_branch",
    );
    expect(workflow).toContain("github.event.pull_request.draft");
    expect(workflow).toContain('run: gh pr ready "$PR_URL"');
  });

  it("does not create a second automatic merge path", () => {
    expect(workflow).not.toContain("gh pr merge");
  });
});

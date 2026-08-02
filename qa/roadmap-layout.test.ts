import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("roadmap layout (conflict-proof)", () => {
  it("keeps open work in roadmap/*.md and process docs in ROADMAP.md", () => {
    expect(existsSync(join(root, "ROADMAP.md"))).toBe(true);
    expect(existsSync(join(root, "roadmap/now.md"))).toBe(true);
    expect(existsSync(join(root, "roadmap/next.md"))).toBe(true);
    expect(existsSync(join(root, "roadmap/later.md"))).toBe(true);
    expect(existsSync(join(root, "roadmap/shipped.md"))).toBe(true);

    const index = read("ROADMAP.md");
    expect(index).toMatch(/roadmap\/now\.md/);
    expect(index).toMatch(/merge=union/);
    // Process index should not accumulate the live checkbox backlog again.
    expect(index).not.toMatch(/^- \[[ x]\] `/m);
  });

  it("keeps open lists free of checked-off items", () => {
    for (const file of ["roadmap/now.md", "roadmap/next.md", "roadmap/later.md"]) {
      const body = read(file);
      const checked = body.match(/^- \[x\]/gm) ?? [];
      expect(checked, `${file} still has completed [x] items — delete them and log in shipped.md`).toEqual(
        [],
      );
      expect(body).toMatch(/^- \[ \]/m);
    }
  });

  it("marks shipped.md for union merge so concurrent appends do not conflict", () => {
    const attrs = read(".gitattributes");
    expect(attrs).toMatch(/roadmap\/shipped\.md\s+merge=union/);
    const shipped = read("roadmap/shipped.md");
    expect(shipped).toMatch(/Append-only|prepend/i);
    expect(shipped).toMatch(/^- \d{4}-\d{2}-\d{2}:/m);
  });
});

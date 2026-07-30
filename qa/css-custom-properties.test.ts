import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  assertCssCustomPropertiesDeclared,
  assertThemeTokenSetsAligned,
  assertTsxCssCustomPropertiesDeclared,
  collectCssVarReferences,
  collectCssVarReferencesFromTsx,
  collectThemeCustomPropertyDeclarations,
  extractTsxStringLiterals,
  findThemeTokenSetSkew,
  findUndeclaredCssCustomProperties,
  findUndeclaredTsxCssCustomProperties,
} from "./css-custom-properties.js";
import {
  danglingFontAliasStylesheet,
  danglingFontAliasTsxComponent,
  halfLightPaletteStylesheet,
  missingLightThemeTokenStylesheet,
  validThemedStylesheet,
  validThemedTsxComponent,
} from "./fixtures/css-custom-properties.js";

function listFilesRecursive(dir: string, suffix: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(path, suffix));
    } else if (entry.name.endsWith(suffix)) {
      files.push(path);
    }
  }
  return files;
}

describe("CSS custom property theme declarations", () => {
  it("accepts a themed stylesheet where every var() resolves", () => {
    expect(() =>
      assertCssCustomPropertiesDeclared(validThemedStylesheet, "valid fixture"),
    ).not.toThrow();
    expect(findUndeclaredCssCustomProperties(validThemedStylesheet)).toEqual(
      [],
    );
    expect(() =>
      assertThemeTokenSetsAligned(validThemedStylesheet, "valid fixture"),
    ).not.toThrow();
    expect(findThemeTokenSetSkew(validThemedStylesheet)).toEqual([]);
  });

  it("fails a fixture stylesheet with a dangling font var()", () => {
    expect(findUndeclaredCssCustomProperties(danglingFontAliasStylesheet)).toEqual(
      [
        {
          property: "--font-display",
          themes: ["dark", "light"],
        },
      ],
    );

    expect(() =>
      assertCssCustomPropertiesDeclared(
        danglingFontAliasStylesheet,
        "dangling-font.css",
      ),
    ).toThrowError(
      "Undeclared CSS custom properties in dangling-font.css: --font-display (missing for dark, light)",
    );
  });

  it("fails when a referenced token is missing from the light theme", () => {
    expect(
      findUndeclaredCssCustomProperties(missingLightThemeTokenStylesheet),
    ).toEqual([
      {
        property: "--accent",
        themes: ["light"],
      },
    ]);
  });

  it("flags dark/light token set skew even when :root keeps values available", () => {
    expect(findUndeclaredCssCustomProperties(halfLightPaletteStylesheet)).toEqual(
      [],
    );
    expect(findThemeTokenSetSkew(halfLightPaletteStylesheet)).toEqual([
      {
        property: "--cool",
        declaredIn: ["dark"],
        omittedFrom: ["light"],
      },
      {
        property: "--surface",
        declaredIn: ["dark"],
        omittedFrom: ["light"],
      },
    ]);

    expect(() =>
      assertThemeTokenSetsAligned(
        halfLightPaletteStylesheet,
        "half-light.css",
      ),
    ).toThrowError(
      "Theme token set skew in half-light.css: --cool (declared under dark, omitted from light); --surface (declared under dark, omitted from light)",
    );
  });

  it("treats var() fallbacks as intentional external tokens", () => {
    const refs = collectCssVarReferences(validThemedStylesheet);
    const loaded = refs.find((ref) => ref.property === "--font-body-loaded");
    expect(loaded).toEqual({
      property: "--font-body-loaded",
      hasFallback: true,
    });
  });

  it("attributes :root, [data-theme=dark] declarations to root and dark", () => {
    const sets = collectThemeCustomPropertyDeclarations(validThemedStylesheet);
    expect(sets.root.has("--text")).toBe(true);
    expect(sets.dark.has("--text")).toBe(true);
    expect(sets.light.has("--text")).toBe(true);
    expect(sets.root.has("--font-body")).toBe(true);
    expect(sets.dark.has("--font-body")).toBe(false);
    expect(sets.light.has("--font-body")).toBe(false);
  });

  it("ignores :root-only shared tokens when computing theme skew", () => {
    const sets = collectThemeCustomPropertyDeclarations(halfLightPaletteStylesheet);
    expect(sets.root.has("--radius-sm")).toBe(true);
    expect(sets.dark.has("--radius-sm")).toBe(false);
    expect(sets.light.has("--radius-sm")).toBe(false);
    expect(
      findThemeTokenSetSkew(halfLightPaletteStylesheet).map((row) => row.property),
    ).not.toContain("--radius-sm");
  });

  it("passes the frontend globals stylesheet for both themes", () => {
    const globalsCss = readFileSync(
      new URL("../frontend/app/globals.css", import.meta.url),
      "utf8",
    );

    expect(() =>
      assertCssCustomPropertiesDeclared(
        globalsCss,
        "frontend/app/globals.css",
      ),
    ).not.toThrow();
    expect(() =>
      assertThemeTokenSetsAligned(globalsCss, "frontend/app/globals.css"),
    ).not.toThrow();
  });
});

describe("TSX string-literal CSS custom property references", () => {
  it("extracts quoted and template string literals while skipping comments", () => {
    const source = `
      // "var(--ignored-line)"
      /* "var(--ignored-block)" */
      {/* "var(--ignored-jsx)" */}
      const a = "var(--good)";
      const b = 'var(--danger)';
      const c = \`var(--accent)\`;
      const d = \`prefix-\${"var(--text)"}-suffix\`;
    `;
    const literals = extractTsxStringLiterals(source);
    expect(literals).toEqual([
      "var(--good)",
      "var(--danger)",
      "var(--accent)",
      "prefix-",
      "var(--text)",
      "-suffix",
    ]);
  });

  it("accepts a TSX fixture whose string literals resolve against the theme", () => {
    expect(
      findUndeclaredTsxCssCustomProperties(
        validThemedTsxComponent,
        validThemedStylesheet,
      ),
    ).toEqual([]);
    expect(() =>
      assertTsxCssCustomPropertiesDeclared(
        validThemedTsxComponent,
        validThemedStylesheet,
        "valid.tsx",
      ),
    ).not.toThrow();

    const refs = collectCssVarReferencesFromTsx(validThemedTsxComponent);
    expect(refs).toEqual(
      expect.arrayContaining([
        { property: "--accent", hasFallback: false },
        { property: "--font-body-loaded", hasFallback: true },
      ]),
    );
  });

  it("fails a fixture component that references an undeclared token", () => {
    // Need --text declared so only --font-display is reported.
    const theme = `
:root, [data-theme="dark"] { --text: #eef2fb; }
[data-theme="light"] { --text: #101826; }
`;
    expect(findUndeclaredTsxCssCustomProperties(danglingFontAliasTsxComponent, theme)).toEqual([
      {
        property: "--font-display",
        themes: ["dark", "light"],
      },
    ]);

    expect(() =>
      assertTsxCssCustomPropertiesDeclared(
        danglingFontAliasTsxComponent,
        theme,
        "dangling-font.tsx",
      ),
    ).toThrowError(
      "Undeclared CSS custom properties in dangling-font.tsx: --font-display (missing for dark, light)",
    );
  });

  it("ignores var() references that only appear inside TSX comments", () => {
    const commentedOnly = `
export function Unused() {
  // style={{ color: "var(--font-display)" }}
  /* color: "var(--missing-token)" */
  return <span {/* style="var(--also-missing)" */} />;
}
`;
    expect(
      findUndeclaredTsxCssCustomProperties(commentedOnly, validThemedStylesheet),
    ).toEqual([]);
  });

  it("passes every frontend TSX file against globals.css theme tokens", () => {
    const frontendRoot = fileURLToPath(new URL("../frontend/", import.meta.url));
    const globalsCss = readFileSync(join(frontendRoot, "app/globals.css"), "utf8");
    const tsxFiles = listFilesRecursive(frontendRoot, ".tsx");

    expect(tsxFiles.length).toBeGreaterThan(0);

    for (const file of tsxFiles) {
      const source = readFileSync(file, "utf8");
      const label = file.replace(/\\/g, "/").replace(/^.*\/frontend\//, "frontend/");
      expect(() =>
        assertTsxCssCustomPropertiesDeclared(source, globalsCss, label),
      ).not.toThrow();
    }
  });
});

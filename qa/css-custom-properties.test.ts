import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  assertCssCustomPropertiesDeclared,
  collectCssVarReferences,
  collectThemeCustomPropertyDeclarations,
  findUndeclaredCssCustomProperties,
} from "./css-custom-properties.js";
import {
  danglingFontAliasStylesheet,
  missingLightThemeTokenStylesheet,
  validThemedStylesheet,
} from "./fixtures/css-custom-properties.js";

describe("CSS custom property theme declarations", () => {
  it("accepts a themed stylesheet where every var() resolves", () => {
    expect(() =>
      assertCssCustomPropertiesDeclared(validThemedStylesheet, "valid fixture"),
    ).not.toThrow();
    expect(findUndeclaredCssCustomProperties(validThemedStylesheet)).toEqual(
      [],
    );
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
  });
});

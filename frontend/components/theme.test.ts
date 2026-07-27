import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_THEME,
  isTheme,
  nextTheme,
  resolveInitialTheme,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
  themeToggleLabel,
} from "./theme";

test("a stored choice always beats the operating system preference", () => {
  assert.equal(resolveInitialTheme("light", false), "light");
  assert.equal(resolveInitialTheme("dark", true), "dark");
});

test("without a stored choice the operating system decides, defaulting to dark", () => {
  assert.equal(resolveInitialTheme(null, true), "light");
  assert.equal(resolveInitialTheme(null, false), DEFAULT_THEME);
  assert.equal(resolveInitialTheme("sepia", false), DEFAULT_THEME);
  assert.equal(resolveInitialTheme(undefined, false), DEFAULT_THEME);
});

test("toggling round-trips between the two themes", () => {
  assert.equal(nextTheme("dark"), "light");
  assert.equal(nextTheme("light"), "dark");
  assert.equal(nextTheme(nextTheme("dark")), "dark");
});

test("the toggle announces the theme it switches to, not the current one", () => {
  assert.equal(themeToggleLabel("dark"), "Switch to light theme");
  assert.equal(themeToggleLabel("light"), "Switch to dark theme");
});

test("only the two supported themes are accepted", () => {
  assert.ok(isTheme("dark"));
  assert.ok(isTheme("light"));
  assert.ok(!isTheme("Dark"));
  assert.ok(!isTheme(null));
});

test("the no-flash script reads the same key the toggle writes and survives storage errors", () => {
  assert.ok(THEME_INIT_SCRIPT.includes(THEME_STORAGE_KEY));
  assert.ok(THEME_INIT_SCRIPT.includes("prefers-color-scheme: light"));
  assert.ok(THEME_INIT_SCRIPT.includes("catch"));
  assert.ok(THEME_INIT_SCRIPT.includes("data-theme"));
});

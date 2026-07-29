/**
 * Fixture stylesheets for CSS custom-property declaration checks.
 */

/** Mirrors the TIPOFF pattern: shared :root tokens + per-theme color tokens. */
export const validThemedStylesheet = `
:root,
[data-theme="dark"] {
  --text: #eef2fb;
  --accent: #ff8a3d;
}

[data-theme="light"] {
  --text: #101826;
  --accent: #e85d1c;
}

:root {
  --font-body: var(--font-body-loaded, Archivo), sans-serif;
  --radius-sm: 8px;
}

body {
  color: var(--text);
  font-family: var(--font-body);
  border-radius: var(--radius-sm);
}

.btn {
  background: var(--accent);
}
`;

/**
 * Dangling --font-display alias: referenced without a fallback and never
 * declared for either theme (the serif-fallback failure mode).
 */
export const danglingFontAliasStylesheet = `
:root,
[data-theme="dark"] {
  --text: #eef2fb;
}

[data-theme="light"] {
  --text: #101826;
}

body {
  color: var(--text);
  font-family: var(--font-display);
}
`;

/**
 * Theme token declared only under [data-theme="dark"] (no :root), so light
 * theme inherits nothing for --accent.
 */
export const missingLightThemeTokenStylesheet = `
[data-theme="dark"] {
  --text: #eef2fb;
  --accent: #ff8a3d;
}

[data-theme="light"] {
  --text: #101826;
}

.btn {
  color: var(--text);
  background: var(--accent);
}
`;

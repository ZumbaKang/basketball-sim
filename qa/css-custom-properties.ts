/**
 * Assert CSS custom properties referenced via var() are declared for each
 * theme. Catches the class of bug where an undefined --font-* alias silently
 * falls back to the browser serif default.
 */

export type ThemeId = "dark" | "light";

export interface UndeclaredCssCustomProperty {
  property: string;
  themes: ThemeId[];
}

const THEMES: readonly ThemeId[] = ["dark", "light"];

/** Strip CSS block comments without a full tokenizer. */
export function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * Expand @media/@supports wrappers into their inner rules so nested
 * declarations and references are still visible to the checker. Drop
 * @keyframes/@font-face blocks (no custom-property contracts there).
 */
export function flattenCssRules(css: string): string {
  const withoutComments = stripCssComments(css);
  let input = withoutComments;
  let output = "";

  while (input.length > 0) {
    const atIndex = input.search(/@[a-zA-Z-]+/);
    if (atIndex === -1) {
      output += input;
      break;
    }

    output += input.slice(0, atIndex);
    const rest = input.slice(atIndex);
    const headerMatch = rest.match(/^@[a-zA-Z-]+[^{]*/);
    if (!headerMatch) {
      output += rest[0] ?? "";
      input = rest.slice(1);
      continue;
    }

    const atName = headerMatch[0].match(/^@([a-zA-Z-]+)/)?.[1]?.toLowerCase() ?? "";
    const afterHeader = rest.slice(headerMatch[0].length).trimStart();
    if (!afterHeader.startsWith("{")) {
      output += headerMatch[0];
      input = rest.slice(headerMatch[0].length);
      continue;
    }

    const body = extractBraceBlock(afterHeader);
    if (body === null) {
      output += rest;
      break;
    }

    const fullLength = rest.length - afterHeader.length + body.fullLength;
    if (atName === "media" || atName === "supports") {
      output += body.inner;
    }
    // else: drop @keyframes, @font-face, @layer wrappers' at-rule but keep
    // nothing — keyframes don't declare theme tokens.
    input = rest.slice(fullLength);
  }

  return output;
}

interface BraceBlock {
  inner: string;
  /** Length of `{` + inner + `}` in the source starting at `{`. */
  fullLength: number;
}

function extractBraceBlock(source: string): BraceBlock | null {
  if (!source.startsWith("{")) return null;
  let depth = 0;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return { inner: source.slice(1, i), fullLength: i + 1 };
      }
    }
  }
  return null;
}

export interface ThemeCustomPropertySets {
  /** Declared on :root (applies regardless of data-theme). */
  root: Set<string>;
  dark: Set<string>;
  light: Set<string>;
}

function classifySelector(selectorList: string): {
  root: boolean;
  dark: boolean;
  light: boolean;
} {
  const parts = selectorList.split(",").map((part) => part.trim());
  let root = false;
  let dark = false;
  let light = false;

  for (const part of parts) {
    if (/(?:^|[\s>+~])\:root(?:$|[\s:.\[#+>~]|:)/.test(` ${part}`) || part === ":root") {
      root = true;
    }
    if (/\[data-theme\s*=\s*(["']?)dark\1\]/.test(part)) {
      dark = true;
    }
    if (/\[data-theme\s*=\s*(["']?)light\1\]/.test(part)) {
      light = true;
    }
  }

  return { root, dark, light };
}

const CUSTOM_PROPERTY_DECL =
  /(?:^|[\s;{])(--[a-zA-Z0-9-_]+)\s*:/g;

/**
 * Collect custom-property declarations grouped by theme applicability.
 */
export function collectThemeCustomPropertyDeclarations(
  css: string,
): ThemeCustomPropertySets {
  const flattened = flattenCssRules(css);
  const sets: ThemeCustomPropertySets = {
    root: new Set(),
    dark: new Set(),
    light: new Set(),
  };

  let remaining = flattened.trim();
  while (remaining.length > 0) {
    const brace = remaining.indexOf("{");
    if (brace === -1) break;

    const selectorList = remaining.slice(0, brace).trim();
    const block = extractBraceBlock(remaining.slice(brace));
    if (!block) break;

    // Skip nested leftover at-rules that weren't flattened.
    if (!selectorList.startsWith("@")) {
      const scope = classifySelector(selectorList);
      // Only attribute declarations that live under a theme/:root selector —
      // component rules may set local overrides, but theme contracts live on
      // :root / [data-theme].
      if (scope.root || scope.dark || scope.light) {
        CUSTOM_PROPERTY_DECL.lastIndex = 0;
        for (const match of block.inner.matchAll(CUSTOM_PROPERTY_DECL)) {
          const property = match[1];
          if (!property) continue;
          if (scope.root) sets.root.add(property);
          if (scope.dark) sets.dark.add(property);
          if (scope.light) sets.light.add(property);
        }
      }
    }

    remaining = remaining.slice(brace + block.fullLength).trim();
  }

  return sets;
}

export interface CssVarReference {
  property: string;
  /** True when var() supplies a fallback, e.g. next/font injected tokens. */
  hasFallback: boolean;
}

/**
 * Collect var(--token) references. Nested fallbacks are detected by a comma
 * at depth 0 inside the var() argument list.
 */
export function collectCssVarReferences(css: string): CssVarReference[] {
  const flattened = flattenCssRules(css);
  const refs: CssVarReference[] = [];
  const pattern = /var\s*\(/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(flattened)) !== null) {
    const start = match.index + match[0].length;
    let depth = 1;
    let i = start;
    let commaAtDepth1 = false;

    for (; i < flattened.length; i++) {
      const ch = flattened[i];
      if (ch === "(") depth++;
      else if (ch === ")") {
        depth--;
        if (depth === 0) break;
      } else if (ch === "," && depth === 1) {
        commaAtDepth1 = true;
      }
    }

    const args = flattened.slice(start, i);
    const nameMatch = args.match(/^\s*(--[a-zA-Z0-9-_]+)/);
    if (nameMatch?.[1]) {
      refs.push({ property: nameMatch[1], hasFallback: commaAtDepth1 });
    }

    pattern.lastIndex = i + 1;
  }

  return refs;
}

function availableForTheme(
  sets: ThemeCustomPropertySets,
  theme: ThemeId,
): Set<string> {
  const available = new Set(sets.root);
  for (const property of sets[theme]) {
    available.add(property);
  }
  return available;
}

/**
 * Find custom properties referenced without a fallback that are missing from
 * one or more themes.
 */
export function findUndeclaredCssCustomProperties(
  css: string,
): UndeclaredCssCustomProperty[] {
  const declarations = collectThemeCustomPropertyDeclarations(css);
  const byTheme = {
    dark: availableForTheme(declarations, "dark"),
    light: availableForTheme(declarations, "light"),
  };

  const missing = new Map<string, Set<ThemeId>>();

  for (const ref of collectCssVarReferences(css)) {
    if (ref.hasFallback) continue;

    const absentThemes = THEMES.filter(
      (theme) => !byTheme[theme].has(ref.property),
    );
    if (absentThemes.length === 0) continue;

    const themes = missing.get(ref.property) ?? new Set<ThemeId>();
    for (const theme of absentThemes) {
      themes.add(theme);
    }
    missing.set(ref.property, themes);
  }

  return [...missing.entries()]
    .map(([property, themes]) => ({
      property,
      themes: THEMES.filter((theme) => themes.has(theme)),
    }))
    .sort((a, b) => a.property.localeCompare(b.property));
}

export function assertCssCustomPropertiesDeclared(
  css: string,
  sourceLabel = "stylesheet",
): void {
  const undeclared = findUndeclaredCssCustomProperties(css);
  if (undeclared.length === 0) return;

  const details = undeclared
    .map(({ property, themes }) => `${property} (missing for ${themes.join(", ")})`)
    .join("; ");

  throw new Error(
    `Undeclared CSS custom properties in ${sourceLabel}: ${details}`,
  );
}

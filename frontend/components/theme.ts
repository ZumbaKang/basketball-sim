export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "tipoff-theme";
export const DEFAULT_THEME: Theme = "dark";

export function isTheme(value: unknown): value is Theme {
  return value === "dark" || value === "light";
}

/** Stored choice wins; otherwise follow the OS, otherwise the broadcast-dark default. */
export function resolveInitialTheme(stored: unknown, prefersLight: boolean): Theme {
  if (isTheme(stored)) return stored;
  return prefersLight ? "light" : DEFAULT_THEME;
}

export function nextTheme(current: Theme): Theme {
  return current === "dark" ? "light" : "dark";
}

export function themeToggleLabel(current: Theme): string {
  return current === "dark" ? "Switch to light theme" : "Switch to dark theme";
}

/**
 * Runs before paint in a blocking inline script so the first frame already has
 * the right palette instead of flashing dark then repainting light.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem("${THEME_STORAGE_KEY}");var l=window.matchMedia("(prefers-color-scheme: light)").matches;var t=s==="dark"||s==="light"?s:(l?"light":"${DEFAULT_THEME}");document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","${DEFAULT_THEME}");}})();`;

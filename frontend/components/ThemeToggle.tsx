"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_THEME,
  nextTheme,
  resolveInitialTheme,
  THEME_STORAGE_KEY,
  themeToggleLabel,
  type Theme,
} from "./theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    setTheme(resolveInitialTheme(stored, prefersLight));
  }, []);

  function toggle() {
    const updated = nextTheme(theme);
    setTheme(updated);
    document.documentElement.setAttribute("data-theme", updated);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, updated);
    } catch {
      // Private-mode storage failures shouldn't break the toggle.
    }
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={themeToggleLabel(theme)}
      title={themeToggleLabel(theme)}
    >
      {theme === "dark" ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}

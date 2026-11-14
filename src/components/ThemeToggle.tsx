import { useState } from "react";

type Theme = "light" | "dark";
const STORAGE_KEY = "northwind-theme";

function readStoredTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function setTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage can be blocked. The theme still applies for this visit.
  }
}

/** Light theme by default (SPEC.md section 9). */
export function applyInitialTheme() {
  document.documentElement.classList.toggle("dark", readStoredTheme() === "dark");
}

export default function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);
  const next: Theme = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => {
        setTheme(next);
        setThemeState(next);
      }}
      aria-label={`Switch to ${next} theme`}
      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
    >
      {theme === "dark" ? "Light theme" : "Dark theme"}
    </button>
  );
}

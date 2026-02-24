import { useState, useEffect, useCallback } from "react";
import type { ThemePreference } from "../types.ts";
import { THEME_KEY } from "../constants.ts";

function loadThemePreference(): ThemePreference {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return "system";
}

function applyTheme(theme: "light" | "dark") {
  document.documentElement.dataset.theme = theme;
}

export function useTheme() {
  const [themePreference, setThemePreferenceState] =
    useState<ThemePreference>(loadThemePreference);

  useEffect(() => {
    if (themePreference === "light" || themePreference === "dark") {
      applyTheme(themePreference);
      return;
    }

    // "system" — detect and listen
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    applyTheme(mq.matches ? "dark" : "light");

    const onChange = (e: MediaQueryListEvent) => {
      applyTheme(e.matches ? "dark" : "light");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [themePreference]);

  const setThemePreference = useCallback((pref: ThemePreference) => {
    localStorage.setItem(THEME_KEY, pref);
    setThemePreferenceState(pref);
  }, []);

  return { themePreference, setThemePreference };
}

"use client";

import { create } from "zustand";
import {
  THEME_DEFAULT,
  THEME_STORAGE_KEY,
  applyResolvedTheme,
  isThemePreference,
  resolveTheme,
  type ResolvedTheme,
  type ThemePreference,
} from "@/lib/theme";

interface ThemeState {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
  /** Re-read OS preference when preference is `system`. */
  syncResolved: () => void;
  hydrate: () => void;
}

function persistPreference(preference: ThemePreference) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    /* ignore quota / private mode */
  }
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  preference: THEME_DEFAULT,
  resolved: "dark",
  setPreference: (preference) => {
    persistPreference(preference);
    const resolved = resolveTheme(preference);
    applyResolvedTheme(resolved);
    set({ preference, resolved });
  },
  syncResolved: () => {
    const { preference } = get();
    const resolved = resolveTheme(preference);
    applyResolvedTheme(resolved);
    set({ resolved });
  },
  hydrate: () => {
    let preference = THEME_DEFAULT;
    try {
      const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (isThemePreference(raw)) preference = raw;
    } catch {
      /* ignore */
    }
    const resolved = resolveTheme(preference);
    applyResolvedTheme(resolved);
    set({ preference, resolved });
  },
}));

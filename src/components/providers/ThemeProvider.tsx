"use client";

import { useEffect } from "react";
import { useThemeStore } from "@/store/themeStore";

/**
 * Hydrates theme preference from localStorage and keeps `system` in sync with OS.
 * FOUC is handled by the inline script in root layout.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const hydrate = useThemeStore((s) => s.hydrate);
  const preference = useThemeStore((s) => s.preference);
  const syncResolved = useThemeStore((s) => s.syncResolved);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (preference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => syncResolved();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preference, syncResolved]);

  return children;
}

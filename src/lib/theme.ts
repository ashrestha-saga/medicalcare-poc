export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "devicecare.theme";
export const THEME_DEFAULT: ThemePreference = "dark";

export const THEME_OPTIONS: {
  value: ThemePreference;
  label: string;
  hint: string;
}[] = [
  { value: "system", label: "System", hint: "Match the device" },
  { value: "light", label: "Light", hint: "Clinical mist" },
  { value: "dark", label: "Dark", hint: "Navy DeviceCare" },
];

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

export function readStoredThemePreference(): ThemePreference {
  if (typeof window === "undefined") return THEME_DEFAULT;
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(raw) ? raw : THEME_DEFAULT;
  } catch {
    return THEME_DEFAULT;
  }
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference !== "system") return preference;
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Apply resolved theme to <html> (and optional theme-color meta). */
export function applyResolvedTheme(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;

  const color = resolved === "dark" ? "#0A1628" : "#D5DEE8";
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", color);
}

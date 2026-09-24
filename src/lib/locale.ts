export const LOCALES = ["en", "de"] as const;
export type AppLocale = (typeof LOCALES)[number];

export const LOCALE_COOKIE = "devicecare.locale";
export const LOCALE_DEFAULT: AppLocale = "en";

export const LOCALE_OPTIONS: {
  value: AppLocale;
  labelKey: "english" | "german";
  hintKey: "englishHint" | "germanHint";
}[] = [
  { value: "en", labelKey: "english", hintKey: "englishHint" },
  { value: "de", labelKey: "german", hintKey: "germanHint" },
];

export function isAppLocale(value: unknown): value is AppLocale {
  return value === "en" || value === "de";
}

/** BCP 47 tag for Intl formatters. */
export function intlLocale(locale: AppLocale): string {
  return locale === "de" ? "de-DE" : "en-GB";
}

export function readLocaleCookie(raw: string | undefined | null): AppLocale {
  return isAppLocale(raw) ? raw : LOCALE_DEFAULT;
}

/** Persist locale for SSR (next-intl request config) and set document lang. */
export function persistLocale(locale: AppLocale) {
  if (typeof document === "undefined") return;
  document.cookie = `${LOCALE_COOKIE}=${locale};path=/;max-age=31536000;SameSite=Lax`;
  document.documentElement.lang = locale;
}

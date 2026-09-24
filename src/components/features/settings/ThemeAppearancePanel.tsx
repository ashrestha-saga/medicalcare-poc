"use client";

import { useThemeStore } from "@/store/themeStore";
import type { ThemePreference } from "@/lib/theme";
import { useTranslations } from "next-intl";

const THEME_VALUES: ThemePreference[] = ["system", "light", "dark"];

/** Appearance segmented control for Settings. */
export function ThemeAppearancePanel() {
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);
  const t = useTranslations("theme");

  return (
    <section className="p-settings__panel" data-testid="settings-appearance">
      <p className="p-sec-title">{t("title")}</p>
      <p className="p-settings__intro">{t("intro")}</p>
      <div className="p-settings__theme" role="radiogroup" aria-label={t("aria")}>
        {THEME_VALUES.map((value) => {
          const active = preference === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              className="p-settings__theme-btn"
              data-active={active ? "1" : "0"}
              data-testid={`theme-${value}`}
              onClick={() => setPreference(value)}
            >
              <span className="p-settings__theme-label">{t(value)}</span>
              <span className="p-settings__theme-hint">{t(`${value}Hint`)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

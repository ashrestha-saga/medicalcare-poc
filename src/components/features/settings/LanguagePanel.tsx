"use client";

import { useTranslations } from "next-intl";
import { useLocaleSwitch } from "@/components/providers/LocaleProvider";
import { LOCALE_OPTIONS } from "@/lib/locale";

/** Language segmented control for Settings — swaps messages without a full reload. */
export function LanguagePanel() {
  const t = useTranslations("language");
  const { locale, setLocale, pending } = useLocaleSwitch();

  return (
    <section className="p-settings__panel" data-testid="settings-language">
      <p className="p-sec-title">{t("title")}</p>
      <p className="p-settings__intro">{t("intro")}</p>
      <div className="p-settings__theme" role="radiogroup" aria-label={t("aria")}>
        {LOCALE_OPTIONS.map((opt) => {
          const active = locale === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              className="p-settings__theme-btn"
              data-active={active ? "1" : "0"}
              data-testid={`locale-${opt.value}`}
              disabled={pending}
              onClick={() => {
                if (opt.value === locale) return;
                void setLocale(opt.value);
              }}
            >
              <span className="p-settings__theme-label">{t(opt.labelKey)}</span>
              <span className="p-settings__theme-hint">{t(opt.hintKey)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

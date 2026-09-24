"use client";

import { useTranslations } from "next-intl";
import { useLocaleSwitch } from "@/components/providers/LocaleProvider";
import { LOCALES, type AppLocale } from "@/lib/locale";

/** Compact EN | DE switch for the account / status bar — no full reload. */
export function LocaleToggle({ className }: { className?: string }) {
  const t = useTranslations("language");
  const { locale, setLocale, pending } = useLocaleSwitch();

  return (
    <div
      className={["p-locale-toggle", className].filter(Boolean).join(" ")}
      role="group"
      aria-label={t("aria")}
      data-testid="locale-toggle"
    >
      {LOCALES.map((code) => {
        const active = locale === code;
        return (
          <button
            key={code}
            type="button"
            className="p-locale-toggle__btn"
            data-active={active ? "1" : "0"}
            data-testid={`locale-toggle-${code}`}
            aria-pressed={active}
            disabled={pending}
            title={code === "en" ? t("english") : t("german")}
            onClick={() => {
              if (code === locale) return;
              void setLocale(code as AppLocale);
            }}
          >
            {code.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}

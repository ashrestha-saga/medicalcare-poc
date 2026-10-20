"use client";

import { useTranslations } from "next-intl";

export type ScanTabId = "scan" | "heute" | "bestand" | "chargen";

type TabDef = { id: ScanTabId; badge?: number };

export function ScanTabBar({
  tabs,
  active,
  onChange,
  variant = "bottom",
}: {
  tabs: TabDef[];
  active: ScanTabId;
  onChange: (id: ScanTabId) => void;
  /** `bottom` = phone/tablet bar; `top` = desktop account-bar chips (same as other `.k` tabs). */
  variant?: "bottom" | "top";
}) {
  const t = useTranslations("scan.tabs");
  const isTop = variant === "top";

  return (
    <nav
      className={isTop ? "p-scan-tabs-top" : "p-scan-tabs"}
      aria-label={t("aria")}
      data-testid={isTop ? "scan-tab-bar-top" : "scan-tab-bar"}
    >
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            className={
              isTop
                ? ["k", "p-scan-tabs-top__btn", selected ? "is-active" : ""].filter(Boolean).join(" ")
                : ["p-scan-tabs__btn", selected ? "is-active" : ""].filter(Boolean).join(" ")
            }
            aria-current={selected ? "page" : undefined}
            data-testid={`scan-tab-${tab.id}`}
            onClick={() => onChange(tab.id)}
          >
            <span>{t(tab.id)}</span>
            {typeof tab.badge === "number" && tab.badge > 0 ? (
              <span
                className={isTop ? "p-acctbar__inventory-count" : "p-scan-tabs__badge"}
                aria-label={t("badge", { count: tab.badge })}
              >
                {tab.badge > 99 ? "99+" : tab.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}

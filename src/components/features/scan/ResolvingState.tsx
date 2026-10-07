"use client";

import { useTranslations } from "next-intl";

export function ResolvingState() {
  const t = useTranslations("scan");
  return (
    <div className="p-wait" data-testid="resolving-state">
      <strong>{t("identifying")}</strong>
      <p>{t("identifyingHint")}</p>
    </div>
  );
}

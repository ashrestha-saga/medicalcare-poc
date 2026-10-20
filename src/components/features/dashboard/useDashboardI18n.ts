"use client";

import { useLocale, useTranslations } from "next-intl";
import type { DashboardTileDTO } from "@/interfaces";

export function useDashboardI18n() {
  const t = useTranslations("pages.dashboard");
  const locale = useLocale();

  function formatDate(iso: string): string {
    const d = new Date(iso.slice(0, 10) + "T00:00:00Z");
    return new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "UTC",
    }).format(d);
  }

  function tileTitle(tile: Pick<DashboardTileDTO, "key" | "title">): string {
    const key = `tiles.${tile.key}.title` as const;
    return t.has(key) ? t(key) : tile.title;
  }

  function tileQuestion(tile: Pick<DashboardTileDTO, "key" | "question">): string {
    const key = `tiles.${tile.key}.question` as const;
    return t.has(key) ? t(key) : tile.question;
  }

  function roleLabel(role: string): string {
    const key = `roles.${role}` as const;
    return t.has(key) ? t(key) : role;
  }

  return { t, locale, formatDate, tileTitle, tileQuestion, roleLabel };
}

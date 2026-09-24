"use client";

import { useTranslations } from "next-intl";
import { useDueDatesList } from "@/components/hooks/due-dates/useDueDatesList";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { DueDatesSummary } from "./DueDatesSummary";
import { DueDatesTable } from "./due-dates-table";

/** Tenant-wide board of frozen duty due dates — gated by duties:view. */
export function DueDatesScreen() {
  const t = useTranslations("pages.dueDates");
  const tCommon = useTranslations("common");
  const list = useDueDatesList();

  if (!list.canView) {
    return (
      <div className="p-work" data-testid="due-dates-denied">
        <main className="p-main">
          <ListPageShell title={t("title")} description={t("denied")}>
            <p className="text-sm text-muted-foreground">{tCommon("contactAdmin")}</p>
          </ListPageShell>
        </main>
      </div>
    );
  }

  return (
    <div className="p-work" data-testid="due-dates-page">
      <main className="p-main">
        <ListPageShell
          title={t("title")}
          description={t("description")}
          headerExtra={
            <DueDatesSummary summary={list.summary} filter={list.filter} onFilter={list.setFilter} />
          }
        >
          <div className="space-y-4">
            <DueDatesTable list={list} />
            <div className="rounded-md border-l-4 border-primary/50 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{t("hintTitle")} </span>
              {t("hintBody")}
            </div>
          </div>
        </ListPageShell>
      </main>
    </div>
  );
}

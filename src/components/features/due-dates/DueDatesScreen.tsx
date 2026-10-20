"use client";

import { useTranslations } from "next-intl";
import { useDueDatesList } from "@/components/hooks/due-dates/useDueDatesList";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { Button } from "@/components/ui/button";
import { DueDatesFilterToolbar } from "./DueDatesFilterToolbar";
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
            <DueDatesFilterToolbar
              dutyKey={list.dutyKey}
              onDutyKeyChange={list.setDutyKey}
              horizon={list.horizon}
              onHorizonChange={list.setHorizon}
              confidence={list.confidence}
              onConfidenceChange={list.setConfidence}
              scheduled={list.scheduled}
              onClearAll={list.clearExtraFilters}
            />
            <DueDatesTable list={list} />
            {list.hasMore || list.totalMatching > list.rows.length ? (
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                <span>
                  {t("showingCount", {
                    shown: list.rows.length,
                    total: list.totalMatching,
                  })}
                </span>
                {list.hasMore ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void list.loadMore()}
                    disabled={list.loading || list.loadingMore}
                    data-testid="due-dates-load-more"
                  >
                    {t("loadMore")}
                  </Button>
                ) : null}
              </div>
            ) : null}
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

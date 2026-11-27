"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/features/shared/EmptyState";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { PageLoading } from "@/components/features/shared/PageLoading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRoutinesToday } from "@/components/hooks/routines/useRoutinesToday";

/** /routines — open IFU function checks today (E105 tile destination). */
export function RoutinesTodayScreen() {
  const t = useTranslations("routinesToday");
  const { items, loading, disabled, refresh } = useRoutinesToday();

  if (disabled) {
    return (
      <ListPageShell title={t("title")} description={t("disabled")} testId="routines-today-disabled">
        <EmptyState>{t("disabled")}</EmptyState>
      </ListPageShell>
    );
  }

  return (
    <ListPageShell
      title={t("title")}
      description={t("description")}
      testId="routines-today-screen"
      headerExtra={
        <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => void refresh()}>
          {t("refresh")}
        </Button>
      }
    >
      {loading && items.length === 0 ? (
        <PageLoading label={t("loading")} />
      ) : items.length === 0 ? (
        <EmptyState testId="routines-today-empty">{t("empty")}</EmptyState>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border" data-testid="routines-today-list">
          {items.map((row) => (
            <li
              key={`${row.deviceInstanceId}-${row.checkCode}`}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {row.inventoryNumber}
                  <span className="text-muted-foreground"> · {row.deviceName}</span>
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">{row.checkLabel}</p>
                <Badge variant="secondary" className="mt-1.5 uppercase">
                  {row.cadence}
                </Badge>
              </div>
              <Button asChild size="sm" className="h-8 shrink-0">
                <Link
                  href={`/devices?id=${encodeURIComponent(row.deviceInstanceId)}`}
                  data-testid={`routines-today-open-${row.inventoryNumber}`}
                >
                  {t("openDevice")}
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </ListPageShell>
  );
}

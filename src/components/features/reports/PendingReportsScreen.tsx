"use client";

import Link from "next/link";
import { FileText, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/features/shared/EmptyState";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { PageLoading } from "@/components/features/shared/PageLoading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePendingReports } from "@/components/hooks/reports/usePendingReports";
import { usePermissions } from "@/lib/providers/PermissionProvider";

/** /reports/pending — sealed reports awaiting clinic acknowledgement (E106). */
export function PendingReportsScreen() {
  const t = useTranslations("reportsPending");
  const { checkPermission } = usePermissions();
  const canAcknowledge = checkPermission("requests:approve");
  const { reports, loading, busyId, refresh, acknowledge } = usePendingReports();

  const resultLabel = (result: string) => {
    if (result === "passed" || result === "passed_with_conditions") return t("passed");
    if (result === "failed") return t("failed");
    return result;
  };

  return (
    <ListPageShell
      title={t("title")}
      description={t("description")}
      testId="reports-pending-screen"
      headerExtra={
        <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => void refresh()}>
          {t("refresh")}
        </Button>
      }
    >
      {loading && reports.length === 0 ? (
        <PageLoading label={t("loading")} />
      ) : reports.length === 0 ? (
        <EmptyState testId="reports-pending-empty">{t("empty")}</EmptyState>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border" data-testid="reports-pending-list">
          {reports.map((r) => (
            <li
              key={r.performanceId}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              data-testid="reports-pending-row"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {r.inventoryNumber}
                  {r.deviceName ? (
                    <span className="text-muted-foreground"> · {r.deviceName}</span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {r.catalogueLabel ?? r.dutyTitle} · {r.performedAt} · {r.performedBy} ·{" "}
                  {resultLabel(r.result)}
                </p>
                <Badge variant="secondary" className="mt-1.5">
                  {r.source}
                </Badge>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {r.reportUrl ? (
                  <Button asChild type="button" variant="ghost" size="sm" className="h-8">
                    <a href={r.reportUrl} target="_blank" rel="noreferrer">
                      <FileText className="h-4 w-4" />
                    </a>
                  </Button>
                ) : null}
                <Button asChild type="button" variant="outline" size="sm" className="h-8">
                  <Link
                    href={`/devices?id=${encodeURIComponent(r.deviceInstanceId)}&focus=reports`}
                  >
                    {t("openDevice")}
                  </Link>
                </Button>
                {canAcknowledge && r.runId ? (
                  <Button
                    type="button"
                    size="sm"
                    className="h-8"
                    disabled={busyId === r.performanceId}
                    onClick={() => void acknowledge(r.performanceId)}
                    data-testid={`reports-pending-ack-${r.performanceId}`}
                  >
                    {busyId === r.performanceId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    {t("confirm")}
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </ListPageShell>
  );
}

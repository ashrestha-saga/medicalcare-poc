"use client";

import { useLocale, useTranslations } from "next-intl";
import { Download, FileText, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDeviceReports } from "@/components/hooks/devices/useDeviceReports";
import { formatDate } from "@/lib/format";
import type { AppLocale } from "@/lib/locale";
import { usePermissions } from "@/lib/providers/PermissionProvider";

/** E106 — sealed inspection reports of a device; acknowledge (requests:approve) + dossier ZIP (export:dossier). */
export function DeviceReportsCard({ deviceId }: { deviceId: string }) {
  const t = useTranslations("inventoryDetail");
  const locale = useLocale() as AppLocale;
  const { checkPermission } = usePermissions();
  const canAcknowledge = checkPermission("requests:approve");
  const canDossier = checkPermission("export:dossier");
  const { reports, unacknowledgedCount, loading, busyId, dossierBusy, acknowledge, downloadDossier } =
    useDeviceReports(deviceId);

  if (loading && reports.length === 0) {
    return (
      <div
        className="mt-4 rounded-md border border-border p-4 text-sm text-muted-foreground"
        data-testid="device-reports-card"
      >
        <Loader2 className="inline h-4 w-4 animate-spin" /> {t("reportsLoading")}
      </div>
    );
  }
  if (reports.length === 0 && !canDossier) return null;

  const resultLabel = (result: string) => {
    switch (result) {
      case "passed":
        return t("markDoneResultPassed");
      case "passed_with_conditions":
        return t("markDoneResultConditions");
      case "failed":
        return t("markDoneResultFailed");
      default:
        return result;
    }
  };

  return (
    <section className="mt-4 rounded-md border border-border bg-card/40" data-testid="device-reports-card">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{t("reportsTitle")}</h3>
          <p className="text-xs text-muted-foreground">
            {unacknowledgedCount > 0
              ? t("reportsUnacknowledged", { count: unacknowledgedCount })
              : t("reportsHint")}
          </p>
        </div>
        {canDossier ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            disabled={dossierBusy}
            onClick={() => void downloadDossier()}
            data-testid="device-dossier-export"
          >
            {dossierBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {t("reportsDossier")}
          </Button>
        ) : null}
      </div>
      {reports.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">{t("reportsEmpty")}</p>
      ) : (
        <ul className="divide-y divide-border">
          {reports.map((r) => (
            <li
              key={r.performanceId}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
              data-testid="device-report-row"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">
                  {r.catalogueLabel ?? r.dutyTitle ?? t("reportsUntitled")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(r.performedAt, locale)} · {r.performedBy} · {resultLabel(r.result)}
                  {r.source === "external" ? ` · ${t("reportsExternal")}` : ""}
                </p>
                {r.acknowledged ? (
                  <p className="text-xs text-muted-foreground">
                    {t("reportsAcknowledgedBy", {
                      name: r.acknowledgedBy ?? "",
                      date: formatDate(r.acknowledgedAt, locale),
                    })}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                {r.runId && !r.acknowledged ? (
                  <Badge variant="secondary">{t("reportsOpen")}</Badge>
                ) : null}
                {r.reportUrl ? (
                  <Button asChild type="button" variant="ghost" size="sm" className="h-8">
                    <a href={r.reportUrl} target="_blank" rel="noreferrer" data-testid="device-report-open">
                      <FileText className="h-4 w-4" />
                      {t("reportsOpenPdf")}
                    </a>
                  </Button>
                ) : null}
                {canAcknowledge && r.runId && !r.acknowledged ? (
                  <Button
                    type="button"
                    size="sm"
                    className="h-8"
                    disabled={busyId === r.performanceId}
                    onClick={() => void acknowledge(r.performanceId)}
                    data-testid={`device-report-ack-${r.performanceId}`}
                  >
                    {busyId === r.performanceId ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {t("reportsAcknowledge")}
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

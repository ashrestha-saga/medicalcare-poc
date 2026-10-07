"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { DeviceDutyDTO, DeviceInstanceDetailDTO } from "@/interfaces";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import type { AppLocale } from "@/lib/locale";

function anchorLabelKey(
  anchor: string,
):
  | "anchorExactDay"
  | "anchorMonthEnd"
  | "anchorYearEnd"
  | "anchorEvent"
  | "anchorInterval"
  | "anchorProcess"
  | "anchorPermanent"
  | null {
  switch (anchor) {
    case "exact_day":
      return "anchorExactDay";
    case "month_end":
      return "anchorMonthEnd";
    case "year_end":
      return "anchorYearEnd";
    case "event":
      return "anchorEvent";
    case "interval":
      return "anchorInterval";
    case "process":
      return "anchorProcess";
    case "permanent":
      return "anchorPermanent";
    default:
      return null;
  }
}

function statusTone(status: DeviceDutyDTO["status"]): string {
  if (status === "overdue") return "text-destructive";
  if (status === "due") return "text-amber-700 dark:text-amber-400";
  if (status === "n/a") return "text-muted-foreground";
  return "text-foreground";
}

interface DeviceDutiesPanelProps {
  device: DeviceInstanceDetailDTO;
  canComplete?: boolean;
  completingId?: string | null;
  onComplete?: (dutyId: string) => void;
}

export function DeviceDutiesPanel({
  device,
  canComplete,
  completingId,
  onComplete,
}: DeviceDutiesPanelProps) {
  const t = useTranslations("inventoryDetail");
  const tCommon = useTranslations("common");
  const locale = useLocale() as AppLocale;
  const [showNotApplicable, setShowNotApplicable] = useState(false);
  const duties = device.duties ?? [];
  const applicable = duties.filter((d) => d.applicable);
  const notApplicable = duties.filter((d) => !d.applicable);
  const rows = showNotApplicable ? duties : applicable;
  const dash = tCommon("dash");

  const translateAnchor = (anchor: string): string => {
    const key = anchorLabelKey(anchor);
    return key ? t(key) : anchor;
  };

  const intervalLabel = (duty: DeviceDutyDTO): string => {
    if (duty.intervalValue != null && duty.intervalUnit) {
      const unit = duty.intervalUnit === "years" ? t("years") : t("monthsUnit");
      return `${duty.intervalValue} ${unit}`;
    }
    return duty.cadenceLabel ?? translateAnchor(duty.deadlineAnchor);
  };

  const dutyStatusLabel = (status: DeviceDutyDTO["status"]): string => {
    switch (status) {
      case "overdue":
        return t("dutyStatusOverdue");
      case "due":
        return t("dutyStatusDue");
      case "ok":
        return t("dutyStatusOk");
      case "unset":
        return t("dutyStatusUnset");
      case "n/a":
        return t("dutyStatusNa");
      default:
        return status;
    }
  };

  return (
    <section className="mt-4 rounded-md border border-border bg-card/40" data-testid="device-duties">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{t("duties")}</h3>
          <p className="text-xs text-muted-foreground">
            {t("nextObligation", {
              date: device.nextObligationDueAt ? formatDate(device.nextObligationDueAt, locale) : dash,
            })}
            {" · "}
            {t("maintenanceDueShort", {
              date: formatDate(device.nextMaintenanceDueAt, locale),
            })}
          </p>
        </div>
        {notApplicable.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => setShowNotApplicable((v) => !v)}
          >
            {showNotApplicable
              ? t("hideNotApplicable")
              : t("showNotApplicable", { count: notApplicable.length })}
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">{t("noDuties")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                <th className="px-4 py-2 font-semibold">{t("colDuty")}</th>
                <th className="px-4 py-2 font-semibold">{t("colCycle")}</th>
                <th className="px-4 py-2 font-semibold">{t("colDue")}</th>
                <th className="px-4 py-2 font-semibold">{t("colLastDone")}</th>
                {canComplete ? <th className="px-4 py-2 font-semibold" /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((duty) => (
                <tr key={duty.id} className="border-b border-border last:border-0" data-testid="device-duty-row">
                  <td className="px-4 py-3 align-top">
                    <p className="font-medium text-foreground">{duty.title}</p>
                    <p className="text-xs text-muted-foreground">{duty.basisText}</p>
                  </td>
                  <td className="px-4 py-3 align-top text-muted-foreground">
                    {intervalLabel(duty)}
                    {duty.dueAt ? ` · ${translateAnchor(duty.deadlineAnchor)}` : ""}
                  </td>
                  <td className={`px-4 py-3 align-top ${statusTone(duty.status)}`}>
                    {duty.dueAt ? formatDate(duty.dueAt, locale) : dash}
                    {duty.status !== "ok" && duty.status !== "unset" ? (
                      <Badge variant="secondary" className="ml-2 uppercase">
                        {dutyStatusLabel(duty.status)}
                      </Badge>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 align-top text-muted-foreground">
                    {formatDate(duty.lastCompletedAt, locale)}
                  </td>
                  {canComplete ? (
                    <td className="px-4 py-3 align-top text-right">
                      {duty.applicable ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8"
                          disabled={Boolean(completingId)}
                          onClick={() => onComplete?.(duty.id)}
                          data-testid={`device-duty-complete-${duty.dutyKey}`}
                        >
                          {completingId === duty.id && <Loader2 className="h-4 w-4 animate-spin" />}
                          {t("markDone")}
                        </Button>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

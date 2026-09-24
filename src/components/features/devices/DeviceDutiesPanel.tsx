"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { DeviceDutyDTO, DeviceInstanceDetailDTO } from "@/interfaces";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function intervalLabel(duty: DeviceDutyDTO): string {
  if (duty.intervalValue != null && duty.intervalUnit) {
    const unit = duty.intervalUnit === "years" ? "years" : "months";
    return `${duty.intervalValue} ${unit}`;
  }
  return duty.cadenceLabel ?? anchorLabel(duty.deadlineAnchor);
}

function anchorLabel(anchor: string): string {
  switch (anchor) {
    case "exact_day":
      return "exact day";
    case "month_end":
      return "end of month";
    case "year_end":
      return "end of year";
    case "event":
      return "event";
    case "interval":
      return "interval";
    case "process":
      return "process";
    case "permanent":
      return "ongoing";
    default:
      return anchor;
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
  const [showNotApplicable, setShowNotApplicable] = useState(false);
  const duties = device.duties ?? [];
  const applicable = duties.filter((d) => d.applicable);
  const notApplicable = duties.filter((d) => !d.applicable);
  const rows = showNotApplicable ? duties : applicable;

  return (
    <section className="mt-4 rounded-md border border-border bg-card/40" data-testid="device-duties">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Duties</h3>
          <p className="text-xs text-muted-foreground">
            Next obligation{" "}
            {device.nextObligationDueAt ? formatDate(device.nextObligationDueAt) : "—"}
            {" · "}
            Maintenance {formatDate(device.nextMaintenanceDueAt)}
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
            {showNotApplicable ? "Hide not applicable" : `Show not applicable (${notApplicable.length})`}
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">
          No frozen duties yet. Complete initial registration or reclassify the model.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                <th className="px-4 py-2 font-semibold">Duty</th>
                <th className="px-4 py-2 font-semibold">Cycle</th>
                <th className="px-4 py-2 font-semibold">Due</th>
                <th className="px-4 py-2 font-semibold">Last done</th>
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
                    {duty.dueAt ? ` · ${anchorLabel(duty.deadlineAnchor)}` : ""}
                  </td>
                  <td className={`px-4 py-3 align-top ${statusTone(duty.status)}`}>
                    {duty.dueAt ? formatDate(duty.dueAt) : "—"}
                    {duty.status !== "ok" && duty.status !== "unset" ? (
                      <Badge variant="secondary" className="ml-2 uppercase">
                        {duty.status}
                      </Badge>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 align-top text-muted-foreground">{formatDate(duty.lastCompletedAt)}</td>
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
                          Mark done
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

"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDeviceRoutines } from "@/components/hooks/devices/useDeviceRoutines";

/** E105 — device detail card for IFU function checks (one-tap pass). */
export function DeviceRoutineCard({ deviceId }: { deviceId: string }) {
  const t = useTranslations("inventoryDetail");
  const { definitions, checks, loading, busyCode, capturePass } = useDeviceRoutines(deviceId);

  if (loading && !definitions.length) {
    return (
      <div className="rounded-md border border-border p-4 text-sm text-muted-foreground" data-testid="device-routine-card">
        <Loader2 className="inline h-4 w-4 animate-spin" /> {t("routinesLoading")}
      </div>
    );
  }

  if (!definitions.length) return null;

  const recent = checks.slice(0, 7);

  return (
    <div className="rounded-md border border-border bg-card/40 p-4 space-y-3" data-testid="device-routine-card">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{t("routinesTitle")}</h3>
        <p className="text-xs text-muted-foreground">{t("routinesHint")}</p>
      </div>
      <ul className="space-y-2">
        {definitions.map((d) => (
          <li key={d.code} className="flex items-center justify-between gap-2 text-sm">
            <div className="min-w-0">
              <p className="font-medium truncate">{d.label}</p>
              <p className="text-xs text-muted-foreground">
                {d.cadence}
                {d.isReference ? ` · ${t("routinesReference")}` : ""}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busyCode === d.code}
              onClick={() => void capturePass(d.code)}
              data-testid={`routine-pass-${d.code}`}
            >
              {busyCode === d.code ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("routinesPass")}
            </Button>
          </li>
        ))}
      </ul>
      {recent.length ? (
        <div className="border-t border-border pt-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("routinesRecent")}
          </p>
          <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
            {recent.map((c) => (
              <li key={c.id}>
                {c.label}: {c.passed === false ? t("routinesFailed") : t("routinesPassed")} ·{" "}
                {new Date(c.performedAt).toLocaleString()}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <Link
        href="/fault-report"
        className="text-xs text-primary underline-offset-2 hover:underline"
        data-testid="routine-fault-link"
      >
        {t("routinesReportFault")}
      </Link>
    </div>
  );
}

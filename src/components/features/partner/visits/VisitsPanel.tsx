"use client";

import { useTranslations } from "next-intl";
import { usePartnerVisits } from "@/components/hooks/partner/visits/usePartnerVisits";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function VisitsPanel({ embedded = false }: { embedded?: boolean }) {
  const t = useTranslations("console");
  const { rows, error, loading, startVisit } = usePartnerVisits();

  return (
    <div
      className={embedded ? undefined : "px-4 pb-6 pt-4 sm:px-[18px]"}
      data-testid="console-visits"
    >
      {error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {loading ? <p className="text-sm text-muted-foreground">…</p> : null}
      {!loading && rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("visitsEmpty")}</p>
      ) : null}
      <ul className="divide-y divide-border rounded-md border border-border bg-card">
        {rows.map((v) => (
          <li
            key={v.id}
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
          >
            <div className="min-w-0">
              <p className="font-medium text-foreground">{v.tenantName}</p>
              <p className="text-xs text-muted-foreground">
                {v.siteName ?? "—"} · {v.requestCount} {t("visitsOrders")}
                {v.plannedAt ? ` · ${new Date(v.plannedAt).toLocaleString("de-DE")}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {v.startedAt ? (
                <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                  {t("visitsStarted")}
                </span>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void startVisit(v.id, v.tenantId)}
                >
                  {t("visitsStart")}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

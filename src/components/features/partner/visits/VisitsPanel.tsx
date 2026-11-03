"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/http/apiClient";
import type { ServiceVisitDTO } from "@/services/console/serviceVisitService";

export function VisitsPanel({ embedded = false }: { embedded?: boolean }) {
  const t = useTranslations("console");
  const [rows, setRows] = useState<ServiceVisitDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<{ rows: ServiceVisitDTO[] }>("/api/partner/visits");
      setRows(data.rows);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("visitsLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function startVisit(id: string, tenantId: string) {
    try {
      await api("/api/partner/visits", {
        method: "POST",
        body: JSON.stringify({ id, tenantId, startedAt: new Date().toISOString() }),
      });
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("visitsStartFailed"));
    }
  }

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

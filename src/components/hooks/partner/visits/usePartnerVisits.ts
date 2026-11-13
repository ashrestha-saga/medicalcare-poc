"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { ServiceVisitDTO } from "@/interfaces/console";
import { api, ApiError } from "@/lib/http/apiClient";

/** Lists and starts partner console service visits. */
export function usePartnerVisits() {
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

  return { rows, error, loading, refresh, startVisit };
}

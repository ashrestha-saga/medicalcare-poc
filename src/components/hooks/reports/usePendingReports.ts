"use client";

import { useCallback, useEffect, useState } from "react";
import type { PendingReportDTO, PendingReportsDTO } from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { toast } from "@/store/toastStore";

/** Clinic-wide unacknowledged sealed reports (/reports/pending). */
export function usePendingReports() {
  const [reports, setReports] = useState<PendingReportDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<PendingReportsDTO>("/api/reports/pending");
      setReports(res.reports);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not load reports.");
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const acknowledge = useCallback(
    async (performanceId: string) => {
      setBusyId(performanceId);
      try {
        await api(`/api/duties/performances/${performanceId}/acknowledge`, {
          method: "POST",
          body: JSON.stringify({}),
        });
        await refresh();
        return true;
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Could not acknowledge report");
        return false;
      } finally {
        setBusyId(null);
      }
    },
    [refresh],
  );

  return { reports, loading, busyId, refresh, acknowledge };
}

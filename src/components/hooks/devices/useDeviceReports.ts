"use client";

import { useCallback, useEffect, useState } from "react";
import type { DeviceReportDTO, DeviceReportsDTO } from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { toast } from "@/store/toastStore";

/** E106 — sealed reports of one device, acknowledgement and dossier download. */
export function useDeviceReports(deviceId: string | null) {
  const [reports, setReports] = useState<DeviceReportDTO[]>([]);
  const [unacknowledgedCount, setUnacknowledgedCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dossierBusy, setDossierBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!deviceId) return;
    setLoading(true);
    try {
      const res = await api<DeviceReportsDTO>(`/api/devices/${deviceId}/reports`);
      setReports(res.reports);
      setUnacknowledgedCount(res.unacknowledgedCount);
    } catch (err) {
      if (!(err instanceof ApiError && (err.status === 403 || err.status === 404))) {
        toast.error(err instanceof ApiError ? err.message : "Could not load reports");
      }
      setReports([]);
      setUnacknowledgedCount(0);
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch lifecycle
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

  const downloadDossier = useCallback(async () => {
    if (!deviceId) return false;
    setDossierBusy(true);
    try {
      const res = await fetch(`/api/devices/${deviceId}/export/dossier`, { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => undefined)) as
          | { error?: { message?: string } }
          | undefined;
        throw new Error(body?.error?.message ?? `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const name =
        /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ??
        "Geraetemappe.zip";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not export dossier");
      return false;
    } finally {
      setDossierBusy(false);
    }
  }, [deviceId]);

  return {
    reports,
    unacknowledgedCount,
    loading,
    busyId,
    dossierBusy,
    acknowledge,
    downloadDossier,
    refresh,
  };
}

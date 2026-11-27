"use client";

import { useCallback, useEffect, useState } from "react";
import type { RefRoutineCheckDTO, RoutineCheckDTO } from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { toast } from "@/store/toastStore";

export function useDeviceRoutines(deviceId: string | null) {
  const [definitions, setDefinitions] = useState<RefRoutineCheckDTO[]>([]);
  const [checks, setChecks] = useState<RoutineCheckDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyCode, setBusyCode] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!deviceId) return;
    setLoading(true);
    try {
      const res = await api<{ checks: RoutineCheckDTO[]; definitions: RefRoutineCheckDTO[] }>(
        `/api/devices/${deviceId}/routine-checks`,
      );
      setChecks(res.checks);
      setDefinitions(res.definitions);
    } catch (err) {
      // Flag off / permission → empty card
      if (!(err instanceof ApiError && (err.status === 403 || err.status === 404))) {
        toast.error(err instanceof ApiError ? err.message : "Could not load routines");
      }
      setChecks([]);
      setDefinitions([]);
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const capturePass = useCallback(
    async (checkCode: string) => {
      if (!deviceId) return;
      setBusyCode(checkCode);
      try {
        await api(`/api/devices/${deviceId}/routine-checks`, {
          method: "POST",
          body: JSON.stringify({
            checkCode,
            passed: true,
            idempotencyKey: `rc-${deviceId}-${checkCode}-${Date.now()}`,
          }),
        });
        toast.success("Function check recorded");
        await refresh();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Could not record check");
      } finally {
        setBusyCode(null);
      }
    },
    [deviceId, refresh],
  );

  return { definitions, checks, loading, busyCode, capturePass, refresh };
}

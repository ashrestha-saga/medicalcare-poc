"use client";

import { useCallback, useEffect, useState } from "react";
import type { ServiceRequestDTO } from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { toast } from "@/store/toastStore";

/**
 * Allocate / transmit for assignment detail (FA-713/714).
 * Accepted / scheduled / completed come from an external portal later.
 */
export function useRequestTransition(
  request: ServiceRequestDTO,
  onUpdated: (next: ServiceRequestDTO) => void,
) {
  const [busy, setBusy] = useState(false);
  const [executorOrgId, setExecutorOrgId] = useState(request.executorOrgId ?? "");

  useEffect(() => {
    setExecutorOrgId(request.executorOrgId ?? "");
  }, [request.executorOrgId]);

  const canAllocate = !request.allocationLocked;
  const canTransmit = Boolean(request.executorOrgId) && !request.allocationLocked;

  const allocate = useCallback(
    async (nextOrgId: string) => {
      if (!nextOrgId) return;
      setBusy(true);
      try {
        const res = await api<{ request: ServiceRequestDTO }>(
          `/api/service-requests/${encodeURIComponent(request.reference)}/allocate`,
          {
            method: "POST",
            body: JSON.stringify({ executorOrgId: nextOrgId }),
          },
        );
        onUpdated(res.request);
        toast.success("Executor allocated.");
      } catch (e) {
        setExecutorOrgId(request.executorOrgId ?? "");
        toast.error(e instanceof ApiError ? e.message : "Could not allocate.");
      } finally {
        setBusy(false);
      }
    },
    [onUpdated, request.executorOrgId, request.reference],
  );

  const onExecutorChange = useCallback(
    (nextOrgId: string) => {
      setExecutorOrgId(nextOrgId);
      if (nextOrgId && nextOrgId !== request.executorOrgId) {
        void allocate(nextOrgId);
      }
    },
    [allocate, request.executorOrgId],
  );

  const transmit = useCallback(async () => {
    setBusy(true);
    try {
      const res = await api<{ request: ServiceRequestDTO }>(
        `/api/service-requests/${encodeURIComponent(request.reference)}/transmit`,
        { method: "POST", body: JSON.stringify({}) },
      );
      onUpdated(res.request);
      toast.success("Assignment transmitted.");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not transmit.");
    } finally {
      setBusy(false);
    }
  }, [onUpdated, request.reference]);

  return {
    busy,
    executorOrgId,
    onExecutorChange,
    canAllocate,
    canTransmit,
    transmit,
  };
}

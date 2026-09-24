"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExecutorOrgDTO, ServiceRequestDTO } from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { toast } from "@/store/toastStore";
import { useRequestCapabilities } from "./useRequestCapabilities";

/** Loads a single assignment by reference for `/requests/[reference]`. */
export function useAssignmentDetail(reference: string) {
  const { canWork } = useRequestCapabilities();
  const [request, setRequest] = useState<ServiceRequestDTO | null>(null);
  const [executors, setExecutors] = useState<ExecutorOrgDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!reference) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setNotFound(false);
    try {
      const [req, exec] = await Promise.all([
        api<ServiceRequestDTO>(`/api/service-requests/${encodeURIComponent(reference)}`),
        api<{ executors: ExecutorOrgDTO[] }>("/api/service-requests/executors").catch(() => ({
          executors: [] as ExecutorOrgDTO[],
        })),
      ]);
      setRequest(req);
      setExecutors(exec.executors);
    } catch (e) {
      setRequest(null);
      setNotFound(true);
      toast.error(e instanceof ApiError ? e.message : "Could not load assignment.");
    } finally {
      setLoading(false);
    }
  }, [reference]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyUpdated = useCallback((next: ServiceRequestDTO) => {
    setRequest(next);
  }, []);

  return {
    canWork,
    request,
    executors,
    loading,
    notFound,
    applyUpdated,
    reload: load,
  };
}

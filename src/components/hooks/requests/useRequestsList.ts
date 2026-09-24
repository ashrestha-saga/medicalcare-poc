"use client";

import { useCallback, useEffect, useState } from "react";
import type { RequestScope, ServiceRequestDTO } from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { toast } from "@/store/toastStore";
import { useRequestCapabilities } from "./useRequestCapabilities";

/**
 * Loads and selects the service-request list for the current scope.
 */
export function useRequestsList() {
  const { canWork, scopes, defaultScope } = useRequestCapabilities();
  const [scope, setScopeState] = useState<RequestScope>(defaultScope);
  const [requests, setRequests] = useState<ServiceRequestDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const scopeAllowed = scopes.some((s) => s.id === scope);
  const activeScope: RequestScope = scopeAllowed ? scope : "mine";

  const setScope = useCallback((next: RequestScope) => {
    setScopeState(next);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ requests: ServiceRequestDTO[]; scope: RequestScope }>(
        `/api/service-requests?scope=${encodeURIComponent(activeScope)}`,
      );
      setRequests(res.requests);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not load requests.");
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [activeScope]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async list fetch on scope change
    void load();
  }, [load]);

  return {
    canWork,
    scopes,
    scope: activeScope,
    setScope,
    requests,
    loading,
    reload: load,
  };
}

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
  const [selected, setSelected] = useState<ServiceRequestDTO | null>(null);

  const scopeAllowed = scopes.some((s) => s.id === scope);
  const activeScope: RequestScope = scopeAllowed ? scope : "mine";

  const setScope = useCallback((next: RequestScope) => {
    setScopeState(next);
    setSelected(null);
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

  // Fetch list whenever the active scope changes (intentional remote sync).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async list fetch on scope change
    void load();
  }, [load]);

  const selectRequest = useCallback((request: ServiceRequestDTO) => {
    setSelected(request);
  }, []);

  const clearSelection = useCallback(() => {
    setSelected(null);
    void load();
  }, [load]);

  const applyUpdated = useCallback((next: ServiceRequestDTO) => {
    setSelected(next);
    setRequests((prev) => prev.map((r) => (r.id === next.id ? next : r)));
  }, []);

  return {
    canWork,
    scopes,
    scope: activeScope,
    setScope,
    requests,
    loading,
    selected,
    selectRequest,
    clearSelection,
    applyUpdated,
    reload: load,
  };
}

"use client";

import { useCallback, useEffect, useState } from "react";
import type { RequestScope, ServiceRequestDTO } from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { useQueryParam, useSyncQueryParams } from "@/lib/navigation/searchParams";
import { toast } from "@/store/toastStore";
import { useRequestCapabilities } from "./useRequestCapabilities";

const SCOPES: RequestScope[] = ["mine", "open", "all"];

function parseScope(raw: string | null, fallback: RequestScope): RequestScope {
  if (raw && (SCOPES as string[]).includes(raw)) return raw as RequestScope;
  return fallback;
}

/**
 * Loads and selects the service-request list for the current scope.
 */
export function useRequestsList() {
  const { canWork, scopes, defaultScope } = useRequestCapabilities();
  const scopeParam = useQueryParam("scope");
  const stateParam = useQueryParam("state");
  const quoteParam = useQueryParam("quote");
  const { sync } = useSyncQueryParams();

  const [scope, setScopeState] = useState<RequestScope>(() => parseScope(scopeParam, defaultScope));
  const [stateFilter, setStateFilterState] = useState<string[] | null>(() =>
    stateParam ? stateParam.split(",").filter(Boolean) : null,
  );
  const [quoteFilter, setQuoteFilterState] = useState<string[] | null>(() =>
    quoteParam ? quoteParam.split(",").filter(Boolean) : null,
  );
  const [requests, setRequests] = useState<ServiceRequestDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setScopeState(parseScope(scopeParam, defaultScope));
    setStateFilterState(stateParam ? stateParam.split(",").filter(Boolean) : null);
    setQuoteFilterState(quoteParam ? quoteParam.split(",").filter(Boolean) : null);
  }, [scopeParam, stateParam, quoteParam, defaultScope]);

  const scopeAllowed = scopes.some((s) => s.id === scope);
  const activeScope: RequestScope = scopeAllowed ? scope : "mine";

  const setScope = useCallback(
    (next: RequestScope) => {
      setScopeState(next);
      sync({ scope: next === defaultScope ? null : next });
    },
    [sync, defaultScope],
  );

  const setStateFilter = useCallback(
    (next: string[] | null) => {
      setStateFilterState(next);
      sync({ state: next?.length ? next.join(",") : null });
    },
    [sync],
  );

  const setQuoteFilter = useCallback(
    (next: string[] | null) => {
      setQuoteFilterState(next);
      sync({ quote: next?.length ? next.join(",") : null });
    },
    [sync],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      sp.set("scope", activeScope);
      if (stateFilter?.length === 1) sp.set("state", stateFilter[0]!);
      const res = await api<{ requests: ServiceRequestDTO[]; scope: RequestScope }>(
        `/api/service-requests?${sp.toString()}`,
      );
      setRequests(res.requests);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not load requests.");
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [activeScope, stateFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    canWork,
    scopes,
    scope: activeScope,
    setScope,
    stateFilter,
    setStateFilter,
    quoteFilter,
    setQuoteFilter,
    requests,
    loading,
    reload: load,
  };
}

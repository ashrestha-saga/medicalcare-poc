"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ConsoleClinicDTO, ConsoleClinicListDTO } from "@/interfaces/console";
import { api, ApiError } from "@/lib/http/apiClient";
import { useQueryParam, useSyncQueryParams } from "@/lib/navigation/searchParams";

export type CustomerListFilter = "all" | "live" | "ending" | "mpsb" | "setup";

function parseFilter(raw: string | null): CustomerListFilter {
  if (raw === "live" || raw === "ending" || raw === "mpsb" || raw === "setup") return raw;
  return "all";
}

function withinDays(iso: string | null | undefined, days: number): boolean {
  if (!iso) return false;
  const now = Date.now();
  const t = new Date(iso).getTime();
  return t >= now && t <= now + days * 86400000;
}

/** Partner console — customers list with URL filter (?filter=live|ending|mpsb|setup). */
export function useCustomerList() {
  const filterParam = useQueryParam("filter");
  const { sync } = useSyncQueryParams();
  const [data, setData] = useState<ConsoleClinicListDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilterState] = useState<CustomerListFilter>(() => parseFilter(filterParam));

  useEffect(() => {
    setFilterState(parseFilter(filterParam));
  }, [filterParam]);

  const setFilter = useCallback(
    (value: CustomerListFilter) => {
      setFilterState(value);
      sync({ filter: value === "all" ? null : value });
    },
    [sync],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api<ConsoleClinicListDTO>("/api/partner/clinics");
      setData(list);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load customers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const clinics = useMemo((): ConsoleClinicDTO[] => {
    const all = data?.clinics ?? [];
    if (filter === "all") return all;
    if (filter === "live") return all.filter((c) => c.live);
    if (filter === "ending") return all.filter((c) => c.live && withinDays(c.validTo, 90));
    if (filter === "mpsb") return all.filter((c) => (c.openMpsb ?? 0) > 0);
    if (filter === "setup") {
      return all.filter((c) => c.setupStuck === true);
    }
    return all;
  }, [data, filter]);

  return { data, clinics, error, loading, refresh, filter, setFilter };
}

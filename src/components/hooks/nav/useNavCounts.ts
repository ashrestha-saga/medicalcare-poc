"use client";

import { useCallback, useEffect, useState } from "react";
import type { NavCountsResponse } from "@/constants/navCounts";
import { api } from "@/lib/http/apiClient";
import { useActingTenantStore } from "@/store/actingTenantStore";

const POLL_MS = 30_000;

/** Fetches sidebar count tags; refreshes on focus, tenant switch, and ~30s. */
export function useNavCounts(enabled: boolean) {
  const [counts, setCounts] = useState<NavCountsResponse | null>(null);
  const actingTenantId = useActingTenantStore((s) => s.tenantId);

  const refresh = useCallback(() => {
    if (!enabled) {
      setCounts(null);
      return;
    }
    void api<NavCountsResponse>("/api/nav/counts")
      .then(setCounts)
      .catch(() => {
        /* keep last good snapshot */
      });
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setCounts(null);
      return;
    }
    refresh();
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    const id = window.setInterval(refresh, POLL_MS);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(id);
    };
  }, [enabled, actingTenantId, refresh]);

  return { counts, refresh };
}

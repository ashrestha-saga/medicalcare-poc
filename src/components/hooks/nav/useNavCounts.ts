"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { NavCountsResponse } from "@/constants/navCounts";
import { api } from "@/lib/http/apiClient";
import { useActingTenantStore } from "@/store/actingTenantStore";

const POLL_MS = 30_000;

/** Fetches sidebar count tags; refreshes on focus, tenant switch, and ~30s — skips if still fresh. */
export function useNavCounts(enabled: boolean) {
  const [counts, setCounts] = useState<NavCountsResponse | null>(null);
  const actingTenantId = useActingTenantStore((s) => s.tenantId);
  const lastFetchedAt = useRef(0);
  const lastTenant = useRef(actingTenantId);

  const refresh = useCallback(
    (force = false) => {
      if (!enabled) {
        setCounts(null);
        lastFetchedAt.current = 0;
        return;
      }
      const tenantChanged = lastTenant.current !== actingTenantId;
      lastTenant.current = actingTenantId;
      if (!force && !tenantChanged && Date.now() - lastFetchedAt.current < POLL_MS) return;
      void api<NavCountsResponse>("/api/nav/counts")
        .then((next) => {
          setCounts(next);
          lastFetchedAt.current = Date.now();
        })
        .catch(() => {
          /* keep last good snapshot */
        });
    },
    [enabled, actingTenantId],
  );

  useEffect(() => {
    if (!enabled) {
      setCounts(null);
      return;
    }
    refresh(true);
    const onFocus = () => refresh(false);
    window.addEventListener("focus", onFocus);
    const id = window.setInterval(() => refresh(false), POLL_MS);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(id);
    };
  }, [enabled, actingTenantId, refresh]);

  return { counts, refresh: () => refresh(true) };
}

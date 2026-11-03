"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  normalizePartnerNavCounts,
  type PartnerNavCountsRaw,
  type PartnerNavCountsResponse,
} from "@/constants/partnerNavCounts";
import { api } from "@/lib/http/apiClient";

const POLL_MS = 30_000;

/** Partner sidebar badge counts; refreshes on focus and ~30s. */
export function usePartnerNavCounts(enabled: boolean) {
  const [counts, setCounts] = useState<PartnerNavCountsResponse | null>(null);
  const lastFetchedAt = useRef(0);

  const refresh = useCallback(
    (force = false) => {
      if (!enabled) {
        setCounts(null);
        lastFetchedAt.current = 0;
        return;
      }
      if (!force && Date.now() - lastFetchedAt.current < POLL_MS) return;
      void api<PartnerNavCountsRaw>("/api/partner/nav-counts")
        .then((raw) => {
          setCounts(normalizePartnerNavCounts(raw));
          lastFetchedAt.current = Date.now();
        })
        .catch(() => {
          /* keep last good snapshot */
        });
    },
    [enabled],
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
  }, [enabled, refresh]);

  return { counts, refresh: () => refresh(true) };
}

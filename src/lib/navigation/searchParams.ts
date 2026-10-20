"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Read a single query param; stable empty → null. */
export function useQueryParam(key: string): string | null {
  const sp = useSearchParams();
  const value = sp.get(key);
  return value && value.length > 0 ? value : null;
}

/**
 * Sync selected filter keys into the URL (replace, no scroll).
 * Omits null/empty/"all" values to keep URLs short.
 */
export function useSyncQueryParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const sync = useCallback(
    (patch: Record<string, string | null | undefined>, opts?: { dropKeys?: string[] }) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const key of opts?.dropKeys ?? []) next.delete(key);
      for (const [key, value] of Object.entries(patch)) {
        if (value == null || value === "" || value === "all") next.delete(key);
        else next.set(key, value);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const current = useMemo(() => Object.fromEntries(searchParams.entries()), [searchParams]);

  return { sync, current, searchParams };
}

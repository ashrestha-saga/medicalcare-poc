"use client";

import { useCallback, useEffect, useState } from "react";
import type { SetupProgressDTO } from "@/services/setup/setupProgressService";
import { api } from "@/lib/http/apiClient";
import { useActingTenantStore } from "@/store/actingTenantStore";

export function useSetupProgress(enabled: boolean) {
  const [progress, setProgress] = useState<SetupProgressDTO | null>(null);
  const [loading, setLoading] = useState(enabled);
  const actingTenantId = useActingTenantStore((s) => s.tenantId);

  const refresh = useCallback(() => {
    if (!enabled) {
      setProgress(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    void api<SetupProgressDTO>("/api/setup/progress")
      .then(setProgress)
      .catch(() => {
        /* keep last good snapshot */
      })
      .finally(() => setLoading(false));
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setProgress(null);
      setLoading(false);
      return;
    }
    refresh();
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [enabled, actingTenantId, refresh]);

  return { progress, loading, refresh };
}

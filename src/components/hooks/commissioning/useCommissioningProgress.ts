"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { SetupProgressDTO } from "@/interfaces/setup";
import { api, ApiError } from "@/lib/http/apiClient";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { toast } from "@/store/toastStore";

/** Clinic Inbetriebnahme progress + dismiss action. */
export function useCommissioningProgress() {
  const t = useTranslations("commissioning");
  const tCommon = useTranslations("common");
  const { checkPermission } = usePermissions();
  const canView = checkPermission("shell:nav");
  const [progress, setProgress] = useState<SetupProgressDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissBusy, setDismissBusy] = useState(false);

  const refresh = useCallback(async () => {
    const res = await api<SetupProgressDTO>("/api/setup/progress");
    setProgress(res);
  }, []);

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    let alive = true;
    void refresh()
      .catch((e) => {
        if (alive) setError(e instanceof ApiError ? e.message : tCommon("loading"));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [canView, refresh, tCommon]);

  async function dismiss() {
    if (dismissBusy) return;
    setDismissBusy(true);
    try {
      const res = await api<SetupProgressDTO>("/api/setup/dismiss", { method: "POST" });
      setProgress(res);
      toast.success(t("dismissed"));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("dismissFailed"));
    } finally {
      setDismissBusy(false);
    }
  }

  return { canView, progress, error, loading, dismissBusy, dismiss };
}

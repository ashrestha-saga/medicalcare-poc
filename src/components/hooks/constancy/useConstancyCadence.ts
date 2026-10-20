"use client";

import { useCallback, useEffect, useState } from "react";
import type { ConstancyCadenceDTO, MissingConstancyCadenceDTO } from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { toast } from "@/store/toastStore";

export type MissingCadenceRow = MissingConstancyCadenceDTO;

export function useConstancyCadence() {
  const { checkPermission } = usePermissions();
  const canView = checkPermission("duties:view");
  const [open, setOpen] = useState<ConstancyCadenceDTO[]>([]);
  const [missing, setMissing] = useState<MissingCadenceRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!canView) {
      setOpen([]);
      setMissing([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api<{ open: ConstancyCadenceDTO[]; missing: MissingCadenceRow[] }>(
        "/api/constancy-cadence",
      );
      setOpen(res.open);
      setMissing(res.missing);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not load constancy cadence.");
      setOpen([]);
      setMissing([]);
    } finally {
      setLoading(false);
    }
  }, [canView]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function determine(input: {
    deviceInstanceId: string;
    constancyObjectCode: string;
    intervalValue: number;
    intervalUnit: "months" | "years";
    basisText: string;
    determinedAt: string;
  }) {
    try {
      await api("/api/constancy-cadence", { method: "POST", body: JSON.stringify(input) });
      toast.success("Cadence determined.");
      await refresh();
      return true;
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not set cadence.");
      return false;
    }
  }

  return { canView, open, missing, loading, refresh, determine };
}

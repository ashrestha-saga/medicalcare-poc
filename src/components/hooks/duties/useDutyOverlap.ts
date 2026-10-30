"use client";

import { useCallback, useEffect, useState } from "react";
import type { DutyOverlapDecisionDTO } from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { toast } from "@/store/toastStore";

export type OverlapDeviceOption = {
  id: string;
  inventoryNumber: string;
  label: string;
};

export function useDutyOverlap() {
  const { checkPermission } = usePermissions();
  const canView = checkPermission("duties:view");
  const [decisions, setDecisions] = useState<DutyOverlapDecisionDTO[]>([]);
  const [devices, setDevices] = useState<OverlapDeviceOption[]>([]);
  const [pending, setPending] = useState<OverlapDeviceOption[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!canView) {
      setDecisions([]);
      setDevices([]);
      setPending([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      type DeviceRow = {
        id: string;
        inventoryNumber: string;
        tradeName: string | null;
        modelName: string | null;
      };
      const toOption = (d: DeviceRow): OverlapDeviceOption => ({
        id: d.id,
        inventoryNumber: d.inventoryNumber,
        label: d.tradeName || d.modelName || d.inventoryNumber,
      });
      const res = await api<{
        decisions: DutyOverlapDecisionDTO[];
        devices: DeviceRow[];
        pending?: DeviceRow[];
      }>("/api/duty-overlap");
      setDecisions(res.decisions);
      setDevices((res.devices ?? []).map(toOption));
      setPending((res.pending ?? []).map(toOption));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not load overlap decisions.");
      setDecisions([]);
      setDevices([]);
      setPending([]);
    } finally {
      setLoading(false);
    }
  }, [canView]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function decide(input: {
    deviceInstanceId: string;
    coveredDutyKey: "dguv" | "stk";
    satisfiedByDutyKey: "dguv" | "stk";
    reasonText: string;
    decidedAt: string;
  }) {
    try {
      await api("/api/duty-overlap", { method: "POST", body: JSON.stringify(input) });
      toast.success("Overlap recorded — covered duty suspended from due dates.");
      await refresh();
      return true;
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not record decision.");
      return false;
    }
  }

  async function revoke(decisionId: string) {
    try {
      await api(`/api/duty-overlap/${encodeURIComponent(decisionId)}/revoke`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      toast.success("Decision revoked — covered duty reactivated if nothing else covers it.");
      await refresh();
      return true;
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not revoke decision.");
      return false;
    }
  }

  return { canView, decisions, devices, pending, loading, refresh, decide, revoke };
}

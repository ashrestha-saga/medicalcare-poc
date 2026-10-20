"use client";

import { useCallback, useEffect, useState } from "react";
import type { DutyOverlapDecisionDTO } from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { toast } from "@/store/toastStore";

export function useDutyOverlap() {
  const { checkPermission } = usePermissions();
  const canView = checkPermission("duties:view");
  const [decisions, setDecisions] = useState<DutyOverlapDecisionDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!canView) {
      setDecisions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api<{ decisions: DutyOverlapDecisionDTO[] }>("/api/duty-overlap");
      setDecisions(res.decisions);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not load overlap decisions.");
      setDecisions([]);
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
      toast.success("Overlap decision recorded. Both duties stay due until closed.");
      await refresh();
      return true;
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not record decision.");
      return false;
    }
  }

  return { canView, decisions, loading, refresh, decide };
}

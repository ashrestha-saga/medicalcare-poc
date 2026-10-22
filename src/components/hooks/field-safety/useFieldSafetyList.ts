"use client";

import { useCallback, useEffect, useState } from "react";
import type { FieldSafetyActionDTO } from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { useQueryParam, useSyncQueryParams } from "@/lib/navigation/searchParams";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { toast } from "@/store/toastStore";

export type FieldSafetyView = "all" | "open" | "unmatched";

function parseView(raw: string | null): FieldSafetyView {
  if (raw === "open" || raw === "unmatched") return raw;
  return "all";
}

export function useFieldSafetyList() {
  const { checkPermission } = usePermissions();
  const canView = checkPermission("fieldsafety:view");
  const canCreate = checkPermission("fieldsafety:create");
  const viewParam = useQueryParam("view");
  const actionIdParam = useQueryParam("actionId");
  const { sync } = useSyncQueryParams();
  const view = parseView(viewParam);

  const [actions, setActions] = useState<FieldSafetyActionDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const setView = useCallback(
    (next: FieldSafetyView) => {
      sync({ view: next === "all" ? null : next, actionId: null });
    },
    [sync],
  );

  const refresh = useCallback(async () => {
    if (!canView) {
      setActions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (view !== "all") sp.set("view", view);
      if (actionIdParam) sp.set("actionId", actionIdParam);
      const qs = sp.toString() ? `?${sp}` : "";
      const res = await api<{ actions: FieldSafetyActionDTO[] }>(`/api/field-safety${qs}`);
      setActions(
        actionIdParam ? res.actions.filter((a) => a.id === actionIdParam) : res.actions,
      );
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not load field safety actions.");
      setActions([]);
    } finally {
      setLoading(false);
    }
  }, [canView, view, actionIdParam]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const close = useCallback(
    async (id: string) => {
      try {
        await api(`/api/field-safety/${id}/close`, { method: "POST", body: "{}" });
        toast.success("Action closed");
        await refresh();
      } catch (err) {
        toast.error(
          err instanceof ApiError
            ? err.message
            : "Could not close — finish Abgleich and record measures first.",
        );
      }
    },
    [refresh],
  );

  const create = useCallback(
    async (body: Record<string, unknown>) => {
      await api("/api/field-safety", { method: "POST", body: JSON.stringify(body) });
      toast.success("Field safety action created");
      await refresh();
    },
    [refresh],
  );

  const matchDevice = useCallback(
    async (
      actionId: string,
      input: {
        deviceInstanceId: string;
        affected: boolean | null;
        actionTakenAt?: string | null;
        actionNote?: string | null;
      },
    ) => {
      await api(`/api/field-safety/${actionId}/match`, {
        method: "POST",
        body: JSON.stringify(input),
      });
      toast.success(
        input.affected === true && input.actionTakenAt
          ? "Measure recorded — scan block cleared"
          : input.affected === true
            ? "Marked affected — do not use until measure is recorded"
            : "Match saved",
      );
      await refresh();
    },
    [refresh],
  );

  const suggestCandidates = useCallback(
    async (actionId: string) => {
      const res = await api<{ action: FieldSafetyActionDTO }>(
        `/api/field-safety/${actionId}/suggest`,
        { method: "POST", body: "{}" },
      );
      const added = res.action.unmatchedCount;
      toast.success(
        added > 0
          ? `Suggested candidates queued (${added} on Abgleich)`
          : "No new inventory matches",
      );
      await refresh();
    },
    [refresh],
  );

  const addAffectedModels = useCallback(
    async (
      actionId: string,
      affectedModels: Array<{
        deviceModelId?: string | null;
        basicUdiDi?: string | null;
        serialFrom?: string | null;
        serialTo?: string | null;
        lotNumber?: string | null;
        note?: string | null;
      }>,
    ) => {
      await api(`/api/field-safety/${actionId}/affected-models`, {
        method: "POST",
        body: JSON.stringify({ affectedModels }),
      });
      toast.success("Model scope added");
      await refresh();
    },
    [refresh],
  );

  return {
    canView,
    canCreate,
    actions,
    loading,
    refresh,
    close,
    create,
    matchDevice,
    suggestCandidates,
    addAffectedModels,
    view,
    setView,
  };
}

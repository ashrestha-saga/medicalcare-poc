"use client";

import { useCallback, useEffect, useState } from "react";
import type { DeviceIncidentDTO } from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { useQueryParam, useSyncQueryParams } from "@/lib/navigation/searchParams";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { toast } from "@/store/toastStore";

export type IncidentView = "all" | "unassessed" | "unreported" | "open";

export type IncidentKpis = {
  unassessed: number;
  unreported: number;
  total: number;
};

function parseView(raw: string | null): IncidentView {
  if (raw === "unassessed" || raw === "unreported" || raw === "open") return raw;
  return "all";
}

export function useIncidentsList() {
  const { checkPermission } = usePermissions();
  const canView = checkPermission("incidents:view");
  const canManage = checkPermission("incidents:manage");
  const viewParam = useQueryParam("view");
  const { sync } = useSyncQueryParams();
  const view = parseView(viewParam);

  const [incidents, setIncidents] = useState<DeviceIncidentDTO[]>([]);
  const [kpis, setKpis] = useState<IncidentKpis>({ unassessed: 0, unreported: 0, total: 0 });
  const [loading, setLoading] = useState(true);

  const setView = useCallback(
    (next: IncidentView) => {
      sync({ view: next === "all" ? null : next });
    },
    [sync],
  );

  const refresh = useCallback(async () => {
    if (!canView) {
      setIncidents([]);
      setKpis({ unassessed: 0, unreported: 0, total: 0 });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const qs = view === "all" ? "" : `?view=${encodeURIComponent(view)}`;
      const res = await api<{ incidents: DeviceIncidentDTO[]; kpis: IncidentKpis }>(
        `/api/incidents${qs}`,
      );
      setIncidents(res.incidents);
      setKpis(res.kpis ?? { unassessed: 0, unreported: 0, total: 0 });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not load incidents.");
      setIncidents([]);
    } finally {
      setLoading(false);
    }
  }, [canView, view]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const assess = useCallback(
    async (id: string, suspectedSerious: boolean | null, assessmentNote?: string | null) => {
      await api(`/api/incidents/${id}/assess`, {
        method: "POST",
        body: JSON.stringify({ suspectedSerious, assessmentNote: assessmentNote ?? null }),
      });
      toast.success("Assessment saved");
      await refresh();
    },
    [refresh],
  );

  const report = useCallback(
    async (
      id: string,
      input: {
        reportedAt: string;
        reportedTo?: string | null;
        channel?: string;
        reportReference?: string | null;
        manufacturerNotifiedAt?: string | null;
      },
    ) => {
      await api(`/api/incidents/${id}/report`, {
        method: "POST",
        body: JSON.stringify(input),
      });
      toast.success("Report recorded");
      await refresh();
    },
    [refresh],
  );

  /** Assess, then optionally record authority notification in one user action. */
  const assessAndMaybeReport = useCallback(
    async (
      id: string,
      input: {
        suspectedSerious: boolean | null;
        assessmentNote?: string | null;
        report?: {
          reportedAt: string;
          reportedTo?: string | null;
          channel?: string;
          reportReference?: string | null;
          manufacturerNotifiedAt?: string | null;
        } | null;
      },
    ) => {
      await api(`/api/incidents/${id}/assess`, {
        method: "POST",
        body: JSON.stringify({
          suspectedSerious: input.suspectedSerious,
          assessmentNote: input.assessmentNote ?? null,
        }),
      });
      if (input.suspectedSerious === true && input.report?.reportedAt) {
        await api(`/api/incidents/${id}/report`, {
          method: "POST",
          body: JSON.stringify(input.report),
        });
        toast.success("Assessment and report saved");
      } else {
        toast.success("Assessment saved");
      }
      await refresh();
    },
    [refresh],
  );

  const assign = useCallback(
    async (id: string, assignedUserId: string, dueAt?: string | null) => {
      await api(`/api/incidents/${id}/assign`, {
        method: "POST",
        body: JSON.stringify({ assignedUserId, dueAt: dueAt ?? null }),
      });
      toast.success("Assigned");
      await refresh();
    },
    [refresh],
  );

  const close = useCallback(
    async (id: string) => {
      try {
        await api(`/api/incidents/${id}/close`, { method: "POST", body: "{}" });
        toast.success("Incident closed");
        await refresh();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Could not close incident.");
      }
    },
    [refresh],
  );

  return {
    canView,
    canManage,
    incidents,
    kpis,
    loading,
    refresh,
    assess,
    report,
    assessAndMaybeReport,
    assign,
    close,
    view,
    setView,
  };
}

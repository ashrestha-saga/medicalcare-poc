"use client";

import { useCallback, useEffect, useState } from "react";
import type { AuditEventDTO, AuditListQuery } from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { useQueryParam, useSyncQueryParams } from "@/lib/navigation/searchParams";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { toast } from "@/store/toastStore";

export function useAuditList(initial: AuditListQuery = {}) {
  const { checkPermission } = usePermissions();
  const canView = checkPermission("audit:view");
  const canExport = checkPermission("audit:export");
  const { sync } = useSyncQueryParams();
  const actorKindParam = useQueryParam("actorKind");

  const [events, setEvents] = useState<AuditEventDTO[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFiltersState] = useState<AuditListQuery>(() => ({
    ...initial,
    ...(actorKindParam ? { actorKind: actorKindParam } : {}),
  }));

  useEffect(() => {
    setFiltersState((prev) => {
      const nextKind = actorKindParam ?? undefined;
      if (prev.actorKind === nextKind) return prev;
      return { ...prev, actorKind: nextKind };
    });
  }, [actorKindParam]);

  const setFilters = useCallback(
    (next: AuditListQuery) => {
      setFiltersState(next);
      sync({ actorKind: next.actorKind?.trim() || null });
    },
    [sync],
  );

  const refresh = useCallback(
    async (next: AuditListQuery = filters) => {
      if (!canView) {
        setEvents([]);
        setNextCursor(null);
        return;
      }
      setLoading(true);
      try {
        const collected: AuditEventDTO[] = [];
        let cursor: string | undefined;
        do {
          const params = new URLSearchParams();
          const query: AuditListQuery = { ...next, limit: 200, cursor };
          for (const [k, v] of Object.entries(query)) {
            if (v != null && String(v).trim()) params.set(k, String(v));
          }
          const res = await api<{ events: AuditEventDTO[]; nextCursor: string | null }>(
            `/api/audit?${params.toString()}`,
          );
          collected.push(...res.events);
          cursor = res.nextCursor ?? undefined;
        } while (cursor && collected.length < 2000);
        setEvents(collected);
        setNextCursor(cursor ?? null);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Could not load activity.");
        setEvents([]);
      } finally {
        setLoading(false);
      }
    },
    [canView, filters],
  );

  useEffect(() => {
    void refresh(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch when filters change
  }, [canView, filters]);

  const exportCsv = useCallback(async () => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v != null && String(v).trim() && k !== "cursor" && k !== "limit") params.set(k, String(v));
    }
    const res = await fetch(`/api/audit/export?${params.toString()}`);
    if (!res.ok) {
      toast.error("Export failed.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "activity.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [filters]);

  return { events, loading, nextCursor, filters, setFilters, refresh, canView, canExport, exportCsv };
}

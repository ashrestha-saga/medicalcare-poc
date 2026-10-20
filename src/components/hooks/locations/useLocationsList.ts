"use client";

import { useCallback, useEffect, useState } from "react";
import type { SiteDTO } from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { useQueryParam, useSyncQueryParams } from "@/lib/navigation/searchParams";
import { invalidateSites } from "@/components/hooks/location/useSites";
import { toast } from "@/store/toastStore";

export type MpsbFilter = "missing" | "appointed" | null;

function parseMpsb(raw: string | null): MpsbFilter {
  if (raw === "missing" || raw === "appointed") return raw;
  return null;
}

export function useLocationsList() {
  const { checkPermission } = usePermissions();
  const canView = checkPermission("locations:view");
  const canCreate = checkPermission("locations:create");
  const canUpdate = checkPermission("locations:update");
  const canDelete = checkPermission("locations:delete");
  const { sync } = useSyncQueryParams();

  const mpsbParam = useQueryParam("mpsb");
  const qParam = useQueryParam("q");
  const mpsb = parseMpsb(mpsbParam);

  const [sites, setSites] = useState<SiteDTO[]>([]);
  const [q, setQState] = useState(qParam ?? "");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setQState(qParam ?? "");
  }, [qParam]);

  const setQ = useCallback(
    (value: string) => {
      setQState(value);
      sync({ q: value.trim() || null });
    },
    [sync],
  );

  const setMpsb = useCallback(
    (next: MpsbFilter) => {
      sync({ mpsb: next });
    },
    [sync],
  );

  const refresh = useCallback(
    async (override?: { q?: string; mpsb?: MpsbFilter }) => {
      if (!canView) {
        setSites([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const sp = new URLSearchParams();
        const nextQ = override?.q ?? q;
        const nextMpsb = override?.mpsb !== undefined ? override.mpsb : mpsb;
        if (nextQ.trim()) sp.set("q", nextQ.trim());
        if (nextMpsb) sp.set("mpsb", nextMpsb);
        const qs = sp.toString();
        const res = await api<{ sites: SiteDTO[] }>(`/api/sites${qs ? `?${qs}` : ""}`);
        setSites(res.sites);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Could not load locations.");
        setSites([]);
      } finally {
        setLoading(false);
      }
    },
    [canView, q, mpsb],
  );

  useEffect(() => {
    void refresh({
      q: qParam ?? "",
      mpsb: parseMpsb(mpsbParam),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch when URL filters change
  }, [canView, qParam, mpsbParam]);

  const remove = useCallback(
    async (id: string) => {
      await api(`/api/sites/${id}`, { method: "DELETE" });
      toast.success("Location deleted.");
      invalidateSites();
      await refresh();
    },
    [refresh],
  );

  return {
    sites,
    q,
    setQ,
    mpsb,
    setMpsb,
    loading,
    refresh,
    remove,
    canView,
    canCreate,
    canUpdate,
    canDelete,
  };
}

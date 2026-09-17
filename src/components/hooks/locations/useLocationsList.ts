"use client";

import { useCallback, useEffect, useState } from "react";
import type { SiteDTO } from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { invalidateSites } from "@/components/hooks/location/useSites";
import { toast } from "@/store/toastStore";

export function useLocationsList() {
  const { checkPermission } = usePermissions();
  const canView = checkPermission("locations:view");
  const canCreate = checkPermission("locations:create");
  const canUpdate = checkPermission("locations:update");
  const canDelete = checkPermission("locations:delete");

  const [sites, setSites] = useState<SiteDTO[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(
    async (search = q) => {
      if (!canView) {
        setSites([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const qs = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : "";
        const res = await api<{ sites: SiteDTO[] }>(`/api/sites${qs}`);
        setSites(res.sites);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Could not load locations.");
        setSites([]);
      } finally {
        setLoading(false);
      }
    },
    [canView, q],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount / canView change
    void refresh("");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount / gate fetch
  }, [canView]);

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
    loading,
    refresh,
    remove,
    canView,
    canCreate,
    canUpdate,
    canDelete,
  };
}

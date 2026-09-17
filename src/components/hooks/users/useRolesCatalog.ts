"use client";

import { useCallback, useEffect, useState } from "react";
import type { RoleCatalogEntry } from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { toast } from "@/store/toastStore";

export function useRolesCatalog() {
  const { checkPermission } = usePermissions();
  const canView = checkPermission("roles:view");
  const [roles, setRoles] = useState<RoleCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!canView) {
      setRoles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api<{ roles: RoleCatalogEntry[] }>("/api/roles");
      setRoles(res.roles);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not load roles.");
      setRoles([]);
    } finally {
      setLoading(false);
    }
  }, [canView]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount / canView change
    void refresh();
  }, [refresh]);

  return { roles, loading, canView, refresh };
}

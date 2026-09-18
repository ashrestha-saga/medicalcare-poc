"use client";

import { useCallback, useEffect, useState } from "react";
import type { PermissionSlug, RoleCatalogEntry } from "@/interfaces";
import type { UserRole } from "@/interfaces/session";
import { api, ApiError } from "@/lib/http/apiClient";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { toast } from "@/store/toastStore";

export function useRolesCatalog() {
  const { checkPermission, refresh: refreshCapabilities } = usePermissions();
  const canView = checkPermission("roles:view");
  const canUpdate = checkPermission("roles:update");
  const [roles, setRoles] = useState<RoleCatalogEntry[]>([]);
  const [allPermissions, setAllPermissions] = useState<PermissionSlug[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingRole, setSavingRole] = useState<UserRole | null>(null);

  const refresh = useCallback(async () => {
    if (!canView) {
      setRoles([]);
      setAllPermissions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api<{ roles: RoleCatalogEntry[]; allPermissions: PermissionSlug[] }>(
        "/api/roles",
      );
      setRoles(res.roles);
      setAllPermissions(res.allPermissions);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not load roles.");
      setRoles([]);
      setAllPermissions([]);
    } finally {
      setLoading(false);
    }
  }, [canView]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount / canView change
    void refresh();
  }, [refresh]);

  const saveRole = useCallback(
    async (role: UserRole, permissions: string[]) => {
      if (!canUpdate) return false;
      setSavingRole(role);
      try {
        const res = await api<{ role: RoleCatalogEntry }>(`/api/roles/${role}`, {
          method: "PATCH",
          body: JSON.stringify({ permissions }),
        });
        setRoles((prev) => prev.map((r) => (r.value === role ? res.role : r)));
        refreshCapabilities();
        toast.success(`${res.role.label} permissions saved.`);
        return true;
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Could not save role.");
        return false;
      } finally {
        setSavingRole(null);
      }
    },
    [canUpdate, refreshCapabilities],
  );

  return {
    roles,
    allPermissions,
    loading,
    canView,
    canUpdate,
    savingRole,
    refresh,
    saveRole,
  };
}

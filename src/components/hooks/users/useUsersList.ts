"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminUserDTO } from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { toast } from "@/store/toastStore";

export function useUsersList() {
  const { checkPermission } = usePermissions();
  const canView = checkPermission("users:view");
  const canCreate = checkPermission("users:create");
  const canUpdate = checkPermission("users:update");
  const canDelete = checkPermission("users:delete");
  const canResetPassword = checkPermission("users:resetpassword");

  const [users, setUsers] = useState<AdminUserDTO[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (search = q) => {
    if (!canView) {
      setUsers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const qs = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : "";
      const res = await api<{ users: AdminUserDTO[] }>(`/api/users${qs}`);
      setUsers(res.users);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not load users.");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [canView, q]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount / canView change
    void refresh("");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount / gate fetch
  }, [canView]);

  const remove = useCallback(
    async (id: string) => {
      await api(`/api/users/${id}`, { method: "DELETE" });
      toast.success("User deleted.");
      await refresh();
    },
    [refresh],
  );

  return {
    users,
    q,
    setQ,
    loading,
    refresh,
    remove,
    canView,
    canCreate,
    canUpdate,
    canDelete,
    canResetPassword,
  };
}

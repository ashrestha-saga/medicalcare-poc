"use client";

import { useCallback, useEffect, useState } from "react";
import type { DashboardBoardDTO } from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { toast } from "@/store/toastStore";

export function useDashboardBoard() {
  const { checkPermission, permissionData } = usePermissions();
  const canView = checkPermission("shell:nav");
  const canManageTiles = checkPermission("roles:view");
  const [board, setBoard] = useState<DashboardBoardDTO | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!canView) {
      setBoard(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api<DashboardBoardDTO>("/api/dashboard/board");
      setBoard(res);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not load dashboard.");
      setBoard(null);
    } finally {
      setLoading(false);
    }
  }, [canView]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    canView,
    canManageTiles,
    board,
    loading,
    refresh,
    role: permissionData?.role,
  };
}

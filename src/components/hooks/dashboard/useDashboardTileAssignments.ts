"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { api, ApiError } from "@/lib/http/apiClient";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { toast } from "@/store/toastStore";
import type { UserRole } from "@/interfaces/session";

export type CatalogTile = {
  key: string;
  title: string;
  question: string;
  zone: "decides" | "worklist" | "watch";
  sortOrder: number;
  requiredPermission: string | null;
};

export type RoleTileAssignment = {
  role: UserRole;
  roleLabel: string;
  tileKeys: string[];
};

export function useDashboardTileAssignments() {
  const t = useTranslations("pages.dashboard");
  const { checkPermission } = usePermissions();
  const canView = checkPermission("roles:view");
  const canUpdate = checkPermission("roles:update");

  const [catalog, setCatalog] = useState<CatalogTile[]>([]);
  const [role, setRole] = useState<UserRole | null>(null);
  const [assignment, setAssignment] = useState<RoleTileAssignment | null>(null);
  const [draftKeys, setDraftKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadCatalog = useCallback(async () => {
    if (!canView) {
      setCatalog([]);
      return;
    }
    try {
      const res = await api<{ catalog: CatalogTile[] }>("/api/dashboard/tiles");
      setCatalog(res.catalog);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not load tile catalog.");
      setCatalog([]);
    }
  }, [canView]);

  const loadAssignment = useCallback(async (r: UserRole) => {
    setLoading(true);
    try {
      const res = await api<{ assignment: RoleTileAssignment }>(
        `/api/dashboard/tiles?role=${encodeURIComponent(r)}`,
      );
      setAssignment(res.assignment);
      setDraftKeys(new Set(res.assignment.tileKeys));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not load role tiles.");
      setAssignment(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (role) void loadAssignment(role);
    else {
      setAssignment(null);
      setDraftKeys(new Set());
    }
  }, [role, loadAssignment]);

  function toggleKey(key: string, checked: boolean) {
    setDraftKeys((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  async function save() {
    if (!role || !canUpdate) return false;
    setSaving(true);
    try {
      const res = await api<{ assignment: RoleTileAssignment }>("/api/dashboard/tiles", {
        method: "PUT",
        body: JSON.stringify({
          role,
          tileKeys: [...draftKeys],
        }),
      });
      setAssignment(res.assignment);
      setDraftKeys(new Set(res.assignment.tileKeys));
      toast.success(
        t("assignments.saved", {
          role: t(`roles.${role}`),
          count: res.assignment.tileKeys.length,
        }),
      );
      return true;
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save role tiles.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  return {
    canView,
    canUpdate,
    catalog,
    role,
    setRole,
    assignment,
    draftKeys,
    toggleKey,
    loading,
    saving,
    save,
  };
}

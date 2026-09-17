"use client";

import { useMemo } from "react";
import type { RequestScope } from "@/interfaces";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { useSessionStore } from "@/store/sessionStore";

/**
 * Permission-derived request UI capabilities (UX only — API still enforces).
 */
export function useRequestCapabilities() {
  const role = useSessionStore((s) => s.user?.role);
  const { checkPermission } = usePermissions();
  const canWork = checkPermission("requests:transition");
  const canViewOpen = checkPermission("requests:view-open");
  const canViewAll = checkPermission("requests:view-all");

  const scopes = useMemo(() => {
    const list: { id: RequestScope; label: string }[] = [{ id: "mine", label: "Mine" }];
    if (canViewOpen) list.push({ id: "open", label: "Open" });
    if (canViewAll) list.push({ id: "all", label: "All" });
    return list;
  }, [canViewOpen, canViewAll]);

  const defaultScope: RequestScope = canViewOpen ? "open" : "mine";

  return { role, canWork, canViewAll, canViewOpen, scopes, defaultScope };
}

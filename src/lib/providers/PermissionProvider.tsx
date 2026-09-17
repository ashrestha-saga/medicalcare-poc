"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CapabilitiesResponse, PermissionSlug } from "@/interfaces/permissions";
import { canAccessPath, resolvePathPermission } from "@/constants/permissions";
import { api } from "@/lib/http/apiClient";

interface PermissionContextValue {
  permissionsLoading: boolean;
  permissionData: CapabilitiesResponse | null;
  checkPermission: (slug: PermissionSlug) => boolean;
  checkRouteAccess: (path: string, method?: string) => boolean;
  getCurrentRoutePermissions: (path: string) => PermissionSlug[];
  refresh: () => void;
}

const PermissionContext = createContext<PermissionContextValue | null>(null);

export function PermissionProvider({ children }: { children: ReactNode }) {
  const [permissionData, setPermissionData] = useState<CapabilitiesResponse | null>(null);
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // Refresh path: mark loading before the fetch settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch lifecycle
    setPermissionsLoading(true);
    void api<CapabilitiesResponse>("/api/me/capabilities")
      .then((data) => {
        if (!cancelled) setPermissionData(data);
      })
      .catch(() => {
        if (!cancelled) setPermissionData(null);
      })
      .finally(() => {
        if (!cancelled) setPermissionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const slugSet = useMemo(() => new Set(permissionData?.permissions ?? []), [permissionData]);

  const checkPermission = useCallback(
    (slug: PermissionSlug) => slugSet.has(slug),
    [slugSet],
  );

  const checkRouteAccess = useCallback(
    (path: string, _method = "get") => {
      void _method;
      return canAccessPath(path, slugSet);
    },
    [slugSet],
  );

  const getCurrentRoutePermissions = useCallback(
    (path: string) => {
      if (!canAccessPath(path, slugSet)) return [];
      const required = resolvePathPermission(path);
      return required ? [required] : [];
    },
    [slugSet],
  );

  const value = useMemo<PermissionContextValue>(
    () => ({
      permissionsLoading,
      permissionData,
      checkPermission,
      checkRouteAccess,
      getCurrentRoutePermissions,
      refresh: () => setTick((n) => n + 1),
    }),
    [
      permissionsLoading,
      permissionData,
      checkPermission,
      checkRouteAccess,
      getCurrentRoutePermissions,
    ],
  );

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
}

export function usePermissions(): PermissionContextValue {
  const ctx = useContext(PermissionContext);
  if (!ctx) {
    throw new Error("usePermissions must be used within PermissionProvider");
  }
  return ctx;
}

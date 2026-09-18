"use client";

import { useCallback, useEffect, useState } from "react";
import type { UserOptionDTO } from "@/interfaces";
import type { UserRole } from "@/interfaces/session";
import { api, ApiError } from "@/lib/http/apiClient";

export interface UseUserOptionsParams {
  /** Role filter — default ["device_admin"]. Pass [] for all roles. */
  roles?: UserRole[];
  active?: boolean | null;
  q?: string;
  excludeIds?: string[];
  /** Skip fetch when false. */
  enabled?: boolean;
}

function buildQuery(params: UseUserOptionsParams): string {
  const qs = new URLSearchParams();
  const roles = params.roles === undefined ? (["device_admin"] as UserRole[]) : params.roles;
  if (roles.length) qs.set("roles", roles.join(","));
  if (params.active === null) qs.set("active", "all");
  else if (params.active === false) qs.set("active", "false");
  // default active=true omitted (server default)
  if (params.q?.trim()) qs.set("q", params.q.trim());
  if (params.excludeIds?.length) qs.set("excludeIds", params.excludeIds.join(","));
  const s = qs.toString();
  return s ? `?${s}` : "";
}

/**
 * Reusable tenant user picklist loader with filter params.
 * Default: active device administrators.
 */
export function useUserOptions(params: UseUserOptionsParams = {}) {
  const {
    roles,
    active,
    q,
    excludeIds,
    enabled = true,
  } = params;

  const [users, setUsers] = useState<UserOptionDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rolesKey = (roles ?? ["device_admin"]).join(",");
  const excludeKey = (excludeIds ?? []).join(",");

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const query: UseUserOptionsParams = {
        roles: roles === undefined ? ["device_admin"] : roles,
        active,
        q,
        excludeIds,
      };
      const res = await api<{ users: UserOptionDTO[] }>(`/api/users/options${buildQuery(query)}`);
      setUsers(res.users);
    } catch (err) {
      setUsers([]);
      setError(err instanceof ApiError ? err.message : "Could not load users.");
    } finally {
      setLoading(false);
    }
  }, [enabled, rolesKey, active, q, excludeKey, roles, excludeIds]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { users, loading, error, refresh };
}

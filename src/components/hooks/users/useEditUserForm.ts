"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ROLE_PERMISSIONS } from "@/constants/permissions";
import type { AdminUserDTO, RoleCatalogEntry } from "@/interfaces";
import type { PermissionSlug } from "@/interfaces/permissions";
import type { UserRole } from "@/interfaces/session";
import { USER_ROLES } from "@/constants/roles";
import { api, ApiError } from "@/lib/http/apiClient";
import { updateUserSchema } from "@/schemas/user";
import { zodFieldErrors } from "@/schemas/formErrors";
import { toast } from "@/store/toastStore";

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((p) => set.has(p));
}

/** Path segments under `/users/` that are pages, not user ids. */
const RESERVED_USER_IDS = new Set(["new"]);

/** Edit page for `/users/[id]` — real users and pending `invite:…` rows. */
export function useEditUserForm(userId: string) {
  const router = useRouter();
  const isReserved = RESERVED_USER_IDS.has(userId);
  const [user, setUser] = useState<AdminUserDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [roleCatalog, setRoleCatalog] = useState<RoleCatalogEntry[]>([]);

  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("user");
  const [active, setActive] = useState(true);
  const [permissions, setPermissions] = useState<PermissionSlug[]>([]);
  const [lastResend, setLastResend] = useState<{
    emailSimulated: boolean;
    redeemUrl: string;
  } | null>(null);
  const [lastPasswordReset, setLastPasswordReset] = useState<{
    emailSimulated: boolean;
    resetUrl: string;
  } | null>(null);

  const presetFor = useCallback(
    (r: UserRole): PermissionSlug[] => {
      const entry = roleCatalog.find((c) => c.value === r);
      return entry ? [...entry.permissions] : [...(ROLE_PERMISSIONS[r] ?? [])];
    },
    [roleCatalog],
  );

  const deviationCount = useMemo(() => {
    const preset = presetFor(role);
    const added = permissions.filter((p) => !preset.includes(p)).length;
    const removed = preset.filter((p) => !permissions.includes(p)).length;
    return added + removed;
  }, [permissions, presetFor, role]);

  const loadCatalog = useCallback(async () => {
    try {
      const res = await api<{ roles: RoleCatalogEntry[] }>("/api/roles");
      setRoleCatalog(res.roles);
      return res.roles;
    } catch {
      const fallback: RoleCatalogEntry[] = USER_ROLES.map((value) => ({
        value,
        label: value,
        permissions: [...ROLE_PERMISSIONS[value]],
        userCount: 0,
      }));
      setRoleCatalog(fallback);
      return fallback;
    }
  }, []);

  const loadUser = useCallback(async () => {
    if (isReserved) return;
    setLoading(true);
    try {
      const [catalog, res] = await Promise.all([
        loadCatalog(),
        api<{ user: AdminUserDTO }>(`/api/users/${encodeURIComponent(userId)}`),
      ]);
      const u = res.user;
      setUser(u);
      setName(u.name);
      setRole(u.role);
      setActive(u.active);
      if (u.permissions != null) {
        setPermissions([...u.permissions]);
      } else {
        const entry = catalog.find((c) => c.value === u.role);
        setPermissions(entry ? [...entry.permissions] : [...(ROLE_PERMISSIONS[u.role] ?? [])]);
      }
      setFieldErrors({});
      setLastResend(null);
      setLastPasswordReset(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "User not found.");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [userId, loadCatalog, isReserved]);

  useEffect(() => {
    if (isReserved) {
      router.replace("/users/new");
      return;
    }
    void loadUser();
  }, [loadUser, isReserved, router]);

  const selectRole = useCallback(
    (next: UserRole) => {
      setRole(next);
      const entry = roleCatalog.find((c) => c.value === next);
      setPermissions(entry ? [...entry.permissions] : [...(ROLE_PERMISSIONS[next] ?? [])]);
    },
    [roleCatalog],
  );

  const resetToPreset = useCallback(() => {
    setPermissions(presetFor(role));
  }, [presetFor, role]);

  const togglePermission = useCallback((slug: PermissionSlug) => {
    setPermissions((prev) =>
      prev.includes(slug) ? prev.filter((p) => p !== slug) : [...prev, slug],
    );
  }, []);

  const isInvited = user?.status === "invited";
  const invitationId = user?.invitationId ?? null;

  const submit = useCallback(async () => {
    if (!user || isInvited) return;
    setBusy(true);
    setFieldErrors({});
    try {
      const bodyPermissions = sameSet(permissions, presetFor(role)) ? null : permissions;
      const parsed = updateUserSchema.safeParse({
        name,
        role,
        active,
        permissions: bodyPermissions,
      });
      if (!parsed.success) {
        setFieldErrors(zodFieldErrors(parsed.error));
        return;
      }
      const res = await api<{ user: AdminUserDTO }>(`/api/users/${encodeURIComponent(user.id)}`, {
        method: "PATCH",
        body: JSON.stringify(parsed.data),
      });
      setUser(res.user);
      toast.success("User updated.");
      router.push("/users");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }, [user, isInvited, name, role, active, permissions, presetFor, router]);

  const lock = useCallback(async () => {
    if (!user || isInvited) return;
    if (user.id === undefined) return;
    setBusy(true);
    try {
      const res = await api<{ user: AdminUserDTO }>(`/api/users/${encodeURIComponent(user.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ name: user.name, role: user.role, active: false }),
      });
      setUser(res.user);
      setActive(false);
      toast.success("Account locked.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Lock failed.");
    } finally {
      setBusy(false);
    }
  }, [user, isInvited]);

  const unlock = useCallback(async () => {
    if (!user || isInvited) return;
    setBusy(true);
    try {
      const res = await api<{ user: AdminUserDTO }>(`/api/users/${encodeURIComponent(user.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ name: user.name, role: user.role, active: true }),
      });
      setUser(res.user);
      setActive(true);
      toast.success("Account unlocked.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unlock failed.");
    } finally {
      setBusy(false);
    }
  }, [user, isInvited]);

  const resendInvite = useCallback(async () => {
    if (!invitationId) return;
    setBusy(true);
    setLastResend(null);
    try {
      const res = await api<{
        invite: { emailSimulated: boolean; redeemUrl: string; email: string };
      }>(`/api/users/invites/${encodeURIComponent(invitationId)}/resend`, { method: "POST" });
      if (res.invite.emailSimulated) {
        setLastResend({ emailSimulated: true, redeemUrl: res.invite.redeemUrl });
        toast.success("Invitation resent (email simulated — copy the redeem link).");
      } else {
        toast.success(`Invitation resent to ${res.invite.email}.`);
      }
      await loadUser();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Resend failed.");
    } finally {
      setBusy(false);
    }
  }, [invitationId, loadUser]);

  const triggerPasswordReset = useCallback(async () => {
    if (!user || isInvited) return;
    setBusy(true);
    setLastPasswordReset(null);
    try {
      const res = await api<{
        reset: { emailSimulated: boolean; resetUrl: string; email: string };
      }>(`/api/users/${encodeURIComponent(user.id)}/reset-password`, { method: "POST" });
      if (res.reset.emailSimulated) {
        setLastPasswordReset({ emailSimulated: true, resetUrl: res.reset.resetUrl });
        toast.success("Reset link created (email simulated — copy the link).");
      } else {
        toast.success(`Password reset email sent to ${res.reset.email}.`);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Reset failed.");
    } finally {
      setBusy(false);
    }
  }, [user, isInvited]);

  const withdrawInvite = useCallback(async () => {
    if (!invitationId) return;
    setBusy(true);
    try {
      await api(`/api/users/invites/${encodeURIComponent(invitationId)}`, { method: "DELETE" });
      toast.success("Invitation withdrawn.");
      router.push("/users");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Withdraw failed.");
    } finally {
      setBusy(false);
    }
  }, [invitationId, router]);

  return {
    user,
    loading: isReserved ? false : loading,
    busy,
    fieldErrors,
    name,
    setName,
    role,
    selectRole,
    active,
    setActive,
    permissions,
    togglePermission,
    resetToPreset,
    deviationCount,
    roleCatalog,
    presetFor,
    isInvited,
    lastResend,
    setLastResend,
    lastPasswordReset,
    setLastPasswordReset,
    submit,
    lock,
    unlock,
    resendInvite,
    withdrawInvite,
    triggerPasswordReset,
    reload: loadUser,
  };
}

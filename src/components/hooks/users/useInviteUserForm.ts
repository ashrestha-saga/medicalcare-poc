"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ROLE_PERMISSIONS } from "@/constants/permissions";
import type { RoleCatalogEntry } from "@/interfaces";
import type { PermissionSlug } from "@/interfaces/permissions";
import type { UserRole } from "@/interfaces/session";
import { USER_ROLES } from "@/constants/roles";
import { api, ApiError } from "@/lib/http/apiClient";
import { createClinicInviteSchema } from "@/schemas/invite";
import { zodFieldErrors } from "@/schemas/formErrors";
import { toast } from "@/store/toastStore";

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((p) => set.has(p));
}

/** Invite-user form for `/users/new` — role must be chosen before person/permissions. */
export function useInviteUserForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [roleCatalog, setRoleCatalog] = useState<RoleCatalogEntry[]>([]);
  const [catalogLoaded, setCatalogLoaded] = useState(false);

  const [roleSelected, setRoleSelected] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole | null>(null);
  const [permissions, setPermissions] = useState<PermissionSlug[]>([]);
  const [lastInviteResult, setLastInviteResult] = useState<{
    emailSimulated: boolean;
    redeemUrl: string;
    email: string;
  } | null>(null);

  const presetFor = useCallback(
    (r: UserRole): PermissionSlug[] => {
      const entry = roleCatalog.find((c) => c.value === r);
      return entry ? [...entry.permissions] : [...(ROLE_PERMISSIONS[r] ?? [])];
    },
    [roleCatalog],
  );

  const deviationCount = useMemo(() => {
    if (!role) return 0;
    const preset = presetFor(role);
    const added = permissions.filter((p) => !preset.includes(p)).length;
    const removed = preset.filter((p) => !permissions.includes(p)).length;
    return added + removed;
  }, [permissions, presetFor, role]);

  const loadCatalog = useCallback(async () => {
    try {
      const res = await api<{ roles: RoleCatalogEntry[] }>("/api/roles");
      setRoleCatalog(res.roles);
      setCatalogLoaded(true);
      return res.roles;
    } catch {
      const fallback: RoleCatalogEntry[] = USER_ROLES.map((value) => ({
        value,
        label: value,
        permissions: [...ROLE_PERMISSIONS[value]],
        userCount: 0,
      }));
      setRoleCatalog(fallback);
      setCatalogLoaded(true);
      return fallback;
    }
  }, []);

  useEffect(() => {
    if (!catalogLoaded) void loadCatalog();
  }, [catalogLoaded, loadCatalog]);

  const selectRole = useCallback(
    async (next: UserRole) => {
      const catalog = catalogLoaded ? roleCatalog : await loadCatalog();
      const entry = catalog.find((c) => c.value === next);
      setRole(next);
      setRoleSelected(true);
      setPermissions(entry ? [...entry.permissions] : [...(ROLE_PERMISSIONS[next] ?? [])]);
      setFieldErrors({});
      setLastInviteResult(null);
    },
    [catalogLoaded, roleCatalog, loadCatalog],
  );

  const resetToPreset = useCallback(() => {
    if (!role) return;
    const entry = roleCatalog.find((c) => c.value === role);
    setPermissions(entry ? [...entry.permissions] : [...(ROLE_PERMISSIONS[role] ?? [])]);
  }, [role, roleCatalog]);

  const togglePermission = useCallback((slug: PermissionSlug) => {
    setPermissions((prev) =>
      prev.includes(slug) ? prev.filter((p) => p !== slug) : [...prev, slug],
    );
  }, []);

  const canSubmit = Boolean(roleSelected && role && name.trim() && email.trim() && !busy);

  const submit = useCallback(async () => {
    if (!role) return;
    setBusy(true);
    setFieldErrors({});
    setLastInviteResult(null);
    try {
      const parsed = createClinicInviteSchema.safeParse({
        email,
        name,
        role,
        permissions,
      });
      if (!parsed.success) {
        setFieldErrors(zodFieldErrors(parsed.error));
        return;
      }
      const body = { ...parsed.data };
      const preset = presetFor(role);
      if (sameSet(permissions, preset)) {
        body.permissions = null;
      }
      const res = await api<{
        invite: { emailSimulated: boolean; redeemUrl: string; email: string };
      }>("/api/users/invites", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (res.invite.emailSimulated) {
        setLastInviteResult({
          emailSimulated: true,
          redeemUrl: res.invite.redeemUrl,
          email: res.invite.email,
        });
        toast.success("Invitation created (email simulated — copy the redeem link).");
      } else {
        toast.success(`Invitation email sent to ${res.invite.email}.`);
        router.push("/users");
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Invite failed.");
    } finally {
      setBusy(false);
    }
  }, [email, name, role, permissions, presetFor, router]);

  const done = useCallback(() => {
    router.push("/users");
  }, [router]);

  return {
    busy,
    fieldErrors,
    roleCatalog,
    catalogLoaded,
    roleSelected,
    email,
    setEmail,
    name,
    setName,
    role,
    selectRole,
    permissions,
    togglePermission,
    resetToPreset,
    deviationCount,
    lastInviteResult,
    canSubmit,
    submit,
    done,
    presetFor,
  };
}

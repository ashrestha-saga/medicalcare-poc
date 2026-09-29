"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ROLE_PERMISSIONS } from "@/constants/permissions";
import type { AdminUserDTO, RoleCatalogEntry } from "@/interfaces";
import type { PermissionSlug } from "@/interfaces/permissions";
import type { UserRole } from "@/interfaces/session";
import { api, ApiError } from "@/lib/http/apiClient";
import { updateUserSchema } from "@/schemas/user";
import { createClinicInviteSchema } from "@/schemas/invite";
import { zodFieldErrors } from "@/schemas/formErrors";
import { toast } from "@/store/toastStore";
import { USER_ROLES } from "@/constants/roles";

export type UserFormMode = "create" | "edit";

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((p) => set.has(p));
}

export function useUserForm(onSaved: () => void) {
  const [mode, setMode] = useState<UserFormMode>("create");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUserDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [roleCatalog, setRoleCatalog] = useState<RoleCatalogEntry[]>([]);
  const [catalogLoaded, setCatalogLoaded] = useState(false);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("user");
  const [active, setActive] = useState(true);
  const [permissions, setPermissions] = useState<PermissionSlug[]>([]);
  const [lastInviteResult, setLastInviteResult] = useState<{
    emailSimulated: boolean;
    redeemUrl: string;
  } | null>(null);

  const presetFor = useCallback(
    (r: UserRole): PermissionSlug[] => {
      const entry = roleCatalog.find((c) => c.value === r);
      return entry ? [...entry.permissions] : [];
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
      setCatalogLoaded(true);
      return res.roles;
    } catch {
      // users:create without roles:view — fall back to static defaults
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
    if (open && !catalogLoaded) void loadCatalog();
  }, [open, catalogLoaded, loadCatalog]);

  const close = useCallback(() => {
    setOpen(false);
    setEditing(null);
    setFieldErrors({});
    setBusy(false);
    setLastInviteResult(null);
  }, []);

  const applyRolePreset = useCallback(
    (nextRole: UserRole, catalog = roleCatalog) => {
      setRole(nextRole);
      const entry = catalog.find((c) => c.value === nextRole);
      setPermissions(entry ? [...entry.permissions] : []);
    },
    [roleCatalog],
  );

  const openCreate = useCallback(async () => {
    setMode("create");
    setEditing(null);
    setEmail("");
    setName("");
    setActive(true);
    setFieldErrors({});
    setLastInviteResult(null);
    const catalog = catalogLoaded ? roleCatalog : await loadCatalog();
    const entry = catalog.find((c) => c.value === "user") ?? catalog[0];
    const nextRole = (entry?.value ?? "user") as UserRole;
    setRole(nextRole);
    setPermissions(entry ? [...entry.permissions] : []);
    setOpen(true);
  }, [catalogLoaded, roleCatalog, loadCatalog]);

  const openEdit = useCallback(
    async (user: AdminUserDTO) => {
      if (user.status === "invited") {
        toast.info("Pending invitations cannot be edited yet. Wait for the user to accept.");
        return;
      }
      setMode("edit");
      setEditing(user);
      setEmail(user.email);
      setName(user.name);
      setRole(user.role);
      setActive(user.active);
      setFieldErrors({});
      setLastInviteResult(null);
      const catalog = catalogLoaded ? roleCatalog : await loadCatalog();
      if (user.permissions != null) {
        setPermissions([...user.permissions]);
      } else {
        const entry = catalog.find((c) => c.value === user.role);
        setPermissions(entry ? [...entry.permissions] : []);
      }
      setOpen(true);
    },
    [catalogLoaded, roleCatalog, loadCatalog],
  );

  const selectRole = useCallback(
    (next: UserRole) => {
      applyRolePreset(next);
    },
    [applyRolePreset],
  );

  const resetToPreset = useCallback(() => {
    applyRolePreset(role);
  }, [applyRolePreset, role]);

  const togglePermission = useCallback((slug: PermissionSlug) => {
    setPermissions((prev) =>
      prev.includes(slug) ? prev.filter((p) => p !== slug) : [...prev, slug],
    );
  }, []);

  const submit = useCallback(async () => {
    setBusy(true);
    setFieldErrors({});
    setLastInviteResult(null);
    try {
      if (mode === "create") {
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
          });
          toast.success("Invitation created (email simulated — copy the redeem link).");
        } else {
          toast.success(`Invitation email sent to ${res.invite.email}.`);
          close();
          onSaved();
          return;
        }
        onSaved();
        return;
      }

      if (editing) {
        const parsed = updateUserSchema.safeParse({
          name,
          role,
          active,
          permissions,
        });
        if (!parsed.success) {
          setFieldErrors(zodFieldErrors(parsed.error));
          return;
        }
        await api(`/api/users/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(parsed.data),
        });
        toast.success("User updated.");
        close();
        onSaved();
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }, [
    mode,
    email,
    name,
    role,
    permissions,
    active,
    editing,
    presetFor,
    close,
    onSaved,
  ]);

  return {
    open,
    mode,
    editing,
    busy,
    fieldErrors,
    email,
    setEmail,
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
    lastInviteResult,
    openCreate,
    openEdit,
    close,
    submit,
  };
}

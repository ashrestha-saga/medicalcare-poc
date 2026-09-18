"use client";

import { useEffect, useMemo, useState } from "react";
import { SUPERADMIN_LOCKED_PERMISSIONS } from "@/constants/permissions";
import { useRolesCatalog } from "@/components/hooks/users/useRolesCatalog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/Loading";
import type { PermissionSlug, RoleCatalogEntry } from "@/interfaces";
import type { UserRole } from "@/interfaces/session";

function RoleEditor({
  role,
  allPermissions,
  canUpdate,
  saving,
  onSave,
}: {
  role: RoleCatalogEntry;
  allPermissions: PermissionSlug[];
  canUpdate: boolean;
  saving: boolean;
  onSave: (role: UserRole, permissions: string[]) => Promise<boolean>;
}) {
  const locked = useMemo(
    () =>
      role.value === "superadmin"
        ? new Set<string>(SUPERADMIN_LOCKED_PERMISSIONS)
        : new Set<string>(),
    [role.value],
  );
  const [draft, setDraft] = useState<Set<string>>(() => new Set(role.permissions));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(new Set(role.permissions));
  }, [role.permissions, editing]);

  const dirty = useMemo(() => {
    if (draft.size !== role.permissions.length) return true;
    return role.permissions.some((p) => !draft.has(p));
  }, [draft, role.permissions]);

  function toggle(slug: PermissionSlug, checked: boolean) {
    if (locked.has(slug)) return;
    setDraft((prev) => {
      const next = new Set(prev);
      if (checked) next.add(slug);
      else next.delete(slug);
      return next;
    });
  }

  async function handleSave() {
    const ok = await onSave(role.value, [...draft]);
    if (ok) setEditing(false);
  }

  function handleCancel() {
    setDraft(new Set(role.permissions));
    setEditing(false);
  }

  return (
    <li className="p-admin__card p-roles__card" data-testid="role-row">
      <div className="p-admin__card-main">
        <div className="p-roles__title-row">
          <div>
            <strong>{role.label}</strong>
            <span className="p-admin__meta">
              {role.value} · {role.userCount} user{role.userCount === 1 ? "" : "s"}
            </span>
          </div>
          {canUpdate && !editing && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
              data-testid={`role-edit-${role.value}`}
            >
              Edit
            </Button>
          )}
        </div>

        {!editing ? (
          <div className="p-admin__slugs">
            {role.permissions.map((slug) => (
              <code key={slug}>{slug}</code>
            ))}
          </div>
        ) : (
          <div className="p-roles__edit" data-testid={`role-edit-panel-${role.value}`}>
            <div className="p-roles__grid">
              {allPermissions.map((slug) => {
                const isLocked = locked.has(slug);
                const id = `perm-${role.value}-${slug}`;
                return (
                  <label key={slug} className="p-roles__perm" htmlFor={id}>
                    <Checkbox
                      id={id}
                      checked={draft.has(slug)}
                      disabled={saving || isLocked}
                      onCheckedChange={(v) => toggle(slug, v === true)}
                      data-testid={`role-perm-${role.value}-${slug}`}
                    />
                    <span>
                      <code>{slug}</code>
                      {isLocked ? <em className="p-roles__locked">required</em> : null}
                    </span>
                  </label>
                );
              })}
            </div>
            <div className="p-roles__actions">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={saving}
                onClick={handleCancel}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={saving || !dirty || draft.size === 0}
                onClick={() => void handleSave()}
                data-testid={`role-save-${role.value}`}
              >
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

/** DB-backed role catalog — editable with roles:update (Phase B). */
export function RolesScreen() {
  const {
    roles,
    allPermissions,
    loading,
    canView,
    canUpdate,
    savingRole,
    saveRole,
  } = useRolesCatalog();

  if (!canView) {
    return (
      <div className="p-work" data-testid="roles-denied">
        <main className="p-main">
          <section className="p-devhead">
            <h2>Roles</h2>
            <p className="p-requests__sub">You don&apos;t have permission to view roles.</p>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="p-work" data-testid="roles-page">
      <main className="p-main">
        <div className="p-admin">
          <section className="p-devhead p-admin__head">
            <h2>Roles</h2>
            <p className="p-requests__sub">
              {canUpdate
                ? "Edit which permission slugs each fixed role receives. Changes apply on next capability refresh."
                : "Fixed roles and their permission slugs."}
            </p>
          </section>

          {loading ? (
            <div className="p-wait">
              <Spinner />
            </div>
          ) : (
            <ul className="p-admin__list" data-testid="roles-list">
              {roles.map((r) => (
                <RoleEditor
                  key={r.value}
                  role={r}
                  allPermissions={allPermissions}
                  canUpdate={canUpdate}
                  saving={savingRole === r.value}
                  onSave={saveRole}
                />
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}

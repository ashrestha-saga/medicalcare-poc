"use client";

import { Spinner } from "@/components/ui/Loading";
import { useRolesCatalog } from "@/components/hooks/users/useRolesCatalog";

/** Read-only role catalog (Phase A) — grants come from ROLE_PERMISSIONS. */
export function RolesScreen() {
  const { roles, loading, canView } = useRolesCatalog();

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
              Fixed roles and their permission slugs. Editable grants land in a later phase.
            </p>
          </section>

          {loading ? (
            <div className="p-wait">
              <Spinner />
            </div>
          ) : (
            <ul className="p-admin__list" data-testid="roles-list">
              {roles.map((r) => (
                <li key={r.value} className="p-admin__card" data-testid="role-row">
                  <div className="p-admin__card-main">
                    <strong>{r.label}</strong>
                    <span className="p-admin__meta">
                      {r.value} · {r.userCount} user{r.userCount === 1 ? "" : "s"}
                    </span>
                    <div className="p-admin__slugs">
                      {r.permissions.map((slug) => (
                        <code key={slug}>{slug}</code>
                      ))}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}

"use client";

import { useUsersList } from "@/components/hooks/users/useUsersList";
import { UsersTable } from "./users-table";

/** Superadmin user management — gated by users:* permission slugs. */
export function UsersScreen() {
  const list = useUsersList();

  if (!list.canView) {
    return (
      <div className="p-work" data-testid="users-denied">
        <main className="p-main">
          <section className="p-devhead">
            <h2>Users</h2>
            <p className="p-requests__sub">You don&apos;t have permission to view users.</p>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="p-work" data-testid="users-page">
      <main className="p-main">
        <div className="p-admin">
          <section className="p-devhead p-admin__head">
            <div className="p-admin__head-copy">
              <h2>Users</h2>
              <p className="p-requests__sub">Create clinic accounts and assign roles</p>
            </div>
          </section>

          <UsersTable list={list} />
        </div>
      </main>
    </div>
  );
}

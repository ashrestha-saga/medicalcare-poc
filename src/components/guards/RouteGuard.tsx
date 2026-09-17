"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Loading } from "@/components/ui/Loading";
import { usePermissions } from "@/lib/providers/PermissionProvider";

/**
 * Path-level RBAC: wait for capabilities, then allow or show 403.
 * Does not take role props — reads PermissionProvider + current path.
 */
export function RouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { permissionsLoading, checkRouteAccess } = usePermissions();

  if (permissionsLoading) {
    return <Loading label="Loading access…" />;
  }

  if (!checkRouteAccess(pathname, "get")) {
    return (
      <div className="p-work" data-testid="forbidden">
        <main className="p-main">
          <section className="p-devhead">
            <h2>Access denied</h2>
            <p className="p-requests__sub">You do not have permission to open this page.</p>
          </section>
        </main>
      </div>
    );
  }

  return <>{children}</>;
}

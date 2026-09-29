"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Loading } from "@/components/ui/Loading";
import { canAccessConsolePath } from "@/constants/partnerPermissions";
import { usePermissions } from "@/lib/providers/PermissionProvider";

/** Path-level RBAC for /partner/* using console:* capabilities. */
export function PartnerRouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { permissionsLoading, permissionData } = usePermissions();

  if (permissionsLoading) {
    return <Loading label="Loading access…" />;
  }

  const granted = permissionData?.permissions ?? [];
  if (!canAccessConsolePath(pathname, granted)) {
    return (
      <div className="p-work" data-testid="console-forbidden">
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

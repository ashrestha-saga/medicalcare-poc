"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loading } from "@/components/ui/Loading";
import { AccessDenied } from "@/components/features/shared/AccessDenied";
import { usePermissions } from "@/lib/providers/PermissionProvider";

/**
 * Path-level RBAC: wait for capabilities, then allow or show 403.
 * Does not take role props — reads PermissionProvider + current path.
 */
export function RouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const t = useTranslations("common");
  const { permissionsLoading, checkRouteAccess } = usePermissions();

  if (permissionsLoading) {
    return <Loading label="Loading access…" />;
  }

  if (!checkRouteAccess(pathname, "get")) {
    return (
      <AccessDenied
        title={t("denied")}
        description={t("contactAdmin")}
        testId="forbidden"
      />
    );
  }

  return <>{children}</>;
}

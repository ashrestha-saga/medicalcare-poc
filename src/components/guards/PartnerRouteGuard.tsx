"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loading } from "@/components/ui/Loading";
import { AccessDenied } from "@/components/features/shared/AccessDenied";
import { canAccessConsolePath } from "@/constants/partnerPermissions";
import { usePermissions } from "@/lib/providers/PermissionProvider";

/** Path-level RBAC for /partner/* using console:* capabilities. */
export function PartnerRouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const t = useTranslations("common");
  const { permissionsLoading, permissionData } = usePermissions();

  if (permissionsLoading) {
    return <Loading label="Loading access…" />;
  }

  const granted = permissionData?.permissions ?? [];
  if (!canAccessConsolePath(pathname, granted)) {
    return (
      <AccessDenied
        title={t("denied")}
        description={t("contactAdmin")}
        testId="console-forbidden"
      />
    );
  }

  return <>{children}</>;
}

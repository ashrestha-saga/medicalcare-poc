"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { RequestScope } from "@/interfaces";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { useSessionStore } from "@/store/sessionStore";

/**
 * Permission-derived request UI capabilities (UX only — API still enforces).
 */
export function useRequestCapabilities() {
  const t = useTranslations("filters");
  const role = useSessionStore((s) => s.user?.role);
  const { checkPermission } = usePermissions();
  const canWork = checkPermission("requests:transition");
  const canViewOpen = checkPermission("requests:view-open");
  const canViewAll = checkPermission("requests:view-all");

  const scopes = useMemo(() => {
    const list: { id: RequestScope; label: string }[] = [{ id: "mine", label: t("scopeMine") }];
    if (canViewOpen) list.push({ id: "open", label: t("scopeOpen") });
    if (canViewAll) list.push({ id: "all", label: t("scopeAll") });
    return list;
  }, [canViewOpen, canViewAll, t]);

  const defaultScope: RequestScope = canViewOpen ? "open" : "mine";

  return { role, canWork, canViewAll, canViewOpen, scopes, defaultScope };
}

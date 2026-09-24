"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { ROLES } from "@/constants/roles";
import { DropdownFilter, FilterToolbar } from "@/components/features/shared/filters";

interface UsersFilterToolbarProps {
  roleFilter: string[] | null;
  statusFilter: string[] | null;
  onRoleChange: (value: string | string[] | null) => void;
  onStatusChange: (value: string | string[] | null) => void;
  onClearAll: () => void;
}

export function UsersFilterToolbar({
  roleFilter,
  statusFilter,
  onRoleChange,
  onStatusChange,
  onClearAll,
}: UsersFilterToolbarProps) {
  const t = useTranslations("filters");
  const tRoles = useTranslations("roles");
  const hasActiveFilters = Boolean(roleFilter?.length || statusFilter?.length);

  const roleOptions = useMemo(
    () => ROLES.map((r) => ({ value: r.value, label: tRoles(r.value) })),
    [tRoles],
  );

  const statusOptions = useMemo(
    () => [
      { value: "active", label: t("active"), colorCode: "#2fd98a" },
      { value: "inactive", label: t("inactive"), colorCode: "#ff3366" },
    ],
    [t],
  );

  return (
    <FilterToolbar hasActiveFilters={hasActiveFilters} onClearAll={onClearAll}>
      <DropdownFilter
        label={t("role")}
        value={roleFilter}
        options={roleOptions}
        onChange={onRoleChange}
        multiple
      />
      <DropdownFilter
        label={t("status")}
        value={statusFilter}
        options={statusOptions}
        onChange={onStatusChange}
        multiple
      />
    </FilterToolbar>
  );
}

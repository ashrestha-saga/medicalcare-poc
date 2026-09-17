"use client";

import { ROLES } from "@/constants/roles";
import { DropdownFilter, FilterToolbar } from "@/components/features/shared/filters";

const STATUS_OPTIONS = [
  { value: "active", label: "Active", colorCode: "#2fd98a" },
  { value: "inactive", label: "Inactive", colorCode: "#ff3366" },
];

const ROLE_OPTIONS = ROLES.map((r) => ({ value: r.value, label: r.label }));

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
  const hasActiveFilters = Boolean(roleFilter?.length || statusFilter?.length);

  return (
    <FilterToolbar hasActiveFilters={hasActiveFilters} onClearAll={onClearAll}>
      <DropdownFilter
        label="Role"
        value={roleFilter}
        options={ROLE_OPTIONS}
        onChange={onRoleChange}
        multiple
      />
      <DropdownFilter
        label="Status"
        value={statusFilter}
        options={STATUS_OPTIONS}
        onChange={onStatusChange}
        multiple
      />
    </FilterToolbar>
  );
}

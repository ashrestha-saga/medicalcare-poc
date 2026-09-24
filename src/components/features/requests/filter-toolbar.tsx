"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { RequestScope } from "@/interfaces";
import { DropdownFilter, FilterToolbar } from "@/components/features/shared/filters";
import { SERVICE_REQUEST_STATE_FILTER_OPTIONS } from "@/constants/serviceRequest";

interface RequestsFilterToolbarProps {
  scopes: { id: RequestScope; label: string }[];
  scope: RequestScope;
  onScopeChange: (scope: RequestScope) => void;
  stateFilter: string[] | null;
  onStateChange: (value: string | string[] | null) => void;
  onClearAll: () => void;
}

export function RequestsFilterToolbar({
  scopes,
  scope,
  onScopeChange,
  stateFilter,
  onStateChange,
  onClearAll,
}: RequestsFilterToolbarProps) {
  const t = useTranslations("filters");
  const tStatus = useTranslations("status");
  const hasActiveFilters = Boolean(stateFilter?.length);

  const statusOptions = useMemo(
    () =>
      SERVICE_REQUEST_STATE_FILTER_OPTIONS.map((o) => ({
        ...o,
        label: tStatus.has(o.value) ? tStatus(o.value) : o.label,
      })),
    [tStatus],
  );

  return (
    <FilterToolbar hasActiveFilters={hasActiveFilters} onClearAll={onClearAll}>
      <DropdownFilter
        label={t("scope")}
        value={scope}
        options={scopes.map((s) => ({ value: s.id, label: s.label }))}
        onChange={(value) => {
          const next = typeof value === "string" ? value : Array.isArray(value) ? value[0] : null;
          if (next === "mine" || next === "open" || next === "all") onScopeChange(next);
        }}
      />
      <DropdownFilter
        label={t("status")}
        value={stateFilter}
        options={statusOptions}
        onChange={onStateChange}
        multiple
      />
    </FilterToolbar>
  );
}

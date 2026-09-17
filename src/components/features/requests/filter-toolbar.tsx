"use client";

import type { RequestScope } from "@/interfaces";
import { DropdownFilter, FilterToolbar } from "@/components/features/shared/filters";

const STATE_OPTIONS = [
  { value: "captured", label: "Captured", colorCode: "#93a6b4" },
  { value: "queued", label: "Queued", colorCode: "#1e7fe0" },
  { value: "transmitted", label: "Transmitted", colorCode: "#1e7fe0" },
  { value: "acknowledged", label: "Acknowledged", colorCode: "#1e7fe0" },
  { value: "in_progress", label: "In progress", colorCode: "#f5a524" },
  { value: "completed", label: "Completed", colorCode: "#2fd98a" },
  { value: "rejected", label: "Rejected", colorCode: "#ff3366" },
];

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
  const hasActiveFilters = Boolean(stateFilter?.length);

  return (
    <FilterToolbar hasActiveFilters={hasActiveFilters} onClearAll={onClearAll}>
      <DropdownFilter
        label="Scope"
        value={scope}
        options={scopes.map((s) => ({ value: s.id, label: s.label }))}
        onChange={(value) => {
          const next = typeof value === "string" ? value : Array.isArray(value) ? value[0] : null;
          if (next === "mine" || next === "open" || next === "all") onScopeChange(next);
        }}
      />
      <DropdownFilter
        label="Status"
        value={stateFilter}
        options={STATE_OPTIONS}
        onChange={onStateChange}
        multiple
      />
    </FilterToolbar>
  );
}

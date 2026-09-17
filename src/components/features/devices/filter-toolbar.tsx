"use client";

import type { SiteDTO } from "@/interfaces";
import { DropdownFilter, FilterToolbar } from "@/components/features/shared/filters";

interface DevicesFilterToolbarProps {
  sites: SiteDTO[];
  siteFilter: string | null;
  onSiteChange: (value: string | string[] | null) => void;
  onClearAll: () => void;
}

export function DevicesFilterToolbar({
  sites,
  siteFilter,
  onSiteChange,
  onClearAll,
}: DevicesFilterToolbarProps) {
  const hasActiveFilters = Boolean(siteFilter);
  const options = sites.map((s) => ({ value: s.id, label: s.name }));

  return (
    <FilterToolbar hasActiveFilters={hasActiveFilters} onClearAll={onClearAll}>
      <DropdownFilter label="Site" value={siteFilter} options={options} onChange={onSiteChange} />
    </FilterToolbar>
  );
}

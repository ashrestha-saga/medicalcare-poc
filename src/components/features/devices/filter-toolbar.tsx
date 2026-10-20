"use client";

import { useTranslations } from "next-intl";
import type { SiteDTO } from "@/interfaces";
import { DropdownFilter, FilterToolbar } from "@/components/features/shared/filters";
import { Button } from "@/components/ui/button";
import type { DeviceStateFilter } from "@/components/hooks/devices/useDevicesList";
import { cn } from "@/lib/utils";

interface DevicesFilterToolbarProps {
  sites: SiteDTO[];
  siteFilter: string | null;
  onSiteChange: (value: string | string[] | null) => void;
  stateFilter: DeviceStateFilter;
  onStateChange: (value: string | string[] | null) => void;
  mineArea: boolean;
  onMineAreaChange: (value: boolean) => void;
  onClearAll: () => void;
}

const STATE_OPTIONS: { value: string; labelKey: string }[] = [
  { value: "draft", labelKey: "stateDraft" },
  { value: "review", labelKey: "stateReview" },
  { value: "released", labelKey: "stateReleased" },
  { value: "retired", labelKey: "stateRetired" },
  { value: "not_released", labelKey: "stateNotReleased" },
];

export function DevicesFilterToolbar({
  sites,
  siteFilter,
  onSiteChange,
  stateFilter,
  onStateChange,
  mineArea,
  onMineAreaChange,
  onClearAll,
}: DevicesFilterToolbarProps) {
  const t = useTranslations("filters");
  const hasActiveFilters = Boolean(siteFilter || stateFilter || mineArea);
  const siteOptions = sites.map((s) => ({ value: s.id, label: s.name }));

  return (
    <FilterToolbar hasActiveFilters={hasActiveFilters} onClearAll={onClearAll}>
      <DropdownFilter label={t("site")} value={siteFilter} options={siteOptions} onChange={onSiteChange} />
      <DropdownFilter
        label={t("status")}
        value={stateFilter}
        options={STATE_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
        onChange={onStateChange}
      />
      <Button
        type="button"
        size="sm"
        variant={mineArea ? "default" : "outline"}
        className={cn("h-8", mineArea && "pointer-events-auto")}
        onClick={() => onMineAreaChange(!mineArea)}
        data-testid="devices-filter-mine-area"
        aria-pressed={mineArea}
      >
        {mineArea ? t("mineAreaActive") : t("mineArea")}
      </Button>
    </FilterToolbar>
  );
}

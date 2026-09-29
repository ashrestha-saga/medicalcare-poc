"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { DropdownFilter, FilterToolbar } from "@/components/features/shared/filters";

const RESOURCE_VALUES = [
  "device",
  "request",
  "user",
  "role",
  "site",
  "catalog_model",
  "session",
  "order",
  "training",
  "capture",
  "oxid",
  "duty",
  "tenant",
] as const;

const ACTOR_KIND_VALUES = ["clinic", "partner", "system", "platform"] as const;

interface ActivityFilterToolbarProps {
  resourceFilter: string[] | null;
  actorKindFilter: string[] | null;
  onResourceChange: (value: string | string[] | null) => void;
  onActorKindChange: (value: string | string[] | null) => void;
  onClearAll: () => void;
}

export function ActivityFilterToolbar({
  resourceFilter,
  actorKindFilter,
  onResourceChange,
  onActorKindChange,
  onClearAll,
}: ActivityFilterToolbarProps) {
  const t = useTranslations("filters");
  const tRes = useTranslations("table.activity.resources");
  const tKind = useTranslations("table.activity.kinds");
  const hasActiveFilters = Boolean(resourceFilter?.length || actorKindFilter?.length);

  const resourceOptions = useMemo(
    () => RESOURCE_VALUES.map((value) => ({ value, label: tRes.has(value) ? tRes(value) : value })),
    [tRes],
  );
  const kindOptions = useMemo(
    () => ACTOR_KIND_VALUES.map((value) => ({ value, label: tKind.has(value) ? tKind(value) : value })),
    [tKind],
  );

  return (
    <FilterToolbar hasActiveFilters={hasActiveFilters} onClearAll={onClearAll}>
      <DropdownFilter
        label={t("resource")}
        value={resourceFilter}
        options={resourceOptions}
        onChange={onResourceChange}
        multiple
      />
      <DropdownFilter
        label={t("actorKind")}
        value={actorKindFilter}
        options={kindOptions}
        onChange={onActorKindChange}
        multiple
      />
    </FilterToolbar>
  );
}

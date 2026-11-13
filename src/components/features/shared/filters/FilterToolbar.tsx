"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

interface FilterToolbarProps {
  children: ReactNode;
  hasActiveFilters: boolean;
  onClearAll: () => void;
  /** Primary/secondary actions pinned to the right of the filter row. */
  trailing?: ReactNode;
}

export function FilterToolbar({ children, hasActiveFilters, onClearAll, trailing }: FilterToolbarProps) {
  const t = useTranslations("filters");
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="filter-toolbar">
      {children}
      {hasActiveFilters && (
        <Button type="button" variant="ghost" size="sm" className="h-8" onClick={onClearAll} data-testid="filters-clear-all">
          {t("clearAll")}
        </Button>
      )}
      {trailing ? <div className="ml-auto flex flex-wrap items-center gap-2">{trailing}</div> : null}
    </div>
  );
}

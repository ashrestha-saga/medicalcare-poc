"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

interface FilterToolbarProps {
  children: React.ReactNode;
  hasActiveFilters: boolean;
  onClearAll: () => void;
}

export function FilterToolbar({ children, hasActiveFilters, onClearAll }: FilterToolbarProps) {
  const t = useTranslations("filters");
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="filter-toolbar">
      {children}
      {hasActiveFilters && (
        <Button type="button" variant="ghost" size="sm" className="h-8" onClick={onClearAll} data-testid="filters-clear-all">
          {t("clearAll")}
        </Button>
      )}
    </div>
  );
}

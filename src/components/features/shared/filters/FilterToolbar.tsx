"use client";

import { Button } from "@/components/ui/button";

interface FilterToolbarProps {
  children: React.ReactNode;
  hasActiveFilters: boolean;
  onClearAll: () => void;
}

export function FilterToolbar({ children, hasActiveFilters, onClearAll }: FilterToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="filter-toolbar">
      {children}
      {hasActiveFilters && (
        <Button type="button" variant="ghost" size="sm" className="h-8" onClick={onClearAll} data-testid="filters-clear-all">
          Clear all
        </Button>
      )}
    </div>
  );
}

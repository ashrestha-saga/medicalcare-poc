"use client";

import { Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Table } from "@tanstack/react-table";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  search?: boolean;
  visibility?: boolean;
  keyword?: string;
  setKeyword?: (value: string) => void;
  setFilteringGlobal?: (value: string) => void;
  removeKeyword?: () => void;
  isLoading?: boolean;
  trailing?: React.ReactNode;
  searchPlaceholder?: string;
}

export function DataTableToolbar<TData>({
  table,
  search = false,
  visibility = false,
  keyword,
  setKeyword,
  setFilteringGlobal,
  removeKeyword,
  isLoading,
  trailing,
  searchPlaceholder = "Search…",
}: DataTableToolbarProps<TData>) {
  const value = setKeyword ? (keyword ?? "") : (table.getState().globalFilter as string) ?? "";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {search && (
        <div className="relative flex min-w-[180px] max-w-sm flex-1 items-center">
          <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={value}
            onChange={(e) => {
              const next = e.target.value;
              if (setKeyword) setKeyword(next);
              else setFilteringGlobal?.(next);
            }}
            placeholder={searchPlaceholder}
            className="h-8 pl-8 pr-8"
            data-testid="data-table-search"
          />
          {(value || isLoading) && (
            <div className="absolute right-1.5 flex items-center gap-0.5">
              {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              {value && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  aria-label="Clear search"
                  onClick={() => {
                    if (removeKeyword) removeKeyword();
                    else if (setKeyword) setKeyword("");
                    else setFilteringGlobal?.("");
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="ml-auto flex items-center gap-2">
        {trailing}
        {visibility && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8" data-testid="data-table-columns">
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(checked) => column.toggleVisibility(!!checked)}
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

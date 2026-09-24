"use client";

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Table } from "@tanstack/react-table";

interface DataTablePaginationProps<TData> {
  table: Table<TData>;
  currentPage?: number;
  totalPages?: number;
  pageSize?: number;
  setPage?: (page: number) => void;
  setPageSize?: (size: number) => void;
  totalItems?: number;
}

export function DataTablePagination<TData>({
  table,
  currentPage,
  totalPages,
  pageSize,
  setPage,
  setPageSize,
  totalItems,
}: DataTablePaginationProps<TData>) {
  const t = useTranslations("table");
  const serverDriven = currentPage != null && totalPages != null && setPage != null;
  const pageIndex = serverDriven ? currentPage - 1 : table.getState().pagination.pageIndex;
  const pageCount = serverDriven ? totalPages : table.getPageCount();
  const size = pageSize ?? table.getState().pagination.pageSize;
  const canPrev = serverDriven ? currentPage! > 1 : table.getCanPreviousPage();
  const canNext = serverDriven ? currentPage! < totalPages! : table.getCanNextPage();

  const goTo = (page: number) => {
    if (serverDriven) setPage?.(page);
    else table.setPageIndex(page - 1);
  };

  const changeSize = (next: number) => {
    if (setPageSize) setPageSize(next);
    else table.setPageSize(next);
    if (serverDriven) setPage?.(1);
    else table.setPageIndex(0);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{t("rowsPerPage")}</span>
        <Select value={String(size)} onValueChange={(v) => changeSize(Number(v))}>
          <SelectTrigger className="h-8 w-[70px]" data-testid="data-table-page-size">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[5, 10, 20, 30, 40, 50].map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {totalItems != null && <span>{t("totalItems", { count: totalItems })}</span>}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {t("pageOf", { page: pageCount === 0 ? 0 : pageIndex + 1, pages: pageCount })}
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={!canPrev}
            onClick={() => goTo(1)}
            aria-label={t("firstPage")}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={!canPrev}
            onClick={() => goTo(pageIndex)}
            aria-label={t("prevPage")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={!canNext}
            onClick={() => goTo(pageIndex + 2)}
            aria-label={t("nextPage")}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={!canNext}
            onClick={() => goTo(pageCount)}
            aria-label={t("lastPage")}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

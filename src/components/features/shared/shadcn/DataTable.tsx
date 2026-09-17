"use client";

import { useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type OnChangeFn,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { DataTableToolbar } from "./data-table-toolbar";
import { DataTablePagination } from "./data-table-pagination";

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  search?: boolean;
  visibility?: boolean;
  displayPagination?: boolean;
  currentPage?: number;
  totalPages?: number;
  pageSize?: number;
  setPage?: (page: number) => void;
  setPageSize?: (size: number) => void;
  totalItems?: number;
  keyword?: string;
  setKeyword?: (value: string) => void;
  removeKeyword?: () => void;
  isLoading?: boolean;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
  onRowClick?: (row: TData) => void;
  headerSticky?: boolean;
  toolbarTrailing?: React.ReactNode;
  emptyMessage?: string;
  className?: string;
  getRowId?: (row: TData) => string;
  searchPlaceholder?: string;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  search = false,
  visibility = false,
  displayPagination = true,
  currentPage,
  totalPages,
  pageSize: pageSizeProp,
  setPage,
  setPageSize,
  totalItems,
  keyword,
  setKeyword,
  removeKeyword,
  isLoading,
  rowSelection: rowSelectionProp,
  onRowSelectionChange,
  onRowClick,
  headerSticky,
  toolbarTrailing,
  emptyMessage = "No results.",
  className,
  getRowId,
  searchPlaceholder,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState("");
  const [internalSelection, setInternalSelection] = useState<RowSelectionState>({});
  const [clientPageIndex, setClientPageIndex] = useState(0);
  const [clientPageSize, setClientPageSize] = useState(pageSizeProp ?? 10);

  const serverDriven = currentPage != null && totalPages != null && setPage != null;
  const rowSelection = rowSelectionProp ?? internalSelection;
  const pageSize = pageSizeProp ?? clientPageSize;
  const pageIndex = serverDriven ? Math.max(0, (currentPage ?? 1) - 1) : clientPageIndex;

  const table = useReactTable({
    data,
    columns,
    getRowId,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter: setKeyword ? undefined : globalFilter,
      pagination: { pageIndex, pageSize },
    },
    enableRowSelection: true,
    manualPagination: serverDriven,
    pageCount: serverDriven ? totalPages : undefined,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setKeyword ? undefined : setGlobalFilter,
    onRowSelectionChange: onRowSelectionChange ?? setInternalSelection,
    onPaginationChange: (updater) => {
      const prev = { pageIndex, pageSize };
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (next.pageSize !== pageSize) {
        if (setPageSize) setPageSize(next.pageSize);
        else setClientPageSize(next.pageSize);
      }
      if (serverDriven) setPage?.(next.pageIndex + 1);
      else setClientPageIndex(next.pageIndex);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: serverDriven ? undefined : getPaginationRowModel(),
  });

  return (
    <div className={cn("space-y-3", className)} data-testid="data-table">
      {(search || visibility || toolbarTrailing) && (
        <DataTableToolbar
          table={table}
          search={search}
          visibility={visibility}
          keyword={keyword}
          setKeyword={setKeyword}
          setFilteringGlobal={setGlobalFilter}
          removeKeyword={removeKeyword}
          isLoading={isLoading}
          trailing={toolbarTrailing}
          searchPlaceholder={searchPlaceholder}
        />
      )}

      <div className="rounded-md border border-border bg-card/40">
        <Table>
          <TableHeader className={headerSticky ? "sticky top-0 z-10 bg-card" : undefined}>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  const meta = header.column.columnDef.meta as { className?: string } | undefined;
                  return (
                    <TableHead key={header.id} className={meta?.className}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  data-testid="data-table-row"
                  className={onRowClick ? "cursor-pointer" : undefined}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta as { className?: string } | undefined;
                    return (
                      <TableCell key={cell.id} className={meta?.className}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  {isLoading ? "Loading…" : emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {displayPagination && (
        <DataTablePagination
          table={table}
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          setPage={setPage}
          setPageSize={setPageSize ?? setClientPageSize}
          totalItems={totalItems ?? (serverDriven ? undefined : table.getFilteredRowModel().rows.length)}
        />
      )}
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { FileSpreadsheet, Plus } from "lucide-react";
import type { CatalogTableProps } from "@/interfaces";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/features/shared/shadcn/DataTable";
import { useCatalogColumns } from "@/components/hooks/catalog/useCatalogColumns";
import { useCatalogTable } from "@/components/hooks/catalog/useCatalogTable";
import { CatalogImportDialog } from "../CatalogImportDialog";
import { CatalogModelFormDialog } from "../CatalogModelFormDialog";

export function CatalogTable({ list, onSelect, onEdit }: CatalogTableProps) {
  const table = useCatalogTable(list);

  const columns = useCatalogColumns({
    canUpdate: list.canUpdate,
    onOpen: onSelect,
    onEdit,
  });

  const trailing = useMemo(() => {
    if (!list.canUpdate) return null;
    return (
      <>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          onClick={table.openImport}
          data-testid="catalog-import"
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          Import manufacturer&apos;s catalog
        </Button>
        <Button type="button" size="sm" className="h-8" onClick={table.openCreate} data-testid="catalog-create">
          <Plus className="h-3.5 w-3.5" />
          Create a model
        </Button>
      </>
    );
  }, [list.canUpdate, table.openCreate, table.openImport]);

  return (
    <div className="space-y-3" data-testid="catalog-list">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span data-testid="catalog-count">
          Models {list.models.length} of {list.models.length}
        </span>
      </div>

      <DataTable
        columns={columns}
        data={list.models}
        search
        keyword={table.keywordInput}
        setKeyword={table.setKeyword}
        removeKeyword={table.removeKeyword}
        isLoading={list.loading}
        toolbarTrailing={trailing}
        emptyMessage="No models in the catalog."
        getRowId={(row) => row.id}
        onRowClick={onSelect}
        displayPagination
        searchPlaceholder="Model, manufacturer, basic UDI-DI…"
      />

      <CatalogModelFormDialog
        open={table.createOpen}
        onOpenChange={table.setCreateOpen}
        onSubmit={table.submitCreate}
      />

      <CatalogImportDialog
        open={table.importOpen}
        onOpenChange={table.setImportOpen}
        onImport={list.importFile}
      />
    </div>
  );
}

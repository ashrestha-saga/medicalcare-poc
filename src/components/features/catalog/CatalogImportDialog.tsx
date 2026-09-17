"use client";

import type { CatalogImportDialogProps } from "@/interfaces";
import { useCatalogImport } from "@/components/hooks/catalog/useCatalogImport";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function CatalogImportDialog({ open, onOpenChange, onImport }: CatalogImportDialogProps) {
  const { inputRef, file, busy, result, handleOpenChange, selectFile, runImport } = useCatalogImport({
    onOpenChange,
    onImport,
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="catalog-import-dialog">
        <DialogHeader>
          <DialogTitle>Import manufacturer&apos;s catalog</DialogTitle>
          <DialogDescription>
            Upload .xlsx / .xls / .csv. Rows are matched by Basic UDI-DI or UDI-DI and upserted into DeviceModel.
            Expected headers: manufacturer, modelName, tradeName, basicUdiDi, udiDi, gtins, riskClass, emdnCode,
            gmdnCode, state, source.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
            className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground"
            data-testid="catalog-import-file"
            onChange={(e) => selectFile(e.target.files?.[0] ?? null)}
          />
          {file && (
            <p className="text-xs text-muted-foreground">
              Selected: <span className="text-foreground">{file.name}</span>
            </p>
          )}
          {result && (
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm" data-testid="catalog-import-result">
              <p>
                Created {result.created} · Updated {result.updated} · Skipped {result.skipped}
              </p>
              {result.errors.length > 0 && (
                <ul className="mt-2 max-h-32 list-disc space-y-0.5 overflow-y-auto pl-4 text-xs text-muted-foreground">
                  {result.errors.slice(0, 8).map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                  {result.errors.length > 8 && <li>…and {result.errors.length - 8} more</li>}
                </ul>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={busy}>
            {result ? "Close" : "Cancel"}
          </Button>
          {!result && (
            <Button
              type="button"
              onClick={() => void runImport()}
              disabled={busy || !file}
              data-testid="catalog-import-run"
            >
              {busy ? "Importing…" : "Import"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

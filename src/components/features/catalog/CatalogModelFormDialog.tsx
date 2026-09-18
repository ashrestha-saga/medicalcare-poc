"use client";

import type { CatalogModelFormDialogProps, CatalogModelFormState } from "@/interfaces";
import { useCatalogModelForm } from "@/components/hooks/catalog/useCatalogModelForm";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Create-only modal for a new DeviceModel. */
export function CatalogModelFormDialog({ open, onOpenChange, onSubmit }: CatalogModelFormDialogProps) {
  const { form, saving, setField, handleSubmit } = useCatalogModelForm({
    open,
    onOpenChange,
    onSubmit,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl" data-testid="catalog-model-form">
        <form onSubmit={(e) => void handleSubmit(e)}>
          <DialogHeader>
            <DialogTitle>Create a model</DialogTitle>
            <DialogDescription>
              Fields map to the central DeviceModel table. Changes apply across all clients that use this model.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-2 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cat-trade">Trade name</Label>
              <Input id="cat-trade" value={form.tradeName} onChange={(e) => setField("tradeName", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-model">Model name</Label>
              <Input id="cat-model" value={form.modelName} onChange={(e) => setField("modelName", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-mfr">Manufacturer</Label>
              <Input
                id="cat-mfr"
                value={form.manufacturer}
                onChange={(e) => setField("manufacturer", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-basic">Basic UDI-DI</Label>
              <Input id="cat-basic" value={form.basicUdiDi} onChange={(e) => setField("basicUdiDi", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-udi">UDI-DI</Label>
              <Input id="cat-udi" value={form.udiDi} onChange={(e) => setField("udiDi", e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cat-gtins">GTINs (comma-separated)</Label>
              <Input id="cat-gtins" value={form.gtins} onChange={(e) => setField("gtins", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>State</Label>
              <Select value={form.state} onValueChange={(v) => setField("state", v as CatalogModelFormState["state"])}>
                <SelectTrigger data-testid="catalog-state">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="review">Under review</SelectItem>
                  <SelectItem value="released">Released</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Select
                value={form.source}
                onValueChange={(v) => setField("source", v as CatalogModelFormState["source"])}
              >
                <SelectTrigger data-testid="catalog-source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="catalog">Catalog</SelectItem>
                  <SelectItem value="beudamed">BEUDAMED</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-cycle">Maintenance cycle (months)</Label>
              <Input
                id="cat-cycle"
                type="number"
                min={1}
                max={120}
                placeholder="e.g. 12"
                value={form.maintenanceCycleMonths}
                onChange={(e) => setField("maintenanceCycleMonths", e.target.value)}
                data-testid="catalog-maintenance-cycle"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} data-testid="catalog-save">
              {saving ? "Saving…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

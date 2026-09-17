"use client";

import { Loader2, X } from "lucide-react";
import type { useLocationAdminForm } from "@/components/hooks/locations/useLocationAdminForm";
import { Badge } from "@/components/ui/badge";
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

type FormApi = ReturnType<typeof useLocationAdminForm>;

export function LocationFormModal({ form }: { form: FormApi }) {
  const isCreate = form.mode === "create";

  return (
    <Dialog
      open={form.open}
      onOpenChange={(open) => {
        if (!open && !form.busy) form.close();
      }}
    >
      <DialogContent className="sm:max-w-lg" data-testid="location-form-dialog">
        <DialogHeader>
          <DialogTitle>{isCreate ? "Create a location" : "Edit location"}</DialogTitle>
          <DialogDescription>
            Location → Area → Room. Areas feed the standardized selection list for inventory and requests.
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void form.submit();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="location-code">Identifier</Label>
              <Input
                id="location-code"
                value={form.code}
                onChange={(e) => form.setCode(e.target.value)}
                disabled={form.busy}
                placeholder="e.g. BONN-A"
                data-testid="location-code"
              />
              {form.fieldErrors.code && <p className="text-xs text-destructive">{form.fieldErrors.code}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="location-name" required>
                Designation
              </Label>
              <Input
                id="location-name"
                value={form.name}
                onChange={(e) => form.setName(e.target.value)}
                disabled={form.busy}
                placeholder="e.g. Klinikum Nord · Haus A"
                data-testid="location-name"
              />
              {form.fieldErrors.name && <p className="text-xs text-destructive">{form.fieldErrors.name}</p>}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="location-address">Address</Label>
            <Input
              id="location-address"
              value={form.address}
              onChange={(e) => form.setAddress(e.target.value)}
              disabled={form.busy}
              data-testid="location-address"
            />
            {form.fieldErrors.address && (
              <p className="text-xs text-destructive">{form.fieldErrors.address}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="location-delivery">Goods receiving — delivery address</Label>
            <Input
              id="location-delivery"
              value={form.deliveryAddress}
              onChange={(e) => form.setDeliveryAddress(e.target.value)}
              disabled={form.busy}
              data-testid="location-delivery"
            />
            <p className="text-xs text-muted-foreground">
              Separate from the deployment site. Spare parts go here; the technician goes to the device.
            </p>
            {form.fieldErrors.deliveryAddress && (
              <p className="text-xs text-destructive">{form.fieldErrors.deliveryAddress}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label>Areas</Label>
            <div className="flex flex-wrap gap-1.5">
              {form.areaNames.map((area) => (
                <Badge key={area} variant="secondary" className="gap-1 pr-1 font-normal">
                  {area}
                  <button
                    type="button"
                    className="rounded-sm p-0.5 hover:bg-muted"
                    onClick={() => form.removeArea(area)}
                    disabled={form.busy}
                    aria-label={`Remove ${area}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {!form.areaNames.length && (
                <span className="text-xs text-muted-foreground">No areas yet.</span>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                value={form.areaDraft}
                onChange={(e) => form.setAreaDraft(e.target.value)}
                disabled={form.busy}
                placeholder="Area name"
                data-testid="location-area-draft"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    form.addArea();
                  }
                }}
              />
              <Button type="button" variant="outline" disabled={form.busy} onClick={form.addArea}>
                Add
              </Button>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" disabled={form.busy} onClick={form.close}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.busy} data-testid="location-form-submit">
              {form.busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {isCreate ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

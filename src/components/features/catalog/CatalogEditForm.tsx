"use client";

import { Loader2 } from "lucide-react";
import type { CatalogModelFormState } from "@/interfaces";
import type { useCatalogModelEditor } from "@/components/hooks/catalog/useCatalogModelEditor";
import { catalogShortId } from "@/components/hooks/catalog/catalogDisplay";
import { catalogStateBadge } from "@/components/hooks/catalog/useCatalogColumns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Info } from "lucide-react";

type EditorApi = ReturnType<typeof useCatalogModelEditor>;

interface CatalogEditFormProps {
  form: EditorApi;
}

export function CatalogEditForm({ form }: CatalogEditFormProps) {
  const detail = form.detail;
  const status = detail ? catalogStateBadge(detail.state) : null;
  const meta = detail
    ? [catalogShortId(detail.id), detail.manufacturer, `v${detail.version}`].filter(Boolean).join(" · ")
    : "";

  return (
    <div className="px-4 pb-8 sm:px-[18px]" data-testid="catalog-edit">
      <section className="mb-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mb-2 h-8 px-0 text-muted-foreground"
          onClick={form.close}
          data-testid="catalog-edit-back"
        >
          ← To the model
        </Button>
        <h2 className="text-2xl font-semibold tracking-tight" data-testid="catalog-edit-title">
          {detail?.displayName ?? "Edit model"}
        </h2>
        <p className="text-sm text-muted-foreground">{meta || "Update central DeviceModel fields"}</p>
      </section>

      {form.loading || !detail ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading model…
        </div>
      ) : (
        <form
          className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]"
          onSubmit={(e) => {
            e.preventDefault();
            void form.submit();
          }}
        >
          <div className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
                <div>
                  <CardTitle className="text-xl">{form.form.tradeName || detail.displayName}</CardTitle>
                  <CardDescription>{meta}</CardDescription>
                </div>
                {status && <Badge variant={status.variant}>{status.label}</Badge>}
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="edit-trade">Trade name</Label>
                  <Input
                    id="edit-trade"
                    value={form.form.tradeName}
                    onChange={(e) => form.setField("tradeName", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-model">Model name</Label>
                  <Input
                    id="edit-model"
                    value={form.form.modelName}
                    onChange={(e) => form.setField("modelName", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-mfr">Manufacturer</Label>
                  <Input
                    id="edit-mfr"
                    value={form.form.manufacturer}
                    onChange={(e) => form.setField("manufacturer", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-basic">Basic UDI-DI</Label>
                  <Input
                    id="edit-basic"
                    value={form.form.basicUdiDi}
                    onChange={(e) => form.setField("basicUdiDi", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-udi">UDI-DI</Label>
                  <Input id="edit-udi" value={form.form.udiDi} onChange={(e) => form.setField("udiDi", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-gmdn">GMDN</Label>
                  <Input
                    id="edit-gmdn"
                    value={form.form.gmdnCode}
                    onChange={(e) => form.setField("gmdnCode", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-emdn">EMDN</Label>
                  <Input
                    id="edit-emdn"
                    value={form.form.emdnCode}
                    onChange={(e) => form.setField("emdnCode", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="edit-gtins">GTINs (comma-separated)</Label>
                  <Input
                    id="edit-gtins"
                    value={form.form.gtins}
                    onChange={(e) => form.setField("gtins", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>State</Label>
                  <Select
                    value={form.form.state}
                    onValueChange={(v) => form.setField("state", v as CatalogModelFormState["state"])}
                  >
                    <SelectTrigger>
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
                    value={form.form.source}
                    onValueChange={(v) => form.setField("source", v as CatalogModelFormState["source"])}
                  >
                    <SelectTrigger>
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
                  <Label htmlFor="edit-cycle">Maintenance cycle (months)</Label>
                  <Input
                    id="edit-cycle"
                    type="number"
                    min={1}
                    max={120}
                    placeholder="e.g. 12"
                    value={form.form.maintenanceCycleMonths}
                    onChange={(e) => form.setField("maintenanceCycleMonths", e.target.value)}
                    data-testid="catalog-edit-maintenance-cycle"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base lowercase">classification</CardTitle>
                <CardDescription>determines all inspection requirements for the copies.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <label className="flex items-start gap-3 rounded-md border border-border/70 px-3 py-2.5">
                  <Checkbox
                    checked={form.annex1}
                    onCheckedChange={(v) => form.setAnnex1(v === true)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-sm font-medium">Annex 1 MPBetreibV — safety-related inspection</span>
                    <span className="block text-xs text-muted-foreground">STK obligation · typically 24 months</span>
                  </span>
                </label>
                <label className="flex items-start gap-3 rounded-md border border-border/70 px-3 py-2.5">
                  <Checkbox
                    checked={form.annex2}
                    onCheckedChange={(v) => form.setAnnex2(v === true)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-sm font-medium">Annex 2 — measuring function</span>
                    <span className="block text-xs text-muted-foreground">MTK · calibration / metrology checks</span>
                  </span>
                </label>
                <label className="flex items-start gap-3 rounded-md border border-border/70 px-3 py-2.5">
                  <Checkbox
                    checked={form.softwareIIb}
                    onCheckedChange={(v) => {
                      if (v === true) form.setSoftwareClass("IIb");
                      else if (!form.softwareC) form.setSoftwareClass("");
                    }}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-sm font-medium">Software class IIb</span>
                    <span className="block text-xs text-muted-foreground">IEC 62304 risk class</span>
                  </span>
                </label>
                <label className="flex items-start gap-3 rounded-md border border-border/70 px-3 py-2.5">
                  <Checkbox
                    checked={form.softwareC}
                    onCheckedChange={(v) => {
                      if (v === true) form.setSoftwareClass("C");
                      else if (!form.softwareIIb) form.setSoftwareClass("");
                    }}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-sm font-medium">Software class C</span>
                    <span className="block text-xs text-muted-foreground">IEC 62304 class C</span>
                  </span>
                </label>
                <label className="flex items-start gap-3 rounded-md border border-border/70 px-3 py-2.5">
                  <Checkbox
                    checked={form.radiation}
                    onCheckedChange={(v) => form.setRadiation(v === true)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-sm font-medium">Radiation (StrlSchV)</span>
                    <span className="block text-xs text-muted-foreground">Radiation protection ordinance</span>
                  </span>
                </label>
                <Alert variant="info">
                  <Info className="h-4 w-4" />
                  <AlertTitle>Changes require confirmation from those affected</AlertTitle>
                  <AlertDescription>
                    This classification change affects {detail.copyCount} items across {detail.siteCount} sites in this
                    clinic.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Save</CardTitle>
                <CardDescription>Increments DeviceModel.version and writes a new classification proposal.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <Button type="submit" disabled={form.busy} data-testid="catalog-edit-save">
                  {form.busy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save changes"
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={form.close} disabled={form.busy}>
                  Cancel
                </Button>
              </CardContent>
            </Card>
          </aside>
        </form>
      )}
    </div>
  );
}

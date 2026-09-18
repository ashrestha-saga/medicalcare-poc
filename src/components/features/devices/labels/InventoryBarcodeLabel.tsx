"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import type { InventoryLabelData } from "@/lib/inventory/label";
import { cn } from "@/lib/utils";

interface InventoryBarcodeLabelProps {
  label: InventoryLabelData;
  className?: string;
}

/** On-screen preview of a printable inventory sticker (CODE128 of inventory #). */
export function InventoryBarcodeLabel({ label, className }: InventoryBarcodeLabelProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current || !label.inventoryNumber) return;
    try {
      JsBarcode(svgRef.current, label.inventoryNumber, {
        format: "CODE128",
        displayValue: false,
        margin: 4,
        width: 1.6,
        height: 44,
        background: "#ffffff",
        lineColor: "#111111",
      });
    } catch {
      // Invalid CODE128 payload — leave empty SVG
    }
  }, [label.inventoryNumber]);

  return (
    <article
      className={cn(
        "flex w-[220px] flex-col gap-1 rounded border border-border bg-white p-3 text-foreground shadow-sm",
        className,
      )}
      data-testid="inventory-barcode-label"
    >
      <p className="line-clamp-2 text-sm font-semibold leading-snug">{label.name}</p>
      <svg ref={svgRef} className="h-11 w-full" aria-hidden />
      <p className="font-mono text-sm font-semibold tracking-wide">{label.inventoryNumber}</p>
      {label.serialNumber ? (
        <p className="font-mono text-xs text-muted-foreground">SN: {label.serialNumber}</p>
      ) : null}
      {label.maintenanceDueLabel ? (
        <p className="text-xs font-medium text-foreground">Due: {label.maintenanceDueLabel}</p>
      ) : null}
    </article>
  );
}

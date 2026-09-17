"use client";

import { useEffect, useState } from "react";
import { useScanStore } from "@/store/scanStore";

/**
 * Catalog adopt step: show model → then service/parts actions.
 */
export function useCatalogAdopt() {
  const resolution = useScanStore((s) => s.resolution);
  const captured = useScanStore((s) => s.captured);
  const continueToServiceRequest = useScanStore((s) => s.continueToServiceRequest);
  const openParts = useScanStore((s) => s.openParts);
  const reset = useScanStore((s) => s.reset);
  const [catalogAdopted, setCatalogAdopted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset adopt step when resolution changes
    setCatalogAdopted(false);
  }, [resolution?.correlationId]);

  const isCatalogModel = resolution?.stage === "catalog" && !captured;
  const isBeudamed = resolution?.stage === "beudamed" && !captured;
  const isInventory = resolution?.stage === "inventory" && !captured;
  const partsAllowed = !captured;
  const proposal = resolution?.classificationProposal;

  return {
    resolution,
    captured,
    proposal,
    partsAllowed,
    isCatalogModel,
    isBeudamed,
    isInventory,
    catalogAdopted,
    adoptCatalog: () => setCatalogAdopted(true),
    backFromActions: () => setCatalogAdopted(false),
    continueToServiceRequest,
    openParts,
    reset,
  };
}

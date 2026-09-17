import type { CatalogClassificationOption, CatalogClassificationSummary, CatalogModelListItemDTO } from "@/interfaces";

export function catalogShortId(id: string): string {
  if (id.startsWith("model-")) return id.replace(/^model-/, "M-").toUpperCase().slice(0, 12);
  return id.slice(0, 8).toUpperCase();
}

export function catalogSourceLabel(source: CatalogModelListItemDTO["source"]): string {
  if (source === "catalog") return "Manufacturer / catalog";
  if (source === "beudamed") return "BEUDAMED";
  return "Manual";
}

export function catalogGmdnEmdn(model: { gmdnCode: string | null; emdnCode: string | null }): string {
  return [model.gmdnCode, model.emdnCode].filter(Boolean).join(" / ") || "—";
}

export function catalogClassificationOptions(
  classification: CatalogClassificationSummary | null | undefined,
): CatalogClassificationOption[] {
  const sw = classification?.softwareClass?.toUpperCase() ?? "";
  return [
    {
      id: "annex1",
      title: "Annex 1 MPBetreibV — safety-related inspection",
      description: "STK obligation · typically 24 months (operator may set shorter)",
      checked: Boolean(classification?.annex1),
    },
    {
      id: "annex2",
      title: "Annex 2 — measuring function",
      description: "MTK · calibration / metrology checks as applicable",
      checked: Boolean(classification?.annex2),
    },
    {
      id: "softwareIIb",
      title: "Software class IIb",
      description: "IEC 62304 · risk class for medical device software",
      checked: sw === "IIB",
    },
    {
      id: "softwareC",
      title: "Software class C",
      description: "IEC 62304 class C · highest software safety class",
      checked: sw === "C",
    },
    {
      id: "radiation",
      title: "Radiation (StrlSchV)",
      description: "Radiation protection ordinance applies to this device type",
      checked: Boolean(classification?.radiation),
    },
  ];
}

export function softwareClassFromFlags(softwareIIb: boolean, softwareC: boolean): string | null {
  if (softwareC) return "C";
  if (softwareIIb) return "IIb";
  return null;
}

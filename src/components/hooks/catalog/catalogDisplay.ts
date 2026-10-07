import type { CatalogClassificationOption, CatalogClassificationSummary, CatalogModelListItemDTO } from "@/interfaces";

type ClassifyT = (key: string) => string;

export function catalogShortId(id: string): string {
  if (id.startsWith("model-")) return id.replace(/^model-/, "M-").toUpperCase().slice(0, 12);
  return id.slice(0, 8).toUpperCase();
}

type SourceT = (key: "sourceManufacturerCatalog" | "sourceBeudamed" | "sourceManual") => string;

export function catalogSourceLabel(
  source: CatalogModelListItemDTO["source"],
  t: SourceT,
): string {
  if (source === "catalog") return t("sourceManufacturerCatalog");
  if (source === "beudamed") return t("sourceBeudamed");
  return t("sourceManual");
}

export function catalogGmdnEmdn(
  model: { gmdnCode: string | null; emdnCode: string | null },
  empty = "—",
): string {
  return [model.gmdnCode, model.emdnCode].filter(Boolean).join(" / ") || empty;
}

export function catalogClassificationOptions(
  classification: CatalogClassificationSummary | null | undefined,
  t: ClassifyT,
): CatalogClassificationOption[] {
  const sw = classification?.softwareClass?.toUpperCase() ?? "";
  return [
    {
      id: "annex1",
      title: t("annex1Title"),
      description: t("annex1Description"),
      checked: Boolean(classification?.annex1),
    },
    {
      id: "annex2",
      title: t("annex2Title"),
      description: t("annex2Description"),
      checked: Boolean(classification?.annex2),
    },
    {
      id: "softwareIIb",
      title: t("softwareIIbTitle"),
      description: t("softwareIIbDescription"),
      checked: sw === "IIB",
    },
    {
      id: "softwareC",
      title: t("softwareCTitle"),
      description: t("softwareCDescription"),
      checked: sw === "C",
    },
    {
      id: "radiation",
      title: t("radiationTitle"),
      description: t("radiationDescription"),
      checked: Boolean(classification?.radiation),
    },
  ];
}

export function softwareClassFromFlags(softwareIIb: boolean, softwareC: boolean): string | null {
  if (softwareC) return "C";
  if (softwareIIb) return "IIb";
  return null;
}

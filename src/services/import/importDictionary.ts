import { prisma } from "@/lib/prisma";
import { impNorm } from "./importNorm";
import type { DictionaryContent, ImportTargetField, ParsedSheet, SheetMapping } from "./types";

const TARGET_FIELDS: ImportTargetField[] = [
  "bezeichnung",
  "typ",
  "hersteller",
  "seriennummer",
  "inventarnummer",
  "loskennung",
  "anschaffung",
  "standort",
  "verantwortlich",
  "letzte_stk",
  "letzte_mtk",
  "naechste_pruefung",
  "gtin",
  "bemerkung",
  "ignorieren",
];

export async function loadActiveDictionary(
  template = "excel_14",
): Promise<DictionaryContent> {
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const fromFixture = () =>
    JSON.parse(
      readFileSync(join(process.cwd(), "fixtures/import/synonyme.json"), "utf8"),
    ) as DictionaryContent;

  // Prefer repo fixture so synonym updates apply without a reseed.
  try {
    return fromFixture();
  } catch {
    /* fall through to DB */
  }

  try {
    const dict = (
      prisma as {
        refImportDictionary?: {
          findFirst: (a: object) => Promise<{ content: unknown } | null>;
        };
      }
    ).refImportDictionary;
    if (!dict?.findFirst) throw new Error("no dictionary");
    const row = await dict.findFirst({
      where: { template, active: true },
      orderBy: { createdAt: "desc" },
    });
    if (!row) throw new Error("no dictionary row");
    return row.content as unknown as DictionaryContent;
  } catch {
    return fromFixture();
  }
}

function buildSynonymIndex(dict: DictionaryContent): Map<string, ImportTargetField> {
  const map = new Map<string, ImportTargetField>();
  for (const [field, syns] of Object.entries(dict.felder || {})) {
    if (!TARGET_FIELDS.includes(field as ImportTargetField)) continue;
    for (const syn of syns) {
      map.set(impNorm(syn), field as ImportTargetField);
    }
  }
  return map;
}

export function fieldFromHeader(
  header: string,
  index: Map<string, ImportTargetField>,
): ImportTargetField | null {
  const n = impNorm(header);
  if (!n) return null;
  if (index.has(n)) return index.get(n)!;
  // Prefer longer synonym hits so short tokens (nr, sn, ort) do not steal columns.
  let best: { field: ImportTargetField; len: number } | null = null;
  for (const [syn, field] of index) {
    if (!syn || syn.length < 3) continue;
    if (n.includes(syn) || (n.length >= 4 && syn.includes(n))) {
      if (!best || syn.length > best.len) best = { field, len: syn.length };
    }
  }
  return best?.field ?? null;
}

/** Known non-inventory sheet names (DeviceCare template “Hinweise”, etc.). */
const SKIP_SHEET_NAMES = new Set([
  "hinweise",
  "hinweis",
  "notes",
  "note",
  "instructions",
  "instruction",
  "readme",
  "info",
  "legende",
  "anleitung",
]);

export function isInstructionSheetName(name: string): boolean {
  return SKIP_SHEET_NAMES.has(impNorm(name));
}

/**
 * First row with ≥3 dictionary hits is the header.
 * Returns -1 when no inventory header is found (sheet should be skipped).
 */
export function detectHeaderRow(
  zeilen: string[][],
  index: Map<string, ImportTargetField>,
): number {
  for (let i = 0; i < zeilen.length; i++) {
    const row = zeilen[i] || [];
    let hits = 0;
    for (const cell of row) {
      if (fieldFromHeader(cell, index)) hits++;
    }
    if (hits >= 3) return i;
  }
  return -1;
}

export function proposeSheetMappings(
  sheets: ParsedSheet[],
  dict: DictionaryContent,
  sites: { id: string; name: string }[],
): SheetMapping[] {
  const index = buildSynonymIndex(dict);
  const out: SheetMapping[] = [];
  for (const s of sheets) {
    if (isInstructionSheetName(s.name)) continue;
    const headerRowIndex = detectHeaderRow(s.zeilen, index);
    // No §14-like header → skip (e.g. Hinweise prose sheet)
    if (headerRowIndex < 0) continue;

    const kopf = s.zeilen[headerRowIndex] || [];
    const columns = kopf.map((header, i) => {
      const field = fieldFromHeader(header, index);
      return {
        index: i,
        header,
        field: field === "ignorieren" ? ("ignorieren" as const) : field,
        byUser: false,
      };
    });
    const skippedTitleRows = s.zeilen
      .slice(0, headerRowIndex)
      .map((r) => r.filter(Boolean).join(" "))
      .filter(Boolean);

    const siteSuggest = suggestSite(s.name, sites);
    out.push({
      name: s.name,
      siteId: siteSuggest.id,
      newSiteName: siteSuggest.id ? null : s.name,
      headerRowIndex,
      skippedTitleRows,
      columns,
    });
  }
  return out;
}

export function suggestSite(
  sheetName: string,
  sites: { id: string; name: string }[],
): { id: string | null } {
  const n = impNorm(sheetName);
  if (!n) return { id: sites[0]?.id ?? null };
  for (const site of sites) {
    const sn = impNorm(site.name);
    if (sn && (sn.includes(n) || n.includes(sn))) return { id: site.id };
  }
  // Multi-sheet without match → new site; single sheet may default later
  return { id: null };
}

export { buildSynonymIndex, TARGET_FIELDS };

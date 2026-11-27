import { ampel } from "./importAmpel";
import { impNorm } from "./importNorm";
import type {
  AmpelResult,
  ImportLastPerformance,
  NormalizedRow,
  ParsedSheet,
  PruefungHint,
  SheetMapping,
} from "./types";

export function parseAnschaffung(raw: string): { jahr: number | null; hinweis?: string } {
  const t = String(raw || "").trim();
  if (!t) return { jahr: null };
  const ca = t.match(/ca\.?\s*(\d{4})/i);
  if (ca) return { jahr: Number(ca[1]), hinweis: "geschätzt" };
  const dmy = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dmy) return { jahr: Number(dmy[3]) };
  const ymd = t.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/);
  if (ymd) return { jahr: Number(ymd[1]) };
  const my = t.match(/^(\d{1,2})\/(\d{4})$/);
  if (my) return { jahr: Number(my[2]) };
  const y = t.match(/^(\d{4})$/);
  if (y) return { jahr: Number(y[1]) };
  return { jahr: null, hinweis: `unbekanntes Datumsformat (${t})` };
}

/** Extract ISO date from free text (DD.MM.YYYY, YYYY-MM, MM/YYYY, year). */
export function parsePerformanceDate(raw: string): string | null {
  const t = String(raw || "").trim();
  if (!t) return null;
  const dmy = t.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2]!.padStart(2, "0")}-${dmy[1]!.padStart(2, "0")}`;
  }
  const ym = t.match(/(\d{4})-(\d{1,2})\b/) || t.match(/(\d{1,2})\/(\d{4})/);
  if (ym && ym[0].includes("-")) {
    return `${ym[1]}-${ym[2]!.padStart(2, "0")}-01`;
  }
  if (ym) {
    return `${ym[2]}-${ym[1]!.padStart(2, "0")}-01`;
  }
  const y = t.match(/\b(20\d{2}|19\d{2})\b/);
  if (y) return `${y[1]}-01-01`;
  return null;
}

/** Free-text "STK 03/2025", "MTK 2024-11", "STK 14.09.2024". */
export function parsePruefung(raw: string, fallbackArt?: "STK" | "MTK"): PruefungHint | null {
  const t = String(raw || "").trim();
  if (!t) return null;
  const artMatch = t.match(/\b(STK|MTK)\b/i);
  const art = (artMatch?.[1]?.toUpperCase() as "STK" | "MTK" | undefined) || fallbackArt;
  if (!art) return null;
  const iso = parsePerformanceDate(t);
  if (!iso) return null;
  return { art, iso, raw: t };
}

function performanceFromField(
  raw: string,
  dutyKey: ImportLastPerformance["dutyKey"],
): ImportLastPerformance | null {
  const iso = parsePerformanceDate(raw);
  if (!iso) return null;
  const firm =
    raw.match(/(?:Fa\.|Firma|durch)\s*([A-Za-zÄÖÜäöüß0-9 ./-]{2,40})/i)?.[1]?.trim() ||
    undefined;
  return {
    dutyKey,
    performedAt: iso,
    result: /fehl|fail|nicht bestanden/i.test(raw) ? "failed" : "passed",
    performedBy: firm,
    reportRef: raw.trim(),
    source: "file",
  };
}

function emptyNormalized(
  sheet: string,
  rowNo: number,
  siteId: string | null,
  newSiteName: string | null,
): NormalizedRow {
  return {
    bezeichnung: "",
    typ: "",
    hersteller: "",
    seriennummer: "",
    inventarnummer: "",
    loskennung: "",
    anschaffung: "",
    jahr: null,
    standort: "",
    verantwortlich: "",
    letzte_stk: "",
    letzte_mtk: "",
    letzte_wartung: "",
    letzte_dguv: "",
    letzte_konstanz: "",
    letzte_validierung: "",
    naechste_pruefung: "",
    gtin: "",
    bemerkung: "",
    hinweise: [],
    pruefungen: [],
    lastPerformances: [],
    siteId,
    newSiteName,
    raum: "",
    areaName: "",
    key: null,
    sheet,
    rowNo,
  };
}

export function normalizeDataRow(
  cells: string[],
  mapping: SheetMapping,
  sites: { id: string; name: string }[],
): { normalized: NormalizedRow; quality: AmpelResult } {
  const rec = emptyNormalized(
    mapping.name,
    mapping.headerRowIndex + 2, // overwritten by caller with absolute row
    mapping.siteId,
    mapping.newSiteName,
  );

  for (const col of mapping.columns) {
    const field = col.field;
    if (!field || field === "ignorieren") continue;
    const val = String(cells[col.index] ?? "").trim();
    if (!val) continue;
    const bag = rec as unknown as Record<string, unknown>;
    if (field in rec && !bag[field]) {
      bag[field] = val;
    }
  }

  // Split Hersteller, Typ / Hersteller/Typ
  if (rec.hersteller && !rec.typ && /[,/]/.test(rec.hersteller)) {
    const parts = rec.hersteller.split(/[,/]/);
    rec.hersteller = parts[0]!.trim();
    rec.typ = parts.slice(1).join("/").trim();
  }

  // Standort/Raum
  if (rec.standort) {
    const teile = rec.standort.split("/").map((x) => x.trim());
    let erkannt = false;
    for (const site of sites) {
      const sn = site.name.toLowerCase();
      const tn = teile[0]?.toLowerCase() || "";
      if (tn && (sn.includes(tn) || tn.includes(sn))) {
        rec.siteId = site.id;
        rec.newSiteName = null;
        erkannt = true;
        break;
      }
    }
    const rest = (erkannt ? teile.slice(1) : teile).join(" / ");
    rec.raum = rest;
    rec.areaName = rest;
  }

  const d = parseAnschaffung(rec.anschaffung);
  rec.jahr = d.jahr;
  if (d.hinweis) rec.hinweise.push(`Anschaffungsjahr ${d.hinweis}`);

  for (const f of ["letzte_stk", "letzte_mtk"] as const) {
    const p = parsePruefung(rec[f], f === "letzte_stk" ? "STK" : "MTK");
    if (p) rec.pruefungen.push(p);
  }
  // Combined "Letzte Prüfung" may land in letzte_stk via synonym
  if (!rec.pruefungen.length && rec.letzte_stk) {
    const p = parsePruefung(rec.letzte_stk);
    if (p) rec.pruefungen.push(p);
  }

  const perfFields: Array<[keyof NormalizedRow, ImportLastPerformance["dutyKey"]]> = [
    ["letzte_stk", "stk"],
    ["letzte_mtk", "mtk"],
    ["letzte_wartung", "wartung"],
    ["letzte_dguv", "dguv"],
    ["letzte_konstanz", "konstanz"],
    ["letzte_validierung", "validierung"],
  ];
  for (const [field, dutyKey] of perfFields) {
    const raw = String(rec[field] || "");
    if (!raw) continue;
    const perf = performanceFromField(raw, dutyKey);
    if (perf) rec.lastPerformances.push(perf);
  }
  // Legacy pruefungen → lastPerformances when columns only filled via STK/MTK parse
  if (!rec.lastPerformances.length) {
    for (const p of rec.pruefungen) {
      rec.lastPerformances.push({
        dutyKey: p.art === "MTK" ? "mtk" : "stk",
        performedAt: p.iso,
        result: "passed",
        reportRef: p.raw,
        source: "file",
      });
    }
  }

  if (rec.naechste_pruefung) {
    rec.hinweise.push(
      `nächste Prüfung laut Datei ${rec.naechste_pruefung} — nur Hinweis (E63)`,
    );
  }

  if (!rec.standort && (rec.siteId || rec.newSiteName)) {
    const site = sites.find((s) => s.id === rec.siteId);
    rec.standort = site?.name || rec.newSiteName || "";
  }

  rec.key = rec.seriennummer
    ? `sn:${impNorm(rec.seriennummer)}`
    : rec.loskennung
      ? `lot:${impNorm(rec.loskennung)}`
      : rec.inventarnummer
        ? `inv:${impNorm(rec.inventarnummer)}`
        : null;

  const quality = ampel(rec);
  return { normalized: rec, quality };
}

export function iterMappedRows(
  sheets: ParsedSheet[],
  mappings: SheetMapping[],
  sites: { id: string; name: string }[],
): { sheet: ParsedSheet; mapping: SheetMapping; rowIndex: number; cells: string[]; normalized: NormalizedRow; quality: AmpelResult }[] {
  const out: ReturnType<typeof iterMappedRows> = [];
  for (const mapping of mappings) {
    const sheet = sheets.find((s) => s.name === mapping.name);
    if (!sheet) continue;
    const data = sheet.zeilen.slice(mapping.headerRowIndex + 1);
    data.forEach((cells, i) => {
      if (!cells.some((c) => String(c).trim())) return;
      const { normalized, quality } = normalizeDataRow(cells, mapping, sites);
      normalized.rowNo = mapping.headerRowIndex + i + 2; // 1-based excel-ish
      out.push({ sheet, mapping, rowIndex: i, cells, normalized, quality });
    });
  }
  return out;
}

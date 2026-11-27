/** Canonical excel_14 target fields after dictionary mapping. */
export type ImportTargetField =
  | "bezeichnung"
  | "typ"
  | "hersteller"
  | "seriennummer"
  | "inventarnummer"
  | "loskennung"
  | "anschaffung"
  | "standort"
  | "verantwortlich"
  | "letzte_stk"
  | "letzte_mtk"
  | "letzte_wartung"
  | "letzte_dguv"
  | "letzte_konstanz"
  | "letzte_validierung"
  | "naechste_pruefung"
  | "gtin"
  | "bemerkung"
  | "ignorieren";

export type AmpelStufe = "gruen" | "gelb" | "rot";
export type ModelMatchArt = "exact" | "fuzzy" | "new" | "none";
export type RowOutcome = "new" | "updated" | "conflict" | "skipped" | "review";

export type ParsedSheet = {
  name: string;
  /** Raw cell rows as strings (including title + header + data). */
  zeilen: string[][];
};

export type SheetMapping = {
  name: string;
  siteId: string | null;
  newSiteName: string | null;
  headerRowIndex: number;
  skippedTitleRows: string[];
  columns: { index: number; header: string; field: ImportTargetField | null; byUser: boolean }[];
};

export type JobMapping = {
  sheets: SheetMapping[];
};

export type PruefungHint = {
  art: "STK" | "MTK";
  iso: string;
  raw: string;
};

/** E103 — last performances carried on ImportRow.normalized (no new table). */
export type ImportLastPerformance = {
  dutyKey: "stk" | "mtk" | "wartung" | "dguv" | "konstanz" | "validierung";
  performedAt: string; // YYYY-MM-DD
  result?: "passed" | "failed" | "unknown";
  performedBy?: string;
  reportRef?: string;
  intervalMonths?: number;
  source: "file";
};

export type NormalizedRow = {
  bezeichnung: string;
  typ: string;
  hersteller: string;
  seriennummer: string;
  inventarnummer: string;
  loskennung: string;
  anschaffung: string;
  jahr: number | null;
  standort: string;
  verantwortlich: string;
  letzte_stk: string;
  letzte_mtk: string;
  letzte_wartung: string;
  letzte_dguv: string;
  letzte_konstanz: string;
  letzte_validierung: string;
  naechste_pruefung: string;
  gtin: string;
  bemerkung: string;
  hinweise: string[];
  pruefungen: PruefungHint[];
  /** E103 — structured last performances (preferred over pruefungen). */
  lastPerformances: ImportLastPerformance[];
  siteId: string | null;
  newSiteName: string | null;
  raum: string;
  areaName: string;
  key: string | null;
  sheet: string;
  rowNo: number;
};

export type AmpelResult = { stufe: AmpelStufe; fehlt: string[] };

export type ModelMatchResult = {
  art: ModelMatchArt;
  modelId: string | null;
  manufacturer?: string;
  modelName?: string;
};

export type ImportStats = {
  rows: number;
  deviceRows: number;
  new: number;
  updated: number;
  green: number;
  yellow: number;
  red: number;
  modelExact: number;
  modelFuzzy: number;
  modelNew: number;
  duplicatesInFile: number;
  releasedHits: number;
  conflicts: number;
  greenShare: number;
  modelHitRate: number;
  sheets: number;
  modelleOhneEinstufung?: number;
};

export type DictionaryContent = {
  version?: string;
  felder: Record<string, string[]>;
  regeln?: unknown[];
};

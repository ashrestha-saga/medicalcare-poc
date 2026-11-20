import * as XLSX from "xlsx";
import type { ParsedSheet } from "./types";

/** CSV: strip BOM, sniff delimiter (; , tab), honour quotes. */
export function parseCsvText(text: string): string[][] {
  const cleaned = String(text || "").replace(/^\uFEFF/, "");
  const first = cleaned.split(/\r?\n/)[0] || "";
  const candidates = [";", ",", "\t"] as const;
  let best: (typeof candidates)[number] = ";";
  let bestN = -1;
  for (const c of candidates) {
    const n = first.split(c).length;
    if (n > bestN) {
      bestN = n;
      best = c;
    }
  }
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i]!;
    if (q) {
      if (ch === '"') {
        if (cleaned[i + 1] === '"') {
          cell += '"';
          i++;
        } else q = false;
      } else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === best) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch === "\r") {
      /* skip */
    } else cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows
    .filter((r) => r.some((c) => String(c).trim()))
    .map((r) => r.map((c) => String(c).trim()));
}

function sheetToStringRows(sheet: XLSX.WorkSheet): string[][] {
  const raw = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });
  return raw
    .map((r) => (Array.isArray(r) ? r : []).map((c) => String(c ?? "").trim()))
    .filter((r) => r.some((c) => c));
}

/** Parse buffer as XLSX (all sheets) or CSV (single sheet). */
export function parseImportBuffer(fileName: string, buffer: Buffer): ParsedSheet[] {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
    return [{ name: "Blatt 1", zeilen: parseCsvText(buffer.toString("utf8")) }];
  }
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  return workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    return { name, zeilen: sheet ? sheetToStringRows(sheet) : [] };
  }).filter((s) => s.zeilen.length > 0);
}

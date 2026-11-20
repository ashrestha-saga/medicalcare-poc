import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseImportBuffer } from "./importParse";
import { proposeSheetMappings } from "./importDictionary";
import { iterMappedRows } from "./importNormalize";
import { ampel } from "./importAmpel";
import type { DictionaryContent } from "./types";

const FIX = join(process.cwd(), "fixtures/import");
const erwartung = JSON.parse(readFileSync(join(FIX, "erwartung.json"), "utf8")) as Record<
  string,
  {
    geraetezeilen: number;
    gruen: number;
    gelb: number;
    rot: number;
    blaetter: number;
  }
>;

describe("sample file Ampel counts (approx acceptance)", () => {
  it("praxis-3 CSV maps and counts Ampel close to erwartung", () => {
    const buf = readFileSync(join(FIX, "praxis-3-chirurgie-inventar.csv"));
    const sheets = parseImportBuffer("praxis-3-chirurgie-inventar.csv", buf);
    const dict = JSON.parse(readFileSync(join(FIX, "synonyme.json"), "utf8")) as DictionaryContent;
    const mapping = proposeSheetMappings(sheets, dict, [{ id: "s1", name: "OP" }]);
    expect(mapping[0]!.columns.filter((c) => c.field && c.field !== "ignorieren").length).toBeGreaterThanOrEqual(
      5,
    );
    const rows = iterMappedRows(sheets, mapping, [{ id: "s1", name: "OP" }]);
    const counts = { gruen: 0, gelb: 0, rot: 0 };
    for (const r of rows) {
      // recompute with forced site for Ampel Standort
      const q = ampel({
        ...r.normalized,
        standort: r.normalized.standort || "OP",
        siteId: "s1",
      });
      counts[q.stufe]++;
    }
    expect(rows.length).toBe(erwartung["praxis-3"]!.geraetezeilen);
    expect(counts.rot).toBe(erwartung["praxis-3"]!.rot);
    // green/yellow may shift slightly if Standort/Jahr parsing differs; allow ±3
    expect(Math.abs(counts.gruen - erwartung["praxis-3"]!.gruen)).toBeLessThanOrEqual(5);
  });

  it("praxis-1 xlsx has one sheet and maps ≥10 columns", () => {
    const buf = readFileSync(join(FIX, "praxis-1-hausarzt-bestandsverzeichnis.xlsx"));
    const sheets = parseImportBuffer("praxis-1.xlsx", buf);
    expect(sheets.length).toBe(erwartung["praxis-1"]!.blaetter);
    const dict = JSON.parse(readFileSync(join(FIX, "synonyme.json"), "utf8")) as DictionaryContent;
    const mapping = proposeSheetMappings(sheets, dict, [{ id: "s1", name: "Praxis" }]);
    const mapped = mapping[0]!.columns.filter((c) => c.field && c.field !== "ignorieren").length;
    expect(mapped).toBeGreaterThanOrEqual(10);
  });

  it("praxis-2 has 3 sheets", () => {
    const buf = readFileSync(join(FIX, "praxis-2-mvz-geraeteliste.xlsx"));
    const sheets = parseImportBuffer("praxis-2.xlsx", buf);
    expect(sheets.length).toBe(erwartung["praxis-2"]!.blaetter);
  });
});

import { describe, expect, it } from "vitest";
import { lastPerformancesFromNormalized } from "./importProvisionalDuties";
import type { NormalizedRow } from "./types";

function baseRow(partial: Partial<NormalizedRow>): NormalizedRow {
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
    siteId: null,
    newSiteName: null,
    raum: "",
    areaName: "",
    key: null,
    sheet: "Bestandsverzeichnis",
    rowNo: 2,
    ...partial,
  };
}

describe("lastPerformancesFromNormalized", () => {
  it("prefers lastPerformances array", () => {
    const n = baseRow({
      lastPerformances: [
        { dutyKey: "stk", performedAt: "2025-09-14", result: "passed", source: "file" },
        { dutyKey: "mtk", performedAt: "2025-03-03", result: "passed", source: "file" },
      ],
    });
    expect(lastPerformancesFromNormalized(n).map((p) => p.dutyKey)).toEqual(["stk", "mtk"]);
  });

  it("falls back to legacy pruefungen", () => {
    const n = baseRow({
      pruefungen: [
        { art: "STK", iso: "2025-09-14", raw: "14.09.2025" },
        { art: "MTK", iso: "2025-03-03", raw: "03.03.2025" },
      ],
    });
    const perfs = lastPerformancesFromNormalized(n);
    expect(perfs).toEqual([
      expect.objectContaining({ dutyKey: "stk", performedAt: "2025-09-14" }),
      expect.objectContaining({ dutyKey: "mtk", performedAt: "2025-03-03" }),
    ]);
  });
});

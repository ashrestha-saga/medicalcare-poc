import { describe, expect, it } from "vitest";
import { ampel } from "./importAmpel";
import { levenshteinRatio, impNorm } from "./importNorm";
import { parseAnschaffung, parsePruefung } from "./importNormalize";
import {
  detectHeaderRow,
  buildSynonymIndex,
  fieldFromHeader,
  proposeSheetMappings,
} from "./importDictionary";
import { parseImportBuffer } from "./importParse";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { DictionaryContent } from "./types";

describe("import Ampel", () => {
  it("marks red without identifier", () => {
    expect(
      ampel({
        seriennummer: "",
        inventarnummer: "",
        loskennung: "",
        bezeichnung: "EKG",
        jahr: 2020,
        hersteller: "X",
        standort: "A",
        siteId: null,
        newSiteName: null,
      }).stufe,
    ).toBe("rot");
  });

  it("marks green when all Pflicht present with SN", () => {
    expect(
      ampel({
        seriennummer: "SN1",
        inventarnummer: "",
        loskennung: "",
        bezeichnung: "EKG",
        jahr: 2020,
        hersteller: "Vitamed",
        standort: "Haus A",
        siteId: "s1",
        newSiteName: null,
      }).stufe,
    ).toBe("gruen");
  });

  it("marks green with Loskennung instead of SN", () => {
    expect(
      ampel({
        seriennummer: "",
        inventarnummer: "INV-1",
        loskennung: "LOT-9",
        bezeichnung: "EKG",
        jahr: 2020,
        hersteller: "Vitamed",
        standort: "Haus A",
        siteId: "s1",
        newSiteName: null,
      }).stufe,
    ).toBe("gruen");
  });

  it("marks yellow when SN present but year missing", () => {
    expect(
      ampel({
        seriennummer: "SN1",
        inventarnummer: "",
        loskennung: "",
        bezeichnung: "EKG",
        jahr: null,
        hersteller: "Vitamed",
        standort: "Haus A",
        siteId: "s1",
        newSiteName: null,
      }).stufe,
    ).toBe("gelb");
  });

  it("maps Produktart to ignore and Loskennung to loskennung", () => {
    const dict = JSON.parse(
      readFileSync(join(process.cwd(), "fixtures/import/synonyme.json"), "utf8"),
    ) as DictionaryContent;
    const index = buildSynonymIndex(dict);
    expect(fieldFromHeader("Produktart", index)).toBe("ignorieren");
    expect(fieldFromHeader("Loskennung", index)).toBe("loskennung");
  });
});

describe("import normalize helpers", () => {
  it("parses ca. year", () => {
    expect(parseAnschaffung("ca. 2019")).toEqual({ jahr: 2019, hinweis: "geschätzt" });
  });

  it("parses STK free text", () => {
    expect(parsePruefung("STK 03/2025")?.art).toBe("STK");
    expect(parsePruefung("STK 03/2025")?.iso.startsWith("2025-03")).toBe(true);
  });

  it("normalises manufacturer labels", () => {
    expect(impNorm("VITAMED Systems GmbH")).toBe(impNorm("Vitamed"));
  });

  it("levenshtein ratio is high for close strings", () => {
    expect(levenshteinRatio("volumatx200", "volumatx210")).toBeGreaterThanOrEqual(0.8);
  });
});

describe("dictionary header detection", () => {
  it("detects header with ≥3 hits", () => {
    const dict = JSON.parse(
      readFileSync(join(process.cwd(), "fixtures/import/synonyme.json"), "utf8"),
    );
    const index = buildSynonymIndex(dict);
    expect(fieldFromHeader("Serien-Nr.", index)).toBe("seriennummer");
    const hi = detectHeaderRow(
      [
        ["Inventarliste Praxis", "", ""],
        ["Gerät", "Hersteller", "Seriennummer", "Inventar-Nr."],
        ["Pump", "Vitamed", "1", "INV-1"],
      ],
      index,
    );
    expect(hi).toBe(1);
  });

  it("returns -1 when no inventory header", () => {
    const dict = JSON.parse(
      readFileSync(join(process.cwd(), "fixtures/import/synonyme.json"), "utf8"),
    );
    const index = buildSynonymIndex(dict);
    expect(detectHeaderRow([["Pflichtangaben je Gerät", ""]], index)).toBe(-1);
  });

  it("skips Hinweise sheet on DeviceCare template", () => {
    const buf = readFileSync(
      join(process.cwd(), "public/import/devicecare-vorlage-bestandsverzeichnis.xlsx"),
    );
    const sheets = parseImportBuffer("devicecare-vorlage.xlsx", buf);
    expect(sheets.map((s) => s.name)).toEqual(["Bestandsverzeichnis", "Hinweise"]);
    const dict = JSON.parse(
      readFileSync(join(process.cwd(), "fixtures/import/synonyme.json"), "utf8"),
    ) as DictionaryContent;
    const mapping = proposeSheetMappings(sheets, dict, [{ id: "s1", name: "Haus A" }]);
    expect(mapping.map((m) => m.name)).toEqual(["Bestandsverzeichnis"]);
    expect(mapping[0]!.columns.filter((c) => c.field && c.field !== "ignorieren").length).toBeGreaterThanOrEqual(
      10,
    );
  });
});

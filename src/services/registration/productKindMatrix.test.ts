import { describe, expect, it } from "vitest";
import { PRODUCT_KINDS } from "../../../prisma/seeds/registrationRef";

function kind(code: string) {
  const row = PRODUCT_KINDS.find((k) => k.code === code);
  if (!row) throw new Error(`missing product kind ${code}`);
  return row;
}

describe("FA-219 product-kind matrix (v17 PRODUKTARTEN)", () => {
  it("Strahlentherapie has no MTK; aktive Therapie shows Aufbereitung instead of MTK (AC 38)", () => {
    expect(kind("therapie-strahlen").shows).not.toContain("mtk");
    expect(kind("aktiv-therapie").shows).not.toContain("mtk");
    expect(kind("aktiv-therapie").shows).toContain("aufbereitung");
  });

  it("Messgerät locks radiation / implant / disposables / reprocessing machine even under Weitere Merkmale (AC 25)", () => {
    const m = kind("messgeraet");
    expect(m.shows).toEqual(
      expect.arrayContaining(["mtk", "stk", "vernetzt", "wartung", "aufbereitung"]),
    );
    for (const key of ["strahlung", "eigenAufb", "implantat", "einmal"]) {
      expect(m.blocks).toContain(key);
    }
    expect(m.presets).toEqual({});
  });

  it("energy-source kinds block implantat, einmal and eigenAufb", () => {
    for (const code of [
      "bildgebung",
      "therapie-strahlen",
      "nuklear",
      "sonografie",
      "aktiv-therapie",
    ]) {
      const blocks = kind(code).blocks;
      expect(blocks).toEqual(expect.arrayContaining(["implantat", "einmal", "eigenAufb"]));
    }
  });

  it("Aufbereitungsgerät cannot also be the product being reprocessed", () => {
    expect(kind("aufbereitungsgeraet").blocks).toContain("aufbereitung");
  });

  it("software and implantat lock eigenAufb and einmal", () => {
    expect(kind("software").blocks).toEqual(
      expect.arrayContaining(["eigenAufb", "einmal", "stk", "mtk"]),
    );
    expect(kind("implantat").blocks).toEqual(
      expect.arrayContaining(["eigenAufb", "einmal", "vernetzt", "mtk"]),
    );
  });

  it("instrument locks vernetzt, mtk and eigenAufb", () => {
    expect(kind("instrument").blocks).toEqual(
      expect.arrayContaining(["vernetzt", "mtk", "eigenAufb", "implantat"]),
    );
  });
});

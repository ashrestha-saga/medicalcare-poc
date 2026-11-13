import { describe, expect, it } from "vitest";
import { displayEuroText, formatEuro, isValidEuroInput, normalizeEuroText, parseEuro } from "./euro";

describe("euro", () => {
  it("formats de-DE euro", () => {
    expect(formatEuro(430)).toMatch(/430/);
    expect(formatEuro(430)).toContain("€");
    expect(formatEuro(1234.5)).toMatch(/1\.234,50/);
  });

  it("parses DE and EN style amounts", () => {
    expect(parseEuro("430")).toBe(430);
    expect(parseEuro("430,50")).toBe(430.5);
    expect(parseEuro("1.234,56")).toBe(1234.56);
    expect(parseEuro("1,234.56")).toBe(1234.56);
    expect(parseEuro("480 €")).toBe(480);
    expect(parseEuro("EUR 99.90")).toBe(99.9);
  });

  it("rejects free text and negatives", () => {
    expect(parseEuro("ca. 480 EUR netto")).toBeNull();
    expect(parseEuro("")).toBeNull();
    expect(parseEuro("-10")).toBeNull();
    expect(isValidEuroInput("abc")).toBe(false);
  });

  it("normalizes to currency text", () => {
    const n = normalizeEuroText("1234,5");
    expect(n).toMatch(/1\.234,50/);
    expect(n).toContain("€");
  });

  it("displayEuroText prefers formatted euro", () => {
    expect(displayEuroText("430")).toContain("€");
    expect(displayEuroText("legacy note")).toBe("legacy note");
  });
});

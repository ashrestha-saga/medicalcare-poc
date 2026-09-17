import { describe, expect, it } from "vitest";
import {
  gs1DateToIso,
  identifierKey,
  isValidGtinCheckDigit,
  normalizeGtin,
  normalizeScannerInput,
  parseIdentifier,
} from "./index";

const GTIN = "04012345678901";

describe("GS1 parser — Section 17.1 test matrix", () => {
  it("plain GTIN", () => {
    const r = parseIdentifier(GTIN);
    expect(r.kind).toBe("gtin");
    expect(r.gtin).toBe(GTIN);
    expect(r.udiDi).toBe(GTIN);
    expect(r.serial).toBeUndefined();
  });

  it("GTIN-13 is normalized to 14 digits", () => {
    // 4012345678901 = GTIN above without leading zero — same check digit
    const r = parseIdentifier("4012345678901");
    expect(r.kind).toBe("gtin");
    expect(r.gtin).toBe(GTIN);
  });

  it("GTIN + serial (human readable)", () => {
    const r = parseIdentifier(`(01)${GTIN}(21)SN10001`);
    expect(r.kind).toBe("udi-di");
    expect(r.gtin).toBe(GTIN);
    expect(r.serial).toBe("SN10001");
  });

  it("GTIN + lot", () => {
    const r = parseIdentifier(`(01)${GTIN}(10)LOT42A`);
    expect(r.kind).toBe("udi-di");
    expect(r.lot).toBe("LOT42A");
  });

  it("GTIN + expiry", () => {
    const r = parseIdentifier(`(01)${GTIN}(17)271231`);
    expect(r.expiry).toBe("2027-12-31");
  });

  it("expiry with DD=00 resolves to end of month", () => {
    expect(gs1DateToIso("270200")).toBe("2027-02-28");
    expect(gs1DateToIso("280200")).toBe("2028-02-29");
  });

  it("full GS1 identifier (raw scanner output with symbology id and GS separators)", () => {
    const r = parseIdentifier(`]d201${GTIN}1727123110LOT42A\u001d21SN10001`);
    expect(r.kind).toBe("udi-di");
    expect(r.gtin).toBe(GTIN);
    expect(r.expiry).toBe("2027-12-31");
    expect(r.lot).toBe("LOT42A");
    expect(r.serial).toBe("SN10001");
  });

  it("full GS1 identifier (human readable)", () => {
    const r = parseIdentifier(`(01)${GTIN}(17)271231(10)LOT42A(21)SN10001`);
    expect(r).toMatchObject({ gtin: GTIN, expiry: "2027-12-31", lot: "LOT42A", serial: "SN10001" });
  });

  it("unknown / malformed identifier never throws", () => {
    expect(parseIdentifier("hello world").kind).toBe("unknown");
    expect(parseIdentifier("(01)123").kind).toBe("unknown");
    expect(parseIdentifier("").kind).toBe("unknown");
    // bad check digit
    expect(parseIdentifier("04012345678900").kind).toBe("unknown");
  });

  it("inventory and serial numbers are recognized as free-text kinds", () => {
    expect(parseIdentifier("INV-10001").kind).toBe("inventory");
    expect(parseIdentifier("SN-10001").kind).toBe("serial");
    expect(parseIdentifier("INV-10001").text).toBe("INV-10001");
  });

  it("whitespace normalization", () => {
    expect(normalizeScannerInput("  (01) 0401 2345 6789 01 \n")).toBe(`(01)${GTIN}`);
    const r = parseIdentifier(`  (01) ${GTIN} (21) SN10001  `);
    expect(r.gtin).toBe(GTIN);
    expect(r.serial).toBe("SN10001");
    expect(parseIdentifier("  inv-10001 ").kind).toBe("inventory");
  });

  it("repeated scan of the same value is deterministic and immutable", () => {
    const a = parseIdentifier(`(01)${GTIN}(21)SN10001`);
    const b = parseIdentifier(`(01)${GTIN}(21)SN10001`);
    expect(a).toEqual(b);
    expect(Object.isFrozen(a)).toBe(true);
    expect(identifierKey(a)).toBe(identifierKey(b));
  });

  it("keeps the raw input untouched", () => {
    const raw = `  (01)${GTIN}  `;
    expect(parseIdentifier(raw).raw).toBe(raw);
  });
});

describe("GTIN helpers", () => {
  it("validates check digits", () => {
    expect(isValidGtinCheckDigit("04012345678901")).toBe(true);
    expect(isValidGtinCheckDigit("04012345678918")).toBe(true);
    expect(isValidGtinCheckDigit("04012345678925")).toBe(true);
    expect(isValidGtinCheckDigit("04012345678902")).toBe(false);
    expect(isValidGtinCheckDigit("abc")).toBe(false);
  });

  it("pads to GTIN-14", () => {
    expect(normalizeGtin("12345678")).toBe("00000012345678");
  });
});

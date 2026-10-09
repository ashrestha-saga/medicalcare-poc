import { describe, expect, it } from "vitest";
import { parseIdentifier } from "@/lib/gs1";
import { identifierLookupText, matchesDevice } from "./matchDevice";

describe("matchesDevice", () => {
  const device = {
    inventoryNumber: "INV-10001",
    serialNumber: "SN-10001",
    udiDi: "04012345678901",
  };

  it("matches inventory number", () => {
    expect(matchesDevice(parseIdentifier("INV-10001"), device)).toBe(true);
  });

  it("matches serial from free text", () => {
    expect(matchesDevice(parseIdentifier("SN-10001"), device)).toBe(true);
  });

  it("matches GS1 serial AI", () => {
    expect(
      matchesDevice(parseIdentifier("(01)04012345678901(21)SN-10001"), device),
    ).toBe(true);
  });

  it("rejects unrelated codes", () => {
    expect(matchesDevice(parseIdentifier("INV-99999"), device)).toBe(false);
  });
});

describe("identifierLookupText", () => {
  it("prefers serial from GS1", () => {
    const id = parseIdentifier("(01)04012345678901(21)SN10001");
    expect(identifierLookupText(id)).toBe("SN10001");
  });
});

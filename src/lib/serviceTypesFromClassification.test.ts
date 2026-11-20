import { describe, expect, it } from "vitest";
import {
  ALWAYS_AVAILABLE_SERVICE_TYPES,
  serviceTypesForClassification,
} from "./serviceTypesFromClassification";

describe("serviceTypesForClassification", () => {
  it("returns only always-on types when classification is missing", () => {
    const codes = serviceTypesForClassification(null).map((t) => t.code);
    expect(codes).toEqual([...ALWAYS_AVAILABLE_SERVICE_TYPES]);
  });

  it("adds STK and MTK when annex flags are set", () => {
    const codes = serviceTypesForClassification({
      annex1: true,
      annex2: true,
      softwareClass: null,
      radiation: false,
    }).map((t) => t.code);
    expect(codes).toEqual(["STK", "MTK", ...ALWAYS_AVAILABLE_SERVICE_TYPES]);
  });

  it("always includes DGUV for partner / ward service requests", () => {
    const codes = serviceTypesForClassification({
      annex1: true,
      annex2: true,
      softwareClass: "IIb",
      radiation: true,
    }).map((t) => t.code);
    expect(codes).toContain("DGUV");
    expect(codes[0]).toBe("STK");
    expect(codes).toEqual([
      "STK",
      "MTK",
      "DGUV",
      "REPAIR",
      "SOFTWARE",
      "RADIATION",
      "OTHER",
    ]);
  });
});

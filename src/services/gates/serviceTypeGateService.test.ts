import { describe, expect, it } from "vitest";
import { normalizeServiceTypeGateKey } from "./serviceTypeGateService";

describe("normalizeServiceTypeGateKey R37", () => {
  it("maps sv / konstanz / dguv aliases", () => {
    expect(normalizeServiceTypeGateKey("SV")).toBe("sv");
    expect(normalizeServiceTypeGateKey("expert")).toBe("sv");
    expect(normalizeServiceTypeGateKey("CONSTANCY")).toBe("konstanz");
    expect(normalizeServiceTypeGateKey("radiation")).toBe("konstanz");
    expect(normalizeServiceTypeGateKey("DGUV")).toBe("dguv");
    expect(normalizeServiceTypeGateKey("STK")).toBeNull();
    expect(normalizeServiceTypeGateKey("REPAIR")).toBeNull();
  });
});

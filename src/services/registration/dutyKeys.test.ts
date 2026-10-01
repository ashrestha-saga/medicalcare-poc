import { describe, expect, it } from "vitest";
import { canonicalDutyKey, normalizeConfidence, toIntervalUnit } from "./dutyKeys";

describe("dutyKeys", () => {
  it("maps dynamic ids to DutyKey enum values", () => {
    expect(canonicalDutyKey("wartung")).toBe("wartung");
    expect(canonicalDutyKey("aufb-extern")).toBe("kontrolle");
    expect(canonicalDutyKey("eigen-val")).toBe("validierung");
    expect(canonicalDutyKey("val-ref-INV-1")).toBe("validierung_verweis");
    expect(canonicalDutyKey("zub-0")).toBe("zubehoer");
    expect(canonicalDutyKey("konstanz-aufnahme")).toBe("konstanz");
    expect(canonicalDutyKey("netz")).toBe("vernetzung");
  });

  it("normalizes interval units and legacy guess confidence", () => {
    expect(toIntervalUnit("Monate")).toBe("months");
    expect(toIntervalUnit("Jahre")).toBe("years");
    expect(normalizeConfidence("guess")).toBe("derived");
    expect(normalizeConfidence("verified")).toBe("verified");
  });
});

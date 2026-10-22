import { describe, expect, it } from "vitest";
import { overlapNotApplicableReason } from "./overlapProjection";

describe("dutyProjection helpers", () => {
  it("overlap reason prefix stays stable for recompute matching", () => {
    expect(overlapNotApplicableReason("STK covers DGUV")).toBe("overlap:STK covers DGUV");
  });
});

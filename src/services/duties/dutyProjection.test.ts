import { describe, expect, it } from "vitest";
import {
  isOverlapSuspensionReason,
  overlapNotApplicableReason,
} from "./overlapProjection";

describe("dutyProjection helpers", () => {
  it("coverage reason prefix stays stable for recompute matching", () => {
    expect(overlapNotApplicableReason("STK covers DGUV")).toBe("overlap:STK covers DGUV");
  });

  it("only coverage suspensions are reactivated when leaving covered_by_stk", () => {
    expect(isOverlapSuspensionReason("overlap:STK covers DGUV")).toBe(true);
    expect(isOverlapSuspensionReason("entfaellt")).toBe(false);
  });
});

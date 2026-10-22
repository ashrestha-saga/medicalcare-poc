import { describe, expect, it } from "vitest";
import {
  isOverlapSuspensionReason,
  OVERLAP_REASON_PREFIX,
  overlapNotApplicableReason,
} from "./overlapProjection";

describe("overlapProjection", () => {
  it("prefixes reason text for duty suspension", () => {
    expect(overlapNotApplicableReason(" STK covers DGUV ")).toBe(
      `${OVERLAP_REASON_PREFIX}STK covers DGUV`,
    );
  });

  it("detects overlap suspension reasons only", () => {
    expect(isOverlapSuspensionReason(`${OVERLAP_REASON_PREFIX}yes`)).toBe(true);
    expect(isOverlapSuspensionReason("reclassify")).toBe(false);
    expect(isOverlapSuspensionReason(null)).toBe(false);
  });
});

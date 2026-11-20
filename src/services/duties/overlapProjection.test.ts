import { describe, expect, it } from "vitest";
import {
  isOverlapSuspensionReason,
  OVERLAP_REASON_PREFIX,
  overlapNotApplicableReason,
} from "./overlapProjection";

describe("overlapProjection (covered_by_stk suspension marker)", () => {
  it("prefixes reason text for DGUV coverage suspension", () => {
    expect(overlapNotApplicableReason(" STK covers DGUV ")).toBe(
      `${OVERLAP_REASON_PREFIX}STK covers DGUV`,
    );
  });

  it("detects coverage suspension reasons only", () => {
    expect(isOverlapSuspensionReason(`${OVERLAP_REASON_PREFIX}yes`)).toBe(true);
    expect(isOverlapSuspensionReason("reclassify")).toBe(false);
    expect(isOverlapSuspensionReason(null)).toBe(false);
  });
});

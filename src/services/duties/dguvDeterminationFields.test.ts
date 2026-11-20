import { describe, expect, it } from "vitest";
import { OVERLAP_REASON_PREFIX } from "./overlapProjection";
import { computeDguvDeterminationDutyPatch } from "./dguvDeterminationFields";

describe("computeDguvDeterminationDutyPatch", () => {
  const now = new Date("2026-11-18T12:00:00.000Z");

  it("suspends DGUV when covered_by_stk", () => {
    const patch = computeDguvDeterminationDutyPatch({
      state: "covered_by_stk",
      gbuRef: "GBU-1",
      reason: "STK covers DGUV",
      lastCompletedAt: null,
      now,
    });
    expect(patch.applicable).toBe(false);
    expect(patch.suspendedAt).toEqual(now);
    expect(patch.dueAt).toBeNull();
    expect(patch.intervalValue).toBeNull();
    expect(patch.notApplicableReason).toBe(`${OVERLAP_REASON_PREFIX}STK covers DGUV`);
  });

  it("clears coverage suspension on own_check", () => {
    const patch = computeDguvDeterminationDutyPatch({
      state: "own_check",
      intervalMonths: 12,
      gbuRef: "GBU-1",
      lastCompletedAt: null,
      now,
    });
    expect(patch.applicable).toBe(true);
    expect(patch.suspendedAt).toBeNull();
    expect(patch.notApplicableReason).toBeNull();
    expect(patch.intervalValue).toBe(12);
    expect(patch.intervalUnit).toBe("months");
    expect(patch.dueAt).toEqual(now);
  });

  it("marks not_applicable without suspension", () => {
    const patch = computeDguvDeterminationDutyPatch({
      state: "not_applicable",
      gbuRef: "GBU-1",
      reason: "non-electrical",
      lastCompletedAt: null,
      now,
    });
    expect(patch.applicable).toBe(false);
    expect(patch.suspendedAt).toBeNull();
    expect(patch.notApplicableReason).toBe("non-electrical");
    expect(patch.dueAt).toBeNull();
  });
});

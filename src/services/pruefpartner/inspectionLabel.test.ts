import { describe, expect, it } from "vitest";
import {
  formatLabelNumber,
  parseLabelNumber,
  suggestLabelNextDue,
  toLabelMonth,
} from "./inspectionLabel";

describe("inspectionLabel", () => {
  it("formats and parses DG-YYYY-NNNN", () => {
    expect(formatLabelNumber("DG", 2026, 144)).toBe("DG-2026-0144");
    expect(parseLabelNumber("DG-2026-0144")).toEqual({
      prefix: "DG",
      year: 2026,
      seq: 144,
    });
  });

  it("suggests next due from duty interval (exact_day + years)", () => {
    const next = suggestLabelNextDue({
      performedAt: new Date("2026-03-15T00:00:00.000Z"),
      deadlineAnchor: "exact_day",
      referenceDate: new Date("2025-03-15T00:00:00.000Z"),
      intervalValue: 1,
      intervalUnit: "years",
    });
    expect(next).toBe("2027-03");
  });

  it("falls back to +12 months without interval", () => {
    expect(
      suggestLabelNextDue({
        performedAt: new Date("2026-11-24T00:00:00.000Z"),
      }),
    ).toBe(toLabelMonth(new Date(Date.UTC(2027, 10, 1))));
  });
});

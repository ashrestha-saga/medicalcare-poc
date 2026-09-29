import { describe, expect, it } from "vitest";
import { isLiveContract } from "@/services/access/partnerAccessService";

const now = new Date("2026-09-25T12:00:00.000Z");

describe("isLiveContract", () => {
  it("accepts an open window", () => {
    expect(
      isLiveContract(
        {
          validFrom: new Date("2024-01-01"),
          validTo: null,
          terminatedAt: null,
          suspendedAt: null,
        },
        now,
      ),
    ).toBe(true);
  });

  it("rejects expired, terminated, and suspended contracts", () => {
    expect(
      isLiveContract(
        {
          validFrom: new Date("2024-01-01"),
          validTo: new Date("2026-06-30"),
          terminatedAt: null,
          suspendedAt: null,
        },
        now,
      ),
    ).toBe(false);
    expect(
      isLiveContract(
        {
          validFrom: new Date("2024-01-01"),
          validTo: null,
          terminatedAt: new Date("2026-01-01"),
          suspendedAt: null,
        },
        now,
      ),
    ).toBe(false);
    expect(
      isLiveContract(
        {
          validFrom: new Date("2024-01-01"),
          validTo: null,
          terminatedAt: null,
          suspendedAt: new Date("2026-09-01"),
        },
        now,
      ),
    ).toBe(false);
  });
});

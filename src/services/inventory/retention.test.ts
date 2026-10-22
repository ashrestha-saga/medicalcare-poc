import { describe, expect, it } from "vitest";
import {
  computeRetainUntil,
  isPurgeAllowed,
  retentionClockOnRetire,
  retentionStatus,
  utcDateOnly,
} from "./retention";

describe("retention (§ 13 Abs. 3)", () => {
  it("computes retainUntil five years after decommission", () => {
    const d = new Date(Date.UTC(2026, 4, 15));
    expect(computeRetainUntil(d).toISOString().slice(0, 10)).toBe("2031-05-15");
  });

  it("sets clock from retire day", () => {
    const clock = retentionClockOnRetire({
      now: new Date(Date.UTC(2026, 9, 22)),
      retiredAt: new Date(Date.UTC(2026, 4, 15, 12, 0, 0)),
    });
    expect(clock.decommissionedAt.toISOString().slice(0, 10)).toBe("2026-05-15");
    expect(clock.retainUntil.toISOString().slice(0, 10)).toBe("2031-05-15");
  });

  it("refuses purge before retainUntil and allows on/after", () => {
    const until = new Date(Date.UTC(2031, 4, 15));
    expect(isPurgeAllowed(until, new Date(Date.UTC(2031, 4, 14)))).toBe(false);
    expect(isPurgeAllowed(until, new Date(Date.UTC(2031, 4, 15)))).toBe(true);
    expect(isPurgeAllowed(null)).toBe(false);
  });

  it("maps retention status for retired devices", () => {
    const until = utcDateOnly(new Date(Date.UTC(2031, 4, 15)));
    expect(
      retentionStatus({
        state: "retired",
        retainUntil: until,
        now: new Date(Date.UTC(2026, 0, 1)),
      }),
    ).toBe("under_retention");
    expect(
      retentionStatus({
        state: "retired",
        retainUntil: until,
        now: new Date(Date.UTC(2031, 5, 1)),
      }),
    ).toBe("purge_allowed");
    expect(retentionStatus({ state: "released", retainUntil: null })).toBe("none");
  });
});

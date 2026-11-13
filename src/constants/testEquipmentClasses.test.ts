import { describe, expect, it } from "vitest";
import { deriveTestEquipmentStatus } from "./testEquipmentClasses";

describe("deriveTestEquipmentStatus", () => {
  const now = new Date("2026-06-15T12:00:00Z");

  it("marks inactive first", () => {
    expect(deriveTestEquipmentStatus(false, "2027-01-01", now)).toBe("inactive");
  });

  it("marks lapsed when calibratedUntil is before today", () => {
    expect(deriveTestEquipmentStatus(true, "2026-06-14", now)).toBe("lapsed");
  });

  it("marks due within 30 days", () => {
    expect(deriveTestEquipmentStatus(true, "2026-07-01", now)).toBe("due");
  });

  it("marks ok when calibration is further out or missing", () => {
    expect(deriveTestEquipmentStatus(true, "2026-12-01", now)).toBe("ok");
    expect(deriveTestEquipmentStatus(true, null, now)).toBe("ok");
  });
});

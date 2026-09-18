import { describe, expect, it } from "vitest";
import {
  addMonthsUtc,
  computeNextMaintenanceDueAt,
  deriveMaintenanceStatus,
  resolveMaintenanceCycleMonths,
} from "./schedule";

describe("addMonthsUtc", () => {
  it("adds months without local timezone drift", () => {
    const base = new Date("2024-01-15T12:00:00.000Z");
    expect(addMonthsUtc(base, 12).toISOString()).toBe("2025-01-15T12:00:00.000Z");
  });
});

describe("computeNextMaintenanceDueAt", () => {
  it("uses lastMaintainedAt when present", () => {
    const due = computeNextMaintenanceDueAt({
      cycleMonths: 12,
      anchorAt: new Date("2023-03-15T00:00:00.000Z"),
      lastMaintainedAt: new Date("2024-06-01T00:00:00.000Z"),
    });
    expect(due?.toISOString()).toBe("2025-06-01T00:00:00.000Z");
  });

  it("falls back to anchor", () => {
    const due = computeNextMaintenanceDueAt({
      cycleMonths: 6,
      anchorAt: new Date("2024-01-10T00:00:00.000Z"),
    });
    expect(due?.toISOString()).toBe("2024-07-10T00:00:00.000Z");
  });

  it("returns null without cycle", () => {
    expect(
      computeNextMaintenanceDueAt({
        cycleMonths: null,
        anchorAt: new Date("2024-01-10T00:00:00.000Z"),
      }),
    ).toBeNull();
  });
});

describe("deriveMaintenanceStatus", () => {
  const now = new Date("2025-01-15T10:00:00.000Z");

  it("classifies overdue / due / ok / unset", () => {
    expect(deriveMaintenanceStatus(new Date("2025-01-10T00:00:00.000Z"), now)).toBe("overdue");
    expect(deriveMaintenanceStatus(new Date("2025-01-15T23:00:00.000Z"), now)).toBe("due");
    expect(deriveMaintenanceStatus(new Date("2025-02-01T00:00:00.000Z"), now)).toBe("ok");
    expect(deriveMaintenanceStatus(null, now)).toBe("unset");
  });
});

describe("resolveMaintenanceCycleMonths", () => {
  it("prefers explicit input over model default", () => {
    expect(resolveMaintenanceCycleMonths(6, 12)).toBe(6);
    expect(resolveMaintenanceCycleMonths(null, 12)).toBe(12);
    expect(resolveMaintenanceCycleMonths(undefined, undefined)).toBeNull();
  });
});

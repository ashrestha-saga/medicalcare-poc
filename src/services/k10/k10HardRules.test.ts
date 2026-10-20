import { describe, expect, it } from "vitest";
import {
  isBatchUsable,
  isDisclosureActive,
  konstanzDueAtFromCadence,
  trimDecidesZone,
} from "./k10HardRules";
import { createBookEntrySchema, openDisclosureSchema, releaseBatchSchema } from "@/schemas/k10";

describe("isBatchUsable", () => {
  it("rejects null and rejected batches", () => {
    expect(isBatchUsable(null)).toBe(false);
    expect(isBatchUsable(undefined)).toBe(false);
    expect(isBatchUsable("rejected")).toBe(false);
  });

  it("allows released and released_with_conditions", () => {
    expect(isBatchUsable("released")).toBe(true);
    expect(isBatchUsable("released_with_conditions")).toBe(true);
  });
});

describe("isDisclosureActive", () => {
  const future = new Date("2030-01-01T00:00:00.000Z");
  const past = new Date("2020-01-01T00:00:00.000Z");
  const now = Date.parse("2026-10-13T12:00:00.000Z");

  it("blocks expired and closed sessions", () => {
    expect(isDisclosureActive({ closedAt: null, expiresAt: past }, now)).toBe(false);
    expect(isDisclosureActive({ closedAt: new Date(now), expiresAt: future }, now)).toBe(false);
  });

  it("allows open future sessions", () => {
    expect(isDisclosureActive({ closedAt: null, expiresAt: future }, now)).toBe(true);
  });
});

describe("trimDecidesZone", () => {
  it("keeps top 3 by urgency and never drops overflow", () => {
    const tiles = [
      { key: "a", urgency: "empty" as const, sortOrder: 1 },
      { key: "b", urgency: "overdue" as const, sortOrder: 2 },
      { key: "c", urgency: "due" as const, sortOrder: 3 },
      { key: "d", urgency: "info" as const, sortOrder: 4 },
      { key: "e", urgency: "overdue" as const, sortOrder: 5 },
    ];
    const { decides, overflow } = trimDecidesZone(tiles, 3);
    expect(decides.map((t) => t.key)).toEqual(["b", "e", "c"]);
    expect(overflow.map((t) => t.key)).toEqual(["d", "a"]);
    expect(decides.length + overflow.length).toBe(tiles.length);
  });
});

describe("konstanzDueAtFromCadence", () => {
  it("returns null when no open cadence", () => {
    expect(konstanzDueAtFromCadence(null, () => new Date())).toBeNull();
  });

  it("delegates to computeDutyDueAt when cadence is open", () => {
    const determinedAt = new Date("2026-01-15T00:00:00.000Z");
    const due = new Date("2026-04-30T00:00:00.000Z");
    const result = konstanzDueAtFromCadence(
      { intervalValue: 3, intervalUnit: "months", determinedAt },
      (args) => {
        expect(args.deadlineAnchor).toBe("month_end");
        expect(args.intervalValue).toBe(3);
        expect(args.referenceDate).toEqual(determinedAt);
        return due;
      },
    );
    expect(result).toEqual(due);
  });
});

describe("k10 schemas (write boundary)", () => {
  it("book entry is create-only with optional correctsEntryId", () => {
    const parsed = createBookEntrySchema.parse({
      deviceInstanceId: "d1",
      kind: "malfunction",
      occurredAt: "2026-10-01",
      description: "Pump alarm",
      correctsEntryId: "prior-1",
    });
    expect(parsed.correctsEntryId).toBe("prior-1");
  });

  it("release batch requires a result enum", () => {
    expect(() => releaseBatchSchema.parse({})).toThrow();
    expect(releaseBatchSchema.parse({ releaseResult: "released" }).releaseResult).toBe("released");
  });

  it("disclosure requires future-facing expiresAt string and scope", () => {
    expect(() => openDisclosureSchema.parse({ expiresAt: "", audience: "LA", scope: [] })).toThrow();
    const ok = openDisclosureSchema.parse({
      expiresAt: "2030-01-01T12:00:00.000Z",
      audience: "Gesundheitsamt",
      scope: ["bestand", "pruefungen"],
    });
    expect(ok.scope).toHaveLength(2);
  });
});

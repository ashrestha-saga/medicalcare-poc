import { describe, expect, it } from "vitest";
import type { CataloguePreviewDTO } from "@/interfaces/pruefpartner";
import { buildDaySections, groupRowsBySite } from "./siteGroups";

function row(partial: Partial<CataloguePreviewDTO> & { reference: string }): CataloguePreviewDTO {
  return {
    tenantId: "t1",
    deviceInstanceId: "d1",
    inventoryNumber: "INV",
    serialNumber: null,
    deviceLabel: partial.deviceLabel ?? partial.reference,
    modelName: null,
    manufacturer: null,
    locationText: "Room",
    accessHint: null,
    siteId: null,
    siteName: null,
    scheduledAt: null,
    visitId: null,
    visitStartedAt: null,
    overdue: false,
    serviceType: "STK",
    dueAt: null,
    inspectionTypeCode: "STK",
    sealed: false,
    catalogue: null,
    qualificationGate: { ok: true, required: [], missing: [] },
    equipmentGate: { ok: true, requiredClass: null, blockedReason: null },
    eligibleEquipment: [],
    draftRunId: null,
    sealedRunId: null,
    ...partial,
  };
}

describe("groupRowsBySite", () => {
  it("groups by site and sorts by earliest due", () => {
    const groups = groupRowsBySite([
      row({
        reference: "a",
        siteId: "s2",
        siteName: "MVZ",
        dueAt: "2026-10-12",
      }),
      row({
        reference: "b",
        siteId: "s1",
        siteName: "Klinikum Nord · Haus A",
        dueAt: "2026-09-30",
        accessHint: "Pforte",
      }),
      row({
        reference: "c",
        siteId: "s1",
        siteName: "Klinikum Nord · Haus A",
        dueAt: "2026-10-01",
      }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]!.siteName).toBe("Klinikum Nord · Haus A");
    expect(groups[0]!.rows).toHaveLength(2);
    expect(groups[0]!.accessHint).toBe("Pforte");
    expect(groups[0]!.earliestDue).toBe("2026-09-30");
    expect(groups[1]!.siteName).toBe("MVZ");
  });
});

describe("buildDaySections", () => {
  it("nests sites under time buckets for Woche", () => {
    const open = [
      row({
        reference: "t",
        siteId: "s1",
        siteName: "Haus A",
        scheduledAt: "2026-10-31T08:00:00.000Z",
      }),
      row({
        reference: "w",
        siteId: "s2",
        siteName: "MVZ",
        scheduledAt: "2026-11-03T08:00:00.000Z",
      }),
    ];
    // Freeze relative to 2026-10-30 via scheduled dates chosen above.
    const sections = buildDaySections(open, "woche");
    const morgen = sections.find((s) => s.key === "morgen");
    const woche = sections.find((s) => s.key === "woche");
    expect(morgen?.sites.map((s) => s.siteName)).toEqual(["Haus A"]);
    expect(woche?.sites.map((s) => s.siteName)).toEqual(["MVZ"]);
  });
});

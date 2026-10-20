import { describe, expect, it } from "vitest";
import {
  consequenceMeansOutOfService,
  encodeOutOfServiceConsequence,
  resolveFurtherActions,
  resolvePrimaryAction,
} from "./scanPrimaryAction";
import { evaluateWithinLimit, openDailyRefCodesForDevice } from "./scanRoutineService";

const base = {
  state: "released" as const,
  isEquipment: false,
  openBatchCount: 0,
  openDailyChecks: false,
  openKonstanzChecks: false,
  hasKonstanzDuties: false,
  ifuLabel: null as string | null,
  lage: "ok" as const,
  quelle: null,
  grund: null,
  openRequestRef: null,
};

describe("scanPrimaryAction", () => {
  it("encodes out-of-service in consequence text", () => {
    expect(encodeOutOfServiceConsequence("Pump swapped", true)).toBe(
      "Außer Betrieb genommen. Pump swapped",
    );
    expect(consequenceMeansOutOfService("Außer Betrieb genommen.")).toBe(true);
    expect(consequenceMeansOutOfService("cleaned filter")).toBe(false);
  });

  it("defaults ward user to Störung melden", () => {
    const a = resolvePrimaryAction({
      ...base,
      permissions: ["inventory:view", "devicebook:view"],
      role: "user",
    });
    expect(a.ctx).toBe("stoerung");
  });

  it("prefers Tageskontrolle when reprocessing open on equipment", () => {
    const a = resolvePrimaryAction({
      ...base,
      isEquipment: true,
      openDailyChecks: true,
      openKonstanzChecks: true,
      hasKonstanzDuties: true,
      permissions: ["inventory:view", "reprocessing:view"],
      role: "user",
    });
    expect(a.ctx).toBe("routine");
  });

  it("does not offer charge-neu on non-equipment", () => {
    const a = resolvePrimaryAction({
      ...base,
      isEquipment: false,
      permissions: ["inventory:view", "reprocessing:view"],
      role: "user",
    });
    expect(a.ctx).toBe("stoerung");
  });

  it("offers charge-neu on equipment when daily checks done", () => {
    const a = resolvePrimaryAction({
      ...base,
      isEquipment: true,
      permissions: ["inventory:view", "reprocessing:view"],
      role: "user",
    });
    expect(a.ctx).toBe("charge-neu");
  });

  it("prefers Konstanz when due and no daily checks", () => {
    const a = resolvePrimaryAction({
      ...base,
      openKonstanzChecks: true,
      hasKonstanzDuties: true,
      lage: "warn",
      quelle: "konstanz",
      grund: "überfällig",
      permissions: ["inventory:view"],
      role: "user",
    });
    expect(a.ctx).toBe("konstanz");
  });

  it("offers service when blocked by malfunction", () => {
    const a = resolvePrimaryAction({
      ...base,
      lage: "stop",
      quelle: "stoerung",
      grund: "Außer Betrieb",
      permissions: ["inventory:view", "requests:create"],
      role: "user",
    });
    expect(a.ctx).toBe("service");
    expect(a.servicePrefill).toBe("reparatur");
  });

  it("blocks with recall stop before routine work", () => {
    const a = resolvePrimaryAction({
      ...base,
      isEquipment: true,
      openDailyChecks: true,
      lage: "stop",
      quelle: "rueckruf",
      grund: "Nicht anwenden — Rückruf X",
      permissions: ["inventory:view", "reprocessing:view"],
      role: "user",
    });
    expect(a.ctx).toBe("info");
    expect(a.tone).toBe("stop");
    expect(a.titleKey).toBe("actions.recallStop");
    expect(a.infoOnly).toBe(true);
  });
});

describe("resolveFurtherActions", () => {
  it("keeps Batches and Daily check when NOW is charge-neu", () => {
    const primary = resolvePrimaryAction({
      ...base,
      isEquipment: true,
      permissions: [
        "inventory:view",
        "reprocessing:view",
        "devicebook:view",
        "requests:create",
        "parts:request",
      ],
      role: "user",
    });
    expect(primary.ctx).toBe("charge-neu");
    const further = resolveFurtherActions(
      {
        ...base,
        isEquipment: true,
        permissions: [
          "inventory:view",
          "reprocessing:view",
          "devicebook:view",
          "requests:create",
          "parts:request",
        ],
        role: "user",
      },
      primary,
    );
    const ctxs = further.map((a) => a.ctx);
    expect(ctxs).toContain("stoerung");
    expect(ctxs).toContain("service");
    expect(ctxs).toContain("ersatz");
    expect(ctxs).toContain("routine");
    expect(ctxs).toContain("charge");
    expect(ctxs).toContain("ifu");
    expect(further.find((a) => a.ctx === "routine")?.textKey).toBe("actions.routineDoneHint");
  });

  it("hides reprocessing rows without permission", () => {
    const primary = resolvePrimaryAction({
      ...base,
      permissions: ["inventory:view", "requests:create", "parts:request"],
      role: "user",
    });
    const further = resolveFurtherActions(
      {
        ...base,
        permissions: ["inventory:view", "requests:create", "parts:request"],
        role: "user",
      },
      primary,
    );
    const ctxs = further.map((a) => a.ctx);
    expect(ctxs).not.toContain("routine");
    expect(ctxs).not.toContain("charge");
    expect(ctxs).not.toContain("stoerung");
    expect(ctxs).toContain("service");
    expect(ctxs).toContain("ersatz");
    expect(ctxs).toContain("ifu");
  });
});

describe("evaluateWithinLimit", () => {
  it("evaluates ≤ and ≥ limits", () => {
    expect(evaluateWithinLimit("≤ 30", "29")).toBe(true);
    expect(evaluateWithinLimit("≤ 30", "31")).toBe(false);
    expect(evaluateWithinLimit("≥ 2,0", "2.5")).toBe(true);
    expect(evaluateWithinLimit("≥ 2,0", "1")).toBe(false);
  });
});

describe("openDailyRefCodesForDevice", () => {
  const refs = [
    { code: "RC-rdg-1", scope: "equipment", equipmentTypeCode: "rdg" },
    { code: "RC-water-1", scope: "water", equipmentTypeCode: null },
  ];

  it("matches equipment catalogue by eigenTyp and subtracts today's evidence", () => {
    const open = openDailyRefCodesForDevice(
      {
        id: "d1",
        productKindCode: "aufbereitungsgeraet",
        characteristicsJson: JSON.stringify({ istAufbGeraet: true, eigenTyp: "rdg" }),
        siteId: "s1",
      },
      refs,
      [{ checkCode: "RC-rdg-1", equipmentDeviceId: "d1", siteId: null }],
    );
    expect(open).toEqual(["RC-water-1"]);
  });

  it("returns no equipment rows for ordinary products", () => {
    const open = openDailyRefCodesForDevice(
      {
        id: "d2",
        productKindCode: "instrument",
        characteristicsJson: JSON.stringify({ aufbereitung: true }),
        siteId: "s1",
      },
      refs,
      [],
    );
    expect(open).toEqual(["RC-water-1"]);
  });
});

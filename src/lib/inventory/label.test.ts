import { describe, expect, it } from "vitest";
import { formatMaintenanceDueLabel, toInventoryLabel, toInventoryLabels } from "@/lib/inventory/label";

describe("toInventoryLabel", () => {
  it("prefers trade name, then model name, then inventory number", () => {
    expect(
      toInventoryLabel({
        inventoryNumber: "INV-1",
        serialNumber: "SN-1",
        tradeName: "Pump",
        modelName: "Model X",
        nextMaintenanceDueAt: null,
      }),
    ).toEqual({
      inventoryNumber: "INV-1",
      name: "Pump",
      serialNumber: "SN-1",
      maintenanceDueLabel: null,
    });

    expect(
      toInventoryLabel({
        inventoryNumber: "INV-2",
        serialNumber: null,
        tradeName: null,
        modelName: "Model Y",
        nextMaintenanceDueAt: null,
      }),
    ).toEqual({
      inventoryNumber: "INV-2",
      name: "Model Y",
      serialNumber: null,
      maintenanceDueLabel: null,
    });

    expect(
      toInventoryLabel({
        inventoryNumber: "INV-3",
        serialNumber: "  ",
        tradeName: "  ",
        modelName: null,
        nextMaintenanceDueAt: null,
      }),
    ).toEqual({
      inventoryNumber: "INV-3",
      name: "INV-3",
      serialNumber: null,
      maintenanceDueLabel: null,
    });
  });

  it("includes formatted maintenance due when present", () => {
    const label = toInventoryLabel({
      inventoryNumber: "INV-1",
      serialNumber: null,
      tradeName: "Pump",
      modelName: null,
      nextMaintenanceDueAt: "2025-03-15T00:00:00.000Z",
    });
    expect(label.maintenanceDueLabel).toBe(formatMaintenanceDueLabel("2025-03-15T00:00:00.000Z"));
    expect(label.maintenanceDueLabel).toMatch(/\d{2}\.\d{2}\.\d{4}/);
  });

  it("maps a list", () => {
    expect(
      toInventoryLabels([
        {
          inventoryNumber: "INV-1",
          serialNumber: null,
          tradeName: "A",
          modelName: null,
          nextMaintenanceDueAt: null,
        },
      ]),
    ).toHaveLength(1);
  });
});

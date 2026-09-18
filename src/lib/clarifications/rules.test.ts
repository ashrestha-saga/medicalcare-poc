import { describe, expect, it } from "vitest";
import { evaluateClarificationIssues, maxSeverity } from "./rules";

describe("evaluateClarificationIssues", () => {
  it("returns empty when record is complete and verified", () => {
    expect(
      evaluateClarificationIssues({
        responsibleUserId: "u1",
        responsiblePerson: "Anna",
        maintenanceCycleMonths: 12,
        room: "4",
        serialNumber: "SN-1",
        modelName: "X200",
        tradeName: "Pump",
        classificationConfidence: "verified",
        hasClassificationProposal: true,
        duplicateSerialInventoryNumbers: [],
      }),
    ).toEqual([]);
  });

  it("flags missing fields and derived classification", () => {
    const issues = evaluateClarificationIssues({
      responsibleUserId: null,
      responsiblePerson: null,
      maintenanceCycleMonths: null,
      room: null,
      serialNumber: null,
      modelName: null,
      tradeName: null,
      classificationConfidence: "derived",
      hasClassificationProposal: true,
      duplicateSerialInventoryNumbers: [],
    });
    expect(issues.map((i) => i.code)).toEqual([
      "missing_responsible",
      "missing_maintenance_cycle",
      "derived_classification",
      "missing_room",
      "missing_model_name",
      "missing_serial",
    ]);
    expect(maxSeverity(issues)).toBe("medium");
  });

  it("flags duplicate serial as high", () => {
    const issues = evaluateClarificationIssues({
      responsibleUserId: "u1",
      responsiblePerson: "A",
      maintenanceCycleMonths: 12,
      room: "1",
      serialNumber: "SN-1",
      modelName: "X",
      tradeName: "X",
      classificationConfidence: "verified",
      hasClassificationProposal: true,
      duplicateSerialInventoryNumbers: ["INV-10002"],
    });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe("duplicate_serial");
    expect(maxSeverity(issues)).toBe("high");
  });
});

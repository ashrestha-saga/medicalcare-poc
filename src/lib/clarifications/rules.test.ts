import { describe, expect, it } from "vitest";
import { evaluateClarificationIssues, maxSeverity } from "./rules";

const complete = {
  responsibleUserId: "u1",
  responsiblePerson: "Anna",
  maintenanceCycleMonths: 12,
  room: "4",
  serialNumber: "SN-1",
  modelName: "X200",
  tradeName: "Pump",
  state: "released",
  classificationConfidence: "verified",
  hasModelClassification: true,
  duplicateSerialInventoryNumbers: [] as string[],
};

describe("evaluateClarificationIssues", () => {
  it("returns empty when record is complete and verified", () => {
    expect(evaluateClarificationIssues(complete)).toEqual([]);
  });

  it("flags not yet released for draft and review", () => {
    expect(evaluateClarificationIssues({ ...complete, state: "draft" }).map((i) => i.code)).toEqual([
      "not_released",
    ]);
    expect(evaluateClarificationIssues({ ...complete, state: "review" })[0]?.label).toContain(
      "under review",
    );
    expect(evaluateClarificationIssues({ ...complete, state: "retired" })).toEqual([]);
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
      state: "released",
      classificationConfidence: "derived",
      hasModelClassification: true,
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
      ...complete,
      duplicateSerialInventoryNumbers: ["INV-10002"],
    });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe("duplicate_serial");
    expect(maxSeverity(issues)).toBe("high");
  });
});

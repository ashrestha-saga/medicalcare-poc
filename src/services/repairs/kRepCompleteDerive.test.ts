import { describe, expect, it } from "vitest";
import {
  deriveRepairCompleteFromKRepSteps,
  parseFunctionTestPassed,
  parsePartsNote,
  parseSafetyRelevant,
  repairGateInputFromDerived,
  repairResultFromAction,
} from "./kRepCompleteDerive";

const STEPS = [
  { id: "s1", inputKind: "check" },
  { id: "s2", inputKind: "text" },
  { id: "s3", inputKind: "select" },
  { id: "s4", inputKind: "parts" },
  { id: "s5", inputKind: "number" },
  { id: "s6", inputKind: "measurement" },
  { id: "s7", inputKind: "result" },
];

describe("kRepCompleteDerive", () => {
  it("maps actions to repair results", () => {
    expect(repairResultFromAction("part_replaced")).toBe("repaired");
    expect(repairResultFromAction("parts_ordered")).toBe("parts_ordered");
    expect(repairResultFromAction("not_repairable")).toBe("not_repairable");
    expect(repairResultFromAction("provisional")).toBe("provisional");
  });

  it("parses safetyRelevant from Ergebnis note", () => {
    expect(parseSafetyRelevant("sicherheitsrelevant: ja")).toBe(true);
    expect(parseSafetyRelevant("sicherheitsrelevant: nein")).toBe(false);
    expect(parseSafetyRelevant("Repaired OK")).toBe(false);
  });

  it("parses parts lines", () => {
    expect(parsePartsNote("Tube ×2\nFilter")).toEqual([
      { description: "Tube", qty: 2 },
      { description: "Filter" },
    ]);
  });

  it("parses function test", () => {
    expect(parseFunctionTestPassed("ok", null, null)).toBe(true);
    expect(parseFunctionTestPassed(null, false, true)).toBe(false);
    expect(parseFunctionTestPassed(null, null, null)).toBe(null);
  });

  it("derives a valid part_replaced completion", () => {
    const derived = deriveRepairCompleteFromKRepSteps({
      inspectionRunId: "run-1",
      steps: STEPS,
      stepResults: [
        { stepId: "s1", confirmed: true },
        { stepId: "s2", note: "worn seal" },
        { stepId: "s3", note: "part_replaced" },
        { stepId: "s4", note: "Seal kit ×1", photoCount: 1 },
        { stepId: "s5", measuredValue: "45" },
        { stepId: "s6", withinLimit: true, confirmed: true },
        { stepId: "s7", note: "repaired\nsicherheitsrelevant: nein" },
      ],
    });
    expect(derived).not.toBeNull();
    expect(derived!.action).toBe("part_replaced");
    expect(derived!.result).toBe("repaired");
    expect(derived!.parts).toHaveLength(1);
    expect(derived!.functionTestPassed).toBe(true);
    expect(derived!.safetyRelevant).toBe(false);
    expect(derived!.laborMinutes).toBe(45);
    expect(derived!.cause).toBe("worn seal");

    const gate = repairGateInputFromDerived(derived!, {
      photoCount: 1,
      noPhotoReason: null,
    });
    expect(gate.partCount).toBe(1);
    expect(gate.hasPartPhotoOrReason).toBe(true);
  });

  it("returns null without Maßnahme", () => {
    expect(
      deriveRepairCompleteFromKRepSteps({
        inspectionRunId: "run-1",
        steps: STEPS,
        stepResults: [],
      }),
    ).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import {
  failedStepsMissingEvidence,
  protocolChecklist,
  signatureKindsSatisfied,
  stepsPayloadFromDraft,
} from "./inspectionProtocolHelpers";
import type { InspectionStepResultDTO } from "@/interfaces/pruefpartner";

const baseStep = (id: string, over: Partial<InspectionStepResultDTO> = {}): InspectionStepResultDTO => ({
  stepId: id,
  position: 1,
  label: id,
  isMeasurement: false,
  unit: null,
  limitText: null,
  limitSource: null,
  comparedToBaseline: false,
  baselineValue: null,
  triggerNote: null,
  confirmed: null,
  measuredValue: null,
  withinLimit: null,
  baselineFlag: false,
  note: null,
  source: "catalogue",
  ...over,
});

describe("protocolChecklist", () => {
  it("follows the same flags the seal uses and names the first gap", () => {
    const gates = protocolChecklist({
      visitStarted: true,
      deviceOk: false,
      stepsComplete: false,
      missingEvidence: 1,
      signatures: [],
    });
    expect(gates.find((g) => !g.done)?.id).toBe("device");
    expect(gates.find((g) => g.id === "evidence")?.done).toBe(false);
    expect(gates.find((g) => g.id === "visit")?.done).toBe(true);
  });
});

describe("inspectionProtocolHelpers Phase 1 gates", () => {
  it("requires both signature kinds", () => {
    expect(signatureKindsSatisfied([])).toBe(false);
    expect(
      signatureKindsSatisfied([{ kind: "inspector", signedAt: "x", absent: false }]),
    ).toBe(false);
    expect(
      signatureKindsSatisfied([
        { kind: "inspector", signedAt: "x", absent: false },
        { kind: "institution", signedAt: null, absent: true },
      ]),
    ).toBe(true);
  });

  it("flags failed steps missing photo/reason", () => {
    const steps = [baseStep("a", { photoCount: 0 }), baseStep("b", { photoCount: 1 })];
    expect(
      failedStepsMissingEvidence(steps, {
        a: { rating: "defect" },
        b: { rating: "defect" },
      }),
    ).toEqual(["a"]);
    expect(
      failedStepsMissingEvidence(steps, {
        a: { rating: "defect", noPhotoReason: "covered" },
      }),
    ).toEqual([]);
  });

  it("sends noPhotoReason for defect ratings", () => {
    const payload = stepsPayloadFromDraft({
      s1: { rating: "defect", noPhotoReason: "no access" },
      s2: { rating: "ok" },
    });
    expect(payload.find((p) => p.stepId === "s1")?.noPhotoReason).toBe("no access");
    expect(payload.find((p) => p.stepId === "s2")?.noPhotoReason).toBeNull();
  });
});

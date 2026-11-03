import { describe, expect, it } from "vitest";
import {
  assertFailedStepsHaveEvidence,
  assertLinkedVisitSealGates,
  assertSignaturesPresent,
  assertVisitStarted,
} from "./sealGates";

describe("sealGates D2/D10/D11", () => {
  it("refuses seal when visit has not started", () => {
    const r = assertVisitStarted(null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.field).toBe("visitId");
  });

  it("accepts a started visit", () => {
    expect(assertVisitStarted(new Date()).ok).toBe(true);
  });

  it("refuses when inspector or institution signature is missing", () => {
    expect(assertSignaturesPresent([]).ok).toBe(false);
    expect(
      assertSignaturesPresent([{ kind: "inspector", signedAt: new Date(), absent: false }]).ok,
    ).toBe(false);
    expect(
      assertSignaturesPresent([
        { kind: "inspector", signedAt: new Date(), absent: false },
        { kind: "institution", signedAt: null, absent: true },
      ]).ok,
    ).toBe(true);
  });

  it("refuses failed steps without photo or noPhotoReason", () => {
    const r = assertFailedStepsHaveEvidence([
      { id: "s1", noPhotoReason: null, photoCount: 0 },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.field).toBe("noPhotoReason");
  });

  it("accepts failed step with reason or photo", () => {
    expect(
      assertFailedStepsHaveEvidence([{ id: "s1", noPhotoReason: "not photographable", photoCount: 0 }])
        .ok,
    ).toBe(true);
    expect(
      assertFailedStepsHaveEvidence([{ id: "s1", noPhotoReason: null, photoCount: 1 }]).ok,
    ).toBe(true);
  });

  it("green path passes all linked-visit gates", () => {
    const r = assertLinkedVisitSealGates({
      visitStartedAt: new Date(),
      signatures: [
        { kind: "inspector", signedAt: new Date(), absent: false },
        { kind: "institution", signedAt: null, absent: true },
      ],
      failedSteps: [{ id: "s1", noPhotoReason: "device covered", photoCount: 0 }],
    });
    expect(r.ok).toBe(true);
  });
});

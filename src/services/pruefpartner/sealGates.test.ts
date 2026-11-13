import { describe, expect, it } from "vitest";
import {
  assertFailedStepsHaveEvidence,
  assertLinkedVisitSealGates,
  assertRepairReportGates,
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

  it("skipVisit waives visit-started for send-in workshop reports (E77)", () => {
    const blocked = assertLinkedVisitSealGates({
      visitStartedAt: null,
      signatures: [
        { kind: "inspector", signedAt: new Date(), absent: false },
        { kind: "institution", signedAt: null, absent: true },
      ],
      failedSteps: [],
    });
    expect(blocked.ok).toBe(false);

    const allowed = assertLinkedVisitSealGates({
      visitStartedAt: null,
      skipVisit: true,
      signatures: [
        { kind: "inspector", signedAt: new Date(), absent: false },
        { kind: "institution", signedAt: null, absent: true },
      ],
      failedSteps: [],
    });
    expect(allowed.ok).toBe(true);
  });
});

describe("assertRepairReportGates R11", () => {
  it("requires result", () => {
    const r = assertRepairReportGates({
      result: null,
      action: "repaired",
      partCount: 0,
      hasPartPhotoOrReason: false,
      functionTestPassed: true,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.field).toBe("result");
  });

  it("rejects part_replaced without parts or photo/reason", () => {
    const noParts = assertRepairReportGates({
      result: "repaired",
      action: "part_replaced",
      partCount: 0,
      hasPartPhotoOrReason: true,
      functionTestPassed: true,
    });
    expect(noParts.ok).toBe(false);
    if (!noParts.ok) expect(noParts.field).toBe("parts");

    const noPhoto = assertRepairReportGates({
      result: "repaired",
      action: "part_replaced",
      partCount: 1,
      hasPartPhotoOrReason: false,
      functionTestPassed: true,
    });
    expect(noPhoto.ok).toBe(false);
    if (!noPhoto.ok) expect(noPhoto.field).toBe("noPhotoReason");
  });

  it("requires function test unless parts_ordered or not_repairable", () => {
    const missing = assertRepairReportGates({
      result: "repaired",
      action: "repaired",
      partCount: 0,
      hasPartPhotoOrReason: false,
      functionTestPassed: null,
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.field).toBe("functionTestPassed");

    expect(
      assertRepairReportGates({
        result: "parts_ordered",
        action: "parts_ordered",
        partCount: 1,
        hasPartPhotoOrReason: true,
        functionTestPassed: null,
      }).ok,
    ).toBe(true);

    expect(
      assertRepairReportGates({
        result: "not_repairable",
        action: "not_repairable",
        partCount: 0,
        hasPartPhotoOrReason: false,
        functionTestPassed: null,
      }).ok,
    ).toBe(true);
  });

  it("accepts a valid repaired completion", () => {
    expect(
      assertRepairReportGates({
        result: "repaired",
        action: "part_replaced",
        partCount: 1,
        hasPartPhotoOrReason: true,
        functionTestPassed: true,
      }).ok,
    ).toBe(true);
  });
});


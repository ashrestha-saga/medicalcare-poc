/**
 * Pure D2 / D10 / D11 seal checks used by inspectionRunService.completeRun.
 * Kept free of Prisma so refusal cases are unit-testable without a DB.
 */

export type SealSignatureInput = {
  kind: string;
  signedAt: Date | string | null;
  absent: boolean;
};

export type SealFailedStepInput = {
  id: string;
  noPhotoReason: string | null;
  photoCount: number;
};

export type SealGateOk = { ok: true };
export type SealGateFail = { ok: false; message: string; field: string };
export type SealGateResult = SealGateOk | SealGateFail;

export function assertVisitStarted(startedAt: Date | string | null | undefined): SealGateResult {
  if (!startedAt) {
    return {
      ok: false,
      message: "Start the site visit before sealing the protocol.",
      field: "visitId",
    };
  }
  return { ok: true };
}

export function assertSignaturesPresent(signatures: SealSignatureInput[]): SealGateResult {
  const inspectorOk = signatures.some(
    (s) => s.kind === "inspector" && (Boolean(s.signedAt) || s.absent),
  );
  const institutionOk = signatures.some(
    (s) => s.kind === "institution" && (Boolean(s.signedAt) || s.absent),
  );
  if (!inspectorOk || !institutionOk) {
    return {
      ok: false,
      message:
        "Inspector and institution signatures (or absence reasons) are required to seal.",
      field: "signatures",
    };
  }
  return { ok: true };
}

export function assertFailedStepsHaveEvidence(failedSteps: SealFailedStepInput[]): SealGateResult {
  for (const fail of failedSteps) {
    if (fail.photoCount === 0 && !fail.noPhotoReason?.trim()) {
      return {
        ok: false,
        message:
          "Failed steps require a photo or a documented no-photo reason before sealing.",
        field: "noPhotoReason",
      };
    }
  }
  return { ok: true };
}

/** Full gate stack when a visit is linked (Phase 1 always links a visit before seal). */
export function assertLinkedVisitSealGates(input: {
  visitStartedAt: Date | string | null | undefined;
  signatures: SealSignatureInput[];
  failedSteps: SealFailedStepInput[];
}): SealGateResult {
  const visit = assertVisitStarted(input.visitStartedAt);
  if (!visit.ok) return visit;
  const sigs = assertSignaturesPresent(input.signatures);
  if (!sigs.ok) return sigs;
  return assertFailedStepsHaveEvidence(input.failedSteps);
}

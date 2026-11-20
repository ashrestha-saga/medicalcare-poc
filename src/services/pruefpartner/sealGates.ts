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

export function assertSignaturesPresent(
  signatures: SealSignatureInput[],
  /** RD26 — visit-level institution countersignature satisfies every run under the visit. */
  visitInstitution?: { signedAt: Date | string | null; signerName?: string | null } | null,
): SealGateResult {
  const inspectorOk = signatures.some(
    (s) => s.kind === "inspector" && (Boolean(s.signedAt) || s.absent),
  );
  const institutionOnRun = signatures.some(
    (s) => s.kind === "institution" && (Boolean(s.signedAt) || s.absent),
  );
  const institutionOk = institutionOnRun || Boolean(visitInstitution?.signedAt);
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

const LABEL_RE = /^[A-Z]{2}-\d{4}-\d{4}$/;

/** E90 / R38 — Prüfplakette on STK/DGUV pass; never on constancy. */
export function assertLabelRequired(input: {
  requiresLabel: boolean;
  result: string;
  labelNumber?: string | null;
  labelNextDue?: string | Date | null;
  isConstancy?: boolean;
}): SealGateResult {
  if (input.isConstancy && input.labelNumber) {
    return {
      ok: false,
      message: "Constancy runs must not carry a Prüfplakette.",
      field: "labelNumber",
    };
  }
  if (!input.requiresLabel) return { ok: true };
  if (input.result === "failed") return { ok: true };
  const num = input.labelNumber?.trim() ?? "";
  if (!num) {
    return {
      ok: false,
      message: "Prüfplakettennummer fehlt — am Gerät anbringen und eintragen.",
      field: "labelNumber",
    };
  }
  if (!LABEL_RE.test(num)) {
    return {
      ok: false,
      message: "Label format must be AA-YYYY-NNNN (e.g. DG-2026-0144).",
      field: "labelNumber",
    };
  }
  if (!input.labelNextDue) {
    return {
      ok: false,
      message: "Next due month (MM/YYYY) is required with the label.",
      field: "labelNextDue",
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
  /** E77 — send-in workshop reports skip the visit-started gate. */
  skipVisit?: boolean;
  visitInstitution?: { signedAt: Date | string | null; signerName?: string | null } | null;
}): SealGateResult {
  if (!input.skipVisit) {
    const visit = assertVisitStarted(input.visitStartedAt);
    if (!visit.ok) return visit;
  }
  const sigs = assertSignaturesPresent(input.signatures, input.visitInstitution);
  if (!sigs.ok) return sigs;
  return assertFailedStepsHaveEvidence(input.failedSteps);
}

/** R11 — extra validations for K-REP repair completion. */
export function assertRepairReportGates(input: {
  result: string | null | undefined;
  action: string | null | undefined;
  partCount: number;
  hasPartPhotoOrReason: boolean;
  functionTestPassed: boolean | null | undefined;
}): SealGateResult {
  if (!input.result) {
    return { ok: false, message: "Repair result is required.", field: "result" };
  }
  if (input.action === "part_replaced") {
    if (input.partCount < 1) {
      return { ok: false, message: "Part replacement requires at least one part row.", field: "parts" };
    }
    if (!input.hasPartPhotoOrReason) {
      return {
        ok: false,
        message: "Part replacement requires a photo or no-photo reason.",
        field: "noPhotoReason",
      };
    }
  }
  if (
    input.result !== "parts_ordered" &&
    input.result !== "not_repairable" &&
    input.functionTestPassed == null
  ) {
    return {
      ok: false,
      message: "Function test result is required unless parts are ordered or not repairable.",
      field: "functionTestPassed",
    };
  }
  return { ok: true };
}

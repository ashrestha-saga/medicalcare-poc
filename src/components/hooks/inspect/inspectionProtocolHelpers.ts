import type { InspectionStepDraft, InspectionStepResultDTO } from "@/interfaces/pruefpartner";

export function seedStepDraft(steps: InspectionStepResultDTO[]): InspectionStepDraft {
  const next: InspectionStepDraft = {};
  for (const s of steps) {
    next[s.stepId] = {
      confirmed: s.confirmed,
      measuredValue: s.measuredValue,
      rating: s.confirmed === true ? "ok" : s.confirmed === false ? "defect" : null,
      noPhotoReason: s.noPhotoReason ?? null,
    };
  }
  return next;
}

export function ratedStepCount(draft: InspectionStepDraft, steps: InspectionStepResultDTO[]): number {
  return steps.filter((s) => {
    const d = draft[s.stepId];
    if (!d) return false;
    if (s.isMeasurement) return Boolean(d.measuredValue?.trim()) && Boolean(d.rating);
    return Boolean(d.rating);
  }).length;
}

export function buildSealNote(args: {
  defects: string;
  familySteps: InspectionStepResultDTO[];
  stepDraft: InspectionStepDraft;
}): string | null {
  const familyNotes = args.familySteps
    .map((s) => {
      const d = args.stepDraft[s.stepId];
      if (!d?.rating) return null;
      return `${s.label}: ${d.rating === "ok" ? "in Ordnung" : "Mangel"}`;
    })
    .filter(Boolean);
  const parts = [
    args.defects.trim() || null,
    familyNotes.length ? `Familie: ${familyNotes.join("; ")}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join("\n") : null;
}

export function stepsPayloadFromDraft(stepDraft: InspectionStepDraft) {
  return Object.entries(stepDraft)
    .filter(([id]) => !id.startsWith("family-"))
    .map(([stepId, v]) => ({
      stepId,
      confirmed: v.rating === "ok" ? true : v.rating === "defect" ? false : (v.confirmed ?? null),
      measuredValue: v.measuredValue ?? null,
      note: v.rating === "defect" ? "Mangel" : null,
      noPhotoReason: v.rating === "defect" ? (v.noPhotoReason?.trim() || null) : null,
    }));
}

export type ProtocolGateId =
  | "visit"
  | "device"
  | "steps"
  | "evidence"
  | "inspector"
  | "institution";

/** Reads the same conditions as canComplete / seal gates. Does not add rules. */
export function protocolChecklist(input: {
  visitStarted: boolean;
  deviceOk: boolean;
  stepsComplete: boolean;
  missingEvidence: number;
  signatures: { kind: string; signedAt: string | null; absent: boolean }[] | undefined;
}): { id: ProtocolGateId; done: boolean }[] {
  const inspector =
    input.signatures?.some((s) => s.kind === "inspector" && (Boolean(s.signedAt) || s.absent)) ??
    false;
  const institution =
    input.signatures?.some(
      (s) => s.kind === "institution" && (Boolean(s.signedAt) || s.absent),
    ) ?? false;
  return [
    { id: "visit", done: input.visitStarted },
    { id: "device", done: input.deviceOk },
    { id: "steps", done: input.stepsComplete },
    { id: "evidence", done: input.missingEvidence === 0 },
    { id: "inspector", done: inspector },
    { id: "institution", done: institution },
  ];
}

export function signatureKindsSatisfied(
  signatures: { kind: string; signedAt: string | null; absent: boolean }[] | undefined,
): boolean {
  if (!signatures?.length) return false;
  const inspectorOk = signatures.some(
    (s) => s.kind === "inspector" && (Boolean(s.signedAt) || s.absent),
  );
  const institutionOk = signatures.some(
    (s) => s.kind === "institution" && (Boolean(s.signedAt) || s.absent),
  );
  return inspectorOk && institutionOk;
}

export function failedStepsMissingEvidence(
  steps: InspectionStepResultDTO[],
  draft: InspectionStepDraft,
): string[] {
  return steps
    .filter((s) => {
      const d = draft[s.stepId];
      const failed =
        d?.rating === "defect" || s.confirmed === false || s.withinLimit === false;
      if (!failed) return false;
      const reason = (d?.noPhotoReason ?? s.noPhotoReason)?.trim();
      const photos = s.photoCount ?? 0;
      return !reason && photos === 0;
    })
    .map((s) => s.stepId);
}

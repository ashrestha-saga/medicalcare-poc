import type { InspectionStepDraft, InspectionStepResultDTO } from "@/interfaces/pruefpartner";

function noteFromValueJson(valueJson: unknown): string | null {
  if (valueJson == null) return null;
  if (typeof valueJson === "string") return valueJson;
  if (typeof valueJson === "number" || typeof valueJson === "boolean") return String(valueJson);
  if (typeof valueJson === "object" && valueJson !== null && "value" in valueJson) {
    const v = (valueJson as { value: unknown }).value;
    return v == null ? null : String(v);
  }
  try {
    return JSON.stringify(valueJson);
  } catch {
    return null;
  }
}

export function seedStepDraft(steps: InspectionStepResultDTO[]): InspectionStepDraft {
  const next: InspectionStepDraft = {};
  for (const s of steps) {
    next[s.stepId] = {
      confirmed: s.confirmed,
      measuredValue: s.measuredValue,
      rating: s.confirmed === true ? "ok" : s.confirmed === false ? "defect" : null,
      noPhotoReason: s.noPhotoReason ?? null,
      note: s.note ?? noteFromValueJson(s.valueJson) ?? null,
      valueJson: s.valueJson ?? null,
    };
  }
  return next;
}

const RICH_KINDS = new Set(["text", "select", "parts", "result"]);

export function ratedStepCount(draft: InspectionStepDraft, steps: InspectionStepResultDTO[]): number {
  return steps.filter((s) => {
    const d = draft[s.stepId];
    if (!d) return false;
    if (s.isMeasurement || s.inputKind === "measurement" || s.inputKind === "number") {
      return Boolean(d.measuredValue?.trim()) && Boolean(d.rating);
    }
    if (s.inputKind && RICH_KINDS.has(s.inputKind)) {
      return Boolean(d.note?.trim()) && Boolean(d.rating);
    }
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
    .map(([stepId, v]) => {
      const defectNote = v.rating === "defect" ? "Mangel" : null;
      const richNote = v.note?.trim() || null;
      return {
        stepId,
        confirmed: v.rating === "ok" ? true : v.rating === "defect" ? false : (v.confirmed ?? null),
        measuredValue: v.measuredValue ?? null,
        note: richNote ?? defectNote,
        noPhotoReason: v.rating === "defect" ? (v.noPhotoReason?.trim() || null) : null,
      };
    });
}

export type ProtocolGateId =
  | "visit"
  | "device"
  | "steps"
  | "evidence"
  | "inspector"
  | "institution";

/** Extra seal blockers outside the checklist strip (e.g. Prüfplakette). */
export type SealBlockerId = ProtocolGateId | "label";

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

/** Ordered list of incomplete seal gates (including optional label). */
export function listSealBlockers(input: {
  visitStarted: boolean;
  deviceOk: boolean;
  stepsComplete: boolean;
  missingEvidence: number;
  signatures: { kind: string; signedAt: string | null; absent: boolean }[] | undefined;
  labelOk: boolean;
}): SealBlockerId[] {
  const missing: SealBlockerId[] = protocolChecklist(input)
    .filter((g) => !g.done)
    .map((g) => g.id);
  if (!input.labelOk) missing.push("label");
  return missing;
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

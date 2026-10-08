import type { InspectionStepDraft, InspectionStepResultDTO } from "@/interfaces/pruefpartner";

export function seedStepDraft(steps: InspectionStepResultDTO[]): InspectionStepDraft {
  const next: InspectionStepDraft = {};
  for (const s of steps) {
    next[s.stepId] = {
      confirmed: s.confirmed,
      measuredValue: s.measuredValue,
      rating: s.confirmed === true ? "ok" : s.confirmed === false ? "defect" : null,
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
    }));
}

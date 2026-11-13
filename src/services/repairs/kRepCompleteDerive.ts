import type { RepairResult } from "@prisma/client";
import type { CompleteRepairInput } from "@/services/repairs/repairCompleteService";

export type KRepStepLike = {
  id: string;
  inputKind?: string | null;
};

export type KRepStepResultLike = {
  stepId: string;
  note?: string | null;
  confirmed?: boolean | null;
  measuredValue?: string | null;
  withinLimit?: boolean | null;
  noPhotoReason?: string | null;
  photoCount?: number;
};

const REPAIR_RESULTS = new Set<RepairResult>([
  "repaired",
  "provisional",
  "not_repairable",
  "parts_ordered",
]);

/** Map Maßnahme select value → MaintenanceEvent.result. */
export function repairResultFromAction(action: string): RepairResult {
  if (action === "parts_ordered") return "parts_ordered";
  if (action === "not_repairable") return "not_repairable";
  if (action === "provisional") return "provisional";
  return "repaired";
}

/** Parse `sicherheitsrelevant: ja|nein` (and EN/boolean forms) from the Ergebnis note. */
export function parseSafetyRelevant(note: string | null | undefined): boolean {
  if (!note?.trim()) return false;
  const m = note.match(
    /sicherheitsrelevan\w*\s*[:=]?\s*(ja|yes|true|1|nein|no|false|0)\b/i,
  );
  if (m) {
    const v = m[1]!.toLowerCase();
    return v === "ja" || v === "yes" || v === "true" || v === "1";
  }
  return false;
}

/** Split free-text parts note into part rows (`desc ×qty` or one line each). */
export function parsePartsNote(note: string | null | undefined): CompleteRepairInput["parts"] {
  if (!note?.trim()) return [];
  return note
    .split(/\n|;/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const qtyMatch = line.match(/^(.+?)\s*[×x]\s*(\d+)\s*$/i);
      if (qtyMatch) {
        return { description: qtyMatch[1]!.trim(), qty: Number(qtyMatch[2]) };
      }
      const partNoMatch = line.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
      if (partNoMatch) {
        return {
          description: partNoMatch[1]!.trim(),
          partNo: partNoMatch[2]!.trim(),
        };
      }
      return { description: line };
    });
}

export function parseFunctionTestPassed(
  measuredValue: string | null | undefined,
  withinLimit: boolean | null | undefined,
  confirmed: boolean | null | undefined,
): boolean | null {
  if (withinLimit === true) return true;
  if (withinLimit === false) return false;
  if (confirmed === false) return false;
  const raw = measuredValue?.trim().toLowerCase() ?? "";
  if (/^(ok|pass|passed|ja|yes|true|1)$/.test(raw)) return true;
  if (/^(fail|failed|nein|no|false|0)$/.test(raw)) return false;
  if (confirmed === true) return true;
  return null;
}

function resultByKind(
  steps: KRepStepLike[],
  results: KRepStepResultLike[],
  kind: string,
): KRepStepResultLike | null {
  const step = steps.find((s) => s.inputKind === kind);
  if (!step) return null;
  return results.find((r) => r.stepId === step.id) ?? null;
}

function parseLaborMinutes(raw: string | null | undefined): number | null {
  if (!raw?.trim()) return null;
  const n = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function parseSoftwarePair(note: string | null | undefined): {
  softwareBefore: string | null;
  softwareAfter: string | null;
} {
  if (!note?.trim()) return { softwareBefore: null, softwareAfter: null };
  const arrow = note.match(/^\s*(.+?)\s*(?:→|->|\/|→)\s*(.+?)\s*$/);
  if (arrow) {
    return {
      softwareBefore: arrow[1]!.trim() || null,
      softwareAfter: arrow[2]!.trim() || null,
    };
  }
  return { softwareBefore: null, softwareAfter: note.trim() };
}

/**
 * Derive CompleteRepairInput fields from a sealed (or about-to-seal) K-REP run's steps.
 * Returns null when Maßnahme (action) is missing — not a completable repair report yet.
 */
export function deriveRepairCompleteFromKRepSteps(input: {
  inspectionRunId: string;
  steps: KRepStepLike[];
  stepResults: KRepStepResultLike[];
}): Omit<CompleteRepairInput, "inspectionRunId"> | null {
  const actionRow = resultByKind(input.steps, input.stepResults, "select");
  const action = actionRow?.note?.trim() || "";
  if (!action) return null;

  const causeRow = resultByKind(input.steps, input.stepResults, "text");
  const checkRow = resultByKind(input.steps, input.stepResults, "check");
  const partsRow = resultByKind(input.steps, input.stepResults, "parts");
  const numberRow = resultByKind(input.steps, input.stepResults, "number");
  const fnRow = resultByKind(input.steps, input.stepResults, "measurement");
  const resultRow = resultByKind(input.steps, input.stepResults, "result");

  let result = repairResultFromAction(action);
  const resultNote = resultRow?.note?.trim() || "";
  const firstToken = resultNote.split(/[\s,;|/]+/)[0]?.toLowerCase() ?? "";
  if (REPAIR_RESULTS.has(firstToken as RepairResult)) {
    result = firstToken as RepairResult;
  }

  const software = parseSoftwarePair(numberRow?.note);
  const laborFromMeasure = parseLaborMinutes(numberRow?.measuredValue);
  const laborFromNote = parseLaborMinutes(numberRow?.note);

  return {
    result,
    action,
    cause: causeRow?.note?.trim() || null,
    faultConfirmed: checkRow?.confirmed ?? null,
    laborMinutes: laborFromMeasure ?? laborFromNote,
    softwareBefore: software.softwareBefore,
    softwareAfter: software.softwareAfter,
    functionTestPassed: parseFunctionTestPassed(
      fnRow?.measuredValue,
      fnRow?.withinLimit,
      fnRow?.confirmed,
    ),
    safetyRelevant: parseSafetyRelevant(resultRow?.note),
    resultText: resultNote || null,
    parts: parsePartsNote(partsRow?.note),
  };
}

/** Gate inputs for assertRepairReportGates from derived complete + parts-step evidence. */
export function repairGateInputFromDerived(
  derived: Omit<CompleteRepairInput, "inspectionRunId">,
  partsEvidence: { photoCount: number; noPhotoReason: string | null | undefined },
) {
  return {
    result: derived.result,
    action: derived.action,
    partCount: derived.parts.length,
    hasPartPhotoOrReason:
      partsEvidence.photoCount > 0 || Boolean(partsEvidence.noPhotoReason?.trim()),
    functionTestPassed: derived.functionTestPassed,
  };
}

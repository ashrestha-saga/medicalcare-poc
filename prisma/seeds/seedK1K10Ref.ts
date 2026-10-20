import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PrismaClient } from "@prisma/client";

type SeedPayload = {
  RefReprocessingCheck: Array<{
    code: string;
    ruleSetId: string;
    scope: "equipment" | "water" | "chemistry" | "sterile_storage";
    equipmentTypeCode: string | null;
    label: string;
    cadence: "per_use" | "daily" | "weekly" | "monthly" | "quarterly" | "yearly" | "per_batch";
    legalBasis?: string | null;
    unit?: string | null;
    limitText?: string | null;
    limitSource?: "standard" | "manufacturer" | "applied_part" | "annex2" | "baseline" | "operator" | null;
    confidence?: "verified" | "responsible" | "determination" | "derived" | "not_applicable" | "guess";
    note?: string | null;
  }>;
  RefInspectionType_neu: Array<{
    code: string;
    ruleSetId: string;
    label: string;
    legalBasis: string;
    deadlineAnchor: "exact_day" | "month_end" | "year_end" | "event" | "interval" | "process" | "permanent" | "reference" | "none";
    defaultInterval: number | null;
    intervalUnit: "months" | "years" | null;
    category: "inspection" | "operating";
    confidence: "verified" | "responsible" | "determination" | "derived" | "not_applicable" | "guess";
    addressee: "operator" | "employer" | "both";
    authorityKind: "health_office" | "device_authority" | "occupational_safety" | "metrology" | "medical_board" | "other" | null;
    evidenceHint?: string | null;
    sourceRef?: string | null;
  }>;
  RefInspectionTypeOverlap: Array<{
    inspectionTypeCode: string;
    satisfiedByCode: string;
    conditionText: string;
    legalNote?: string | null;
  }>;
};

function loadPayload(): SeedPayload {
  const raw = readFileSync(join(__dirname, "../fixtures/seed-k1-k10.json"), "utf8");
  return JSON.parse(raw) as SeedPayload;
}

/** Seeds RefReprocessingCheck, DGUV RefInspectionType, and overlap rules. */
export async function seedK1K10Ref(prisma: PrismaClient) {
  const data = loadPayload();

  for (const row of data.RefInspectionType_neu) {
    await prisma.refInspectionType.upsert({
      where: { code: row.code },
      update: {
        ruleSetId: row.ruleSetId,
        label: row.label,
        legalBasis: row.legalBasis,
        deadlineAnchor: row.deadlineAnchor,
        defaultInterval: row.defaultInterval,
        intervalUnit: row.intervalUnit,
        category: row.category,
        confidence: row.confidence,
        addressee: row.addressee,
        authorityKind: row.authorityKind,
        evidenceHint: row.evidenceHint ?? null,
        sourceRef: row.sourceRef ?? null,
      },
      create: {
        code: row.code,
        ruleSetId: row.ruleSetId,
        label: row.label,
        legalBasis: row.legalBasis,
        deadlineAnchor: row.deadlineAnchor,
        defaultInterval: row.defaultInterval,
        intervalUnit: row.intervalUnit,
        category: row.category,
        confidence: row.confidence,
        addressee: row.addressee,
        authorityKind: row.authorityKind,
        evidenceHint: row.evidenceHint ?? null,
        sourceRef: row.sourceRef ?? null,
      },
    });
  }

  for (const row of data.RefReprocessingCheck) {
    await prisma.refReprocessingCheck.upsert({
      where: { code: row.code },
      update: {
        ruleSetId: row.ruleSetId,
        scope: row.scope,
        equipmentTypeCode: row.equipmentTypeCode,
        label: row.label,
        cadence: row.cadence,
        legalBasis: row.legalBasis ?? null,
        unit: row.unit ?? null,
        limitText: row.limitText ?? null,
        limitSource: row.limitSource ?? null,
        confidence: row.confidence ?? "determination",
        note: row.note ?? null,
      },
      create: {
        code: row.code,
        ruleSetId: row.ruleSetId,
        scope: row.scope,
        equipmentTypeCode: row.equipmentTypeCode,
        label: row.label,
        cadence: row.cadence,
        legalBasis: row.legalBasis ?? null,
        unit: row.unit ?? null,
        limitText: row.limitText ?? null,
        limitSource: row.limitSource ?? null,
        confidence: row.confidence ?? "determination",
        note: row.note ?? null,
      },
    });
  }

  for (const row of data.RefInspectionTypeOverlap) {
    await prisma.refInspectionTypeOverlap.upsert({
      where: {
        inspectionTypeCode_satisfiedByCode: {
          inspectionTypeCode: row.inspectionTypeCode,
          satisfiedByCode: row.satisfiedByCode,
        },
      },
      update: {
        conditionText: row.conditionText,
        legalNote: row.legalNote ?? null,
      },
      create: {
        inspectionTypeCode: row.inspectionTypeCode,
        satisfiedByCode: row.satisfiedByCode,
        conditionText: row.conditionText,
        legalNote: row.legalNote ?? null,
      },
    });
  }
}

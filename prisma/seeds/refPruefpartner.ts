/**
 * Prüfpartner v7 reference seed — from fixtures/seed-pruefpartner.json.
 * Idempotent upserts by stable codes.
 */
import type { CatalogueScope, LimitSource, PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type SeedFile = {
  RefInspectionCatalogue: Array<Record<string, unknown>>;
  RefInspectionStep: Array<Record<string, unknown>>;
  RefQualification: Array<{ code: string; label: string; legalBasis?: string | null }>;
  RefQualificationRule: Array<{ inspectionTypeCode: string; qualificationCode: string }>;
  RefCatalogueQualification: Array<{ catalogueCode: string; qualificationCode: string }>;
  RefSkill: Array<{ code: string; label: string }>;
  RefSkillLevel: Array<{ code: string; label: string; rank: number }>;
  RefTestEquipmentClass: Array<{ code: string; label: string }>;
  RefAppliedPartType: Array<{ code: string; label: string; patientLeakageLimit?: string | null }>;
  RefDeviceFamily: Array<{ code: string; label: string }>;
  RefDeviceFamilyStep: Array<Record<string, unknown>>;
  RefValidationOccasion: Array<{ code: string; label: string }>;
  RefAttachmentKind: Array<{ code: string; label: string; isLeading: boolean }>;
  RefHandoverItem: Array<{ code: string; label: string; note?: string | null }>;
};

const RULE_SET_REF: Record<string, string> = {
  mp: "rs-mpbetreibv",
  strl: "rs-strlschv",
};

/** Mockup lowercase codes → RefInspectionType.code in this POC. */
export const INSPECTION_TYPE_MAP: Record<string, string> = {
  stk: "STK",
  mtk: "MTK",
  abnahme: "ACCEPT",
  konstanz: "CONSTANCY",
  sv: "EXPERT",
  validierung: "VALIDATION",
  wartung: "MAINT",
  install: "INSTALL",
  itsec: "ITSEC",
  aerztl: "MEDBOARD",
  kontrolle: "REPROC_CTRL",
  routine: "ROUTINE",
};

const EXTRA_INSPECTION_TYPES: Array<{
  code: string;
  ruleSetId: string;
  label: string;
  legalBasis: string;
  deadlineAnchor: "interval" | "exact_day";
  category: "inspection" | "operating";
}> = [
  {
    code: "ROUTINE",
    ruleSetId: "rs-mpbetreibv",
    label: "Routineprüfung Aufbereitung",
    legalBasis: "§ 8 MPBetreibV · KRINKO/BfArM",
    deadlineAnchor: "interval",
    category: "operating",
  },
];

function loadSeed(): SeedFile {
  const raw = readFileSync(join(__dirname, "../fixtures/seed-pruefpartner.json"), "utf8");
  return JSON.parse(raw) as SeedFile;
}

function mapInspectionType(code: string): string {
  return INSPECTION_TYPE_MAP[code] ?? code.toUpperCase();
}

function mapLimitSource(raw: unknown): LimitSource | null {
  if (!raw || typeof raw !== "string") return null;
  const allowed = [
    "standard",
    "manufacturer",
    "applied_part",
    "annex2",
    "baseline",
    "operator",
  ] as const;
  return allowed.includes(raw as (typeof allowed)[number]) ? (raw as LimitSource) : null;
}

export async function seedRefPruefpartner(prisma: PrismaClient) {
  const seed = loadSeed();

  for (const t of EXTRA_INSPECTION_TYPES) {
    await prisma.refInspectionType.upsert({
      where: { code: t.code },
      update: { label: t.label },
      create: {
        code: t.code,
        ruleSetId: t.ruleSetId,
        label: t.label,
        legalBasis: t.legalBasis,
        deadlineAnchor: t.deadlineAnchor,
        defaultInterval: null,
        intervalUnit: null,
        evidenceHint: null,
        category: t.category,
        confidence: "derived",
        sourceRef: null,
      },
    });
  }

  for (const row of seed.RefAppliedPartType) {
    await prisma.refAppliedPartType.upsert({
      where: { code: row.code },
      update: { label: row.label, patientLeakageLimit: row.patientLeakageLimit ?? null },
      create: {
        code: row.code,
        label: row.label,
        patientLeakageLimit: row.patientLeakageLimit ?? null,
      },
    });
  }

  for (const row of seed.RefDeviceFamily) {
    await prisma.refDeviceFamily.upsert({
      where: { code: row.code },
      update: { label: row.label },
      create: { code: row.code, label: row.label },
    });
  }

  for (const row of seed.RefDeviceFamilyStep) {
    const deviceFamilyCode = String(row.deviceFamilyCode);
    const position = Number(row.position);
    const id = `dfs-${deviceFamilyCode}-${position}`;
    await prisma.refDeviceFamilyStep.upsert({
      where: { deviceFamilyCode_position: { deviceFamilyCode, position } },
      update: {
        label: String(row.label),
        isMeasurement: Boolean(row.isMeasurement),
        unit: row.unit ? String(row.unit) : null,
        limitText: row.limitText ? String(row.limitText) : null,
        limitSource: mapLimitSource(row.limitSource),
        targetValue: row.targetValue != null ? Number(row.targetValue) : null,
      },
      create: {
        id,
        deviceFamilyCode,
        position,
        label: String(row.label),
        isMeasurement: Boolean(row.isMeasurement),
        unit: row.unit ? String(row.unit) : null,
        limitText: row.limitText ? String(row.limitText) : null,
        limitSource: mapLimitSource(row.limitSource),
        targetValue: row.targetValue != null ? Number(row.targetValue) : null,
      },
    });
  }

  for (const row of seed.RefValidationOccasion) {
    await prisma.refValidationOccasion.upsert({
      where: { code: row.code },
      update: { label: row.label },
      create: { code: row.code, label: row.label },
    });
  }

  for (const row of seed.RefAttachmentKind) {
    await prisma.refAttachmentKind.upsert({
      where: { code: row.code },
      update: { label: row.label, isLeading: row.isLeading },
      create: { code: row.code, label: row.label, isLeading: row.isLeading },
    });
  }

  for (const row of seed.RefHandoverItem) {
    await prisma.refHandoverItem.upsert({
      where: { code: row.code },
      update: { label: row.label, note: row.note ?? null },
      create: { code: row.code, label: row.label, note: row.note ?? null },
    });
  }

  for (const row of seed.RefTestEquipmentClass) {
    await prisma.refTestEquipmentClass.upsert({
      where: { code: row.code },
      update: { label: row.label },
      create: { code: row.code, label: row.label },
    });
  }

  for (const row of seed.RefQualification) {
    await prisma.refQualification.upsert({
      where: { code: row.code },
      update: { label: row.label, legalBasis: row.legalBasis ?? null, ruleSetId: "rs-mpbetreibv" },
      create: {
        code: row.code,
        label: row.label,
        legalBasis: row.legalBasis ?? null,
        ruleSetId: "rs-mpbetreibv",
      },
    });
  }

  for (const row of seed.RefSkill) {
    await prisma.refSkill.upsert({
      where: { code: row.code },
      update: { label: row.label },
      create: { code: row.code, label: row.label },
    });
  }

  for (const row of seed.RefSkillLevel) {
    await prisma.refSkillLevel.upsert({
      where: { code: row.code },
      update: { label: row.label, rank: row.rank },
      create: { code: row.code, label: row.label, rank: row.rank },
    });
  }

  const catalogueIdByCode = new Map<string, string>();

  for (const row of seed.RefInspectionCatalogue) {
    const code = String(row.code);
    const ruleSetRef = String(row.ruleSetRef ?? "mp");
    const ruleSetId = RULE_SET_REF[ruleSetRef] ?? "rs-mpbetreibv";
    const inspectionTypeCode = mapInspectionType(String(row.inspectionTypeCode));
    const scope = String(row.scope) as CatalogueScope;
    const id = `cat-${code}`;

    await prisma.refInspectionCatalogue.upsert({
      where: { ruleSetId_code: { ruleSetId, code } },
      update: {
        inspectionTypeCode,
        scope,
        scopeValue: row.scopeValue != null ? String(row.scopeValue) : null,
        label: String(row.label),
        legalBasis: row.legalBasis ? String(row.legalBasis) : null,
        retention: row.retention ? String(row.retention) : null,
        testEquipmentClass: row.testEquipmentClass ? String(row.testEquipmentClass) : null,
        traceabilityRequired: Boolean(row.traceabilityRequired),
        setsBaseline: Boolean(row.setsBaseline),
        requiresBaseline: Boolean(row.requiresBaseline),
        occasions: Array.isArray(row.occasions) ? row.occasions : [],
        draft: Boolean(row.draft),
        noCatalogue: Boolean(row.noCatalogue),
        note: row.note ? String(row.note) : null,
      },
      create: {
        id,
        ruleSetId,
        code,
        inspectionTypeCode,
        scope,
        scopeValue: row.scopeValue != null ? String(row.scopeValue) : null,
        label: String(row.label),
        legalBasis: row.legalBasis ? String(row.legalBasis) : null,
        retention: row.retention ? String(row.retention) : null,
        testEquipmentClass: row.testEquipmentClass ? String(row.testEquipmentClass) : null,
        traceabilityRequired: Boolean(row.traceabilityRequired),
        setsBaseline: Boolean(row.setsBaseline),
        requiresBaseline: Boolean(row.requiresBaseline),
        occasions: Array.isArray(row.occasions) ? row.occasions : [],
        draft: Boolean(row.draft),
        noCatalogue: Boolean(row.noCatalogue),
        note: row.note ? String(row.note) : null,
      },
    });

    const saved = await prisma.refInspectionCatalogue.findUnique({
      where: { ruleSetId_code: { ruleSetId, code } },
      select: { id: true },
    });
    if (saved) catalogueIdByCode.set(code, saved.id);
  }

  for (const row of seed.RefInspectionStep) {
    const catalogueCode = String(row.catalogueCode);
    const catalogueId = catalogueIdByCode.get(catalogueCode);
    if (!catalogueId) continue;
    const position = Number(row.position);
    const stepId = `step-${catalogueCode}-${position}`;
    await prisma.refInspectionStep.upsert({
      where: { catalogueId_position: { catalogueId, position } },
      update: {
        label: String(row.label),
        isMeasurement: Boolean(row.isMeasurement),
        unit: row.unit ? String(row.unit) : null,
        limitText: row.limitText ? String(row.limitText) : null,
        limitSource: mapLimitSource(row.limitSource),
        dependsOnAppliedPart: Boolean(row.dependsOnAppliedPart),
        comparedToBaseline: Boolean(row.comparedToBaseline),
        targetValue: row.targetValue != null ? Number(row.targetValue) : null,
        triggerNote: row.triggerNote ? String(row.triggerNote) : null,
      },
      create: {
        id: stepId,
        catalogueId,
        position,
        label: String(row.label),
        isMeasurement: Boolean(row.isMeasurement),
        unit: row.unit ? String(row.unit) : null,
        limitText: row.limitText ? String(row.limitText) : null,
        limitSource: mapLimitSource(row.limitSource),
        dependsOnAppliedPart: Boolean(row.dependsOnAppliedPart),
        comparedToBaseline: Boolean(row.comparedToBaseline),
        targetValue: row.targetValue != null ? Number(row.targetValue) : null,
        triggerNote: row.triggerNote ? String(row.triggerNote) : null,
      },
    });
  }

  for (const row of seed.RefQualificationRule) {
    const inspectionTypeCode = mapInspectionType(row.inspectionTypeCode);
    const id = `qr-${inspectionTypeCode}-${row.qualificationCode}`;
    await prisma.refQualificationRule.upsert({
      where: {
        inspectionTypeCode_qualificationCode: {
          inspectionTypeCode,
          qualificationCode: row.qualificationCode,
        },
      },
      update: {},
      create: {
        id,
        inspectionTypeCode,
        qualificationCode: row.qualificationCode,
      },
    });
  }

  for (const row of seed.RefCatalogueQualification) {
    const catalogueId = catalogueIdByCode.get(row.catalogueCode);
    if (!catalogueId) continue;
    const id = `cq-${row.catalogueCode}-${row.qualificationCode}`;
    await prisma.refCatalogueQualification.upsert({
      where: {
        catalogueId_qualificationCode: {
          catalogueId,
          qualificationCode: row.qualificationCode,
        },
      },
      update: {},
      create: {
        id,
        catalogueId,
        qualificationCode: row.qualificationCode,
      },
    });
  }

}

/** Call after partner orgs exist — demo instruments for MSR / RTS. */
export async function seedPruefpartnerDemoEquipment(prisma: PrismaClient) {
  const msrOrgId = "1f0f2544-0dc8-5869-9c13-85f741e48258";
  const rtsOrgId = "7a48a751-3e3a-5edb-abfa-95ef550e6249";

  const instruments: Array<{
    id: string;
    organisationId: string;
    classCode: string;
    label: string;
    serialNumber: string;
    calibratedUntil: Date;
    traceabilityRef: string;
  }> = [
    {
      id: "te-msr-stk-1",
      organisationId: msrOrgId,
      classCode: "sicherheitstester",
      label: "Gossen Metrawatt SECUTEST",
      serialNumber: "ST-4471",
      calibratedUntil: new Date("2027-06-30"),
      traceabilityRef: "DAkkS-Kalibrierschein K-4471/2026",
    },
    {
      id: "te-msr-rx-1",
      organisationId: msrOrgId,
      classCode: "roentgen_pruefkoerper",
      label: "DIN 6868 Prüfkörper PK-MSR-01",
      serialNumber: "RX-MSR-2201",
      calibratedUntil: new Date("2027-09-30"),
      traceabilityRef: "DAkkS-Kalibrierschein RX-2201/2026",
    },
    {
      id: "te-rts-rx-1",
      organisationId: rtsOrgId,
      classCode: "roentgen_pruefkoerper",
      label: "DIN 6868 Prüfkörper PK-RTS-01",
      serialNumber: "RX-RTS-1104",
      calibratedUntil: new Date("2027-08-15"),
      traceabilityRef: "DAkkS-Kalibrierschein RX-1104/2026",
    },
  ];

  for (const item of instruments) {
    const org = await prisma.organisation.findUnique({ where: { id: item.organisationId } });
    if (!org) continue;
    await prisma.testEquipment.upsert({
      where: { id: item.id },
      update: {
        classCode: item.classCode,
        label: item.label,
        serialNumber: item.serialNumber,
        calibratedUntil: item.calibratedUntil,
        traceabilityRef: item.traceabilityRef,
        active: true,
      },
      create: {
        id: item.id,
        organisationId: item.organisationId,
        classCode: item.classCode,
        label: item.label,
        serialNumber: item.serialNumber,
        calibratedUntil: item.calibratedUntil,
        traceabilityRef: item.traceabilityRef,
        active: true,
      },
    });
  }
}

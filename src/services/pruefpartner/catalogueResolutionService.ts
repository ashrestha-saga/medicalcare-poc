import type { CatalogueScope, LimitSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/errors";
import { getActiveBaseline } from "./baselineService";

export interface ResolvedStepDTO {
  id: string;
  position: number;
  label: string;
  isMeasurement: boolean;
  unit: string | null;
  limitText: string | null;
  limitSource: LimitSource | null;
  dependsOnAppliedPart: boolean;
  comparedToBaseline: boolean;
  targetValue: number | null;
  triggerNote: string | null;
  /** Resolved limit when dependsOnAppliedPart. */
  resolvedLimitText: string | null;
  baselineValue: string | null;
  source: "catalogue" | "family";
  familyCode?: string;
}

export interface ResolvedCatalogueDTO {
  catalogueId: string;
  code: string;
  label: string;
  inspectionTypeCode: string;
  scope: CatalogueScope;
  scopeValue: string | null;
  draft: boolean;
  noCatalogue: boolean;
  note: string | null;
  legalBasis: string | null;
  retention: string | null;
  testEquipmentClass: string | null;
  testEquipmentClassLabel: string | null;
  traceabilityRequired: boolean;
  setsBaseline: boolean;
  requiresBaseline: boolean;
  occasions: string[];
  appliedPartCode: string | null;
  appliedPartLabel: string | null;
  deviceFamilyCode: string | null;
  steps: ResolvedStepDTO[];
  missingBaseline: boolean;
}

async function openClassification(deviceModelId: string | null | undefined) {
  if (!deviceModelId) return null;
  return prisma.deviceModelClassification.findFirst({
    where: { deviceModelId, validTo: null },
    include: {
      mtkItem: { select: { itemNo: true } },
      appliedPart: true,
      deviceFamily: true,
    },
  });
}

function constancyScopeValue(code: string | null | undefined): string | null {
  if (!code) return null;
  if (code === "aufnahme" || code === "durchl") return "aufnahme";
  if (code === "monitor" || code === "digital") return "monitor";
  return code;
}

async function resolveCatalogueRecord(args: {
  inspectionTypeCode: string;
  classification: Awaited<ReturnType<typeof openClassification>>;
  constancyObjectCode: string | null;
  equipmentScopeValue: string | null;
}) {
  const { inspectionTypeCode, classification, constancyObjectCode, equipmentScopeValue } = args;

  const attempts: { scope: CatalogueScope; scopeValue: string | null }[] = [];

  if (classification?.mtkItem?.itemNo) {
    attempts.push({ scope: "annex2", scopeValue: classification.mtkItem.itemNo });
  }
  const cv = constancyScopeValue(constancyObjectCode);
  if (cv) attempts.push({ scope: "constancy", scopeValue: cv });
  if (equipmentScopeValue) {
    attempts.push({ scope: "equipment", scopeValue: equipmentScopeValue });
  }
  attempts.push({ scope: "generic", scopeValue: null });

  for (const attempt of attempts) {
    const cat = await prisma.refInspectionCatalogue.findFirst({
      where: {
        inspectionTypeCode,
        scope: attempt.scope,
        scopeValue: attempt.scopeValue,
      },
      include: { steps: { orderBy: { position: "asc" } } },
    });
    if (cat) return cat;
  }

  return prisma.refInspectionCatalogue.findFirst({
    where: { inspectionTypeCode, scope: "generic" },
    include: { steps: { orderBy: { position: "asc" } } },
  });
}

function resolveAppliedPartLimit(
  step: { dependsOnAppliedPart: boolean; limitText: string | null },
  appliedPartCode: string | null,
  appliedPartLimit: string | null,
): string | null {
  if (!step.dependsOnAppliedPart) return step.limitText;
  if (!appliedPartCode || appliedPartCode === "keines") return null;
  return appliedPartLimit ?? step.limitText;
}

export async function resolveCatalogueForAssignment(args: {
  tenantId: string;
  deviceInstanceId: string;
  inspectionTypeCode: string;
  constancyObjectCode?: string | null;
  equipmentScopeValue?: string | null;
}): Promise<ResolvedCatalogueDTO | null> {
  const device = await prisma.deviceInstance.findFirst({
    where: { id: args.deviceInstanceId, tenantId: args.tenantId },
    select: { modelId: true },
  });
  if (!device) throw notFound("Device not found.");

  const classification = await openClassification(device.modelId);
  const catalogue = await resolveCatalogueRecord({
    inspectionTypeCode: args.inspectionTypeCode,
    classification,
    constancyObjectCode: args.constancyObjectCode ?? null,
    equipmentScopeValue: args.equipmentScopeValue ?? null,
  });

  if (!catalogue) return null;

  const appliedPartCode = classification?.appliedPartCode ?? null;
  const deviceFamilyCode = classification?.deviceFamilyCode ?? null;
  const occasions = Array.isArray(catalogue.occasions)
    ? (catalogue.occasions as string[])
    : [];

  const steps: ResolvedStepDTO[] = [];

  for (const step of catalogue.steps) {
    if (step.dependsOnAppliedPart && (!appliedPartCode || appliedPartCode === "keines")) {
      continue;
    }
    const resolvedLimitText = resolveAppliedPartLimit(
      step,
      appliedPartCode,
      classification?.appliedPart?.patientLeakageLimit ?? null,
    );
    let baselineValue: string | null = null;
    if (step.comparedToBaseline || step.limitSource === "baseline") {
      const baseline = await getActiveBaseline({
        tenantId: args.tenantId,
        deviceInstanceId: args.deviceInstanceId,
        measureKey: step.label,
      });
      baselineValue = baseline?.value ?? null;
    }
    steps.push({
      id: step.id,
      position: step.position,
      label: step.label,
      isMeasurement: step.isMeasurement,
      unit: step.unit,
      limitText: step.limitText,
      limitSource: step.limitSource,
      dependsOnAppliedPart: step.dependsOnAppliedPart,
      comparedToBaseline: step.comparedToBaseline,
      targetValue: step.targetValue,
      triggerNote: step.triggerNote,
      resolvedLimitText,
      baselineValue,
      source: "catalogue",
    });
  }

  if (deviceFamilyCode && args.inspectionTypeCode === "STK") {
    const familySteps = await prisma.refDeviceFamilyStep.findMany({
      where: { deviceFamilyCode },
      orderBy: { position: "asc" },
    });
    const offset = steps.length;
    for (const fs of familySteps) {
      steps.push({
        id: `family-${fs.id}`,
        position: offset + fs.position,
        label: fs.label,
        isMeasurement: fs.isMeasurement,
        unit: fs.unit,
        limitText: fs.limitText,
        limitSource: fs.limitSource,
        dependsOnAppliedPart: false,
        comparedToBaseline: false,
        targetValue: fs.targetValue,
        triggerNote: null,
        resolvedLimitText: fs.limitText,
        baselineValue: null,
        source: "family",
        familyCode: deviceFamilyCode,
      });
    }
  }

  let missingBaseline = false;
  if (catalogue.requiresBaseline) {
    const needsBaseline = catalogue.steps.some((s) => s.limitSource === "baseline");
    if (needsBaseline) {
      const anyBaseline = steps.some((s) => s.baselineValue);
      missingBaseline = !anyBaseline;
    }
  }

  let testEquipmentClassLabel: string | null = null;
  if (catalogue.testEquipmentClass) {
    const cls = await prisma.refTestEquipmentClass.findUnique({
      where: { code: catalogue.testEquipmentClass },
      select: { label: true },
    });
    testEquipmentClassLabel = cls?.label ?? null;
  }

  return {
    catalogueId: catalogue.id,
    code: catalogue.code,
    label: catalogue.label,
    inspectionTypeCode: catalogue.inspectionTypeCode,
    scope: catalogue.scope,
    scopeValue: catalogue.scopeValue,
    draft: catalogue.draft,
    noCatalogue: catalogue.noCatalogue,
    note: catalogue.note,
    legalBasis: catalogue.legalBasis,
    retention: catalogue.retention,
    testEquipmentClass: catalogue.testEquipmentClass,
    testEquipmentClassLabel,
    traceabilityRequired: catalogue.traceabilityRequired,
    setsBaseline: catalogue.setsBaseline,
    requiresBaseline: catalogue.requiresBaseline,
    occasions,
    appliedPartCode,
    appliedPartLabel: classification?.appliedPart?.label ?? null,
    deviceFamilyCode,
    steps,
    missingBaseline,
  };
}

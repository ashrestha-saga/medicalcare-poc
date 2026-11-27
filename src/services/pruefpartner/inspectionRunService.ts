import type { ActingContext, PartnerContext } from "@/interfaces/session";
import type {
  CataloguePreviewDTO,
  InspectionRunDTO,
  InspectionStepResultDTO,
} from "@/interfaces/pruefpartner";
import { prisma } from "@/lib/prisma";
import { forbidden, notFound, unprocessable } from "@/lib/errors";
import { withTenantStore } from "@/lib/auth/tenantContext";
import { requirePermission } from "@/lib/auth/tenantContext";
import { recordDutyCompletion } from "@/services/registration/recordDutyCompletion";
import { resolveCatalogueForAssignment } from "./catalogueResolutionService";
import { checkQualificationGate } from "./qualificationGateService";
import { checkTestEquipmentGate, listEligibleEquipment } from "./testEquipmentGateService";
import { evaluateMeasurement } from "./limitEvaluationService";
import {
  assertLabelRequired,
  assertLinkedVisitSealGates,
  assertRepairReportGates,
} from "./sealGates";
import {
  allocateLabelNumber,
  resolveInspectionLabel,
  suggestLabelNextDue,
} from "./inspectionLabel";
import { assertCanStartRepairRun } from "@/services/repairs/trainingGateService";
import { completeRepairFromRun } from "@/services/repairs/repairCompleteService";
import {
  deriveRepairCompleteFromKRepSteps,
  repairGateInputFromDerived,
} from "@/services/repairs/kRepCompleteDerive";
import {
  K_REP_CATALOGUE_CODE,
  REPAIR_SERVICE_TYPE,
  inspectionTypeCodeForServiceRequest,
} from "@/constants/repairs";
import { requireRepairsEnabled } from "@/lib/features/repairs";
import { createAttachmentFromDataUrl } from "@/services/storage/attachmentBlobService";
import { inspectionReportService } from "@/services/reports/inspectionReportService";

function isKRepRun(run: {
  catalogue: { code: string };
  serviceRequest?: { serviceType: string } | null;
}): boolean {
  const st = run.serviceRequest?.serviceType;
  return (
    run.catalogue.code === K_REP_CATALOGUE_CODE ||
    st === REPAIR_SERVICE_TYPE ||
    st === "REPAIR"
  );
}

/** Idempotent fold of a sealed K-REP run into MaintenanceEvent (retry / re-seal path). */
async function ensureKRepMaintenanceEvent(
  ctx: ActingContext,
  run: {
    id: string;
    catalogue: { steps: { id: string; inputKind: string | null }[] };
    stepResults: {
      id: string;
      stepId: string;
      note: string | null;
      confirmed: boolean | null;
      measuredValue: string | null;
      withinLimit: boolean | null;
      noPhotoReason: string | null;
    }[];
  },
) {
  const derived = deriveRepairCompleteFromKRepSteps({
    inspectionRunId: run.id,
    steps: run.catalogue.steps,
    stepResults: run.stepResults,
  });
  if (!derived) return;
  await completeRepairFromRun(ctx, { inspectionRunId: run.id, ...derived });
}

function isoDate(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

async function loadAssignment(reference: string, tenantId: string) {
  const req = await prisma.serviceRequest.findFirst({
    where: { reference, tenantId },
    include: {
      duty: true,
      assigneeUser: { select: { id: true, name: true } },
    },
  });
  if (!req) throw notFound("Assignment not found.");
  if (req.subjectType !== "instance" && req.subjectType !== "group") {
    throw unprocessable("Inspection runs require a device instance or Sammelauftrag assignment.");
  }
  if (!req.transmittedAt) {
    throw unprocessable(
      "Assignment has not been transmitted yet — the clinic must transmit before inspection.",
      { field: "transmittedAt" },
    );
  }
  if (req.state === "rejected") {
    throw unprocessable("Assignment was withdrawn.", { field: "state" });
  }
  return req;
}

/** Inspect portal: only the assigned technician may see or run the job. */
function assertAssignedToCaller(
  req: { assigneeUserId: string | null },
  userId: string,
): void {
  if (req.assigneeUserId !== userId) {
    throw forbidden("This inspection is not assigned to you.");
  }
}

async function loadDevice(tenantId: string, instanceId: string) {
  const device = await prisma.deviceInstance.findFirst({
    where: { id: instanceId, tenantId },
    include: {
      model: { select: { tradeName: true, modelName: true, manufacturer: true } },
      area: {
        select: {
          name: true,
          site: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!device) throw notFound("Device not found.");
  return device;
}

function isoDateTime(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

function minutesBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60_000));
}

/** UTC calendar date for E34 uniqueness (technician + site + day + sequence). */
function visitDayUtc(d: Date = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

type VisitPreviewFields = {
  visitId: string | null;
  visitStartedAt: string | null;
  visitCompletedAt: string | null;
  visitSequence: number | null;
  setupMinutes: number | null;
  secondVisitReason: string | null;
};

async function loadVisitPreviewFields(
  tenantId: string,
  visitId: string | null | undefined,
): Promise<VisitPreviewFields> {
  if (!visitId) {
    return {
      visitId: null,
      visitStartedAt: null,
      visitCompletedAt: null,
      visitSequence: null,
      setupMinutes: null,
      secondVisitReason: null,
    };
  }
  const visit = await prisma.serviceVisit.findFirst({
    where: { id: visitId, tenantId },
    select: {
      id: true,
      startedAt: true,
      completedAt: true,
      sequence: true,
      setupMinutes: true,
      secondVisitReason: true,
    },
  });
  if (!visit) {
    return {
      visitId: null,
      visitStartedAt: null,
      visitCompletedAt: null,
      visitSequence: null,
      setupMinutes: null,
      secondVisitReason: null,
    };
  }
  return {
    visitId: visit.id,
    visitStartedAt: isoDateTime(visit.startedAt),
    visitCompletedAt: isoDateTime(visit.completedAt),
    visitSequence: visit.sequence,
    setupMinutes: visit.setupMinutes,
    secondVisitReason: visit.secondVisitReason,
  };
}

type RunWithCatalogue = {
  id: string;
  tenantId: string;
  deviceInstanceId: string;
  catalogueId: string;
  catalogue: { code: string; label: string; draft: boolean; noCatalogue: boolean };
  deviceConfirmed: boolean;
  deviceConfirmSkipped: boolean;
  deviceConfirmCode: string | null;
  occasionCode: string | null;
  performedAt: Date;
  startedAt?: Date | null;
  completedAt?: Date | null;
  performedByName: string;
  result: string;
  note: string | null;
  dutyPerformanceId: string | null;
  idempotencyKey: string | null;
  testEquipmentId: string | null;
  visitId?: string | null;
};

function toRunDto(
  run: RunWithCatalogue,
  steps: ResolvedStepWithResult[],
  deviceMeta: { inventoryNumber: string; serialNumber: string | null; deviceLabel: string },
  reference: string,
  extras?: {
    visitStartedAt?: Date | null;
    signatures?: InspectionRunDTO["signatures"];
  },
): InspectionRunDTO {
  return {
    id: run.id,
    reference,
    tenantId: run.tenantId,
    deviceInstanceId: run.deviceInstanceId,
    catalogueId: run.catalogueId,
    catalogueCode: run.catalogue.code,
    catalogueLabel: run.catalogue.label,
    draft: run.catalogue.draft,
    noCatalogue: run.catalogue.noCatalogue,
    deviceConfirmed: run.deviceConfirmed,
    deviceConfirmSkipped: run.deviceConfirmSkipped,
    deviceConfirmCode: run.deviceConfirmCode,
    occasionCode: run.occasionCode,
    performedAt: isoDate(run.performedAt)!,
    startedAt: isoDateTime(run.startedAt),
    completedAt: isoDateTime(run.completedAt),
    performedByName: run.performedByName,
    result: run.result,
    note: run.note,
    dutyPerformanceId: run.dutyPerformanceId,
    idempotencyKey: run.idempotencyKey,
    inventoryNumber: deviceMeta.inventoryNumber,
    serialNumber: deviceMeta.serialNumber,
    deviceLabel: deviceMeta.deviceLabel,
    testEquipmentId: run.testEquipmentId,
    steps,
    sealed: Boolean(run.dutyPerformanceId) || Boolean(run.completedAt),
    visitId: run.visitId ?? null,
    visitStartedAt: extras?.visitStartedAt ? extras.visitStartedAt.toISOString() : null,
    signatures: extras?.signatures ?? [],
  };
}

type ResolvedStepWithResult = InspectionStepResultDTO;

async function buildStepResults(runId: string, resolved: Awaited<ReturnType<typeof resolveCatalogueForAssignment>>) {
  if (!resolved) return [];
  const existing = await prisma.inspectionStepResult.findMany({
    where: { runId },
    include: { _count: { select: { attachments: true } } },
  });
  const byStepId = new Map(existing.map((r) => [r.stepId, r]));

  return resolved.steps
    .filter((s) => s.source === "catalogue")
    .map((s) => {
      const r = byStepId.get(s.id);
      return {
        stepId: s.id,
        position: s.position,
        label: s.label,
        isMeasurement: s.isMeasurement,
        unit: s.unit,
        limitText: s.resolvedLimitText ?? s.limitText,
        limitSource: s.limitSource,
        comparedToBaseline: s.comparedToBaseline,
        baselineValue: s.baselineValue,
        triggerNote: s.triggerNote,
        confirmed: r?.confirmed ?? null,
        measuredValue: r?.measuredValue ?? null,
        withinLimit: r?.withinLimit ?? null,
        baselineFlag: r?.baselineFlag ?? false,
        note: r?.note ?? null,
        source: s.source,
        noPhotoReason: r?.noPhotoReason ?? null,
        photoCount: r?._count.attachments ?? 0,
        resultId: r?.id ?? null,
        inputKind: s.inputKind ?? null,
        optionsJson: s.optionsJson ?? null,
        valueJson: r?.valueJson ?? null,
      };
    });
}

async function loadRunExtras(runId: string, visitId: string | null) {
  const [visit, signatures] = await Promise.all([
    visitId
      ? prisma.serviceVisit.findFirst({ where: { id: visitId }, select: { startedAt: true } })
      : Promise.resolve(null),
    prisma.inspectionSignature.findMany({ where: { runId } }),
  ]);
  return {
    visitStartedAt: visit?.startedAt ?? null,
    signatures: signatures.map((s) => ({
      kind: s.kind,
      signerName: s.signerName,
      signerRole: s.signerRole,
      signedAt: s.signedAt ? s.signedAt.toISOString() : null,
      absent: s.absent,
      absentReason: s.absentReason,
    })),
  };
}

export const inspectionRunService = {
  async resolvePreview(
    ctx: ActingContext,
    reference: string,
    opts?: { deviceInstanceId?: string | null },
  ): Promise<CataloguePreviewDTO> {
    requirePermission(ctx, "inspections:perform", "inspections:view");
    return withTenantStore(ctx, async () => {
      const req = await loadAssignment(reference, ctx.tenantId);
      assertAssignedToCaller(req, ctx.user.id);

      const selectedDeviceId = opts?.deviceInstanceId?.trim() || null;
      const isGroup = req.subjectType === "group";

      let collective: CataloguePreviewDTO["collective"] = null;
      if (isGroup) {
        const items = await prisma.serviceRequestItem.findMany({
          where: { serviceRequestId: req.id, tenantId: ctx.tenantId },
          orderBy: { position: "asc" },
          include: {
            deviceInstance: {
              select: {
                id: true,
                inventoryNumber: true,
                kind: true,
                model: { select: { tradeName: true, modelName: true } },
                characteristicsJson: true,
              },
            },
          },
        });
        const done = items.filter((i) => i.status === "done" || i.status === "skipped").length;
        collective = {
          done,
          total: items.length,
          items: items.map((i) => {
            let charName: string | null = null;
            try {
              const raw = i.deviceInstance.characteristicsJson;
              if (raw) {
                const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
                charName =
                  (parsed as { tradeName?: string })?.tradeName?.trim() ||
                  (parsed as { modelName?: string })?.modelName?.trim() ||
                  null;
              }
            } catch {
              /* ignore */
            }
            const deviceLabel =
              i.deviceInstance.model?.tradeName ||
              i.deviceInstance.model?.modelName ||
              charName ||
              i.deviceInstance.inventoryNumber;
            return {
              id: i.id,
              position: i.position,
              status: i.status,
              deviceInstanceId: i.deviceInstanceId,
              inventoryNumber: i.deviceInstance.inventoryNumber,
              kind: i.deviceInstance.kind,
              deviceLabel,
              inspectionRunId: i.inspectionRunId,
              skippedReason: i.skippedReason,
            };
          }),
        };

        // Group list view — no single device selected yet.
        if (!selectedDeviceId) {
          const site = req.siteId
            ? await prisma.site.findFirst({
                where: { id: req.siteId },
                select: { id: true, name: true },
              })
            : null;
          const visitFields = await loadVisitPreviewFields(ctx.tenantId, req.visitId);
          const assignmentCompleted =
            req.state === "completed" ||
            req.state === "rejected" ||
            (collective.total > 0 && collective.done >= collective.total);
          return {
            reference,
            serviceRequestId: req.id,
            tenantId: ctx.tenantId,
            subjectType: "group",
            deviceInstanceId: null,
            inventoryNumber: "—",
            serialNumber: null,
            deviceLabel: `Sammelauftrag · ${collective.done} / ${collective.total}`,
            modelName: null,
            manufacturer: null,
            locationText: req.locationText || site?.name || "—",
            accessHint: req.accessHint,
            siteId: req.siteId ?? site?.id ?? null,
            siteName: site?.name ?? null,
            scheduledAt: isoDateTime(req.scheduledAt),
            ...visitFields,
            overdue: false,
            serviceType: req.serviceType,
            fulfilment: req.fulfilment ?? "on_site",
            dueAt: isoDate(req.duty?.dueAt),
            inspectionTypeCode: inspectionTypeCodeForServiceRequest({
              serviceType: req.serviceType,
              dutyInspectionTypeCode: req.duty?.inspectionTypeCode,
              checkType: req.checkType,
            }),
            sealed: assignmentCompleted,
            suggestedLabel: null,
            catalogue: null,
            qualificationGate: { ok: true, required: [], missing: [] },
            equipmentGate: { ok: true, requiredClass: null, blockedReason: null },
            eligibleEquipment: [],
            draftRunId: null,
            sealedRunId: null,
            collective,
          };
        }
      }

      const deviceInstanceId = isGroup ? selectedDeviceId! : req.subjectId;
      if (isGroup) {
        const item = await prisma.serviceRequestItem.findFirst({
          where: {
            serviceRequestId: req.id,
            deviceInstanceId,
            tenantId: ctx.tenantId,
          },
        });
        if (!item) throw unprocessable("Device is not part of this Sammelauftrag");
      }

      const device = await loadDevice(ctx.tenantId, deviceInstanceId);
      const duty = req.duty;
      let inspectionTypeCode = inspectionTypeCodeForServiceRequest({
        serviceType: req.serviceType,
        dutyInspectionTypeCode: duty?.inspectionTypeCode,
        checkType: req.checkType,
      });

      let resolved = await resolveCatalogueForAssignment({
        tenantId: ctx.tenantId,
        deviceInstanceId,
        inspectionTypeCode,
        constancyObjectCode: duty?.constancyObjectCode,
      });
      // E78 — constancy miss → ACCEPT generic (K-ABN).
      if (!resolved && inspectionTypeCode === "CONSTANCY") {
        inspectionTypeCode = "ACCEPT";
        resolved = await resolveCatalogueForAssignment({
          tenantId: ctx.tenantId,
          deviceInstanceId,
          inspectionTypeCode,
          constancyObjectCode: duty?.constancyObjectCode,
        });
      }

      const performanceDate = new Date();
      const qualGate = resolved
        ? await checkQualificationGate({
            userId: ctx.user.id,
            catalogueId: resolved.catalogueId,
            inspectionTypeCode: resolved.inspectionTypeCode,
            performanceDate,
          })
        : { ok: true, required: [], missing: [] };

      const orgId = ctx.user.accountKind === "partner" ? ctx.user.organisationId : "";
      const equipGate = await checkTestEquipmentGate({
        organisationId: orgId,
        testEquipmentClass: resolved?.testEquipmentClass ?? null,
        testEquipmentId: null,
        performanceDate,
        traceabilityRequired: resolved?.traceabilityRequired ?? false,
      });

      const existingRun = await prisma.inspectionRun.findFirst({
        where: {
          serviceRequestId: req.id,
          deviceInstanceId,
          dutyPerformanceId: null,
        },
        orderBy: { performedAt: "desc" },
      });

      const sealedRun = await prisma.inspectionRun.findFirst({
        where: {
          serviceRequestId: req.id,
          deviceInstanceId: isGroup ? deviceInstanceId : undefined,
          dutyPerformanceId: { not: null },
        },
        orderBy: { performedAt: "desc" },
        select: { id: true },
      });
      const itemDone =
        isGroup &&
        Boolean(
          collective?.items.find(
            (i) =>
              i.deviceInstanceId === deviceInstanceId &&
              (i.status === "done" || i.status === "skipped"),
          ),
        );
      const assignmentCompleted =
        req.state === "completed" ||
        req.state === "rejected" ||
        itemDone ||
        (!isGroup && Boolean(sealedRun));

      const catalogue = resolved
        ? {
            ...resolved,
            steps: resolved.steps.map((s) => ({
              stepId: s.id,
              position: s.position,
              label: s.label,
              isMeasurement: s.isMeasurement,
              unit: s.unit,
              limitText: s.resolvedLimitText ?? s.limitText,
              limitSource: s.limitSource,
              comparedToBaseline: s.comparedToBaseline,
              baselineValue: s.baselineValue,
              triggerNote: s.triggerNote,
              confirmed: null,
              measuredValue: null,
              withinLimit: null,
              baselineFlag: false,
              note: null,
              source: s.source,
              inputKind: s.inputKind ?? null,
              optionsJson: s.optionsJson ?? null,
              valueJson: null,
            })),
          }
        : null;

      const dueAt = isoDate(duty?.dueAt);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const overdue = Boolean(
        dueAt && new Date(`${dueAt}T00:00:00`) < today && !assignmentCompleted,
      );
      let suggestedLabel: CataloguePreviewDTO["suggestedLabel"] = null;
      if (catalogue?.requiresLabel && !assignmentCompleted) {
        const nextDue = suggestLabelNextDue({
          performedAt: new Date(),
          deadlineAnchor: duty?.deadlineAnchor,
          referenceDate: duty?.referenceDate,
          intervalValue: duty?.intervalValue,
          intervalUnit: duty?.intervalUnit,
        });
        const number = await allocateLabelNumber({ tenantId: ctx.tenantId });
        suggestedLabel = { number, nextDue };
      }
      const locParts = [device.area?.name, device.room].filter(Boolean);
      const siteId = req.siteId ?? device.area?.site?.id ?? null;
      const siteName = device.area?.site?.name ?? null;
      const visitFields = await loadVisitPreviewFields(
        ctx.tenantId,
        req.visitId ?? existingRun?.visitId ?? null,
      );

      let charName: string | null = null;
      try {
        const raw = device.characteristicsJson;
        if (raw) {
          const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
          charName =
            (parsed as { tradeName?: string })?.tradeName?.trim() ||
            (parsed as { modelName?: string })?.modelName?.trim() ||
            null;
        }
      } catch {
        /* ignore */
      }

      return {
        reference,
        serviceRequestId: req.id,
        tenantId: ctx.tenantId,
        subjectType: req.subjectType,
        deviceInstanceId,
        inventoryNumber: device.inventoryNumber,
        serialNumber: device.serialNumber,
        deviceLabel:
          device.model?.tradeName || device.model?.modelName || charName || req.locationText,
        modelName: device.model?.modelName ?? device.model?.tradeName ?? charName,
        manufacturer: device.model?.manufacturer ?? null,
        locationText: locParts.length > 0 ? locParts.join(" · ") : req.locationText || "—",
        accessHint: req.accessHint,
        siteId,
        siteName,
        scheduledAt: isoDateTime(req.scheduledAt),
        ...visitFields,
        overdue,
        serviceType: req.serviceType,
        fulfilment: req.fulfilment ?? "on_site",
        dueAt,
        inspectionTypeCode,
        sealed: assignmentCompleted,
        suggestedLabel,
        catalogue,
        qualificationGate: qualGate,
        equipmentGate: {
          ok: equipGate.ok,
          requiredClass: equipGate.requiredClass,
          blockedReason: equipGate.blockedReason,
        },
        eligibleEquipment: equipGate.instruments,
        draftRunId: assignmentCompleted ? null : (existingRun?.id ?? null),
        sealedRunId: sealedRun?.id ?? null,
        collective,
      };
    });
  },

  async startRun(
    ctx: ActingContext,
    body: {
      reference: string;
      /** Required for Sammelauftrag (subjectType=group): which item device to run. */
      deviceInstanceId?: string | null;
      occasionCode?: string | null;
      testEquipmentId?: string | null;
      performedAt?: string;
    },
  ): Promise<InspectionRunDTO> {
    requirePermission(ctx, "inspections:perform");
    return withTenantStore(ctx, async () => {
      const req = await loadAssignment(body.reference, ctx.tenantId);
      assertAssignedToCaller(req, ctx.user.id);
      if (
        req.serviceType === REPAIR_SERVICE_TYPE ||
        req.serviceType === "REPAIR"
      ) {
        const tenant = await prisma.tenant.findUnique({
          where: { id: ctx.tenantId },
          select: { featureFlags: true },
        });
        requireRepairsEnabled(tenant?.featureFlags);
      }
      await assertCanStartRepairRun(ctx, req.id);
      if (req.state === "completed" || req.state === "rejected") {
        throw unprocessable("This assignment is already completed and cannot be started again.");
      }
      // E89 / R37 — service-type gate on partner run start (same as disposition assign).
      if (ctx.user.accountKind === "partner" && ctx.user.organisationId) {
        const { assertServiceTypeGate } = await import(
          "@/services/gates/serviceTypeGateService"
        );
        await assertServiceTypeGate({
          tenantId: ctx.tenantId,
          organisationId: ctx.user.organisationId,
          serviceType: req.serviceType,
          assigneeUserId: ctx.user.id,
          serviceRequestId: req.id,
        });
      }

      let deviceInstanceId = req.subjectId;
      if (req.subjectType === "group") {
        const itemDeviceId = body.deviceInstanceId?.trim();
        if (!itemDeviceId) {
          throw unprocessable("deviceInstanceId required for Sammelauftrag", {
            field: "deviceInstanceId",
          });
        }
        const item = await prisma.serviceRequestItem.findFirst({
          where: {
            serviceRequestId: req.id,
            deviceInstanceId: itemDeviceId,
            tenantId: ctx.tenantId,
          },
        });
        if (!item) throw unprocessable("Device is not part of this Sammelauftrag");
        if (item.status === "done" || item.status === "skipped") {
          throw unprocessable("This Sammelauftrag item is already finished");
        }
        deviceInstanceId = itemDeviceId;
        const priorForDevice = await prisma.inspectionRun.findFirst({
          where: {
            serviceRequestId: req.id,
            deviceInstanceId,
            dutyPerformanceId: { not: null },
          },
          select: { id: true },
        });
        if (priorForDevice) {
          throw unprocessable("A sealed protocol already exists for this device on the Sammelauftrag.");
        }
      } else {
        const priorSealed = await prisma.inspectionRun.findFirst({
          where: { serviceRequestId: req.id, dutyPerformanceId: { not: null } },
          select: { id: true },
        });
        if (priorSealed) {
          throw unprocessable("A sealed protocol already exists for this assignment.");
        }
      }

      const device = await loadDevice(ctx.tenantId, deviceInstanceId);
      const duty = req.duty;
      let inspectionTypeCode = inspectionTypeCodeForServiceRequest({
        serviceType: req.serviceType,
        dutyInspectionTypeCode: duty?.inspectionTypeCode,
        checkType: req.checkType,
      });

      let resolved = await resolveCatalogueForAssignment({
        tenantId: ctx.tenantId,
        deviceInstanceId,
        inspectionTypeCode,
        constancyObjectCode: duty?.constancyObjectCode,
      });
      if (!resolved && inspectionTypeCode === "CONSTANCY") {
        inspectionTypeCode = "ACCEPT";
        resolved = await resolveCatalogueForAssignment({
          tenantId: ctx.tenantId,
          deviceInstanceId,
          inspectionTypeCode,
          constancyObjectCode: duty?.constancyObjectCode,
        });
      }
      if (!resolved) throw unprocessable("No inspection catalogue found for this assignment.");

      const performanceDate = body.performedAt
        ? new Date(`${body.performedAt}T12:00:00`)
        : new Date();

      const qualGate = await checkQualificationGate({
        userId: ctx.user.id,
        catalogueId: resolved.catalogueId,
        inspectionTypeCode: resolved.inspectionTypeCode,
        performanceDate,
      });
      if (!qualGate.ok) {
        throw unprocessable(
          `Missing qualification: ${qualGate.missing.map((m) => m.label).join(", ")}`,
        );
      }

      if (resolved.missingBaseline) {
        throw unprocessable("Baseline values required before this inspection can start.");
      }

      const orgId = ctx.user.accountKind === "partner" ? ctx.user.organisationId : "";
      const equipGate = await checkTestEquipmentGate({
        organisationId: orgId,
        testEquipmentClass: resolved.testEquipmentClass,
        testEquipmentId: body.testEquipmentId ?? null,
        performanceDate,
        traceabilityRequired: resolved.traceabilityRequired,
      });
      if (!equipGate.ok && resolved.testEquipmentClass) {
        const msg =
          equipGate.blockedReason === "calibration_lapsed"
            ? "Calibration expired before performance date."
            : equipGate.blockedReason === "traceability_missing"
              ? "Traceability reference required for this catalogue."
              : (equipGate.blockedReason ?? "Test equipment required.");
        throw unprocessable(msg);
      }

      if (resolved.occasions.length > 0 && !body.occasionCode) {
        throw unprocessable("Validation occasion required.");
      }

      const { getOpenClassification } = await import(
        "@/services/registration/classificationScope"
      );
      const classification = device.modelId
        ? await getOpenClassification(prisma, device.modelId, ctx.tenantId)
        : null;

      let run = await prisma.inspectionRun.findFirst({
        where: {
          serviceRequestId: req.id,
          deviceInstanceId,
          dutyPerformanceId: null,
        },
        include: { catalogue: true },
      });

      if (!run) {
        run = await prisma.inspectionRun.create({
          data: {
            tenantId: ctx.tenantId,
            deviceInstanceId,
            catalogueId: resolved.catalogueId,
            deviceDutyId: duty?.id ?? null,
            serviceRequestId: req.id,
            // Inherit site visit from the assignment when already started (Sammelauftrag).
            visitId: req.visitId ?? null,
            occasionCode: body.occasionCode ?? null,
            performedAt: performanceDate,
            startedAt: new Date(),
            performedByUserId: ctx.user.id,
            performedByName: ctx.user.name,
            organisationId: ctx.user.accountKind === "partner" ? ctx.user.organisationId : null,
            testEquipmentId: body.testEquipmentId ?? null,
            appliedPartCode: classification?.appliedPartCode ?? null,
          },
          include: { catalogue: true },
        });
      } else {
        const patch: { startedAt?: Date; visitId?: string } = {};
        if (!run.startedAt) patch.startedAt = new Date();
        if (!run.visitId && req.visitId) patch.visitId = req.visitId;
        if (Object.keys(patch).length) {
          run = await prisma.inspectionRun.update({
            where: { id: run.id },
            data: patch,
            include: { catalogue: true },
          });
        }
      }

      if (req.state !== "in_progress") {
        await prisma.statusEvent.create({
          data: {
            tenantId: ctx.tenantId,
            serviceRequestId: req.id,
            state: "in_progress",
            source: "inspection_run",
            actor: ctx.user.name,
            note: `Inspection started (${resolved.code})`,
          },
        });
        await prisma.serviceRequest.update({
          where: { id: req.id },
          data: { state: "in_progress" },
        });
      }

      const steps = await buildStepResults(run.id, resolved);
      const visitId = run.visitId ?? req.visitId ?? null;
      const extras = await loadRunExtras(run.id, visitId);
      return toRunDto(
        { ...run, visitId },
        steps,
        {
          inventoryNumber: device.inventoryNumber,
          serialNumber: device.serialNumber,
          deviceLabel: device.model?.tradeName || device.model?.modelName || req.locationText,
        },
        body.reference,
        extras,
      );
    });
  },

  async getRun(ctx: ActingContext, runId: string): Promise<InspectionRunDTO> {
    requirePermission(ctx, "inspections:perform", "inspections:view");
    return withTenantStore(ctx, async () => {
      const run = await prisma.inspectionRun.findFirst({
        where: { id: runId, tenantId: ctx.tenantId },
        include: {
          catalogue: true,
          serviceRequest: { select: { reference: true, visitId: true } },
        },
      });
      if (!run) throw notFound("Inspection run not found.");

      const device = await loadDevice(ctx.tenantId, run.deviceInstanceId);
      const resolved = await resolveCatalogueForAssignment({
        tenantId: ctx.tenantId,
        deviceInstanceId: run.deviceInstanceId,
        inspectionTypeCode: run.catalogue.inspectionTypeCode,
      });
      const steps = await buildStepResults(run.id, resolved);
      const visitId = run.visitId ?? run.serviceRequest?.visitId ?? null;
      const extras = await loadRunExtras(run.id, visitId);
      return toRunDto(
        { ...run, visitId },
        steps,
        {
          inventoryNumber: device.inventoryNumber,
          serialNumber: device.serialNumber,
          deviceLabel: device.model?.tradeName || device.model?.modelName || device.inventoryNumber,
        },
        run.serviceRequest?.reference ?? run.id,
        extras,
      );
    });
  },

  /**
   * Discard an unsealed draft protocol so the assignment can be started fresh
   * (e.g. after catalogue mapping changes). Sealed runs are immutable.
   */
  async discardDraftRun(
    ctx: ActingContext,
    runId: string,
  ): Promise<{ ok: true; reference: string | null }> {
    requirePermission(ctx, "inspections:perform");
    return withTenantStore(ctx, async () => {
      const run = await prisma.inspectionRun.findFirst({
        where: { id: runId, tenantId: ctx.tenantId },
        include: {
          serviceRequest: {
            select: { reference: true, assigneeUserId: true },
          },
        },
      });
      if (!run) throw notFound("Inspection run not found.");
      if (run.dutyPerformanceId) {
        throw unprocessable("Sealed protocols cannot be discarded.");
      }
      if (run.serviceRequest) {
        assertAssignedToCaller(run.serviceRequest, ctx.user.id);
      } else if (run.performedByUserId && run.performedByUserId !== ctx.user.id) {
        throw forbidden("This inspection is not assigned to you.");
      }

      await prisma.deviceClarification.updateMany({
        where: { inspectionRunId: run.id },
        data: { inspectionRunId: null },
      });
      await prisma.baselineMeasurement.updateMany({
        where: { runId: run.id },
        data: { runId: null },
      });
      await prisma.inspectionRun.delete({ where: { id: run.id } });

      return { ok: true, reference: run.serviceRequest?.reference ?? null };
    });
  },

  /**
   * D2 — ensure ServiceVisit linked to the run + request, then mark started.
   * Called from the inspect protocol before steps / seal.
   */
  async ensureAndStartVisit(
    ctx: ActingContext,
    runId: string,
  ): Promise<{ visitId: string; startedAt: string }> {
    requirePermission(ctx, "inspections:perform");
    if (ctx.user.accountKind !== "partner" || !ctx.user.organisationId) {
      throw forbidden();
    }
    const organisationId = ctx.user.organisationId;
    return withTenantStore(ctx, async () => {
      const run = await prisma.inspectionRun.findFirst({
        where: { id: runId, tenantId: ctx.tenantId },
        include: {
          serviceRequest: {
            select: { id: true, siteId: true, visitId: true, assigneeUserId: true },
          },
        },
      });
      if (!run) throw notFound("Inspection run not found.");
      if (run.dutyPerformanceId) throw unprocessable("Run already sealed.");

      let visitId = run.visitId ?? run.serviceRequest?.visitId ?? null;
      if (visitId) {
        const existing = await prisma.serviceVisit.findFirst({
          where: { id: visitId, tenantId: ctx.tenantId },
        });
        if (!existing) visitId = null;
        else if (existing.completedAt) {
          throw unprocessable(
            "This visit already ended. Resume it or start a second visit with a reason (E34).",
            { field: "visitId" },
          );
        } else if (!existing.startedAt) {
          await prisma.serviceVisit.update({
            where: { id: existing.id },
            data: { startedAt: new Date(), date: existing.date ?? visitDayUtc() },
          });
        }
      }

      if (!visitId) {
        const created = await prisma.serviceVisit.create({
          data: {
            tenantId: ctx.tenantId,
            organisationId,
            siteId: run.serviceRequest?.siteId ?? null,
            technicianUserId: run.serviceRequest?.assigneeUserId ?? ctx.user.id,
            plannedAt: new Date(),
            startedAt: new Date(),
            date: visitDayUtc(),
            sequence: 1,
          },
        });
        visitId = created.id;
      }

      await prisma.inspectionRun.update({
        where: { id: run.id },
        data: { visitId },
      });
      if (run.serviceRequestId) {
        await prisma.serviceRequest.update({
          where: { id: run.serviceRequestId },
          data: { visitId },
        });
      }

      const visit = await prisma.serviceVisit.findFirstOrThrow({ where: { id: visitId } });
      return { visitId, startedAt: visit.startedAt!.toISOString() };
    });
  },

  /**
   * Day-plan site card — start one ServiceVisit for the given assignments.
   * E34: a completed visit must be resumed or replaced by a second visit (not silently restarted).
   */
  async startSiteVisit(
    ctx: ActingContext,
    body: { siteId: string | null; references: string[] },
  ): Promise<{ visitId: string; startedAt: string }> {
    requirePermission(ctx, "inspections:perform");
    if (ctx.user.accountKind !== "partner" || !ctx.user.organisationId) {
      throw forbidden();
    }
    const organisationId = ctx.user.organisationId;
    const refs = [...new Set(body.references)].filter(Boolean);
    if (refs.length === 0) throw unprocessable("No assignments to start a visit for.");

    return withTenantStore(ctx, async () => {
      const requests = await prisma.serviceRequest.findMany({
        where: {
          tenantId: ctx.tenantId,
          reference: { in: refs },
          assigneeUserId: ctx.user.id,
          transmittedAt: { not: null },
          state: { not: "rejected" },
        },
        select: { id: true, reference: true, siteId: true, visitId: true },
      });
      if (requests.length === 0) {
        throw forbidden("No assignments of yours match this visit.");
      }

      const siteId =
        body.siteId ??
        requests.map((r) => r.siteId).find((id): id is string => Boolean(id)) ??
        null;

      let visitId =
        requests.map((r) => r.visitId).find((id): id is string => Boolean(id)) ?? null;
      if (visitId) {
        const existing = await prisma.serviceVisit.findFirst({
          where: { id: visitId, tenantId: ctx.tenantId, organisationId },
        });
        if (!existing) visitId = null;
        else if (existing.completedAt) {
          throw unprocessable(
            "This visit already ended. Resume (no new travel) or start a second visit with a reason (E34).",
            { field: "visitId" },
          );
        } else if (!existing.startedAt) {
          await prisma.serviceVisit.update({
            where: { id: existing.id },
            data: {
              startedAt: new Date(),
              technicianUserId: ctx.user.id,
              date: existing.date ?? visitDayUtc(),
            },
          });
        }
      }

      if (!visitId) {
        const created = await prisma.serviceVisit.create({
          data: {
            tenantId: ctx.tenantId,
            organisationId,
            siteId,
            technicianUserId: ctx.user.id,
            plannedAt: new Date(),
            startedAt: new Date(),
            date: visitDayUtc(),
            sequence: 1,
          },
        });
        visitId = created.id;
      }

      await prisma.serviceRequest.updateMany({
        where: { id: { in: requests.map((r) => r.id) } },
        data: { visitId },
      });
      await prisma.inspectionRun.updateMany({
        where: {
          tenantId: ctx.tenantId,
          serviceRequestId: { in: requests.map((r) => r.id) },
          dutyPerformanceId: null,
        },
        data: { visitId },
      });

      const visit = await prisma.serviceVisit.findFirstOrThrow({ where: { id: visitId } });
      return { visitId, startedAt: (visit.startedAt ?? new Date()).toISOString() };
    });
  },

  /** End a running site visit (sets completedAt + setupMinutes). */
  async endSiteVisit(
    ctx: ActingContext,
    visitId: string,
  ): Promise<{ visitId: string; completedAt: string; setupMinutes: number }> {
    requirePermission(ctx, "inspections:perform");
    if (ctx.user.accountKind !== "partner" || !ctx.user.organisationId) {
      throw forbidden();
    }
    const organisationId = ctx.user.organisationId;
    return withTenantStore(ctx, async () => {
      const visit = await prisma.serviceVisit.findFirst({
        where: { id: visitId, tenantId: ctx.tenantId, organisationId },
      });
      if (!visit) throw notFound("Visit not found.");
      if (!visit.startedAt) {
        throw unprocessable("Visit has not been started.", { field: "visitId" });
      }
      if (visit.completedAt) {
        return {
          visitId: visit.id,
          completedAt: visit.completedAt.toISOString(),
          setupMinutes: visit.setupMinutes ?? 0,
        };
      }

      const endedAt = new Date();
      const runs = await prisma.inspectionRun.findMany({
        where: { visitId: visit.id, tenantId: ctx.tenantId },
        select: { startedAt: true, completedAt: true, performedAt: true },
      });
      const firstStep =
        runs
          .map((r) => r.startedAt ?? r.performedAt)
          .filter((d): d is Date => Boolean(d))
          .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
      const lastStep =
        runs
          .map((r) => r.completedAt)
          .filter((d): d is Date => Boolean(d))
          .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
      const vor = firstStep
        ? minutesBetween(visit.startedAt, firstStep)
        : minutesBetween(visit.startedAt, endedAt);
      const nach = lastStep ? minutesBetween(lastStep, endedAt) : 0;
      const setupMinutes = vor + nach;

      const updated = await prisma.serviceVisit.update({
        where: { id: visit.id },
        data: { completedAt: endedAt, setupMinutes },
      });
      return {
        visitId: updated.id,
        completedAt: updated.completedAt!.toISOString(),
        setupMinutes,
      };
    });
  },

  /** Resume an ended visit without a new travel stamp (clear completedAt). */
  async resumeSiteVisit(
    ctx: ActingContext,
    visitId: string,
  ): Promise<{ visitId: string; startedAt: string }> {
    requirePermission(ctx, "inspections:perform");
    if (ctx.user.accountKind !== "partner" || !ctx.user.organisationId) {
      throw forbidden();
    }
    const organisationId = ctx.user.organisationId;
    return withTenantStore(ctx, async () => {
      const visit = await prisma.serviceVisit.findFirst({
        where: { id: visitId, tenantId: ctx.tenantId, organisationId },
      });
      if (!visit) throw notFound("Visit not found.");
      if (!visit.startedAt) {
        throw unprocessable("Visit has not been started.", { field: "visitId" });
      }
      if (!visit.completedAt) {
        return { visitId: visit.id, startedAt: visit.startedAt.toISOString() };
      }
      const updated = await prisma.serviceVisit.update({
        where: { id: visit.id },
        data: { completedAt: null, setupMinutes: null },
      });
      return {
        visitId: updated.id,
        startedAt: updated.startedAt!.toISOString(),
      };
    });
  },

  /**
   * E34 — second visit today (new travel). Requires reason; links open refs to the new visit.
   */
  async startSecondSiteVisit(
    ctx: ActingContext,
    visitId: string,
    body: {
      reason: "notfall" | "teile" | "kunde" | "sonstiges";
      note?: string | null;
      references: string[];
    },
  ): Promise<{ visitId: string; startedAt: string; sequence: number }> {
    requirePermission(ctx, "inspections:perform");
    if (ctx.user.accountKind !== "partner" || !ctx.user.organisationId) {
      throw forbidden();
    }
    const organisationId = ctx.user.organisationId;
    const reasonLabels: Record<string, string> = {
      notfall: "Interrupted by emergency",
      teile: "Parts fetched",
      kunde: "Customer postponed",
      sonstiges: "other",
    };
    const note = body.note?.trim() || "";
    if (body.reason === "sonstiges" && !note) {
      throw unprocessable("Note is required for reason “other”.", { field: "note" });
    }
    const reasonText = `${reasonLabels[body.reason] ?? body.reason}${note ? ` — ${note}` : ""}`;

    return withTenantStore(ctx, async () => {
      const prior = await prisma.serviceVisit.findFirst({
        where: { id: visitId, tenantId: ctx.tenantId, organisationId },
      });
      if (!prior) throw notFound("Visit not found.");
      if (!prior.completedAt) {
        throw unprocessable("End the current visit before starting a second visit (E34).", {
          field: "visitId",
        });
      }

      const refs = [...new Set(body.references)].filter(Boolean);
      const requests = await prisma.serviceRequest.findMany({
        where: {
          tenantId: ctx.tenantId,
          assigneeUserId: ctx.user.id,
          transmittedAt: { not: null },
          state: { notIn: ["completed", "rejected"] },
          ...(refs.length > 0 ? { reference: { in: refs } } : { visitId: prior.id }),
        },
        select: { id: true },
      });
      if (requests.length === 0) {
        throw unprocessable("No open assignments to attach to the second visit.");
      }

      const day = prior.date ?? visitDayUtc(prior.startedAt ?? new Date());
      const maxSeq = await prisma.serviceVisit.aggregate({
        where: {
          tenantId: ctx.tenantId,
          siteId: prior.siteId,
          technicianUserId: prior.technicianUserId ?? ctx.user.id,
          date: day,
        },
        _max: { sequence: true },
      });
      const sequence = (maxSeq._max.sequence ?? prior.sequence ?? 1) + 1;

      const created = await prisma.serviceVisit.create({
        data: {
          tenantId: ctx.tenantId,
          organisationId,
          siteId: prior.siteId,
          technicianUserId: prior.technicianUserId ?? ctx.user.id,
          plannedAt: new Date(),
          startedAt: new Date(),
          date: day,
          sequence,
          secondVisitReason: reasonText,
        },
      });

      await prisma.serviceRequest.updateMany({
        where: { id: { in: requests.map((r) => r.id) } },
        data: { visitId: created.id },
      });
      await prisma.inspectionRun.updateMany({
        where: {
          tenantId: ctx.tenantId,
          serviceRequestId: { in: requests.map((r) => r.id) },
          dutyPerformanceId: null,
        },
        data: { visitId: created.id },
      });

      return {
        visitId: created.id,
        startedAt: created.startedAt!.toISOString(),
        sequence: created.sequence,
      };
    });
  },

  /** D11 — attach Mangelbild photo to a failed step result. */
  async attachStepPhoto(
    ctx: ActingContext,
    runId: string,
    stepId: string,
    dataUrl: string,
  ): Promise<{ attachmentId: string; photoCount: number }> {
    requirePermission(ctx, "inspections:perform");
    return withTenantStore(ctx, async () => {
      const run = await prisma.inspectionRun.findFirst({
        where: { id: runId, tenantId: ctx.tenantId },
        select: { id: true, dutyPerformanceId: true },
      });
      if (!run) throw notFound("Inspection run not found.");
      if (run.dutyPerformanceId) throw unprocessable("Run already sealed.");

      let result = await prisma.inspectionStepResult.findUnique({
        where: { runId_stepId: { runId, stepId } },
      });
      if (!result) {
        result = await prisma.inspectionStepResult.create({
          data: {
            runId,
            stepId,
            confirmed: false,
            recordedAt: new Date(),
          },
        });
      }

      const blob = await createAttachmentFromDataUrl(prisma, {
        tenantId: ctx.tenantId,
        kind: "mangelbild",
        dataUrl,
      });
      await prisma.inspectionStepAttachment.create({
        data: {
          resultId: result.id,
          blobId: blob.id,
          kind: "mangelbild",
        },
      });
      const photoCount = await prisma.inspectionStepAttachment.count({
        where: { resultId: result.id },
      });
      return { attachmentId: blob.id, photoCount };
    });
  },

  async confirmDevice(
    ctx: ActingContext,
    runId: string,
    body: { code?: string; skip?: boolean },
  ): Promise<void> {
    requirePermission(ctx, "inspections:perform");
    await withTenantStore(ctx, async () => {
      const run = await prisma.inspectionRun.findFirst({
        where: { id: runId, tenantId: ctx.tenantId },
        include: { deviceInstance: true },
      });
      if (!run) throw notFound("Inspection run not found.");
      if (run.dutyPerformanceId) throw unprocessable("Run already completed.");

      if (body.skip) {
        await prisma.inspectionRun.update({
          where: { id: runId },
          data: {
            deviceConfirmed: true,
            deviceConfirmSkipped: true,
            deviceConfirmCode: null,
          },
        });
        return;
      }

      const code = (body.code ?? "").trim();
      if (!code) throw unprocessable("Scan code required.");

      const inv = run.deviceInstance.inventoryNumber.toLowerCase();
      const sn = (run.deviceInstance.serialNumber ?? "").toLowerCase();
      const udi = (run.deviceInstance.udiDi ?? "").toLowerCase();
      const q = code.toLowerCase();
      const match = q === inv || (sn && q === sn) || (udi && (q === udi || udi.includes(q)));

      if (!match) {
        throw unprocessable("Scanned code does not match this device.");
      }

      await prisma.inspectionRun.update({
        where: { id: runId },
        data: {
          deviceConfirmed: true,
          deviceConfirmSkipped: false,
          deviceConfirmCode: code,
        },
      });
    });
  },

  async saveSteps(
    ctx: ActingContext,
    runId: string,
    steps: {
      stepId: string;
      confirmed?: boolean | null;
      measuredValue?: string | null;
      note?: string | null;
      noPhotoReason?: string | null;
    }[],
  ): Promise<void> {
    requirePermission(ctx, "inspections:perform");
    await withTenantStore(ctx, async () => {
      const run = await prisma.inspectionRun.findFirst({
        where: { id: runId, tenantId: ctx.tenantId },
        include: {
          catalogue: { include: { steps: true } },
          visit: { select: { id: true, startedAt: true, completedAt: true } },
          serviceRequest: {
            select: {
              visitId: true,
              visit: { select: { startedAt: true, completedAt: true } },
            },
          },
        },
      });
      if (!run) throw notFound("Inspection run not found.");
      if (run.dutyPerformanceId) throw unprocessable("Run already completed.");

      // D2 — when a visit is linked, steps require a running (started, not ended) visit.
      const linkedVisit = run.visit ?? run.serviceRequest?.visit ?? null;
      const visitLinked = Boolean(run.visitId ?? run.serviceRequest?.visitId);
      if (visitLinked && !linkedVisit?.startedAt) {
        throw unprocessable("Start the site visit before recording inspection steps.", {
          field: "visitId",
        });
      }
      if (visitLinked && linkedVisit?.completedAt) {
        throw unprocessable(
          "This visit has ended. Resume it or start a second visit before recording steps.",
          { field: "visitId" },
        );
      }

      const resolved = await resolveCatalogueForAssignment({
        tenantId: ctx.tenantId,
        deviceInstanceId: run.deviceInstanceId,
        inspectionTypeCode: run.catalogue.inspectionTypeCode,
      });

      const now = new Date();
      for (const input of steps) {
        const meta = resolved?.steps.find((s) => s.id === input.stepId);
        const refStep = run.catalogue.steps.find((s) => s.id === input.stepId);
        if (!refStep && !meta) continue;

        let withinLimit: boolean | null = null;
        let baselineFlag = false;
        if (input.measuredValue && meta) {
          const ev = evaluateMeasurement({
            measuredValue: input.measuredValue,
            limitText: meta.resolvedLimitText ?? meta.limitText,
            baselineValue: meta.baselineValue,
            comparedToBaseline: meta.comparedToBaseline,
          });
          withinLimit = ev.withinLimit;
          baselineFlag = ev.baselineFlag;
        }

        const writingValue =
          input.confirmed !== undefined || input.measuredValue !== undefined;

        await prisma.inspectionStepResult.upsert({
          where: { runId_stepId: { runId, stepId: input.stepId } },
          update: {
            confirmed: input.confirmed ?? null,
            measuredValue: input.measuredValue ?? null,
            withinLimit,
            baselineFlag,
            note: input.note ?? null,
            noPhotoReason: input.noPhotoReason ?? undefined,
            ...(writingValue ? { recordedAt: now } : {}),
          },
          create: {
            runId,
            stepId: input.stepId,
            confirmed: input.confirmed ?? null,
            measuredValue: input.measuredValue ?? null,
            withinLimit,
            baselineFlag,
            note: input.note ?? null,
            noPhotoReason: input.noPhotoReason ?? null,
            recordedAt: writingValue ? now : null,
          },
        });
      }
    });
  },

  async completeRun(
    ctx: ActingContext,
    runId: string,
    body: {
      result?: "passed" | "passed_with_conditions" | "failed" | "deviation";
      note?: string | null;
      idempotencyKey?: string;
      /** E90 — Prüfplakette */
      labelNumber?: string | null;
      labelNextDue?: string | null;
      captureMode?: "device_protocol" | "manual_measurement" | "visual" | null;
      protocolBlobId?: string | null;
    },
  ): Promise<InspectionRunDTO> {
    requirePermission(ctx, "inspections:perform");
    return withTenantStore(ctx, async () => {
      if (body.idempotencyKey) {
        const prior = await prisma.inspectionRun.findFirst({
          where: { idempotencyKey: body.idempotencyKey, tenantId: ctx.tenantId },
          include: {
            catalogue: { include: { steps: true } },
            serviceRequest: { select: { reference: true, serviceType: true } },
            stepResults: true,
          },
        });
        if (prior?.dutyPerformanceId) {
          if (isKRepRun(prior)) {
            await ensureKRepMaintenanceEvent(ctx, prior);
          }
          const device = await loadDevice(ctx.tenantId, prior.deviceInstanceId);
          const resolved = await resolveCatalogueForAssignment({
            tenantId: ctx.tenantId,
            deviceInstanceId: prior.deviceInstanceId,
            inspectionTypeCode: prior.catalogue.inspectionTypeCode,
          });
          const steps = await buildStepResults(prior.id, resolved);
          return toRunDto(
            prior,
            steps,
            {
              inventoryNumber: device.inventoryNumber,
              serialNumber: device.serialNumber,
              deviceLabel: device.model?.tradeName || device.model?.modelName || device.inventoryNumber,
            },
            prior.serviceRequest?.reference ?? prior.id,
          );
        }
      }

      const run = await prisma.inspectionRun.findFirst({
        where: { id: runId, tenantId: ctx.tenantId },
        include: {
          catalogue: { include: { steps: true } },
          serviceRequest: { include: { duty: true } },
          stepResults: true,
        },
      });
      if (!run) throw notFound("Inspection run not found.");
      if (run.dutyPerformanceId) throw unprocessable("Run already completed.");
      if (!run.deviceConfirmed && !run.deviceConfirmSkipped) {
        throw unprocessable("Device must be confirmed before completing.");
      }

      // D2 / D10 / D11 — visit required for on-site; send-in (E77) skips visit gate.
      const fulfilment = run.serviceRequest?.fulfilment ?? "on_site";
      const skipVisit = fulfilment === "send_in";
      const visitId = run.visitId ?? run.serviceRequest?.visitId ?? null;
      if (!visitId && !skipVisit) {
        throw unprocessable("Start the site visit before sealing the protocol.", {
          field: "visitId",
        });
      }
      const linkedVisit = visitId
        ? await prisma.serviceVisit.findFirst({
            where: { id: visitId },
            select: {
              startedAt: true,
              completedAt: true,
              institutionSignedAt: true,
              institutionSignerName: true,
            },
          })
        : null;
      if (!skipVisit && linkedVisit?.completedAt) {
        throw unprocessable(
          "This visit has ended. Resume it or start a second visit before sealing.",
          { field: "visitId" },
        );
      }
      const signatures = await prisma.inspectionSignature.findMany({
        where: { runId: run.id },
      });
      const failedSteps = run.stepResults.filter(
        (sr) => sr.withinLimit === false || sr.confirmed === false,
      );
      const failedWithEvidence = await Promise.all(
        failedSteps.map(async (sr) => ({
          id: sr.id,
          noPhotoReason: sr.noPhotoReason,
          photoCount: await prisma.inspectionStepAttachment.count({
            where: { resultId: sr.id },
          }),
        })),
      );
      const gate = assertLinkedVisitSealGates({
        visitStartedAt: linkedVisit?.startedAt ?? null,
        signatures,
        failedSteps: failedWithEvidence,
        skipVisit,
        visitInstitution: linkedVisit?.institutionSignedAt
          ? {
              signedAt: linkedVisit.institutionSignedAt,
              signerName: linkedVisit.institutionSignerName,
            }
          : null,
      });
      if (!gate.ok) {
        throw unprocessable(gate.message, { field: gate.field });
      }

      const inspType = await prisma.refInspectionType.findUnique({
        where: { code: run.catalogue.inspectionTypeCode },
        select: { requiresLabel: true, code: true },
      });
      const typeCode = (inspType?.code ?? run.catalogue.inspectionTypeCode).toLowerCase();
      const isConstancy =
        typeCode.includes("konstanz") ||
        typeCode.includes("constancy") ||
        typeCode === "radiation";
      const resultCode = body.result ?? "passed";
      const dutyForLabel = run.serviceRequest?.duty
        ? {
            deadlineAnchor: run.serviceRequest.duty.deadlineAnchor,
            referenceDate: run.serviceRequest.duty.referenceDate,
            intervalValue: run.serviceRequest.duty.intervalValue,
            intervalUnit: run.serviceRequest.duty.intervalUnit,
          }
        : null;
      const resolvedLabel = await resolveInspectionLabel({
        tenantId: ctx.tenantId,
        requiresLabel: Boolean(inspType?.requiresLabel),
        result: resultCode,
        labelNumber: body.labelNumber,
        labelNextDue: body.labelNextDue,
        duty: dutyForLabel,
        performedAt: run.performedAt,
      });
      const labelGate = assertLabelRequired({
        requiresLabel: Boolean(inspType?.requiresLabel),
        result: resultCode,
        labelNumber: resolvedLabel.labelNumber,
        labelNextDue: resolvedLabel.labelNextDue,
        isConstancy,
      });
      if (!labelGate.ok) {
        throw unprocessable(labelGate.message, { field: labelGate.field });
      }

      // A6/A7 — K-REP repair report gates before seal; MaintenanceEvent after seal.
      let kRepComplete: Parameters<typeof completeRepairFromRun>[1] | null = null;
      if (isKRepRun(run)) {
        const tenant = await prisma.tenant.findUnique({
          where: { id: ctx.tenantId },
          select: { featureFlags: true },
        });
        requireRepairsEnabled(tenant?.featureFlags);

        const derived = deriveRepairCompleteFromKRepSteps({
          inspectionRunId: run.id,
          steps: run.catalogue.steps,
          stepResults: run.stepResults,
        });
        if (!derived) {
          throw unprocessable("K-REP Maßnahme (action) is required before sealing.", {
            field: "action",
          });
        }

        const partsStep = run.catalogue.steps.find((s) => s.inputKind === "parts");
        const partsResult = partsStep
          ? run.stepResults.find((r) => r.stepId === partsStep.id)
          : null;
        const partsPhotoCount = partsResult
          ? await prisma.inspectionStepAttachment.count({
              where: { resultId: partsResult.id },
            })
          : 0;

        const repairGate = assertRepairReportGates(
          repairGateInputFromDerived(derived, {
            photoCount: partsPhotoCount,
            noPhotoReason: partsResult?.noPhotoReason,
          }),
        );
        if (!repairGate.ok) {
          throw unprocessable(repairGate.message, { field: repairGate.field });
        }
        kRepComplete = { inspectionRunId: run.id, ...derived };
      }

      if (run.catalogue.traceabilityRequired && run.testEquipmentId) {
        const orgForGate =
          ctx.user.accountKind === "partner" ? ctx.user.organisationId : "";
        const equipGate = await checkTestEquipmentGate({
          organisationId: orgForGate,
          testEquipmentClass: run.catalogue.testEquipmentClass,
          testEquipmentId: run.testEquipmentId,
          performanceDate: run.performedAt,
          traceabilityRequired: true,
        });
        if (!equipGate.ok) {
          throw unprocessable(
            equipGate.blockedReason === "traceability_missing"
              ? "Traceability reference required for this catalogue."
              : (equipGate.blockedReason ?? "Test equipment gate failed."),
          );
        }
      }

      const result = resultCode;
      const orgId =
        ctx.user.accountKind === "partner" ? ctx.user.organisationId : null;
      const labelNextDueRaw = resolvedLabel.labelNextDue?.trim() || null;
      const labelNextDue = labelNextDueRaw
        ? new Date(
            labelNextDueRaw.length === 7
              ? `${labelNextDueRaw}-01T00:00:00.000Z`
              : labelNextDueRaw.includes("-")
                ? `${labelNextDueRaw.slice(0, 10)}T00:00:00.000Z`
                : labelNextDueRaw,
          )
        : null;

      await prisma.$transaction(async (tx) => {
        if (run.catalogue.setsBaseline) {
          const baselineEntries = run.stepResults
            .filter((sr) => sr.measuredValue)
            .map((sr) => {
              const step = run.catalogue.steps.find((s) => s.id === sr.stepId);
              return {
                measureKey: step?.label ?? sr.stepId,
                value: sr.measuredValue!,
                unit: step?.unit ?? null,
              };
            });
          for (const entry of baselineEntries) {
            await tx.baselineMeasurement.updateMany({
              where: {
                tenantId: ctx.tenantId,
                deviceInstanceId: run.deviceInstanceId,
                measureKey: entry.measureKey,
                validTo: null,
              },
              data: { validTo: new Date() },
            });
            await tx.baselineMeasurement.create({
              data: {
                tenantId: ctx.tenantId,
                deviceInstanceId: run.deviceInstanceId,
                measureKey: entry.measureKey,
                value: entry.value,
                unit: entry.unit,
                runId: run.id,
                recordedBy: ctx.user.name,
              },
            });
          }
        }

        let dutyPerformanceId: string | null = null;
        const duty = run.serviceRequest?.duty;
        if (duty) {
          const completion = await recordDutyCompletion(tx, {
            tenantId: ctx.tenantId,
            duty: {
              id: duty.id,
              deviceInstanceId: duty.deviceInstanceId,
              dutyKey: duty.dutyKey,
              title: duty.title,
              deadlineAnchor: duty.deadlineAnchor,
              referenceDate: duty.referenceDate,
              intervalValue: duty.intervalValue,
              intervalUnit: duty.intervalUnit,
              dueAt: duty.dueAt,
              inspectionTypeCode: duty.inspectionTypeCode,
            },
            performedAt: run.performedAt,
            performedBy: run.performedByName,
            actorUserId: ctx.user.id,
            note: body.note ?? run.note,
            source: "inspection_run",
            serviceRequestId: run.serviceRequestId,
            result: result === "deviation" ? "deviation" : result,
            unitEventSuffix: orgId ? `org ${orgId}` : null,
            labelNumber: result === "failed" ? null : resolvedLabel.labelNumber,
            labelNextDue: result === "failed" ? null : labelNextDue,
          });
          dutyPerformanceId = completion.dutyPerformanceId;
        }

        // D4 — failed seal locks the device (not for constancy: A44 — Betreiber decides).
        if (result === "failed" && !isConstancy) {
          await tx.deviceInstance.update({
            where: { id: run.deviceInstanceId },
            data: {
              lockedAt: new Date(),
              lockReason: body.note?.trim() || "Sealed inspection failed",
              lockedByRunId: run.id,
            },
          });
        }

        await tx.inspectionRun.update({
          where: { id: runId },
          data: {
            result,
            note: body.note ?? run.note,
            idempotencyKey: body.idempotencyKey ?? null,
            dutyPerformanceId,
            completedAt: new Date(),
            startedAt: run.startedAt ?? new Date(),
            captureMode: body.captureMode ?? undefined,
            protocolBlobId: body.protocolBlobId ?? undefined,
          },
        });

        if (run.serviceRequestId) {
          const current = await tx.serviceRequest.findFirst({
            where: { id: run.serviceRequestId },
            select: { state: true, subjectType: true },
          });
          if (current && current.state !== "completed") {
            const resultLabel =
              result === "passed"
                ? "Freigegeben"
                : result === "passed_with_conditions"
                  ? "Mit Auflage freigegeben"
                  : result === "failed"
                    ? "Gesperrt"
                    : result;

            // RD26 — mark Sammelauftrag item done; complete order only when all items finish.
            let completeRequest = current.subjectType !== "group";
            if (current.subjectType === "group") {
              const item = await tx.serviceRequestItem.findFirst({
                where: {
                  serviceRequestId: run.serviceRequestId,
                  deviceInstanceId: run.deviceInstanceId,
                },
              });
              if (item) {
                await tx.serviceRequestItem.update({
                  where: { id: item.id },
                  data: { status: "done", inspectionRunId: runId },
                });
              }
              const remaining = await tx.serviceRequestItem.count({
                where: {
                  serviceRequestId: run.serviceRequestId,
                  status: "open",
                },
              });
              completeRequest = remaining === 0;
            }

            if (completeRequest) {
              await tx.statusEvent.create({
                data: {
                  tenantId: ctx.tenantId,
                  serviceRequestId: run.serviceRequestId,
                  state: "completed",
                  source: "inspection_run",
                  actor: ctx.user.name,
                  note: [
                    `Protocol sealed (${run.catalogue.code}) — ${resultLabel}`,
                    body.note?.trim() || null,
                  ]
                    .filter(Boolean)
                    .join(": "),
                },
              });
              await tx.serviceRequest.update({
                where: { id: run.serviceRequestId },
                data: { state: "completed" },
              });
            } else {
              await tx.statusEvent.create({
                data: {
                  tenantId: ctx.tenantId,
                  serviceRequestId: run.serviceRequestId,
                  state: "in_progress",
                  source: "inspection_run",
                  actor: ctx.user.name,
                  note: [
                    `Sammelauftrag item sealed (${run.catalogue.code}) — ${resultLabel}`,
                    body.note?.trim() || null,
                  ]
                    .filter(Boolean)
                    .join(": "),
                },
              });
            }
          }
        }
      });

      // E106 — render the sealed report outside the seal tx; failure leaves reportBlobId null
      // and POST /api/jobs/reports fills it later (never fails the seal).
      await inspectionReportService.enqueueOrRenderAfterSeal(runId);

      if (kRepComplete) {
        await completeRepairFromRun(ctx, kRepComplete);
      }

      // End the linked site visit after a successful seal (resume remains available for more jobs).
      if (visitId && !skipVisit && linkedVisit && !linkedVisit.completedAt) {
        try {
          const endedAt = new Date();
          const runs = await prisma.inspectionRun.findMany({
            where: { visitId, tenantId: ctx.tenantId },
            select: { startedAt: true, completedAt: true, performedAt: true },
          });
          const firstStep =
            runs
              .map((r) => r.startedAt ?? r.performedAt)
              .filter((d): d is Date => Boolean(d))
              .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
          const lastStep =
            runs
              .map((r) => r.completedAt)
              .filter((d): d is Date => Boolean(d))
              .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
          const vor = firstStep
            ? Math.max(0, Math.round((firstStep.getTime() - linkedVisit.startedAt!.getTime()) / 60_000))
            : Math.max(0, Math.round((endedAt.getTime() - linkedVisit.startedAt!.getTime()) / 60_000));
          const nach = lastStep
            ? Math.max(0, Math.round((endedAt.getTime() - lastStep.getTime()) / 60_000))
            : 0;
          await prisma.serviceVisit.update({
            where: { id: visitId },
            data: { completedAt: endedAt, setupMinutes: vor + nach },
          });
        } catch {
          /* seal already committed — visit end is best-effort */
        }
      }

      return this.getRun(ctx, runId);
    });
  },

  async listTestEquipment(ctx: PartnerContext, classCode?: string) {
    return listEligibleEquipment({
      organisationId: ctx.organisationId,
      classCode: classCode ?? null,
    });
  },
};

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
  if (req.subjectType !== "instance") {
    throw unprocessable("Inspection runs require a device instance assignment.");
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

async function loadDevice(tenantId: string, instanceId: string) {
  const device = await prisma.deviceInstance.findFirst({
    where: { id: instanceId, tenantId },
    include: {
      model: { select: { tradeName: true, modelName: true, manufacturer: true } },
      area: { select: { name: true } },
    },
  });
  if (!device) throw notFound("Device not found.");
  return device;
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
  performedByName: string;
  result: string;
  note: string | null;
  dutyPerformanceId: string | null;
  idempotencyKey: string | null;
  testEquipmentId: string | null;
};

function toRunDto(
  run: RunWithCatalogue,
  steps: ResolvedStepWithResult[],
  deviceMeta: { inventoryNumber: string; serialNumber: string | null; deviceLabel: string },
  reference: string,
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
    sealed: Boolean(run.dutyPerformanceId),
  };
}

type ResolvedStepWithResult = InspectionStepResultDTO;

async function buildStepResults(runId: string, resolved: Awaited<ReturnType<typeof resolveCatalogueForAssignment>>) {
  if (!resolved) return [];
  const existing = await prisma.inspectionStepResult.findMany({ where: { runId } });
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
      };
    });
}

export const inspectionRunService = {
  async resolvePreview(ctx: ActingContext, reference: string): Promise<CataloguePreviewDTO> {
    requirePermission(ctx, "inspections:perform", "inspections:view");
    return withTenantStore(ctx, async () => {
      const req = await loadAssignment(reference, ctx.tenantId);
      const device = await loadDevice(ctx.tenantId, req.subjectId);
      const duty = req.duty;
      const inspectionTypeCode = duty?.inspectionTypeCode ?? "STK";

      const resolved = await resolveCatalogueForAssignment({
        tenantId: ctx.tenantId,
        deviceInstanceId: req.subjectId,
        inspectionTypeCode,
        constancyObjectCode: duty?.constancyObjectCode,
      });

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
          dutyPerformanceId: null,
        },
        orderBy: { performedAt: "desc" },
      });

      const sealedRun = await prisma.inspectionRun.findFirst({
        where: {
          serviceRequestId: req.id,
          dutyPerformanceId: { not: null },
        },
        orderBy: { performedAt: "desc" },
        select: { id: true },
      });
      const assignmentCompleted =
        req.state === "completed" || req.state === "rejected" || Boolean(sealedRun);

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
            })),
          }
        : null;

      const dueAt = isoDate(duty?.dueAt);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const overdue = Boolean(
        dueAt && new Date(`${dueAt}T00:00:00`) < today && !sealedRun,
      );
      const locParts = [device.area?.name, device.room].filter(Boolean);

      return {
        reference,
        tenantId: ctx.tenantId,
        deviceInstanceId: req.subjectId,
        inventoryNumber: device.inventoryNumber,
        serialNumber: device.serialNumber,
        deviceLabel: device.model?.tradeName || device.model?.modelName || req.locationText,
        modelName: device.model?.modelName ?? device.model?.tradeName ?? null,
        manufacturer: device.model?.manufacturer ?? null,
        locationText: locParts.length > 0 ? locParts.join(" · ") : req.locationText || "—",
        accessHint: req.accessHint,
        overdue,
        serviceType: req.serviceType,
        dueAt,
        inspectionTypeCode,
        sealed: assignmentCompleted,
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
      };
    });
  },

  async startRun(
    ctx: ActingContext,
    body: {
      reference: string;
      occasionCode?: string | null;
      testEquipmentId?: string | null;
      performedAt?: string;
    },
  ): Promise<InspectionRunDTO> {
    requirePermission(ctx, "inspections:perform");
    return withTenantStore(ctx, async () => {
      const req = await loadAssignment(body.reference, ctx.tenantId);
      if (req.assigneeUserId !== ctx.user.id && ctx.user.appRole !== "admin") {
        throw forbidden();
      }
      if (req.state === "completed" || req.state === "rejected") {
        throw unprocessable("This assignment is already completed and cannot be started again.");
      }
      const priorSealed = await prisma.inspectionRun.findFirst({
        where: { serviceRequestId: req.id, dutyPerformanceId: { not: null } },
        select: { id: true },
      });
      if (priorSealed) {
        throw unprocessable("A sealed protocol already exists for this assignment.");
      }

      const device = await loadDevice(ctx.tenantId, req.subjectId);
      const duty = req.duty;
      const inspectionTypeCode = duty?.inspectionTypeCode ?? "STK";

      const resolved = await resolveCatalogueForAssignment({
        tenantId: ctx.tenantId,
        deviceInstanceId: req.subjectId,
        inspectionTypeCode,
        constancyObjectCode: duty?.constancyObjectCode,
      });
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

      const classification = await prisma.deviceModelClassification.findFirst({
        where: { deviceModelId: device.modelId ?? undefined, validTo: null },
        select: { appliedPartCode: true },
      });

      let run = await prisma.inspectionRun.findFirst({
        where: { serviceRequestId: req.id, dutyPerformanceId: null },
        include: { catalogue: true },
      });

      if (!run) {
        run = await prisma.inspectionRun.create({
          data: {
            tenantId: ctx.tenantId,
            deviceInstanceId: req.subjectId,
            catalogueId: resolved.catalogueId,
            deviceDutyId: duty?.id ?? null,
            serviceRequestId: req.id,
            occasionCode: body.occasionCode ?? null,
            performedAt: performanceDate,
            performedByUserId: ctx.user.id,
            performedByName: ctx.user.name,
            organisationId: ctx.user.accountKind === "partner" ? ctx.user.organisationId : null,
            testEquipmentId: body.testEquipmentId ?? null,
            appliedPartCode: classification?.appliedPartCode ?? null,
          },
          include: { catalogue: true },
        });
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
      return toRunDto(run, steps, {
        inventoryNumber: device.inventoryNumber,
        serialNumber: device.serialNumber,
        deviceLabel: device.model?.tradeName || device.model?.modelName || req.locationText,
      }, body.reference);
    });
  },

  async getRun(ctx: ActingContext, runId: string): Promise<InspectionRunDTO> {
    requirePermission(ctx, "inspections:perform", "inspections:view");
    return withTenantStore(ctx, async () => {
      const run = await prisma.inspectionRun.findFirst({
        where: { id: runId, tenantId: ctx.tenantId },
        include: { catalogue: true, serviceRequest: { select: { reference: true } } },
      });
      if (!run) throw notFound("Inspection run not found.");

      const device = await loadDevice(ctx.tenantId, run.deviceInstanceId);
      const resolved = await resolveCatalogueForAssignment({
        tenantId: ctx.tenantId,
        deviceInstanceId: run.deviceInstanceId,
        inspectionTypeCode: run.catalogue.inspectionTypeCode,
      });
      const steps = await buildStepResults(run.id, resolved);
      return toRunDto(
        run,
        steps,
        {
          inventoryNumber: device.inventoryNumber,
          serialNumber: device.serialNumber,
          deviceLabel: device.model?.tradeName || device.model?.modelName || device.inventoryNumber,
        },
        run.serviceRequest?.reference ?? run.id,
      );
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
    steps: { stepId: string; confirmed?: boolean | null; measuredValue?: string | null; note?: string | null }[],
  ): Promise<void> {
    requirePermission(ctx, "inspections:perform");
    await withTenantStore(ctx, async () => {
      const run = await prisma.inspectionRun.findFirst({
        where: { id: runId, tenantId: ctx.tenantId },
        include: { catalogue: { include: { steps: true } } },
      });
      if (!run) throw notFound("Inspection run not found.");
      if (run.dutyPerformanceId) throw unprocessable("Run already completed.");

      const resolved = await resolveCatalogueForAssignment({
        tenantId: ctx.tenantId,
        deviceInstanceId: run.deviceInstanceId,
        inspectionTypeCode: run.catalogue.inspectionTypeCode,
      });

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

        await prisma.inspectionStepResult.upsert({
          where: { runId_stepId: { runId, stepId: input.stepId } },
          update: {
            confirmed: input.confirmed ?? null,
            measuredValue: input.measuredValue ?? null,
            withinLimit,
            baselineFlag,
            note: input.note ?? null,
          },
          create: {
            runId,
            stepId: input.stepId,
            confirmed: input.confirmed ?? null,
            measuredValue: input.measuredValue ?? null,
            withinLimit,
            baselineFlag,
            note: input.note ?? null,
          },
        });
      }
    });
  },

  async completeRun(
    ctx: ActingContext,
    runId: string,
    body: {
      result?: "passed" | "passed_with_conditions" | "failed";
      note?: string | null;
      idempotencyKey?: string;
    },
  ): Promise<InspectionRunDTO> {
    requirePermission(ctx, "inspections:perform");
    return withTenantStore(ctx, async () => {
      if (body.idempotencyKey) {
        const prior = await prisma.inspectionRun.findFirst({
          where: { idempotencyKey: body.idempotencyKey, tenantId: ctx.tenantId },
          include: { catalogue: true, serviceRequest: { select: { reference: true } } },
        });
        if (prior?.dutyPerformanceId) {
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

      const result = body.result ?? "passed";
      const orgId =
        ctx.user.accountKind === "partner" ? ctx.user.organisationId : null;

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
            result,
            unitEventSuffix: orgId ? `org ${orgId}` : null,
          });
          dutyPerformanceId = completion.dutyPerformanceId;
        }

        await tx.inspectionRun.update({
          where: { id: runId },
          data: {
            result,
            note: body.note ?? run.note,
            idempotencyKey: body.idempotencyKey ?? null,
            dutyPerformanceId,
          },
        });

        if (run.serviceRequestId) {
          const current = await tx.serviceRequest.findFirst({
            where: { id: run.serviceRequestId },
            select: { state: true },
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
          }
        }
      });

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

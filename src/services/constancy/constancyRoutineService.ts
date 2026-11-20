/**
 * E87 / R34–R35 — clinic constancy routine capture + deviation clarification (no auto-lock).
 */
import type { TenantWorkContext } from "@/interfaces";
import { actorFromContext } from "@/lib/auth/actorContext";
import { requirePermission } from "@/lib/auth/tenantContext";
import { notFound, unprocessable } from "@/lib/errors";
import { requireRadiationDguvEnabled } from "@/lib/features/radiationDguv";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/services/audit/auditService";
import { computeDutyDueAt } from "@/services/registration/dueDate";
import { transitionOperationalState } from "@/services/repairs/operationalStateService";
import type {
  ConstancyRoutineCompleteInput,
  ResolveConstancyDeviationInput,
} from "@/schemas/k10";
import {
  referenceRowsFromJson,
  visualCheckpointsFor,
} from "@/lib/constancy/captureDefaults";

async function requireFlag(ctx: TenantWorkContext) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { featureFlags: true },
  });
  requireRadiationDguvEnabled(tenant?.featureFlags);
}

function addYears(d: Date, years: number): Date {
  const out = new Date(d);
  out.setUTCFullYear(out.getUTCFullYear() + years);
  return out;
}

type RefRow = {
  name: string;
  value: number;
  unit: string;
  tolerancePct?: number | null;
  toleranceAbs?: number | null;
};

function withinTolerance(measured: number, ref: RefRow): boolean {
  if (ref.toleranceAbs != null) return Math.abs(measured - ref.value) <= ref.toleranceAbs;
  if (ref.tolerancePct != null) {
    return Math.abs(measured - ref.value) <= (Math.abs(ref.value) * ref.tolerancePct) / 100;
  }
  return measured === ref.value;
}

export type DueKonstanzRoutineRow = {
  id: string;
  dueAt: string;
  inventoryNumber: string;
  deviceLabel: string | null;
  constancyObjectCode: string | null;
  constancyObjectLabel: string | null;
  /** due_today / overdue = actionable now; upcoming = takt set, due in the future */
  status: "due_today" | "overdue" | "upcoming";
  openClarificationId: string | null;
  lastPerformedAt: string | null;
  lastPerformedBy: string | null;
  lastResult: string | null;
  cadence: {
    captureMode: "device_protocol" | "manual_measurement" | "visual";
    protocolSource: string | null;
    referenceValuesJson: RefRow[] | null;
    visualCheckpoints: string[];
    intervalValue: number;
    intervalUnit: string;
    basisText: string;
  };
};

export type MissingTaktRoutineRow = {
  dutyId: string;
  deviceInstanceId: string;
  inventoryNumber: string;
  deviceLabel: string | null;
  constancyObjectCode: string;
  constancyObjectLabel: string | null;
  defaultCadence: string | null;
};

export type ConstancyRoutineRecordRow = {
  id: string;
  performedAt: string;
  inventoryNumber: string;
  constancyObjectCode: string | null;
  constancyObjectLabel: string | null;
  captureMode: "device_protocol" | "manual_measurement" | "visual" | null;
  result: string;
  performedBy: string;
  retentionUntil: string | null;
  attachmentBlobId: string | null;
  measurementsJson: unknown;
  clarificationId: string | null;
};

export type ConstancyRoutineBoard = {
  duties: DueKonstanzRoutineRow[];
  missingTakt: MissingTaktRoutineRow[];
  records: ConstancyRoutineRecordRow[];
  kpi: {
    dueToday: number;
    overdue: number;
    openClarifications: number;
    records: number;
  };
};

function startOfTodayUtc(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

function deviceLabelOf(model?: {
  tradeName: string | null;
  modelName: string | null;
} | null): string | null {
  if (!model) return null;
  return model.tradeName || model.modelName || null;
}

function mapCaptureMode(
  mode: string | null | undefined,
): "device_protocol" | "manual_measurement" | "visual" {
  if (mode === "manual_measurement" || mode === "visual") return mode;
  return "device_protocol";
}

export const constancyRoutineService = {
  async listDue(ctx: TenantWorkContext): Promise<DueKonstanzRoutineRow[]> {
    const board = await this.listBoard(ctx);
    return board.duties.filter((d) => d.status === "due_today" || d.status === "overdue");
  },

  async listBoard(ctx: TenantWorkContext): Promise<ConstancyRoutineBoard> {
    requirePermission(ctx, "duties:view");
    await requireFlag(ctx);

    const today = startOfTodayUtc();
    const todayDay = today.toISOString().slice(0, 10);

    const [allDuties, openClarifications, recordCount, recent] = await Promise.all([
      prisma.deviceDuty.findMany({
        where: {
          tenantId: ctx.tenantId,
          dutyKey: "konstanz",
          applicable: true,
          suspendedAt: null,
          constancyObjectCode: { not: null },
          deviceInstance: { state: { not: "retired" } },
        },
        include: {
          deviceInstance: {
            select: {
              inventoryNumber: true,
              model: { select: { tradeName: true, modelName: true } },
            },
          },
          constancyObject: { select: { label: true, defaultCadence: true } },
          performances: {
            orderBy: { performedAt: "desc" },
            take: 1,
            select: {
              performedAt: true,
              performedBy: true,
              result: true,
              clarificationId: true,
            },
          },
        },
        orderBy: [{ dueAt: "asc" }, { title: "asc" }],
        take: 500,
      }),
      prisma.deviceClarification.count({
        where: {
          tenantId: ctx.tenantId,
          kind: "constancy_deviation",
          resolvedAt: null,
        },
      }),
      prisma.dutyPerformance.count({
        where: {
          tenantId: ctx.tenantId,
          OR: [{ source: "routine" }, { captureMode: { not: null } }],
          deviceDuty: { dutyKey: "konstanz" },
        },
      }),
      prisma.dutyPerformance.findMany({
        where: {
          tenantId: ctx.tenantId,
          deviceDuty: { dutyKey: "konstanz" },
          OR: [{ source: "routine" }, { captureMode: { not: null } }, { source: "scan" }],
        },
        include: {
          deviceDuty: {
            select: {
              constancyObjectCode: true,
              constancyObject: { select: { label: true } },
              deviceInstance: { select: { inventoryNumber: true } },
            },
          },
        },
        orderBy: [{ performedAt: "desc" }, { recordedAt: "desc" }],
        take: 40,
      }),
    ]);

    const deviceIds = [...new Set(allDuties.map((d) => d.deviceInstanceId))];
    const cadences =
      deviceIds.length === 0
        ? []
        : await prisma.constancyCadence.findMany({
            where: {
              tenantId: ctx.tenantId,
              validTo: null,
              deviceInstanceId: { in: deviceIds },
            },
          });
    const cadenceByKey = new Map(
      cadences.map((c) => [`${c.deviceInstanceId}:${c.constancyObjectCode}`, c]),
    );

    const openClarByDevice = await prisma.deviceClarification.findMany({
      where: {
        tenantId: ctx.tenantId,
        kind: "constancy_deviation",
        resolvedAt: null,
        deviceInstanceId: { in: deviceIds },
      },
      select: { id: true, deviceInstanceId: true },
    });
    const clarByDevice = new Map(openClarByDevice.map((c) => [c.deviceInstanceId, c.id]));

    const duties: DueKonstanzRoutineRow[] = [];
    const missingTakt: MissingTaktRoutineRow[] = [];
    let dueToday = 0;
    let overdue = 0;

    for (const duty of allDuties) {
      const code = duty.constancyObjectCode!;
      const cadence = cadenceByKey.get(`${duty.deviceInstanceId}:${code}`);
      if (!cadence) {
        missingTakt.push({
          dutyId: duty.id,
          deviceInstanceId: duty.deviceInstanceId,
          inventoryNumber: duty.deviceInstance.inventoryNumber,
          deviceLabel: deviceLabelOf(duty.deviceInstance.model),
          constancyObjectCode: code,
          constancyObjectLabel: duty.constancyObject?.label ?? null,
          defaultCadence: duty.constancyObject?.defaultCadence ?? null,
        });
        continue;
      }
      // Cadence set but dueAt not projected yet — still list under upcoming with empty date
      const dueDay = duty.dueAt ? duty.dueAt.toISOString().slice(0, 10) : todayDay;
      let status: DueKonstanzRoutineRow["status"] = "upcoming";
      if (duty.dueAt) {
        if (dueDay < todayDay) status = "overdue";
        else if (dueDay === todayDay) status = "due_today";
        else status = "upcoming";
      }
      if (status === "overdue") overdue += 1;
      else if (status === "due_today") dueToday += 1;

      const last = duty.performances[0] ?? null;
      duties.push({
        id: duty.id,
        dueAt: dueDay,
        inventoryNumber: duty.deviceInstance.inventoryNumber,
        deviceLabel: deviceLabelOf(duty.deviceInstance.model),
        constancyObjectCode: duty.constancyObjectCode,
        constancyObjectLabel: duty.constancyObject?.label ?? null,
        status,
        openClarificationId: clarByDevice.get(duty.deviceInstanceId) ?? null,
        lastPerformedAt: last ? last.performedAt.toISOString().slice(0, 10) : null,
        lastPerformedBy: last?.performedBy ?? null,
        lastResult: last?.result ?? null,
        cadence: {
          captureMode: mapCaptureMode(cadence.captureMode),
          protocolSource: cadence.protocolSource,
          referenceValuesJson: referenceRowsFromJson(cadence.referenceValuesJson),
          visualCheckpoints: visualCheckpointsFor(
            duty.constancyObjectCode,
            cadence.referenceValuesJson,
          ),
          intervalValue: cadence.intervalValue,
          intervalUnit: cadence.intervalUnit,
          basisText: cadence.basisText,
        },
      });
    }

    duties.sort((a, b) => {
      const rank = (s: DueKonstanzRoutineRow["status"]) =>
        s === "overdue" ? 0 : s === "due_today" ? 1 : 2;
      const r = rank(a.status) - rank(b.status);
      if (r !== 0) return r;
      return a.dueAt.localeCompare(b.dueAt);
    });

    const records: ConstancyRoutineRecordRow[] = recent.map((row) => ({
      id: row.id,
      performedAt: row.performedAt.toISOString().slice(0, 10),
      inventoryNumber: row.deviceDuty.deviceInstance.inventoryNumber,
      constancyObjectCode: row.deviceDuty.constancyObjectCode,
      constancyObjectLabel: row.deviceDuty.constancyObject?.label ?? null,
      captureMode: row.captureMode ? mapCaptureMode(row.captureMode) : null,
      result: row.result,
      performedBy: row.performedBy,
      retentionUntil: row.retentionUntil
        ? row.retentionUntil.toISOString().slice(0, 10)
        : null,
      attachmentBlobId: row.attachmentBlobId,
      measurementsJson: row.measurementsJson ?? null,
      clarificationId: row.clarificationId,
    }));

    return {
      duties,
      missingTakt,
      records,
      kpi: {
        dueToday,
        overdue,
        openClarifications,
        records: recordCount,
      },
    };
  },

  async complete(ctx: TenantWorkContext, input: ConstancyRoutineCompleteInput) {
    requirePermission(ctx, "inventory:update");
    await requireFlag(ctx);

    const duty = await prisma.deviceDuty.findFirst({
      where: { id: input.dutyId, tenantId: ctx.tenantId, dutyKey: "konstanz" },
    });
    if (!duty) throw notFound("Constancy duty not found");
    if (!duty.applicable || duty.suspendedAt) {
      throw unprocessable("Duty is not active");
    }

    const cadence = await prisma.constancyCadence.findFirst({
      where: {
        deviceInstanceId: duty.deviceInstanceId,
        constancyObjectCode: duty.constancyObjectCode ?? undefined,
        validTo: null,
      },
    });
    if (!cadence) throw unprocessable("No open constancy cadence for this duty");

    const mode = input.captureMode;
    if (mode !== cadence.captureMode) {
      // Allow override only when explicitly sent; prefer cadence mode when mismatch is accidental
    }

    let result = input.result;

    if (mode === "device_protocol") {
      if (cadence.protocolSource && !input.attachmentBlobId) {
        throw unprocessable("Protocol attachment required when protocolSource is set", {
          field: "attachmentBlobId",
        });
      }
      if (result !== "passed" && result !== "failed") {
        throw unprocessable("Mode A result must be passed or failed", { field: "result" });
      }
    }

    if (mode === "manual_measurement") {
      const refs = referenceRowsFromJson(cadence.referenceValuesJson);
      if (!refs.length) {
        throw unprocessable("Cadence has no referenceValuesJson for mode B");
      }
      const measurements = input.measurements ?? [];
      if (measurements.length < refs.length) {
        throw unprocessable("Every reference row needs a measurement", { field: "measurements" });
      }
      let anyOut = false;
      const evaluated = refs.map((ref) => {
        const m = measurements.find((x) => x.name === ref.name) ?? measurements[refs.indexOf(ref)];
        const ok = withinTolerance(m.value, ref);
        if (!ok) anyOut = true;
        return { name: ref.name, value: m.value, unit: m.unit || ref.unit, withinLimit: ok };
      });
      if (anyOut) result = "deviation";
      if (result === "passed" && anyOut) {
        throw unprocessable("Cannot pass with out-of-tolerance measurement", { field: "result" });
      }
      input = { ...input, measurements: evaluated };
    }

    if (mode === "visual") {
      const points = input.visualFindings ?? [];
      for (const p of points) {
        if (!p.ok && !p.finding?.trim()) {
          throw unprocessable("Finding text required for unchecked visual points", {
            field: "visualFindings",
          });
        }
      }
      if (points.some((p) => !p.ok) && result === "passed") {
        throw unprocessable("Cannot pass with failed visual points", { field: "result" });
      }
    }

    const performedAt = input.performedAt
      ? new Date(`${input.performedAt}T00:00:00.000Z`)
      : new Date();
    const retentionUntil = addYears(performedAt, 10);
    const actor = actorFromContext(ctx);

    const nextDue = computeDutyDueAt({
      deadlineAnchor: duty.deadlineAnchor,
      referenceDate: duty.referenceDate,
      lastCompletedAt: performedAt,
      intervalValue: cadence.intervalValue,
      intervalUnit: cadence.intervalUnit,
    });

    const out = await prisma.$transaction(async (tx) => {
      let clarificationId: string | null = null;
      if (result === "failed" || result === "deviation") {
        const clar = await tx.deviceClarification.create({
          data: {
            tenantId: ctx.tenantId,
            deviceInstanceId: duty.deviceInstanceId,
            kind: "constancy_deviation",
            label: "Konstanzprüfung — Abweichung / nicht bestanden",
            deferredBy: actor.actorName || ctx.user.id,
            deferredAt: performedAt,
          },
        });
        clarificationId = clar.id;
      }

      const perf = await tx.dutyPerformance.create({
        data: {
          tenantId: ctx.tenantId,
          deviceDutyId: duty.id,
          performedAt,
          result,
          note: input.note?.trim() || null,
          performedBy: ctx.user.name,
          performedByUserId: ctx.user.id,
          source: "routine",
          captureMode: mode,
          attachmentBlobId: input.attachmentBlobId ?? null,
          clarificationId,
          retentionUntil,
          measurementsJson: input.measurements ?? input.visualFindings ?? undefined,
        },
      });

      await tx.deviceDuty.update({
        where: { id: duty.id },
        data: {
          lastCompletedAt: performedAt,
          dueAt: nextDue,
          notifyStage: null,
          lastNotifiedAt: null,
        },
      });

      return { perf, clarificationId };
    });

    await recordAudit({
      actor,
      resource: "DutyPerformance",
      resourceId: out.perf.id,
      action: "constancy_routine",
      summary: `Konstanz routine ${mode} → ${result}`,
    });

    return {
      performanceId: out.perf.id,
      result,
      clarificationId: out.clarificationId,
      retentionUntil: retentionUntil.toISOString().slice(0, 10),
      dueAt: nextDue?.toISOString() ?? null,
      locked: false,
    };
  },

  async resolveDeviation(
    ctx: TenantWorkContext,
    clarificationId: string,
    input: ResolveConstancyDeviationInput,
  ) {
    requirePermission(ctx, "requests:approve");
    await requireFlag(ctx);

    const clar = await prisma.deviceClarification.findFirst({
      where: { id: clarificationId, kind: "constancy_deviation" },
    });
    if (!clar) throw notFound("Clarification not found");
    if (clar.resolvedAt) throw unprocessable("Already resolved");

    if (input.action === "continue" && !input.reason?.trim()) {
      throw unprocessable("Reason required to continue operation", { field: "reason" });
    }

    const actor = actorFromContext(ctx);
    const now = new Date();

    if (input.action === "lock") {
      await transitionOperationalState(ctx, {
        deviceInstanceId: clar.deviceInstanceId,
        to: "locked",
        lockSource: "rso",
        note: input.note?.trim() || "Konstanzprüfung nicht bestanden — Sperre durch SSB/MPSB",
      });
      await prisma.deviceBookEntry.create({
        data: {
          tenantId: ctx.tenantId,
          deviceInstanceId: clar.deviceInstanceId,
          kind: "note",
          occurredAt: now,
          description:
            input.note?.trim() ||
            "Konstanzprüfung nicht bestanden — Gerät gesperrt (Strahlenschutz)",
          recordedBy: actor.actorName || ctx.user.id,
        },
      });
    }

    await prisma.deviceClarification.update({
      where: { id: clarificationId },
      data: {
        resolvedAt: now,
        resolvedBy: ctx.user.id,
        resolutionNote:
          input.action === "lock"
            ? input.note?.trim() || "locked"
            : input.reason!.trim(),
      },
    });

    await recordAudit({
      actor,
      resource: "DeviceClarification",
      resourceId: clarificationId,
      action: input.action === "lock" ? "constancy_lock" : "constancy_continue",
      summary:
        input.action === "lock"
          ? "Constancy deviation → lock (rso)"
          : `Constancy deviation → continue (${input.reason})`,
    });

    return { ok: true as const, action: input.action };
  },
};

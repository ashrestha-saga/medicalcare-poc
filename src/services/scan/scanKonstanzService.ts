import type {
  ScanKonstanzItemDTO,
  ScanKonstanzOpenDTO,
  ScanKonstanzResultDTO,
  TenantContext,
} from "@/interfaces";
import { requirePermission } from "@/lib/auth/tenantContext";
import { actorFromTenant } from "@/lib/auth/actorContext";
import { badRequest, notFound, unprocessable } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/services/audit/auditService";
import { recordDutyCompletion } from "@/services/registration/recordDutyCompletion";
import type { SubmitScanKonstanzInput } from "@/schemas/k10";
import { assertDeviceInWorkAreas } from "@/services/users/userAreaScope";

function startOfTodayUtc(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

function isoDate(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

async function baselineDoneForDevice(deviceInstanceId: string, tenantId: string): Promise<boolean> {
  const baseline = await prisma.deviceDuty.findFirst({
    where: {
      deviceInstanceId,
      tenantId,
      setsBaseline: true,
      applicable: true,
      suspendedAt: null,
    },
    include: {
      performances: { take: 1, orderBy: { performedAt: "desc" } },
    },
  });
  return Boolean(baseline?.lastCompletedAt) || (baseline?.performances?.length ?? 0) > 0;
}

async function openCadenceExists(
  deviceInstanceId: string,
  constancyObjectCode: string,
): Promise<boolean> {
  const row = await prisma.constancyCadence.findFirst({
    where: {
      deviceInstanceId,
      constancyObjectCode,
      validTo: null,
    },
    select: { id: true },
  });
  return Boolean(row);
}

export async function deviceHasOpenKonstanz(deviceId: string): Promise<boolean> {
  const today = startOfTodayUtc();
  const due = await prisma.deviceDuty.findFirst({
    where: {
      deviceInstanceId: deviceId,
      dutyKey: "konstanz",
      applicable: true,
      suspendedAt: null,
      dueAt: { lte: today },
    },
    select: { id: true },
  });
  if (due) return true;

  const failed = await prisma.dutyPerformance.findFirst({
    where: {
      result: "failed",
      deviceDuty: {
        deviceInstanceId: deviceId,
        dutyKey: "konstanz",
        applicable: true,
        suspendedAt: null,
      },
    },
    orderBy: { performedAt: "desc" },
    select: { performedAt: true, deviceDutyId: true },
  });
  if (!failed) return false;
  const laterOk = await prisma.dutyPerformance.findFirst({
    where: {
      deviceDutyId: failed.deviceDutyId,
      performedAt: { gt: failed.performedAt },
      result: { in: ["passed", "passed_with_conditions"] },
    },
    select: { id: true },
  });
  return !laterOk;
}

export async function deriveKonstanzSperr(deviceId: string): Promise<{
  lage: "stop" | "warn";
  quelle: "konstanz";
  grund: string;
} | null> {
  const failed = await prisma.dutyPerformance.findFirst({
    where: {
      result: "failed",
      deviceDuty: {
        deviceInstanceId: deviceId,
        dutyKey: "konstanz",
        applicable: true,
        suspendedAt: null,
      },
    },
    orderBy: { performedAt: "desc" },
    select: {
      performedAt: true,
      deviceDutyId: true,
      note: true,
      deviceDuty: { select: { title: true, constancyObjectCode: true } },
    },
  });
  if (failed) {
    const laterOk = await prisma.dutyPerformance.findFirst({
      where: {
        deviceDutyId: failed.deviceDutyId,
        performedAt: { gt: failed.performedAt },
        result: { in: ["passed", "passed_with_conditions"] },
      },
      select: { id: true },
    });
    if (!laterOk) {
      const d = failed.performedAt.toISOString().slice(0, 10);
      const title = failed.deviceDuty.title ?? failed.deviceDuty.constancyObjectCode ?? "Konstanz";
      return {
        lage: "stop",
        quelle: "konstanz",
        grund: `Konstanzprüfung am ${d} nicht bestanden (${title})${failed.note ? `: ${failed.note}` : ""}`,
      };
    }
  }

  const today = startOfTodayUtc();
  const overdue = await prisma.deviceDuty.findFirst({
    where: {
      deviceInstanceId: deviceId,
      dutyKey: "konstanz",
      applicable: true,
      suspendedAt: null,
      dueAt: { lt: today },
    },
    orderBy: { dueAt: "asc" },
    select: { dueAt: true, title: true, constancyObjectCode: true },
  });
  if (overdue?.dueAt) {
    const title = overdue.title ?? overdue.constancyObjectCode ?? "Konstanz";
    return {
      lage: "warn",
      quelle: "konstanz",
      grund: `Konstanzprüfung überfällig seit ${isoDate(overdue.dueAt)} (${title})`,
    };
  }

  return null;
}

export const scanKonstanzService = {
  async listOpen(ctx: TenantContext, deviceId: string): Promise<ScanKonstanzOpenDTO> {
    requirePermission(ctx, "inventory:view");
    const device = await prisma.deviceInstance.findFirst({
      where: { id: deviceId },
      select: {
        id: true,
        inventoryNumber: true,
        areaId: true,
        model: { select: { tradeName: true, modelName: true } },
      },
    });
    if (!device) throw notFound("Device not found");
    await assertDeviceInWorkAreas(ctx, device.areaId);

    const today = startOfTodayUtc();
    const hasBaseline = await baselineDoneForDevice(deviceId, ctx.tenantId);
    const duties = await prisma.deviceDuty.findMany({
      where: {
        deviceInstanceId: deviceId,
        dutyKey: "konstanz",
        applicable: true,
        suspendedAt: null,
      },
      include: {
        constancyObject: { select: { label: true } },
        performances: {
          orderBy: { performedAt: "desc" },
          take: 1,
          select: { result: true, performedAt: true },
        },
      },
      orderBy: [{ dueAt: "asc" }, { title: "asc" }],
    });

    const items: ScanKonstanzItemDTO[] = [];
    for (const d of duties) {
      const last = d.performances[0] ?? null;
      const hasCadence =
        d.dueAt != null ||
        (d.constancyObjectCode
          ? await openCadenceExists(deviceId, d.constancyObjectCode)
          : false);

      let status: ScanKonstanzItemDTO["status"] = "ok";
      if (d.requiresBaseline && !hasBaseline) status = "baseline_missing";
      else if (!hasCadence || d.dueAt == null) status = "missing_cadence";
      else if (last?.result === "failed") status = "failed";
      else if (d.dueAt < today) status = "overdue";
      else if (isoDate(d.dueAt) === isoDate(today)) status = "due";
      else status = "ok";

      const canComplete =
        status === "due" || status === "overdue" || status === "failed";

      if (status === "ok") continue;

      items.push({
        dutyId: d.id,
        title: d.title ?? d.constancyObject?.label ?? d.dutyKey,
        constancyObjectCode: d.constancyObjectCode,
        constancyObjectLabel: d.constancyObject?.label ?? null,
        dueAt: isoDate(d.dueAt),
        status,
        canComplete,
        requiresBaseline: d.requiresBaseline,
        lastResult: last?.result ?? null,
        lastPerformedAt: isoDate(last?.performedAt ?? null),
        basisText: d.basisText,
      });
    }

    const label =
      device.model?.tradeName?.trim() ||
      device.model?.modelName?.trim() ||
      device.inventoryNumber;

    return {
      deviceId: device.id,
      inventoryNumber: device.inventoryNumber,
      label,
      performedAt: isoDate(today)!,
      items,
    };
  },

  async submit(
    ctx: TenantContext,
    deviceId: string,
    input: SubmitScanKonstanzInput,
  ): Promise<ScanKonstanzResultDTO> {
    requirePermission(ctx, "inventory:view");
    const open = await this.listOpen(ctx, deviceId);
    const item = open.items.find((i) => i.dutyId === input.dutyId);
    if (!item) throw notFound("Constancy duty not open on this device");
    if (!item.canComplete) {
      throw unprocessable(
        item.status === "missing_cadence"
          ? "Constancy takt must be determined before the check can be recorded."
          : item.status === "baseline_missing"
            ? "Baseline / acceptance must be recorded before constancy."
            : "This constancy duty cannot be completed yet.",
        { field: "dutyId", code: item.status },
      );
    }

    if (
      (input.result === "failed" || input.result === "passed_with_conditions") &&
      !input.note?.trim()
    ) {
      throw unprocessable("Note required for failed or conditional result.", { field: "note" });
    }

    const duty = await prisma.deviceDuty.findFirst({
      where: {
        id: input.dutyId,
        deviceInstanceId: deviceId,
        dutyKey: "konstanz",
        applicable: true,
        suspendedAt: null,
      },
    });
    if (!duty) throw notFound("Duty not found");

    const performedAt = input.performedAt
      ? new Date(`${input.performedAt}T12:00:00.000Z`)
      : startOfTodayUtc();
    if (Number.isNaN(performedAt.getTime())) {
      throw badRequest("Invalid performedAt date");
    }

    const { nextDue } = await prisma.$transaction(async (tx) =>
      recordDutyCompletion(tx, {
        tenantId: ctx.tenantId,
        duty,
        performedAt,
        performedBy: ctx.user.name,
        actorUserId: ctx.user.id,
        note: input.note?.trim() || null,
        source: "scan",
        result: input.result,
      }),
    );

    await recordAudit({
      actor: actorFromTenant(ctx),
      resource: "duty",
      resourceId: duty.id,
      action: "complete",
      summary: `Scan Konstanz ${item.title} → ${input.result}`,
    });

    return {
      deviceId,
      inventoryNumber: open.inventoryNumber,
      dutyId: duty.id,
      title: item.title,
      result: input.result,
      performedAt: isoDate(performedAt)!,
      nextDueAt: isoDate(nextDue),
      note: input.note?.trim() || null,
    };
  },
};

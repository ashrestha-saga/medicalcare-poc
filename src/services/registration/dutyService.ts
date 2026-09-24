import type { DeviceDutyDTO, DutyScheduleStatus, TenantContext } from "@/interfaces";
import { requirePermission } from "@/lib/auth/tenantContext";
import { notFound, unprocessable } from "@/lib/errors";
import { deriveMaintenanceStatus } from "@/lib/maintenance/schedule";
import { prisma } from "@/lib/prisma";
import { computeDutyDueAt } from "./dueDate";
import type { Prisma, PrismaClient } from "@prisma/client";

type DutyRow = {
  id: string;
  deviceInstanceId: string;
  dutyKey: string;
  inspectionTypeCode: string;
  title: string | null;
  basisText: string;
  deadlineAnchor: string;
  intervalValue: number | null;
  intervalUnit: string | null;
  cadenceLabel: string | null;
  applicable: boolean;
  notApplicableReason: string | null;
  referenceDate: Date;
  dueAt: Date | null;
  lastCompletedAt: Date | null;
  evidenceHint: string | null;
  confidence: string;
  deviceInstance?: {
    inventoryNumber: string;
    model: { tradeName: string | null } | null;
  };
};

function dutyStatus(row: { applicable: boolean; dueAt: Date | null }): DutyScheduleStatus {
  if (!row.applicable) return "n/a";
  return deriveMaintenanceStatus(row.dueAt);
}

export function toDutyDTO(row: DutyRow): DeviceDutyDTO {
  return {
    id: row.id,
    deviceInstanceId: row.deviceInstanceId,
    dutyKey: row.dutyKey,
    inspectionTypeCode: row.inspectionTypeCode,
    title: row.title ?? row.dutyKey,
    basisText: row.basisText,
    deadlineAnchor: row.deadlineAnchor,
    intervalValue: row.intervalValue,
    intervalUnit: row.intervalUnit,
    cadenceLabel: row.cadenceLabel,
    applicable: row.applicable,
    notApplicableReason: row.notApplicableReason,
    referenceDate: row.referenceDate.toISOString(),
    dueAt: row.dueAt?.toISOString() ?? null,
    lastCompletedAt: row.lastCompletedAt?.toISOString() ?? null,
    evidenceHint: row.evidenceHint,
    confidence: row.confidence,
    status: dutyStatus(row),
    inventoryNumber: row.deviceInstance?.inventoryNumber,
    tradeName: row.deviceInstance?.model?.tradeName ?? null,
  };
}

const dutyOrder = [{ applicable: "desc" as const }, { dueAt: "asc" as const }, { dutyKey: "asc" as const }];

export async function listDutiesForInstance(tenantId: string, deviceInstanceId: string): Promise<DeviceDutyDTO[]> {
  const rows = await prisma.deviceDuty.findMany({
    where: { tenantId, deviceInstanceId, suspendedAt: null },
    orderBy: dutyOrder,
  });
  return rows.map(toDutyDTO);
}

export function nextObligationDueAt(duties: DeviceDutyDTO[]): string | null {
  const dated = duties
    .filter((d) => d.applicable && d.dueAt)
    .map((d) => d.dueAt as string)
    .sort();
  return dated[0] ?? null;
}

function parsePerformedAt(raw: string | null | undefined): Date {
  if (!raw?.trim()) return new Date();
  const parsed = new Date(raw.trim());
  if (Number.isNaN(parsed.getTime())) {
    throw unprocessable("Invalid performed date.", { field: "performedAt" });
  }
  return parsed;
}

/** After instance-level "mark maintenance done", roll the open Wartung duty in the same tx. */
export async function syncWartungDutyOnComplete(
  tx: Prisma.TransactionClient,
  args: { tenantId: string; deviceInstanceId: string; performedAt: Date },
) {
  const wartung = await tx.deviceDuty.findFirst({
    where: {
      tenantId: args.tenantId,
      deviceInstanceId: args.deviceInstanceId,
      dutyKey: "wartung",
      suspendedAt: null,
      applicable: true,
    },
  });
  if (!wartung) return;
  await tx.deviceDuty.update({
    where: { id: wartung.id },
    data: {
      lastCompletedAt: args.performedAt,
      dueAt: computeDutyDueAt({
        deadlineAnchor: wartung.deadlineAnchor,
        referenceDate: wartung.referenceDate,
        lastCompletedAt: args.performedAt,
        intervalValue: wartung.intervalValue,
        intervalUnit: wartung.intervalUnit,
      }),
      notifyStage: null,
      lastNotifiedAt: null,
    },
  });
}

export const dutyService = {
  async listForDevice(ctx: TenantContext, deviceId: string): Promise<DeviceDutyDTO[]> {
    requirePermission(ctx, "inventory:view");
    const device = await prisma.deviceInstance.findFirst({
      where: { id: deviceId, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!device) throw notFound("Device not found.");
    return listDutiesForInstance(ctx.tenantId, deviceId);
  },

  async listDue(
    ctx: TenantContext,
    query?: { before?: Date; limit?: number },
  ): Promise<DeviceDutyDTO[]> {
    requirePermission(ctx, "inventory:view");
    const before = query?.before ?? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    const limit = Math.min(Math.max(query?.limit ?? 100, 1), 500);
    const rows = await prisma.deviceDuty.findMany({
      where: {
        tenantId: ctx.tenantId,
        applicable: true,
        suspendedAt: null,
        dueAt: { not: null, lte: before },
      },
      include: {
        deviceInstance: {
          select: { inventoryNumber: true, model: { select: { tradeName: true } } },
        },
      },
      orderBy: { dueAt: "asc" },
      take: limit,
    });
    return rows.map(toDutyDTO);
  },

  async complete(
    ctx: TenantContext,
    dutyId: string,
    input?: { performedAt?: string | null; note?: string | null },
  ): Promise<DeviceDutyDTO> {
    requirePermission(ctx, "inventory:update");
    const existing = await prisma.deviceDuty.findFirst({
      where: { id: dutyId, tenantId: ctx.tenantId },
    });
    if (!existing) throw notFound("Duty not found.");
    if (existing.suspendedAt) throw unprocessable("This duty was superseded by a later classification.");
    if (!existing.applicable) throw unprocessable("This duty is not applicable.");

    const performedAt = parsePerformedAt(input?.performedAt);
    const nextDue = computeDutyDueAt({
      deadlineAnchor: existing.deadlineAnchor,
      referenceDate: existing.referenceDate,
      lastCompletedAt: performedAt,
      intervalValue: existing.intervalValue,
      intervalUnit: existing.intervalUnit,
    });

    const updated = await prisma.$transaction(async (tx) => {
      const duty = await tx.deviceDuty.update({
        where: { id: existing.id },
        data: {
          lastCompletedAt: performedAt,
          dueAt: nextDue,
          notifyStage: null,
          lastNotifiedAt: null,
        },
      });

      await tx.deviceUnitEvent.create({
        data: {
          tenantId: ctx.tenantId,
          deviceInstanceId: existing.deviceInstanceId,
          actor: ctx.user.name,
          action: "duty_complete",
          note: [
            existing.title ?? existing.dutyKey,
            nextDue ? `next due ${nextDue.toISOString().slice(0, 10)}` : "no calendar due",
            input?.note?.trim() || null,
          ]
            .filter(Boolean)
            .join(" — "),
        },
      });

      if (existing.dutyKey === "wartung") {
        const instance = await tx.deviceInstance.findFirst({
          where: { id: existing.deviceInstanceId, tenantId: ctx.tenantId },
        });
        if (instance) {
          const cycleMonths =
            existing.intervalUnit === "months"
              ? existing.intervalValue
              : existing.intervalUnit === "years" && existing.intervalValue != null
                ? existing.intervalValue * 12
                : instance.maintenanceCycleMonths;
          await tx.deviceInstance.update({
            where: { id: instance.id },
            data: {
              lastMaintainedAt: performedAt,
              nextMaintenanceDueAt: nextDue,
              ...(cycleMonths != null ? { maintenanceCycleMonths: cycleMonths } : {}),
            },
          });
          await tx.maintenanceEvent.create({
            data: {
              tenantId: ctx.tenantId,
              deviceInstanceId: instance.id,
              kind: "completed",
              performedAt,
              previousDueAt: existing.dueAt,
              nextDueAt: nextDue,
              cycleMonths: cycleMonths ?? null,
              note: input?.note?.trim() || null,
              actorUserId: ctx.user.id,
            },
          });
        }
      }

      return duty;
    });

    return toDutyDTO(updated);
  },

  /** Recompute dueAt for rows written before the column existed. Safe to re-run. */
  async backfillDueDates(db: Pick<PrismaClient, "deviceDuty"> = prisma): Promise<number> {
    const rows = await db.deviceDuty.findMany({
      select: {
        id: true,
        deadlineAnchor: true,
        referenceDate: true,
        lastCompletedAt: true,
        intervalValue: true,
        intervalUnit: true,
      },
    });
    let updated = 0;
    for (const row of rows) {
      const dueAt = computeDutyDueAt(row);
      await db.deviceDuty.update({ where: { id: row.id }, data: { dueAt } });
      updated += 1;
    }
    return updated;
  },
};
